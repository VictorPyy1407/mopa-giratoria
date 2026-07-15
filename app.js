/* ============================================================
   Mopa Triangular 360° — VG Shop
   Motor de la landing. Reutiliza la infraestructura compartida:
   Supabase (pedidos_web + trigger de Telegram), analytics VG Shop.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.PRODUCT_CONFIG || {};
  var PY_CITIES = window.PY_CITIES || [];
  var DELIVERY = window.DELIVERY_CITIES || [];
  var features = Object.assign({}, CFG.features || {});
  var FKEY = 'mopa360_features';

  var state = { submitting: false, formStarted: false, gIndex: 0 };

  /* ---------- helpers ---------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function norm(s) { return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function fmt(n) { return 'Gs. ' + Math.round(n).toLocaleString('es-PY'); }

  /* ---------- feature flags ---------- */
  function loadFeatures() {
    try {
      var saved = JSON.parse(localStorage.getItem(FKEY) || '{}');
      Object.keys(saved).forEach(function (k) { features[k] = saved[k]; });
    } catch (e) {}
  }
  function applyFeatures() {
    var an = $('#announce'); if (an) an.style.display = features.announcementBar ? '' : 'none';
    var sw = $('#stockWrap'); if (sw) sw.hidden = !features.stockUrgency;
  }

  /* ---------- precios estáticos ---------- */
  function paintPrices() {
    $$('[data-price]').forEach(function (el) { el.textContent = fmt(CFG.price); });
  }

  /* ---------- lazy loading ---------- */
  function initLazy() {
    var imgs = $$('img.lazy');
    if (!('IntersectionObserver' in window)) {
      imgs.forEach(function (im) { im.src = im.dataset.src; im.classList.add('loaded'); });
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var im = en.target;
        im.src = im.dataset.src;
        im.addEventListener('load', function () { im.classList.add('loaded'); });
        obs.unobserve(im);
      });
    }, { rootMargin: '300px 0px' });
    imgs.forEach(function (im) { io.observe(im); });
  }

  /* ---------- reveal ---------- */
  function initReveal() {
    var els = $$('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); obs.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- header + scroll UI ---------- */
  function initScrollUI() {
    var header = $('#header');
    var sticky = $('#stickyBar');
    var back = $('#backTop');
    var form = $('#form');
    function onScroll() {
      var y = window.pageYOffset;
      if (header) header.classList.toggle('scrolled', y > 8);
      if (back && features.backToTop) back.hidden = y < 500;
      if (sticky && features.stickyMobileBar) {
        var formTop = form ? form.getBoundingClientRect().top : 9999;
        sticky.classList.toggle('show', y > 620 && formTop > 120);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (back) back.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ---------- smooth anchor scroll ---------- */
  function initAnchors() {
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id === '#' || id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.pageYOffset - 70;
        window.scrollTo({ top: top, behavior: 'smooth' });
      });
    });
  }

  /* ---------- CTAs tracking ---------- */
  function initCTAs() {
    $$('[data-cta]').forEach(function (b) {
      b.addEventListener('click', function () { track('add_to_cart', { placement: b.dataset.cta }); });
    });
  }

  /* ---------- Galería ---------- */
  function buildGallery() {
    var g = CFG.gallery || [];
    var main = $('#gMain'), cap = $('#gCaption'), thumbs = $('#gThumbs');
    if (!main || !g.length) return;
    thumbs.innerHTML = g.map(function (item, i) {
      return '<button data-i="' + i + '" class="' + (i === 0 ? 'active' : '') + '" aria-label="Ver imagen ' + (i + 1) + '">' +
        '<img src="' + item.src + '" alt="" loading="lazy" decoding="async"></button>';
    }).join('');
    function show(i) {
      i = (i + g.length) % g.length;
      state.gIndex = i;
      main.src = g[i].src;
      cap.textContent = g[i].cap || '';
      $$('#gThumbs button').forEach(function (b, bi) { b.classList.toggle('active', bi === i); });
      if ($('#lightbox').classList.contains('show')) { $('#lbImg').src = g[i].src; }
    }
    thumbs.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; show(parseInt(b.dataset.i, 10));
    });
    $('.g-prev').addEventListener('click', function () { show(state.gIndex - 1); });
    $('.g-next').addEventListener('click', function () { show(state.gIndex + 1); });
    show(0);

    // Lightbox
    var lb = $('#lightbox'), lbImg = $('#lbImg');
    main.parentElement.addEventListener('click', function (e) {
      if (e.target.closest('.g-nav')) return;
      lbImg.src = g[state.gIndex].src; lb.classList.add('show'); lb.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll');
    });
    function closeLb() { lb.classList.remove('show'); lb.setAttribute('aria-hidden', 'true'); document.body.classList.remove('no-scroll'); }
    $('.lb-close').addEventListener('click', closeLb);
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    $('.lb-prev').addEventListener('click', function () { show(state.gIndex - 1); });
    $('.lb-next').addEventListener('click', function () { show(state.gIndex + 1); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('show')) return;
      if (e.key === 'Escape') closeLb();
      else if (e.key === 'ArrowLeft') show(state.gIndex - 1);
      else if (e.key === 'ArrowRight') show(state.gIndex + 1);
    });
    // Swipe (mobile)
    var x0 = null;
    main.parentElement.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    main.parentElement.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) show(state.gIndex + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });
  }

  /* ---------- Opiniones ---------- */
  var REVIEWS = [
    { n: 'Carolina Benítez', c: 'Asunción', ini: 'CB', bg: '#2563EB', t: 'Increíble lo bien que limpia las esquinas del baño. Ya no me agacho para nada. La recomiendo 100%.' },
    { n: 'Rodrigo Villalba', c: 'Luque', ini: 'RV', bg: '#0F2C6B', t: 'Llega debajo de los muebles sin mover nada. El giro 360° es lo mejor, se maneja re fácil.' },
    { n: 'Fátima Duarte', c: 'San Lorenzo', ini: 'FD', bg: '#F97316', t: 'La microfibra absorbe muchísimo. Uso el compartimento para el detergente y queda todo brillante.' },
    { n: 'Andrés Cáceres', c: 'Capiatá', ini: 'AC', bg: '#16A34A', t: 'Llegó rapidísimo y pagué al recibir. Buena calidad, mucho mejor que la mopa común que tenía.' },
    { n: 'Lucía Ramírez', c: 'Fernando de la Mora', ini: 'LR', bg: '#7C3AED', t: 'La uso en seco y en húmedo. Los vidrios y azulejos quedan impecables. Vale cada guaraní.' },
    { n: 'Marcos Ortiz', c: 'Ciudad del Este', ini: 'MO', bg: '#DB2777', t: 'Práctica y liviana. Mi esposa quedó feliz, limpia toda la casa en la mitad de tiempo.' }
  ];
  function renderReviews() {
    var grid = $('#reviewsGrid'); if (!grid) return;
    grid.innerHTML = REVIEWS.map(function (r) {
      return '<article class="review">' +
        '<span class="stars">★★★★★</span>' +
        '<p class="review-text">' + r.t + '</p>' +
        '<div class="review-who">' +
        '<span class="avatar" style="background:' + r.bg + '">' + r.ini + '</span>' +
        '<span><span class="review-name">' + r.n + '</span><br><span class="review-city">' + r.c + '</span></span>' +
        '<span class="verified">✓ Verificado</span>' +
        '</div></article>';
    }).join('');
  }

  /* ---------- FAQ ---------- */
  var FAQ = [
    { q: '¿Sirve para pisos de porcelanato y cerámica?', a: 'Sí. Está diseñada para porcelanato, cerámica, madera, azulejos y más. Limpia sin rayar la superficie.' },
    { q: '¿Se puede lavar la microfibra?', a: 'Totalmente. El paño de microfibra es lavable y reutilizable: lo enjuagás, lo secás y queda listo para el próximo uso.' },
    { q: '¿Incluye el paño de microfibra?', a: 'Sí, la mopa viene con su paño de microfibra triangular incluido, listo para usar.' },
    { q: '¿Cómo funciona el compartimento para detergente?', a: 'Tiene un compartimento donde cargás jabón líquido o detergente; al pasar la mopa, dosifica el producto sobre el piso para una limpieza más profunda.' },
    { q: '¿Se puede usar en seco?', a: 'Sí. Funciona en seco para levantar polvo y pelos, y en húmedo para una limpieza a fondo.' },
    { q: '¿Cómo pago y cuánto cuesta el envío?', a: 'El envío es GRATIS a todo Paraguay. En Asunción y Central pagás contra entrega al recibir. Al interior coordinamos el envío por transportadora.' }
  ];
  function renderFaq() {
    var acc = $('#accordion'); if (!acc) return;
    acc.innerHTML = FAQ.map(function (f) {
      return '<div class="acc-item"><button class="acc-q" type="button">' + f.q +
        '<span class="acc-ico">+</span></button><div class="acc-a"><p>' + f.a + '</p></div></div>';
    }).join('');
    acc.addEventListener('click', function (e) {
      var q = e.target.closest('.acc-q'); if (!q) return;
      var item = q.parentElement;
      var open = item.classList.contains('open');
      $$('.acc-item', acc).forEach(function (it) { it.classList.remove('open'); it.querySelector('.acc-a').style.maxHeight = null; });
      if (!open) { item.classList.add('open'); var a = item.querySelector('.acc-a'); a.style.maxHeight = a.scrollHeight + 'px'; }
    });
  }

  /* ---------- Stock (sin temporizadores falsos) ---------- */
  function initStock() {
    if (!features.stockUrgency) return;
    var u = CFG.urgency || {};
    var start = u.stockStart || 40, min = u.stockMin || 6;
    var key = 'mopa360_stock';
    var val = parseInt(sessionStorage.getItem(key) || '', 10);
    if (isNaN(val)) { val = start; sessionStorage.setItem(key, val); }
    var num = $('#stockNum'), fill = $('#stockFill');
    function paint() {
      if (num) num.textContent = val;
      if (fill) fill.style.width = Math.max(8, Math.round((val / start) * 100)) + '%';
    }
    paint();
    // Baja lento y de forma realista mientras el usuario navega, nunca por debajo de min.
    var timer = setInterval(function () {
      if (val <= min) { clearInterval(timer); return; }
      if (Math.random() < 0.5) { val -= 1; sessionStorage.setItem(key, val); paint(); }
    }, 22000);
  }

  /* ---------- WhatsApp links ---------- */
  function waLink(msg) {
    return 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(msg);
  }
  function initWhats() {
    var msg = 'Hola, vi la ' + CFG.name + ' en la página y quiero más información.';
    var link = waLink(msg);
    ['#contactWhats', '#footContact', '#fabWhats'].forEach(function (sel) {
      var el = $(sel); if (el) el.href = link;
    });
    var fab = $('#fabWhats'); if (fab && features.floatingWhats) fab.hidden = false;
  }

  /* ---------- Ciudades datalist ---------- */
  function initCities() {
    var dl = $('#cityList'); if (!dl) return;
    dl.innerHTML = PY_CITIES.map(function (c) { return '<option value="' + c + '">'; }).join('');
    var city = $('#ciudad');
    if (city) city.addEventListener('change', function () { updateShipNote(city.value); });
    if (city) city.addEventListener('blur', function () { updateShipNote(city.value); });
  }
  function updateShipNote(city) {
    var note = $('#shipNote'); if (!note) return;
    if (!city || !city.trim()) { note.hidden = true; return; }
    var isMetro = DELIVERY.some(function (z) { return norm(z) === norm(city); });
    note.hidden = false;
    if (isMetro) {
      note.className = 'ship-note metro';
      note.textContent = '✅ Tu ciudad tiene delivery a domicilio. Pagás contra entrega al recibir. Envío GRATIS.';
    } else {
      note.className = 'ship-note interior';
      note.textContent = '🚚 Envío al interior por transportadora (GRATIS). Coordinamos el pago por adelantado antes del despacho.';
    }
  }

  /* ---------- Formulario ---------- */
  function validateField(name, silent) {
    var wrap = $('.field[data-field="' + name + '"]');
    if (!wrap) return true;
    var input = wrap.querySelector('input,textarea');
    var v = (input.value || '').trim();
    var ok = true;
    if (name === 'telefono') ok = v.replace(/[^0-9]/g, '').length >= 6;
    else ok = v.length >= 2;
    if (!silent || v.length) { wrap.classList.toggle('err', !ok); wrap.classList.toggle('ok', ok); }
    return ok;
  }
  function initForm() {
    var form = $('#orderForm'); if (!form) return;
    ['nombre', 'telefono', 'ciudad', 'direccion'].forEach(function (n) {
      var wrap = $('.field[data-field="' + n + '"]'); if (!wrap) return;
      var input = wrap.querySelector('input,textarea');
      input.addEventListener('blur', function () { validateField(n); });
      input.addEventListener('input', function () {
        if (wrap.classList.contains('err')) validateField(n);
        if (!state.formStarted) { state.formStarted = true; track('begin_checkout', {}); }
      });
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); confirmAndSubmit(); });
  }
  function validateAll() {
    var fields = ['nombre', 'telefono', 'ciudad', 'direccion'];
    var firstBad = null;
    fields.forEach(function (f) { if (!validateField(f) && !firstBad) firstBad = f; });
    if (firstBad) {
      var el = $('.field[data-field="' + firstBad + '"] input');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { el.focus({ preventScroll: true }); }, 300);
    }
    return !firstBad;
  }
  function collectForm() {
    var g = function (n) { var el = $('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
    return {
      nombre: g('nombre'), telefono: g('telefono'), ciudad: g('ciudad'),
      direccion: g('direccion'), referencia: g('referencia'), comentario: g('comentario')
    };
  }
  function orderNumber() { return '#PY' + Date.now().toString().slice(-6) + rand(10, 99); }

  function saveOrder(order) {
    return fetch(CFG.supabaseUrl + '/rest/v1/' + CFG.supabaseTable, {
      method: 'POST',
      headers: {
        apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey,
        'Content-Type': 'application/json', Prefer: 'return=minimal'
      },
      body: JSON.stringify(order)
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); });
  }

  function confirmAndSubmit() {
    if (state.submitting) return;
    if (!validateAll()) { toast('Completá nombre, teléfono, ciudad y dirección'); return; }
    var data = collectForm();
    var id = orderNumber();
    var isMetro = DELIVERY.some(function (z) { return norm(z) === norm(data.ciudad); });

    var refParts = ['Cantidad: 1 unidad'];
    if (data.referencia) refParts.push('Ref: ' + data.referencia);
    if (data.comentario) refParts.push('Comentario: ' + data.comentario);
    if (isMetro) {
      refParts.push('Delivery a domicilio (Asunción/Central)');
      refParts.push('PAGO CONTRA ENTREGA · Envío gratis');
    } else {
      refParts.push('Envío al INTERIOR por transportadora');
      refParts.push('PAGO ANTICIPADO antes del envío · Envío gratis');
    }

    var order = {
      id: id,
      producto: CFG.name,
      precio: CFG.price,
      cantidad: 1,
      subtotal: CFG.price,
      ganancia: 0,
      nombre: data.nombre,
      telefono: data.telefono,
      correo: 'No informado',
      ci: 'No informado',
      departamento: '',
      ciudad: data.ciudad,
      direccion: data.direccion,
      referencia: refParts.join(' | '),
      ubicacion_maps: 'No informado',
      estado: 'Pendiente',
      origen: CFG.origin,
      created_at: new Date().toISOString()
    };

    track('form_submitted', { quantity: 1 });
    state.submitting = true;
    var btn = $('#confirmOrder');
    btn.classList.add('loading'); btn.disabled = true;

    saveOrder(order).then(function () {
      state.submitting = false; btn.classList.remove('loading'); btn.disabled = false;
      showSuccess(order, data, isMetro);
      track('purchase', { transaction_id: id, value: CFG.price, quantity: 1 });
    }).catch(function (err) {
      console.error('[order] error', err);
      state.submitting = false; btn.classList.remove('loading'); btn.disabled = false;
      toast('No se pudo enviar el pedido. Revisá tu conexión e intentá de nuevo.');
    });
  }

  function showSuccess(order, data, isMetro) {
    $('#successOrderNum').textContent = order.id;
    $('#successProduct').textContent = CFG.name;
    $('#successTotal').textContent = fmt(order.subtotal);
    $('#successPhone').textContent = order.telefono;
    var tl = $('#successTotalLabel'), st = $('#successStep3');
    if (isMetro) {
      tl.textContent = 'Total (al recibir)';
      st.textContent = 'Pagás en efectivo cuando recibís tu mopa. ¡Así de simple!';
    } else {
      tl.textContent = 'Total (pago anticipado)';
      st.textContent = 'Al ser envío al interior, coordinamos el pago por adelantado y luego despachamos por transportadora.';
    }
    var msg = 'Hola! Acabo de hacer un pedido en VG Shop 🛍️\n\n' +
      'N° ' + order.id + '\n' + CFG.name + '\n' +
      'Total: ' + fmt(order.subtotal) + '\n' +
      'Nombre: ' + data.nombre + '\nCiudad: ' + data.ciudad + '\nDirección: ' + data.direccion;
    $('#successWhats').href = waLink(msg);
    var s = $('#success');
    s.classList.add('show'); s.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  }
  function initSuccess() {
    var back = $('#backHome'); if (!back) return;
    back.addEventListener('click', function () {
      $('#success').classList.remove('show');
      document.body.classList.remove('no-scroll');
      $('#orderForm').reset();
      $$('.field').forEach(function (f) { f.classList.remove('ok', 'err'); });
      $('#shipNote').hidden = true;
      state.formStarted = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- Modales legales ---------- */
  var LEGAL = {
    privacidad: {
      t: 'Política de Privacidad',
      b: '<p>En VG Shop respetamos tu privacidad. Los datos que ingresás en el formulario (nombre, teléfono, ciudad y dirección) se usan únicamente para procesar y coordinar la entrega de tu pedido.</p>' +
         '<p>No compartimos tu información con terceros ajenos a la logística de envío, ni la usamos para fines distintos a tu compra.</p>' +
         '<p>Podés solicitar la eliminación de tus datos escribiéndonos por WhatsApp.</p>'
    },
    terminos: {
      t: 'Términos y Condiciones',
      b: '<p>El precio publicado es de ' + 'Gs. 145.000' + ' con envío gratis a todo Paraguay.</p>' +
         '<p>En Asunción y Central el pago es contra entrega. Para envíos al interior, el pago se coordina de forma anticipada antes del despacho por transportadora.</p>' +
         '<p>La confirmación del pedido a través del formulario no constituye un cobro: nuestro equipo te contactará por WhatsApp para coordinar la entrega.</p>' +
         '<p>Garantía de satisfacción sujeta a las condiciones informadas al momento de la compra.</p>'
    }
  };
  function initLegal() {
    var modal = $('#legalModal');
    function open(key) {
      var d = LEGAL[key]; if (!d) return;
      $('#legalTitle').textContent = d.t;
      $('#legalBody').innerHTML = d.b;
      modal.classList.add('show'); modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll');
    }
    function close() { modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('no-scroll'); }
    $$('[data-modal]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); open(a.dataset.modal); });
    });
    $('.modal-close', modal).addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  /* ---------- Analytics ---------- */
  function track(event, params) {
    params = params || {};
    var payload = Object.assign({ event: event, product: CFG.name, value: CFG.price, currency: CFG.currency }, params);
    if (window.dataLayer) window.dataLayer.push(payload);
    if (typeof window.gtag === 'function') window.gtag('event', event, payload);
    if (window.VisitorTracker && typeof window.VisitorTracker.trackEcommerce === 'function') {
      window.VisitorTracker.trackEcommerce(event, { productName: CFG.name, productPrice: CFG.price, revenue: payload.value });
    }
    if (typeof window.fbq === 'function') {
      var mp = { content_name: CFG.name, content_type: 'product', value: payload.value || CFG.price, currency: CFG.currency };
      if (event === 'view_content') window.fbq('track', 'ViewContent', mp);
      else if (event === 'add_to_cart') window.fbq('track', 'AddToCart', mp);
      else if (event === 'begin_checkout') window.fbq('track', 'InitiateCheckout', mp);
      else if (event === 'form_submitted') window.fbq('track', 'Lead', mp);
      else if (event === 'purchase') {
        if (params.transaction_id) window.fbq('track', 'Purchase', mp, { eventID: params.transaction_id });
        else window.fbq('track', 'Purchase', mp);
      }
    }
  }
  function initScrollDepth() {
    var marks = [25, 50, 75, 90]; var fired = {};
    window.addEventListener('scroll', function () {
      var h = document.documentElement;
      var pct = ((h.scrollTop + window.innerHeight) / h.scrollHeight) * 100;
      marks.forEach(function (m) { if (pct >= m && !fired[m]) { fired[m] = 1; track('scroll_depth', { depth: m }); } });
    }, { passive: true });
  }

  /* ---------- Visitor tracking (edge function) ---------- */
  function initVisitorTracking() {
    var URL = CFG.supabaseUrl, KEY = CFG.supabaseAnonKey;
    if (!URL || !KEY) return;
    var TRACK = URL + '/functions/v1/track-visitor';
    var sid = sessionStorage.getItem('lp_session_id') || 'sess_' + Math.random().toString(36).slice(2, 15) + '_' + Date.now().toString(36);
    sessionStorage.setItem('lp_session_id', sid);
    var hb = null;
    function send(event, extra) {
      fetch(TRACK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
        body: JSON.stringify(Object.assign({
          event: event, sessionId: sid, pageUrl: location.href, pageTitle: document.title,
          referrer: document.referrer, userAgent: navigator.userAgent, landingPage: CFG.origin
        }, extra || {})),
        keepalive: true
      }).catch(function () {});
    }
    window.VisitorTracker = { trackEcommerce: function (event, data) { send('ecommerce_' + event, data); } };
    send('pageview');
    hb = setInterval(function () { if (!document.hidden) send('heartbeat'); }, 15000);
    document.addEventListener('visibilitychange', function () { send(document.hidden ? 'hidden' : 'visible'); });
    window.addEventListener('pagehide', function () { clearInterval(hb); send('leave'); });
  }

  /* ---------- GTM / GA4 / Pixel / Clarity ---------- */
  function isConfigured(v) { return Boolean(v) && !/^(PEGAR_AQUI|G-XXXX|GTM-XXXX|TU_|YOUR_|XXXX)/i.test(v); }
  function initGA4() {
    if (!isConfigured(CFG.ga4Id)) return;
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + CFG.ga4Id;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', CFG.ga4Id);
  }
  function initGTM() {
    if (!isConfigured(CFG.gtmId)) return;
    (function (w, d, s, l, i) {
      w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0], j = d.createElement(s), dl = l !== 'dataLayer' ? '&l=' + l : '';
      j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', CFG.gtmId);
  }
  function initPixel() {
    if (!isConfigured(CFG.metaPixelId)) return;
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', CFG.metaPixelId);
    window.fbq('track', 'PageView');
  }
  function initClarity() {
    if (!isConfigured(CFG.clarityId)) return;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CFG.clarityId);
  }

  /* ---------- Config panel (dev) ---------- */
  var FEATURE_LABELS = {
    announcementBar: 'Barra de anuncios',
    stickyMobileBar: 'Barra fija mobile',
    stockUrgency: 'Contador de stock',
    floatingWhats: 'WhatsApp flotante',
    backToTop: 'Volver arriba'
  };
  function setFeature(k, val) {
    features[k] = val;
    var saved = {}; try { saved = JSON.parse(localStorage.getItem(FKEY) || '{}'); } catch (e) {}
    saved[k] = val; localStorage.setItem(FKEY, JSON.stringify(saved));
    applyFeatures();
    if (k === 'floatingWhats') { var fab = $('#fabWhats'); if (fab) fab.hidden = !val; }
    if (k === 'backToTop' && !val) { var bt = $('#backTop'); if (bt) bt.hidden = true; }
  }
  function initConfigPanel() {
    var params = new URLSearchParams(location.search);
    var wantPanel = params.get('config') === '1';
    var hasSaved = false;
    try { hasSaved = Object.keys(JSON.parse(localStorage.getItem(FKEY) || '{}')).length > 0; } catch (e) {}
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) { e.preventDefault(); buildPanel(true); }
    });
    if (wantPanel) buildPanel(true);
    else if (hasSaved) { /* features already applied */ }
    function buildPanel(show) {
      var panel = $('#configPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'configPanel';
        panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:400;background:#fff;border:1px solid #E7ECF3;border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.2);padding:16px 18px;width:250px;font-size:.9rem';
        var rows = Object.keys(FEATURE_LABELS).map(function (k) {
          return '<label style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;cursor:pointer">' +
            FEATURE_LABELS[k] + '<input type="checkbox" data-fk="' + k + '" ' + (features[k] ? 'checked' : '') + '></label>';
        }).join('');
        panel.innerHTML = '<div style="font-weight:800;margin-bottom:8px">⚙️ Funciones</div>' + rows +
          '<button id="cpClose" style="margin-top:10px;width:100%;padding:8px;border-radius:10px;background:#2563EB;color:#fff;font-weight:700">Cerrar</button>';
        document.body.appendChild(panel);
        panel.addEventListener('change', function (e) {
          var cb = e.target.closest('input[data-fk]'); if (cb) setFeature(cb.dataset.fk, cb.checked);
        });
        $('#cpClose', panel).addEventListener('click', function () { panel.style.display = 'none'; });
      }
      if (show) panel.style.display = panel.style.display === 'none' ? 'block' : (panel.style.display ? 'block' : 'block');
    }
  }

  /* ---------- misc ---------- */
  function initMisc() {
    var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  }

  /* ---------- init ---------- */
  function init() {
    loadFeatures();
    paintPrices();
    applyFeatures();
    initLazy();
    initReveal();
    initScrollUI();
    initAnchors();
    initCTAs();
    buildGallery();
    renderReviews();
    renderFaq();
    initStock();
    initWhats();
    initCities();
    initForm();
    initSuccess();
    initLegal();
    initScrollDepth();
    initVisitorTracking();
    initGA4();
    initGTM();
    initPixel();
    initClarity();
    initConfigPanel();
    initMisc();
    track('view_content');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
