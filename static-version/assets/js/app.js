/* Taiba static version — vanilla JS behaviours.
   No framework, no build step, no network requests. */
(function () {
  'use strict';

  var D = window.TAIBA || {};
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function countFor(dept) {
    var row = (D.studentCounts && D.studentCounts[dept.slug]) || {};
    var male = Number(row.male || 0);
    var female = Number(row.female || 0);
    return { male: male, female: female, total: male + female };
  }

  function studentTotals() {
    var totals = { male: 0, female: 0, total: 0 };
    (D.departments || []).forEach(function (dept) {
      var count = countFor(dept);
      totals.male += count.male;
      totals.female += count.female;
      totals.total += count.total;
    });
    return totals;
  }

  /* ---------- editable text + derived stats ---------- */
  function initContent() {
    var text = D.content || {};
    var map = {
      '[data-content="accreditation"]': text.accreditation,
      '[data-content="vision"]': text.vision,
      '[data-content="mission"]': text.mission
    };
    Object.keys(map).forEach(function (selector) {
      $$(selector).forEach(function (el) {
        if (map[selector]) el.textContent = map[selector];
      });
    });

    var totals = studentTotals();
    $$('[data-students-total]').forEach(function (el) {
      el.setAttribute('data-count', String(totals.total));
    });
    $$('[data-students-male]').forEach(function (el) { el.textContent = formatNumber(totals.male); });
    $$('[data-students-female]').forEach(function (el) { el.textContent = formatNumber(totals.female); });
  }

  /* ---------- shared chrome ---------- */
  function initChrome() {
    var header = $('.site-header');
    var toggle = $('.nav-toggle');
    var nav = $('.nav-links');
    var progress = $('.scroll-progress');

    function onScroll() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? window.scrollY / max : 0;
      if (header) header.classList.toggle('is-scrolled', window.scrollY > 12);
      if (progress) document.documentElement.style.setProperty('--scroll', (ratio * 100).toFixed(2) + '%');
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      $$('a', nav).forEach(function (link) {
        link.addEventListener('click', function () {
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    var path = window.location.pathname.split('/').pop() || 'index.html';
    $$('.nav-links a[href]').forEach(function (link) {
      var target = link.getAttribute('href').split('/').pop() || 'index.html';
      if (target === path) link.setAttribute('aria-current', 'page');
    });

    $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  }

  /* ---------- scroll reveals ---------- */
  function initReveals() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = Number(el.getAttribute('data-delay') || 0) * 90;
        window.setTimeout(function () { el.classList.add('is-visible'); }, delay);
        observer.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- tilt cards + magnetic buttons ---------- */
  function initPointerEffects() {
    if (reduce || window.matchMedia('(hover: none)').matches) return;
    $$('[data-tilt]').forEach(function (card) {
      card.addEventListener('pointermove', function (event) {
        var rect = card.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - 0.5;
        var y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty('--tilt-x', x.toFixed(3));
        card.style.setProperty('--tilt-y', y.toFixed(3));
      });
      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--tilt-x', '0');
        card.style.setProperty('--tilt-y', '0');
      });
    });
    $$('[data-magnetic]').forEach(function (button) {
      button.addEventListener('pointermove', function (event) {
        var rect = button.getBoundingClientRect();
        var x = (event.clientX - rect.left - rect.width / 2) * 0.18;
        var y = (event.clientY - rect.top - rect.height / 2) * 0.18;
        button.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      button.addEventListener('pointerleave', function () { button.style.transform = ''; });
    });
  }

  /* ---------- animated counters ---------- */
  function initCounters() {
    var counters = $$('[data-count]');
    if (!counters.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      counters.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = Number(el.getAttribute('data-count')) || 0;
        var suffix = el.getAttribute('data-suffix') || '';
        var duration = 1100;
        var start = performance.now();
        function tick(now) {
          var p = Math.min((now - start) / duration, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- department card markup ---------- */
  function departmentCard(dept, index) {
    return '<article class="card reveal" data-tilt data-delay="' + (index % 6) + '">' +
      '<div class="card__media"><img src="' + escapeHtml(dept.image) + '" alt="' + escapeHtml(dept.name) + '" loading="lazy"></div>' +
      '<div class="card__body">' +
        '<h3>' + escapeHtml(dept.name) + '</h3>' +
        '<p>' + escapeHtml(dept.short) + '</p>' +
        '<span class="card-students">عدد الطلاب: ' + formatNumber(countFor(dept).total) + '</span>' +
        '<a class="card-link" href="department.html?slug=' + encodeURIComponent(dept.slug) + '">التفاصيل والمهارات ←</a>' +
      '</div>' +
    '</article>';
  }

  function initDepartments() {
    var grid = $('#department-grid');
    if (!grid || !D.departments) return;
    var filters = $('#department-filters');
    var count = $('#department-count');

    function render(category) {
      var list = category === 'all' ? D.departments : D.departments.filter(function (d) { return d.category === category; });
      grid.innerHTML = list.map(departmentCard).join('');
      if (count) count.textContent = list.length + ' تخصص متاح';
      initReveals();
      initPointerEffects();
    }

    if (filters && D.categories) {
      filters.innerHTML = D.categories.map(function (cat, i) {
        return '<button class="filter-btn' + (i === 0 ? ' is-active' : '') + '" type="button" data-filter="' + cat.id + '">' + escapeHtml(cat.label) + '</button>';
      }).join('');
      filters.addEventListener('click', function (event) {
        var button = event.target.closest('[data-filter]');
        if (!button) return;
        $$('.filter-btn', filters).forEach(function (b) { b.classList.remove('is-active'); });
        button.classList.add('is-active');
        render(button.getAttribute('data-filter'));
      });
    }
    render('all');
  }

  function initHomeDepartments() {
    var grid = $('#home-departments');
    if (!grid || !D.departments) return;
    grid.innerHTML = D.departments.slice(0, 6).map(departmentCard).join('');
  }

  /* ---------- department detail ---------- */
  function initDepartmentDetail() {
    var root = $('#department-detail');
    if (!root || !D.departments) return;
    var slug = new URLSearchParams(window.location.search).get('slug') || '';
    var dept = D.departments.filter(function (d) { return d.slug === slug; })[0];
    if (!dept) {
      root.innerHTML = '<div class="card form-card"><h2>تخصص غير موجود</h2><p class="muted">عد إلى صفحة التخصصات لاختيار مسار من القائمة.</p><a class="btn btn--primary" href="departments.html">كل التخصصات</a></div>';
      return;
    }
    document.title = dept.name + ' | مجمع طيبة تكنولوجي';
    var skills = dept.skills.map(function (s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('');
    var count = countFor(dept);
    root.innerHTML =
      '<div class="detail-grid">' +
        '<article class="card reveal">' +
          '<div class="card__media card__media--tall"><img src="' + escapeHtml(dept.image) + '" alt="' + escapeHtml(dept.name) + '"></div>' +
          '<div class="card__body">' +
            '<span class="eyebrow">وصف التخصص</span>' +
            '<h2>' + escapeHtml(dept.name) + '</h2>' +
            '<p>' + escapeHtml(dept.description) + '</p>' +
          '</div>' +
        '</article>' +
        '<aside class="detail-side">' +
          '<section class="card feature reveal" data-delay="1"><span class="feature__icon">◉</span><h3>عدد الطلاب</h3><p class="detail-count">' + formatNumber(count.total) + ' طالبًا وطالبة</p><p class="muted">' + formatNumber(count.male) + ' ذكور • ' + formatNumber(count.female) + ' إناث</p><p class="muted detail-note">تُدار هذه الأعداد من لوحة التحكم في النسخة الكاملة.</p></section>' +
          '<section class="card feature reveal" data-delay="2"><span class="feature__icon">◆</span><h3>مجال التركيز</h3><p>' + escapeHtml(dept.focus) + '</p></section>' +
          '<section class="card feature reveal" data-delay="3"><span class="feature__icon">✓</span><h3>المهارات المكتسبة</h3><ul class="skill-list">' + skills + '</ul></section>' +
          '<section class="card feature reveal" data-delay="4"><span class="feature__icon">!</span><h3>قبل الالتحاق</h3><p>' + escapeHtml(dept.admission) + '</p><a class="btn btn--primary" data-magnetic href="apply.html">التقديم لهذا التخصص</a></section>' +
        '</aside>' +
      '</div>';
    var link = $('a[href="apply.html"]', root);
    if (link) link.href = 'apply.html?specialization=' + encodeURIComponent(dept.slug);
  }

  /* ---------- FAQ ---------- */
  function initFaq() {
    var root = $('#faq-list');
    if (!root || !D.faq) return;
    root.innerHTML = D.faq.map(function (item, i) {
      return '<details class="reveal" data-delay="' + (i % 4) + '"><summary>' + escapeHtml(item.q) + '</summary><p>' + escapeHtml(item.a) + '</p></details>';
    }).join('');
  }

  /* ---------- news ---------- */
  function initNews() {
    var root = $('#news-list');
    if (!root || !D.news) return;
    root.innerHTML = D.news.map(function (item, i) {
      return '<article class="card feature reveal" data-tilt data-delay="' + (i % 4) + '">' +
        '<span class="eyebrow">' + escapeHtml(item.tag) + '</span>' +
        '<h3>' + escapeHtml(item.title) + '</h3>' +
        '<p class="muted">' + escapeHtml(item.date) + '</p>' +
        '<p>' + escapeHtml(item.text) + '</p>' +
      '</article>';
    }).join('');
  }

  /* ---------- gallery + lightbox ---------- */
  function initGallery() {
    var grid = $('#gallery-grid');
    if (!grid || !D.gallery) return;
    var filters = $('#gallery-filters');
    var lightbox = $('#lightbox');
    var lightboxImg = $('#lightbox-image');
    var lightboxTitle = $('#lightbox-title');

    function render(type) {
      var list = type === 'all' ? D.gallery : D.gallery.filter(function (g) { return g.type === type; });
      grid.innerHTML = list.map(function (g, i) {
        return '<button class="gallery-item reveal" data-tilt data-delay="' + (i % 5) + '" type="button" data-src="' + escapeHtml(g.src) + '" data-title="' + escapeHtml(g.title) + '">' +
          '<img src="' + escapeHtml(g.src) + '" alt="' + escapeHtml(g.title) + '" loading="lazy">' +
          '<span>' + escapeHtml(g.title) + '</span>' +
        '</button>';
      }).join('');
      initReveals();
      initPointerEffects();
    }

    if (filters) {
      var types = D.galleryTypes || [
        { id: 'all', label: 'كل الصور' },
        { id: 'practical', label: 'التدريب العملي' },
        { id: 'theoretical', label: 'الدراسة النظرية' }
      ];
      filters.innerHTML = types.map(function (type, index) {
        return '<button class="filter-btn' + (index === 0 ? ' is-active' : '') + '" type="button" data-filter="' + escapeHtml(type.id) + '">' + escapeHtml(type.label) + '</button>';
      }).join('');
      filters.addEventListener('click', function (event) {
        var button = event.target.closest('[data-filter]');
        if (!button) return;
        $$('.filter-btn', filters).forEach(function (b) { b.classList.remove('is-active'); });
        button.classList.add('is-active');
        render(button.getAttribute('data-filter'));
      });
    }
    render('all');

    if (lightbox && lightboxImg && lightboxTitle) {
      grid.addEventListener('click', function (event) {
        var item = event.target.closest('[data-src]');
        if (!item) return;
        lightboxImg.src = item.getAttribute('data-src');
        lightboxImg.alt = item.getAttribute('data-title');
        lightboxTitle.textContent = item.getAttribute('data-title');
        lightbox.hidden = false;
      });
      lightbox.addEventListener('click', function (event) {
        if (event.target === lightbox || event.target.closest('[data-close]')) {
          lightbox.hidden = true;
          lightboxImg.src = '';
        }
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { lightbox.hidden = true; lightboxImg.src = ''; }
      });
    }
  }

  /* ---------- real study plan (generated from backend data) ---------- */
  function initSubjects() {
    var root = $('#subject-list');
    if (!root || !D.subjects) return;

    var gradeFilters = $('#subject-grade-filters');
    var typeFilters = $('#subject-type-filters');
    var count = $('#subject-count');
    var grades = [
      { id: 'all', label: 'كل الصفوف' },
      { id: 'first', label: 'الصف الأول' },
      { id: 'second', label: 'الصف الثاني' },
      { id: 'third', label: 'الصف الثالث' }
    ];
    var types = [
      { id: 'all', label: 'الكل' },
      { id: 'theoretical', label: 'نظرية' },
      { id: 'practical', label: 'عملية' }
    ];
    var groups = [
      { id: 'theoretical', title: 'المواد النظرية', note: 'أساس علمي ولغوي يبني عليه التطبيق العملي.' },
      { id: 'practical', title: 'المواد العملية', note: 'تمارين معملية ومشروعات تحوّل المعرفة إلى مهارة.' }
    ];
    var state = { grade: 'all', type: 'all' };

    function filterMarkup(list, key, selected) {
      return list.map(function (item) {
        return '<button class="filter-btn' + (item.id === selected ? ' is-active' : '') +
          '" type="button" data-' + key + '="' + item.id + '">' + escapeHtml(item.label) + '</button>';
      }).join('');
    }

    function cardMarkup(subject) {
      var isPractical = subject.type === 'practical';
      return '<article class="card subject-card reveal">' +
        '<div class="subject-card__head">' +
          '<span class="subject-card__type' + (isPractical ? ' is-practical' : '') + '">' +
            (isPractical ? 'عملية' : 'نظرية') + '</span>' +
          '<span class="subject-card__grade">' + escapeHtml(
            subject.grade === 'first' ? 'الأول' : subject.grade === 'second' ? 'الثاني' : 'الثالث'
          ) + '</span>' +
        '</div>' +
        '<h3>' + escapeHtml(subject.name) + '</h3>' +
        '<p class="subject-card__periods">' + formatNumber(subject.weekly_periods) + ' حصة/أسبوع</p>' +
        '<p class="muted">' + escapeHtml(subject.description || '') + '</p>' +
        '<span class="subject-card__dept">' + escapeHtml(subject.department_slug || 'مادة عامة') + '</span>' +
      '</article>';
    }

    function render() {
      var list = D.subjects.filter(function (subject) {
        return (state.grade === 'all' || subject.grade === state.grade) &&
          (state.type === 'all' || subject.type === state.type);
      });
      root.innerHTML = groups.map(function (group) {
        var items = list.filter(function (subject) { return subject.type === group.id; });
        if (!items.length) return '';
        return '<section class="subject-group">' +
          '<div class="section-head"><span class="eyebrow">' + escapeHtml(group.title) + '</span>' +
          '<p class="muted">' + escapeHtml(group.note) + '</p></div>' +
          '<div class="grid grid--3">' + items.map(cardMarkup).join('') + '</div>' +
        '</section>';
      }).join('');
      if (count) count.textContent = formatNumber(list.length) + ' مادة مطابقة من ' + formatNumber(D.subjects.length) + ' مادة';
      initReveals();
    }

    if (gradeFilters) {
      gradeFilters.innerHTML = filterMarkup(grades, 'grade', state.grade);
      gradeFilters.addEventListener('click', function (event) {
        var button = event.target.closest('[data-grade]');
        if (!button) return;
        state.grade = button.getAttribute('data-grade');
        $$('.filter-btn', gradeFilters).forEach(function (b) { b.classList.remove('is-active'); });
        button.classList.add('is-active');
        render();
      });
    }

    if (typeFilters) {
      typeFilters.innerHTML = filterMarkup(types, 'type', state.type);
      typeFilters.addEventListener('click', function (event) {
        var button = event.target.closest('[data-type]');
        if (!button) return;
        state.type = button.getAttribute('data-type');
        $$('.filter-btn', typeFilters).forEach(function (b) { b.classList.remove('is-active'); });
        button.classList.add('is-active');
        render();
      });
    }

    render();
  }

  /* ---------- demo application form (no backend) ---------- */
  function initApply() {
    var form = $('#apply-form');
    if (!form) return;
    var message = $('#form-message');
    var fill = $('.progress__fill');
    var label = $('#progress-label');
    var required = $$('[data-required]', form).filter(function (el) { return el.type !== 'checkbox'; });
    var consent = $('[name="consent"]', form);
    var specialization = $('[name="specialization"]', form);

    if (specialization && D.departments) {
      var params = new URLSearchParams(window.location.search);
      var preselect = params.get('specialization') || '';
      specialization.innerHTML = '<option value="">اختر التخصص</option>' + D.departments.map(function (d) {
        return '<option value="' + escapeHtml(d.slug) + '"' + (d.slug === preselect ? ' selected' : '') + '>' + escapeHtml(d.name) + '</option>';
      }).join('');
    }

    function updateProgress() {
      var done = required.filter(function (el) { return String(el.value || '').trim().length > 0; }).length;
      if (consent && consent.checked) done += 1;
      var total = required.length + (consent ? 1 : 0);
      var percent = total ? Math.round((done / total) * 100) : 0;
      if (fill) fill.style.setProperty('--fill', percent + '%');
      if (label) label.textContent = percent + '%';
    }

    function setError(field, text) {
      var wrapper = field.closest('.field');
      var error = wrapper && $('.error', wrapper);
      if (wrapper) wrapper.classList.toggle('is-invalid', Boolean(text));
      if (error) error.textContent = text || '';
    }

    function validateField(field) {
      var value = String(field.value || '').trim();
      if (!value) { setError(field, 'هذا الحقل مطلوب'); return false; }
      if (field.type === 'tel' && value.replace(/\D/g, '').length < 10) { setError(field, 'أدخل رقم هاتف صحيحًا'); return false; }
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setError(field, 'أدخل بريدًا إلكترونيًا صحيحًا'); return false; }
      setError(field, '');
      return true;
    }

    required.forEach(function (field) {
      field.addEventListener('input', function () { validateField(field); updateProgress(); });
      field.addEventListener('change', updateProgress);
    });
    if (consent) consent.addEventListener('change', updateProgress);
    updateProgress();

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var valid = required.every(validateField);
      if (consent && !consent.checked) {
        var wrapper = consent.closest('.field');
        var error = wrapper && $('.error', wrapper);
        if (wrapper) wrapper.classList.add('is-invalid');
        if (error) error.textContent = 'يجب الموافقة قبل الإرسال';
        valid = false;
      }
      if (!valid) {
        if (message) { message.textContent = 'يرجى تصحيح الحقول المحددة قبل المتابعة.'; message.setAttribute('data-state', 'error'); }
        return;
      }
      if (message) {
        message.textContent = 'تم التحقق من بياناتك. هذه نسخة ثابتة للعرض فقط، لذلك لا يتم إرسال أي طلب إلى خادم. النسخة الكاملة من الموقع تحفظ الطلب وترجع رقم متابعة.';
        message.setAttribute('data-state', 'ok');
      }
      updateProgress();
      if (message) message.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    initChrome();
    initContent();
    initReveals();
    initPointerEffects();
    initCounters();
    initHomeDepartments();
    initDepartments();
    initDepartmentDetail();
    initFaq();
    initNews();
    initGallery();
    initSubjects();
    initApply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
