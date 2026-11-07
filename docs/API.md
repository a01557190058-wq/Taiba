# مرجع واجهة REST

القاعدة: `http://127.0.0.1:3000` في التطوير، أو أصل النشر في الإنتاج.

## الغلاف العام

استجابة ناجحة:

```json
{
  "data": {},
  "meta": {}
}
```

استجابة خطأ:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "رسالة عربية مناسبة",
    "fields": {
      "phone": "رقم الهاتف مطلوب."
    }
  }
}
```

- `fields` يظهر فقط في أخطاء التحقق.
- لا تُعاد آثار المكدس أو تفاصيل داخلية للعميل.
- جميع التواريخ بصيغة ISO 8601 وبتوقيت UTC.

## المصادقة و CSRF

1. أي طلب إلى صفحة أو واجهة يعيد كوكي `taiba.csrf` (غير `HttpOnly`).
2. أرسل قيمته في الرأس `x-csrf-token` مع كل `POST` أو `PATCH` أو `PUT` أو `DELETE`.
3. بعد `POST /api/auth/login` يُنشأ كوكي جلسة `taiba.sid` (`HttpOnly`).
4. الجلسة تُخزَّن على الخادم في SQLite، ويمكن إبطالها بـ `POST /api/auth/logout`.

كل مسارات `/api/admin/*` تتطلب جلسة إدارية صالحة، ثم رمز CSRF صالحًا للطلبات المغيّرة للحالة.

## الترقيم والفلاتر

مسارات القوائم الإدارية تقبل:

| المعامل | القيمة |
| --- | --- |
| `page` | رقم الصفحة، يبدأ من 1 |
| `limit` | عدد العناصر، بحد أقصى 100 |
| `q` | بحث نصي |
| `state` | `published` أو `draft` أو `archived` (للأقسام) |
| `status` | `NEW` أو `UNDER_REVIEW` أو `ACCEPTED` أو `REJECTED` (للطلبات) |
| `department_id` | معرف قسم |
| `is_demo` | `true` أو `false` |
| `sort` | `newest` أو `oldest` (للطلبات) |

شكل `meta` في القوائم الإدارية:

```json
{
  "total": 18,
  "page": 1,
  "limit": 10,
  "totalPages": 2,
  "hasNext": true,
  "hasPrev": false
}
```

---

## المسارات العامة

### `GET /api/health`

```json
{ "data": { "status": "ok", "time": "2026-11-01T12:00:00.000Z" } }
```

### `GET /api/departments`

يعيد الأقسام المنشورة والنشطة فقط، مرتبة بـ `sort_order` ثم `id`.

```json
{
  "data": [
    {
      "id": 1,
      "name": "قسم البرمجة",
      "slug": "programming",
      "short_description": "...",
      "image_url": "/assets/img/departments/programming.svg",
      "sort_order": 10,
      "skills": "HTML\nCSS\nJavaScript"
    }
  ],
  "meta": { "total": 10 }
}
```

### `GET /api/departments/:slug`

يعيد قسمًا منشورًا ونشطًا فقط. غير المتاح يعيد `404 DEPARTMENT_NOT_FOUND`.

### `GET /api/news`

يعيد الأخبار المنشورة فقط، مرتبة بالأخبار المميزة ثم تاريخ النشر. يقبل:

- `q`: بحث في العنوان والملخص والنص.
- `category`: تصفية حسب التصنيف.
- `featured=true`: الأخبار المميزة فقط.
- `page` و`limit` (الحد الأقصى 30).

```json
{
  "data": [
    {
      "id": 1,
      "title": "انطلاق أسبوع المشروعات التطبيقية",
      "slug": "demo-projects-week",
      "summary": "...",
      "category": "أنشطة",
      "image_url": "/assets/img/departments/programming.svg",
      "is_featured": true,
      "published_at": "2026-10-20T09:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 9,
    "total": 6,
    "hasNext": false,
    "categories": [{ "name": "أنشطة", "count": 2 }]
  }
}
```

### `GET /api/news/:slug`

يعيد خبرًا منشورًا مع حقل `related` يحتوي حتى 3 أخبار ذات صلة، وحقل `media` لوسائط الخبر (صور المعرض وروابط الفيديو). غير المنشور أو غير الموجود يعيد `404 NOT_FOUND`.

```json
{
  "data": {
    "id": 1,
    "title": "...",
    "slug": "...",
    "image_url": "/assets/uploads/news/1699999999-abc123.jpg",
    "media": [
      {
        "id": 10,
        "type": "image",
        "url": "/assets/uploads/news/1699999999-def456.jpg",
        "caption": "صورة من النشاط",
        "sort_order": 0,
        "provider": null,
        "embed_url": null
      },
      {
        "id": 11,
        "type": "video",
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "caption": "ملخص الفعالية",
        "sort_order": 1,
        "provider": "youtube",
        "embed_url": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
      }
    ],
    "related": []
  }
}
```

- `image_url` يُستخدم كصورة غلاف. إن تُرك فارغًا، يُستخدم أول ملف صورة في `media` تلقائيًا.
- `provider` أحد `youtube` أو `vimeo` أو `file`، و`embed_url` متاح لمزوّدي الفيديو المضمّن فقط.
- الفيديو يُقبل برابط فقط: YouTube أو Vimeo أو ملف MP4/WebM/OGG/MOV مباشر.

### `GET /api/school-content`

```json
{
  "data": {
    "content": { "hero_subtitle": "...", "vision": "..." },
    "faqs": [{ "id": 1, "question": "...", "answer": "..." }],
    "objectives": ["...", "..."],
    "admission_steps": ["...", "..."]
  }
}
```

### `POST /api/applications`

يتطلب CSRF وحدًا معدلًا للطلبات (5 محاولات لكل 15 دقيقة افتراضيًا).

```json
{
  "full_name": "أحمد محمد",
  "phone": "01012345678",
  "email": "ahmed@example.com",
  "department_id": 1,
  "previous_education": "ثانوية عامة",
  "additional_notes": "ملاحظات اختيارية",
  "consent": true
}
```

قواعد مهمة:

- `full_name`: 3–100 حرفًا، حروف ومسافات ورموز اسم محدودة.
- `phone`: 7–15 رقمًا، وتُطبَّع الأرقام العربية الهندية إلى لاتينية.
- `email`: اختياري، 120 حرفًا كحد أقصى.
- `department_id`: قسم منشور ونشط فقط.
- `consent`: يجب أن تكون `true`.
- منع التكرار: نفس رقم الهاتف + نفس القسم خلال 24 ساعة يعيد `409 DUPLICATE_APPLICATION`.

الاستجابة `201`:

```json
{
  "data": {
    "reference_number": "TBS-2026-AB12CD",
    "full_name": "أحمد محمد",
    "department_name": "قسم البرمجة",
    "status": "NEW",
    "status_label": "جديد",
    "submitted_at": "2026-11-01T12:00:00.000Z",
    "message": "تم تسجيل طلبك بنجاح..."
  }
}
```

لا تُعاد الملاحظات الإدارية ولا المعرفات الداخلية في هذه الاستجابة.

---

## المصادقة

### `POST /api/auth/login`

```json
{ "identifier": "admin@taiba.demo", "password": "••••••••" }
```

`identifier` يقبل البريد الإلكتروني أو اسم المستخدم (غير حساس لحالة الأحرف). الاستجابة `200` تعيد بيانات المدير العامة فقط. المحاولات الفاشلة تعيد `401 INVALID_CREDENTIALS` بعدد محدد لكل نافذة زمنية.

### `GET /api/auth/me`

يعيد `{ "data": { "admin": { ... } } }` عند وجود جلسة، و`401 UNAUTHORIZED` بخلاف ذلك.

### `POST /api/auth/logout`

يتطلب CSRF، ويدمّر الجلسة ويمسح الكوكي.

---

## مسارات الإدارة

### الإحصاءات

`GET /api/admin/dashboard/stats`

```json
{
  "data": {
    "applications": { "total": 10, "demo": 8, "real": 2, "by_status": { "NEW": 5 } },
    "departments": { "total": 10, "published": 10, "draft": 0, "archived": 0 },
    "recent_applications": [],
    "generated_at": "2026-11-01T12:00:00.000Z"
  }
}
```

### الأقسام

- `GET /api/admin/departments` — قائمة كاملة مع `q` و`state` و`is_demo` والترقيم.
- `POST /api/admin/departments` — الحقول: `name`، `slug` (اختياري)، `short_description`، `description`، `educational_focus`، `skills`، `admission_info`، `image_url`، `is_published`، `is_active`، `sort_order`.
- `GET /api/admin/departments/:id` — بيانات قسم واحد.
- `PATCH /api/admin/departments/:id` — أي مجموعة من الحقول أعلاه.
- `DELETE /api/admin/departments/:id` — يُرفض بـ `409 DEPARTMENT_HAS_APPLICATIONS` إذا كان للقسم طلبات. أضف `?force=true` لحذف القسم وطلباته معًا داخل معاملة واحدة بعد تأكيد كتابي في الواجهة.

قواعد الحقول:

- `name`: 2–120 حرفًا.
- `short_description`: 10–300 حرفًا.
- `description`: 30–6000 حرف.
- `slug`: حروف وأرقام وشرطات، 2–140 حرفًا، ويُشتق من الاسم إن تُرك فارغًا.
- `image_url`: مسار محلي يبدأ بـ `/` أو رابط `http(s)://`، بحد 500 حرف.
- `sort_order`: عدد صحيح 0–9999.

### الطلبات

- `GET /api/admin/applications` — لا يعيد الملاحظات الإدارية في القائمة.
- `GET /api/admin/applications/:id` — يعيد التفاصيل كاملة بما فيها `admin_notes`.
- `PATCH /api/admin/applications/:id/status` — `{ "status": "NEW" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED" }`.
- `PATCH /api/admin/applications/:id/notes` — `{ "admin_notes": "..." }` بحد 2000 حرف.
- `DELETE /api/admin/applications/:id` — حذف نهائي لأي طلب، تجريبي أو حقيقي، بعد تأكيد كتابي في الواجهة. يعيد `{ "id", "reference_number", "was_demo" }`.
- `GET /api/admin/applications/export.csv` — يقبل نفس فلاتر القائمة، ويعيد `text/csv` مع BOM ليتوافق مع Excel العربي.

### المحتوى والأسئلة

- `GET /api/admin/school-content` — يعيد `content` و`definitions` (المفاتيح المسموحة وحدودها) و`faqs`.
- `PATCH /api/admin/school-content` — كائن `{ "key": "value" }`؛ تُرفض المفاتيح غير المعروفة.
- `POST /api/admin/school-content/faqs` — `question` (5–300)، `answer` (5–2000)، `sort_order`، `is_published`.
- `PATCH /api/admin/school-content/faqs/:id` — أي مجموعة من حقول السؤال.
- `DELETE /api/admin/school-content/faqs/:id` — حذف سؤال.

المحتوى يُخزَّن ويُعرض كنص عادي فقط؛ لا يوجد مسار لتنفيذ HTML.

### الأخبار

- `GET /api/admin/news` — قائمة كاملة مع `q` و`state` (`published` / `draft` / `featured`) و`is_demo` والترقيم.
- `POST /api/admin/news` — الحقول: `title`، `slug` (اختياري)، `summary`، `body`، `category`، `image_url`، `media`، `is_published`، `is_featured`، `published_at`، `sort_order`.
- `POST /api/admin/news/uploads` — رفع صور بصيغة `multipart/form-data` تحت الحقل `images` (حتى 6 ملفات في الطلب).
- `GET /api/admin/news/:id` — بيانات خبر واحد مع `media`.
- `PATCH /api/admin/news/:id` — أي مجموعة من الحقول أعلاه؛ عند إرسال `media` تُستبدل القائمة كاملة.
- `DELETE /api/admin/news/:id` — حذف نهائي لأي خبر، تجريبي أو حقيقي، مع حذف ملفاته المرفوعة غير المستخدمة.

`media` مصفوفة عناصر بالشكل التالي (حتى 20 عنصرًا: 12 صورة و8 فيديوهات كحد أقصى):

```json
{
  "type": "image",
  "url": "/assets/uploads/news/1699999999-abc123.jpg",
  "caption": "وصف اختياري",
  "sort_order": 0
}
```

- `type`: `image` أو `video`.
- `url`: للصورة مسار محلي يبدأ بـ `/` أو رابط `http(s)://`؛ للفيديو رابط YouTube/Vimeo أو ملف فيديو مباشر.
- `caption`: اختياري حتى 200 حرف.
- `sort_order`: عدد صحيح يحدد ترتيب العرض.

استجابة الرفع:

```json
{
  "data": {
    "files": [
      {
        "url": "/assets/uploads/news/1699999999-abc123.jpg",
        "name": "photo.jpg",
        "size": 48213,
        "mime": "image/jpeg"
      }
    ]
  }
}
```

قيود الرفع: JPG/PNG/WebP/GIF فقط (SVG مرفوض)، و5 ميجابايت لكل صورة. تُولَّد أسماء الملفات على الخادم ولا يُستخدم اسم العميل. الملفات المرفوعة تُخزَّن في `uploads/news/` في جذر المشروع افتراضيًا وتُقدَّم على `/assets/uploads/news/...`، ويمكن تغيير المجلد بـ `NEWS_UPLOADS_DIR`.

قواعد الحقول:

- `title`: 3–160 حرفًا، و`slug` يُشتق منه إن تُرك فارغًا.
- `summary`: 10–500 حرف.
- `body`: 20–12000 حرف، ويُعرض كنص عادي.
- `category`: اختياري حتى 80 حرفًا.
- `slug`: فريد؛ التعارض يعيد `409 SLUG_TAKEN`.
- `published_at`: تاريخ ISO اختياري؛ يُستخدم وقت الحفظ إن تُرك فارغًا.
- `sort_order`: عدد صحيح 0–9999.

### البيانات التجريبية

- `GET /api/admin/demo-data` — ملخص العدادات وقوائم السجلات التجريبية.
- `POST /api/admin/demo-data/seed` — إضافة الناقص فقط، آمنة وقابلة للتكرار.
- `POST /api/admin/demo-data/reset` — يتطلب `{ "confirm": "RESET_DEMO_DATA" }`.
- `POST /api/admin/demo-data/cleanup` — يتطلب `{ "confirm": "DELETE_DEMO_DATA" }`.

`reset` يحذف السجلات التجريبية ثم يعيد إنشاءها. القسم التجريبي المرتبط بطلب حقيقي يُؤرشف أثناء الحذف ثم يُعاد نشره تلقائيًا. عمليات البيانات التجريبية لا تحذف أي سجل حقيقي.

---

## رموز الأخطاء الشائعة

| الرمز | الحالة | المعنى |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | حقول غير صالحة، مع `fields` |
| `UNAUTHORIZED` | 401 | لا جلسة إدارية |
| `INVALID_CREDENTIALS` | 401 | بيانات دخول خاطئة |
| `CSRF_INVALID` | 403 | رمز CSRF مفقود أو غير صالح |
| `FORBIDDEN` | 403 | صلاحية غير كافية |
| `NOT_FOUND` | 404 | المورد غير موجود |
| `DUPLICATE_APPLICATION` | 409 | طلب مكرر خلال 24 ساعة |
| `DEPARTMENT_HAS_APPLICATIONS` | 409 | قسم له طلبات؛ أعد المحاولة مع `?force=true` للحذف الكامل |
| `SLUG_TAKEN` | 409 | معرّف الخبر أو القسم مستخدم بالفعل |
| `RATE_LIMITED` | 429 | تجاوز حد المحاولات |
| `INTERNAL_ERROR` | 500 | خطأ غير متوقع برسالة آمنة |
