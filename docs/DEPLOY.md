# دليل النشر — Render و Railway

هذا الدليل ينشر الموقع ولوحة التحكم على استضافة Node.js دائمة. المشروع يستخدم SQLite كملف، لذلك **القرص الدائم إلزامي**: بدونه تُفقد الأقسام والطلبات وحساب المدير عند كل إعادة نشر أو إعادة تشغيل.

---

## قبل البدء

| المتطلب | السبب |
| --- | --- |
| مستودع GitHub محدّث | المنصتان تنشران من GitHub مباشرة |
| حساب على Render أو Railway | إنشاء الخدمة |
| خطة مدفوعة (اختياري) | لازمة فقط لحفظ البيانات دائمًا؛ الخطة المجانية تعمل بدونها |
| Node.js 22.13+ | وحدة `node:sqlite` المدمجة |

الملفات الجاهزة في المشروع:

- `render.yaml` — وصف كامل لخدمة Render (بناء، تشغيل، فحص صحة، قرص، متغيرات).
- `railway.toml` — أوامر البناء والتشغيل على Railway.
- `.node-version` — يثبّت Node.js 24.
- `backend/package-lock.json` — يستخدمه `npm ci` لبناء قابل للتكرار.
- `frontend/package-lock.json` — يثبّت اعتماديات React/Vite لبناء الواجهة.
- `frontend/vite.config.js` — يبني الموقع العام ولوحة التحكم إلى `frontend/dist`، وهو ما يقدّمه Express.

---

## متغيرات البيئة المطلوبة

| المتغير | القيمة | ملاحظات |
| --- | --- | --- |
| `NODE_ENV` | `production` | يفعّل HSTS وكوكي `Secure` ورسائل أخطاء آمنة |
| `HOST` | `0.0.0.0` | **مهم**: بدونها لن تصل المنصة إلى الخادم |
| `PORT` | يوفّرها مزوّد الاستضافة | لا تضبطها يدويًا إلا عند الحاجة |
| `TRUST_PROXY` | `true` | لأن المنصة تعمل خلف وكيل HTTPS |
| `DB_PATH` | `/var/data/taiba.sqlite` | داخل القرص الدائم، أو `./data/taiba.sqlite` على الخطة المجانية |
| `SEED_DEMO_ON_EMPTY` | `false` | اجعله `true` فقط على الخطة المجانية بلا قرص |
| `SESSION_SECRET` | سر عشوائي طويل | إلزامي في الإنتاج |
| `ADMIN_USERNAME` | `admin` أو اسم تختاره | 3 أحرف على الأقل |
| `ADMIN_EMAIL` | بريدك الحقيقي | يُستخدم لتسجيل الدخول |
| `ADMIN_PASSWORD` | كلمة مرور قوية | 10 أحرف على الأقل |
| `APP_ORIGIN` | `https://your-domain` | نفس رابط الموقع بعد النشر |
| `ALLOWED_ORIGINS` | فارغ عادةً | أصول إضافية فقط عند الحاجة |
| `NEWS_UPLOADS_DIR` | `/var/data/uploads/news` | احفظ صور الأخبار على القرص الدائم؛ الافتراضي `uploads/news` داخل المشروع |

توليد سر جلسة:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## النشر على Render

### الطريقة السريعة: Blueprint

1. ارفع المشروع إلى GitHub.
2. افتح <https://dashboard.render.com> ثم **New → Blueprint**.
3. اختر المستودع. سيقرأ Render ملف `render.yaml` تلقائيًا.
4. املأ القيم المطلوبة:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD` (10 أحرف على الأقل)
   - `APP_ORIGIN` يمكن تركه فارغًا الآن وضبطه بعد النشر.
5. اضغط **Apply** وانتظر انتهاء البناء والنشر.
6. بعد ظهور الرابط، افتح **Environment** واضبط:
   ```text
   APP_ORIGIN = https://<اسم-الخدمة>.onrender.com
   ```
   ثم أعد النشر (**Manual Deploy → Deploy latest commit**).

### الطريقة اليدوية

لو لم يعمل Blueprint لأي سبب:

1. **New → Web Service** واختر المستودع.
2. الإعدادات:
   ```text
   Runtime:        Node
   Build Command:  cd frontend && npm ci && npm run build && cd ../backend && npm ci --omit=dev
   Start Command:  cd backend && npm run admin:init && npm start
   Health Check:   /api/health
   ```
3. أضف **Disk**:
   ```text
   Name:       taiba-data
   Mount Path: /var/data
   Size:       1 GB
   ```
4. أضف متغيرات البيئة من الجدول أعلاه.
5. انشر الخدمة.

> الخطة المجانية على Render لا تدعم الأقراص. لطريقة النشر المجاني بدون قرص راجع القسم التالي، وللحفظ الدائم استخدم `Starter` أو أعلى أو Railway.

---

## النشر على الخطة المجانية (بدون قرص دائم)

ملف `render.yaml` الحالي مضبوط على `plan: free`. الخطة المجانية لا توفّر قرصًا دائمًا، لذلك:

- قاعدة البيانات تُنشأ داخل مجلد التطبيق (`DB_PATH=./data/taiba.sqlite`).
- أي إعادة نشر أو إعادة تشغيل تعيد الملف إلى الصفر، فتُفقد الطلبات والأقسام التي أضفتها.
- المتغير `SEED_DEMO_ON_EMPTY=true` يعيد ملء البيانات التجريبية تلقائيًا عند إقلاع قاعدة فارغة، حتى لا تظهر الصفحات العامة خالية.
- الخدمة تنام بعد 15 دقيقة بلا زيارات، وأول زيارة بعدها تستغرق نحو دقيقة حتى تستيقظ.

هذا مناسب لعرض الموقع ومشاركة الرابط، وغير مناسب لاستقبال طلبات حقيقية. عند الحاجة إلى حفظ البيانات:

1. غيّر `plan: free` إلى `plan: starter` في `render.yaml`.
2. أضف القرص:
   ```yaml
   disk:
     name: taiba-data
     mountPath: /var/data
     sizeGB: 1
   ```
3. غيّر `DB_PATH` إلى `/var/data/taiba.sqlite`، واحذف `SEED_DEMO_ON_EMPTY` أو اجعله `false`.
4. أعد النشر.

---


## النشر على Railway

1. افتح <https://railway.app> ثم **New Project → Deploy from GitHub repo**.
2. اختر المستودع. سيستخدم Railway ملف `railway.toml`.
3. أضف **Volume** من إعدادات الخدمة:
   ```text
   Mount Path: /var/data
   ```
4. أضف متغيرات البيئة من الجدول أعلاه (بما فيها `DB_PATH=/var/data/taiba.sqlite` و`HOST=0.0.0.0` و`TRUST_PROXY=true` و`SESSION_SECRET`).
5. من **Settings → Networking** اضغط **Generate Domain** للحصول على رابط عام.
6. اضبط `APP_ORIGIN` على الرابط الناتج وأعد النشر.

> Railway يوفّر HTTPS تلقائيًا. لا تضبط `PORT`؛ Railway يمرّره للخادم.

---

## بعد أول نشر

### 1. إنشاء حساب المدير

أمر التشغيل يتضمن `npm run admin:init`، لذلك يُنشأ الحساب تلقائيًا عند أول إقلاع:

- إذا ضبطت `ADMIN_PASSWORD`، فسيُستخدم كما هو.
- إذا تركته فارغًا، تُولَّد كلمة مرور وتُطبع **مرة واحدة** في سجلات النشر (Logs). ابحث عن:
  ```text
  كلمة المرور التي تم توليدها (تُعرض مرة واحدة فقط)
  ```

لا توجد صفحة لتغيير كلمة المرور داخل لوحة التحكم في هذه النسخة. لتغييرها استخدم Shell المنصة:

```bash
cd backend
ADMIN_PASSWORD='كلمة-مرور-جديدة-قوية' npm run admin:init -- --force
```

### 2. إضافة البيانات التجريبية (اختياري)

البيانات التجريبية لا تُضاف تلقائيًا. بعد تسجيل الدخول:

- افتح **لوحة التحكم → البيانات التجريبية**.
- اضغط **إضافة البيانات التجريبية**.

أو من Shell المنصة:

```bash
cd backend
npm run db:seed
```

### 3. تنظيف ما قبل الإطلاق الرسمي

- غيّر اسم المستخدم والبريد وكلمة المرور.
- احذف البيانات التجريبية من صفحة **البيانات التجريبية**.
- عدّل نصوص الموقع والأسئلة من صفحة **المحتوى والأسئلة**.
- أنشئ الأقسام الحقيقية أو حرّر الأقسام التجريبية.
- تأكد من ظهور أرقام التواصل الرسمية فقط.

---

## النطاق المخصص (Custom Domain)

### Render

**Settings → Custom Domains → Add Custom Domain**، ثم أضف السجل الذي يعرضه Render في DNS:

- `CNAME` يشير إلى `onrender.com` للنطاق الفرعي.
- أو `A`/`ALIAS` حسب تعليمات المنصة للنطاق الجذري.

بعد التحقق، حدّث `APP_ORIGIN` إلى النطاق الجديد وأعد النشر.

### Railway

**Settings → Networking → Custom Domain**، ثم أضف سجل `CNAME` كما يعرضه Railway. حدّث `APP_ORIGIN` وأعد النشر.

---

## النسخ الاحتياطي

قاعدة البيانات ملف واحد داخل القرص الدائم:

```text
/var/data/taiba.sqlite
/var/data/taiba.sqlite-wal
/var/data/taiba.sqlite-shm
```

### نسخة متسقة دون إيقاف الخدمة

SQLite يدعم `VACUUM INTO` لإنشاء نسخة نظيفة:

```bash
cd backend
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.env.DB_PATH);db.exec(\"VACUUM INTO '/var/data/backup.sqlite'\");db.close()"
```

ثم نزّل `backup.sqlite` من Shell المنصة أو انسخه إلى تخزين خارجي.

### قواعد مهمة

- لا تنسخ الملف أثناء كتابة نشطة دون `VACUUM INTO` أو إيقاف الخدمة.
- احتفظ بنسخة خارج المنصة (S3، Google Drive، جهازك) وليس على القرص نفسه فقط.
- اختبر استعادة النسخة على قاعدة محلية قبل الاعتماد عليها.
- جدول نسخة يومية على الأقل.

---

## حل المشكلات

| المشكلة | السبب المحتمل | الحل |
| --- | --- | --- |
| `502 Bad Gateway` | الخادم لا يستمع على العنوان الصحيح | `HOST=0.0.0.0` وعدم تثبيت `PORT` يدويًا |
| فشل البناء | Node أقدم من 22.13 | `NODE_VERSION=24` أو ملف `.node-version` |
| `Cannot find module 'node:sqlite'` | إصدار Node قديم | استخدم Node 24 |
| البيانات تختفي بعد كل نشر | لا يوجد قرص دائم أو `DB_PATH` خاطئ | أضف Disk/Volume واضبط `DB_PATH=/var/data/taiba.sqlite` |
| تسجيل الدخول يعيد الصفحة للدخول | كوكي `Secure` لا يُرسل | استخدم HTTPS، واضبط `TRUST_PROXY=true` و`APP_ORIGIN` |
| `SESSION_SECRET must be set` | المتغير غير موجود | أضف `SESSION_SECRET` في الإنتاج |
| `database is locked` | أكثر من نسخة تعمل على نفس الملف | شغّل نسخة واحدة فقط (Instance Count = 1) |
| لا يوجد حساب إداري | فشل `admin:init` | راجع Logs ثم شغّل `cd backend && npm run admin:init` |
| الموقع يفتح لكن بلا أقسام | لم تُضف البيانات التجريبية أو الأقسام | أضفها من لوحة التحكم |

### قراءة السجلات

- **Render:** الخدمة → **Logs**.
- **Railway:** الخدمة → **Deployments → View Logs**.

---

## قائمة تحقق أمنية قبل الإطلاق

- [ ] `NODE_ENV=production`.
- [ ] `SESSION_SECRET` عشوائي وطويل.
- [ ] HTTPS يعمل والنطاق المخصص متصل.
- [ ] `TRUST_PROXY=true` خلف وكيل المنصة.
- [ ] `APP_ORIGIN` يطابق النطاق الفعلي.
- [ ] كلمة مرور المدير قوية ومختلفة عن أي كلمة تجريبية.
- [ ] البيانات التجريبية محذوفة.
- [ ] نسخة احتياطية مجدولة ومختبرة.
- [ ] نسخة واحدة فقط من الخدمة (SQLite بكاتب واحد).
- [ ] مراجعة السجلات وتنبيهات الأخطاء.

---

## ملاحظات معمارية

- لا تستخدم التوسع الأفقي (أكثر من نسخة) مع SQLite؛ استخدم PostgreSQL لاحقًا إن احتجت ذلك.
- المنصة تتولى TLS؛ لا تشغّل HTTP خامًا في الإنتاج.
- لا ترفع `backend/.env` أو ملفات `database/*.sqlite` إلى GitHub؛ `.gitignore` يمنعها بالفعل.
- الخطط المجانية قد تُوقف الخدمة عند عدم الاستخدام؛ هذا يؤثر على توفر الموقع لا على البيانات إن وُجد قرص دائم.
