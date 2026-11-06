/**
 * Cauce · interfaz web del piloto AI-901 (Distribuidora Río Claro).
 * Aplicación de una sola página sin dependencias externas.
 */
'use strict';

/* ============================== Utilidades ============================== */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Formato ligero para respuestas del modelo: negritas y viñetas, siempre sobre texto escapado. */
const md = (v) => esc(v).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^\s*[-*]\s+/gm, '• ').replace(/^#+\s*/gm, '');
const money = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const pct = (n) => `${Math.round((n || 0) * 100)}%`;
const timeAgo = (iso) => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  invoice: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h7M9 17h5"/>',
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
  message: '<path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  send: '<path d="M4 12l16-8-6 16-2-7z"/>',
  speaker: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  store: '<path d="M3 9l2-5h14l2 5"/><path d="M4 9v11h16V9M9 20v-6h6v6"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M15 11c3.3 0 6 1.3 6 3s-2.7 3-6 3"/>',
  camera: '<path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  file: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

function toast(message, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'ok' ? 'check' : 'alert')}<span>${esc(message)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ============================== Estado y API ============================== */

const session = {
  role: localGet('cauce.role') || 'cliente',
  branch: localGet('cauce.branch') || 'CEN',
  info: null,
  chat: [],
};

function localGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function localSet(key, value) { try { localStorage.setItem(key, value); } catch { /* almacenamiento no disponible */ } }

async function api(path, options = {}) {
  const headers = { 'x-demo-role': session.role, 'x-demo-branch': session.branch, ...(options.headers || {}) };
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
  }
  const response = await fetch(path, { ...options, headers });
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json() : await response.blob();
  if (!response.ok) {
    const error = new Error(data?.error || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

const branchName = (id) => session.info?.branches.find((b) => b.id === id)?.name || id;
const roleCan = {
  cliente: { invoices: false, review: false },
  sucursal: { invoices: false, review: true },
  finanzas: { invoices: true, review: true },
};

/* ============================== Navegación ============================== */

const ROUTES = [
  { id: 'bienvenida', title: 'Bienvenida', icon: 'home', group: 'Inicio', render: renderWelcome },
  { id: 'panel', title: 'Panel ejecutivo', icon: 'dashboard', group: 'Inicio', render: renderDashboard },
  { id: 'asistente', title: 'Asistente inteligente', icon: 'chat', group: 'Operación', render: renderAssistant },
  { id: 'facturas', title: 'Facturas', icon: 'invoice', group: 'Operación', render: renderInvoices },
  { id: 'catalogo', title: 'Catálogo e inventario', icon: 'box', group: 'Operación', render: renderCatalog },
  { id: 'quejas', title: 'Análisis de quejas', icon: 'message', group: 'Operación', render: renderComplaints },
  { id: 'vision', title: 'Voz y visión', icon: 'eye', group: 'Operación', render: renderVision },
  { id: 'revision', title: 'Revisión humana', icon: 'check', group: 'Control', render: renderReviews },
  { id: 'transparencia', title: 'Configuración e IA responsable', icon: 'shield', group: 'Control', render: renderTransparency },
];

function renderNav(pending = 0) {
  let group = '';
  const current = currentRoute().id;
  $('#nav').innerHTML = ROUTES.map((r) => {
    const label = r.group !== group ? `<div class="nav-label">${r.group}</div>` : '';
    group = r.group;
    const count = r.id === 'revision' && pending ? `<span class="count">${pending}</span>` : '';
    return `${label}<a href="#/${r.id}" class="${r.id === current ? 'active' : ''}">${icon(r.icon)}<span>${r.title}</span>${count}</a>`;
  }).join('');
}

function currentRoute() {
  const id = location.hash.replace(/^#\/?/, '') || 'bienvenida';
  return ROUTES.find((r) => r.id === id) || ROUTES[0];
}

async function router() {
  const route = currentRoute();
  $('#pageTitle').textContent = route.title;
  $('#crumb').textContent = `${route.group} · ${branchName(session.branch)}`;
  $('#sidebar').classList.remove('open');
  closeDrawer();
  renderNav(window.__pending || 0);
  const view = $('#view');
  view.innerHTML = '<div class="stack"><div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:260px"></div></div>';
  try {
    await route.render(view);
    view.firstElementChild?.classList.add('fade-in');
  } catch (error) {
    view.innerHTML = `<div class="notice bad">${icon('alert')}<div><strong>No se pudo cargar este módulo.</strong><br>${esc(error.message)}</div></div>`;
  }
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  refreshPending();
}

async function refreshPending() {
  if (!roleCan[session.role].review) { window.__pending = 0; renderNav(0); return; }
  try {
    const reviews = await api('/api/reviews');
    window.__pending = reviews.filter((r) => r.status === 'pendiente').length;
    renderNav(window.__pending);
  } catch { /* sin permisos o sin conexión */ }
}

function openDrawer(title, html) {
  $('#drawerTitle').textContent = title;
  $('#drawerBody').innerHTML = html;
  $('#drawer').classList.add('open');
  $('#drawerBackdrop').classList.add('open');
}
function closeDrawer() {
  $('#drawer').classList.remove('open');
  $('#drawerBackdrop').classList.remove('open');
}

const lockedNotice = (what) => `<div class="card card-pad"><div class="empty">${icon('shield')}<div><strong>${what}</strong></div><p class="small">Esta información es confidencial. Cambia al perfil <strong>Finanzas / Dirección</strong> en la parte superior para consultarla.</p><button class="btn btn-primary" data-role="finanzas">Cambiar a Finanzas</button></div></div>`;

/* ============================== Gráficas SVG ============================== */

function barChart(data, keys, colors) {
  const w = 560; const h = 190; const pad = 28;
  const max = Math.max(1, ...data.flatMap((d) => keys.map((k) => d[k])));
  const groupW = (w - pad) / data.length;
  const barW = Math.min(18, (groupW - 14) / keys.length);
  const bars = data.map((d, i) => keys.map((k, j) => {
    const bh = (d[k] / max) * (h - 44);
    const x = pad + i * groupW + (groupW - barW * keys.length) / 2 + j * barW;
    return `<rect x="${x}" y="${h - 24 - bh}" width="${barW - 3}" height="${Math.max(bh, 1)}" rx="3" fill="${colors[j]}"><title>${d[k]}</title></rect>`;
  }).join('') + `<text x="${pad + i * groupW + groupW / 2}" y="${h - 6}" text-anchor="middle" font-size="11" fill="#7c898b">${new Date(`${d.date}T12:00`).toLocaleDateString('es-MX', { weekday: 'short' })}</text>`).join('');
  const grid = [0, 0.5, 1].map((t) => `<line x1="${pad}" x2="${w}" y1="${h - 24 - t * (h - 44)}" y2="${h - 24 - t * (h - 44)}" stroke="#efe9df"/><text x="0" y="${h - 20 - t * (h - 44)}" font-size="10.5" fill="#9aa5a6">${Math.round(t * max)}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img">${grid}${bars}</svg>`;
}

function donut(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let acc = 0;
  const r = 52; const c = 2 * Math.PI * r;
  const arcs = parts.map((p) => {
    const len = (p.value / total) * c;
    const seg = `<circle r="${r}" cx="70" cy="70" fill="none" stroke="${p.color}" stroke-width="18" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 70 70)"><title>${p.label}: ${p.value}</title></circle>`;
    acc += len;
    return seg;
  }).join('');
  return `<svg viewBox="0 0 140 140" width="140" height="140">${arcs}<text x="70" y="68" text-anchor="middle" font-size="22" font-weight="600" fill="#15262b">${total === 1 && !parts.some((p) => p.value) ? 0 : total}</text><text x="70" y="86" text-anchor="middle" font-size="10.5" fill="#7c898b">comentarios</text></svg>`;
}

const SENTIMENT = {
  positive: { label: 'Positivo', color: '#367454', cls: 'ok' },
  neutral: { label: 'Neutral', color: '#9aa5a6', cls: '' },
  negative: { label: 'Negativo', color: '#a9443a', cls: 'bad' },
  mixed: { label: 'Mixto', color: '#c9933a', cls: 'warn' },
};

const confBar = (value) => {
  const color = value >= 0.9 ? '#367454' : value >= 0.8 ? '#5b8f6f' : value >= 0.6 ? '#c9933a' : '#a9443a';
  return `<div class="conf"><div class="bar"><i style="width:${Math.round(value * 100)}%;background:${color}"></i></div><span class="small mono">${pct(value)}</span></div>`;
};

/* ============================== Bienvenida ============================== */

async function renderWelcome(view) {
  view.innerHTML = `
  <div class="stack">
    <section class="hero">
      <svg class="waves" viewBox="0 0 600 200" fill="none" stroke="#7fb7bf" stroke-width="1.4"><path d="M0 150c80-60 160 30 240-20s160-60 240-10 120 20 120 20"/><path d="M0 175c80-50 160 25 240-15s160-50 240-8 120 15 120 15" opacity=".6"/><path d="M0 125c80-70 160 35 240-25s160-70 240-12 120 25 120 25" opacity=".35"/></svg>
      <div class="eyebrow">Piloto AI-901 · Distribuidora Río Claro</div>
      <h2>Facturas, inventario, políticas y clientes en un solo cauce.</h2>
      <p>Cauce conecta Microsoft Foundry y los servicios de Azure AI para responder con evidencia, leer facturas, detectar duplicados y escuchar a los clientes. Lo dudoso siempre pasa por una persona.</p>
      <div class="row wrap">
        <a class="btn btn-light" href="#/panel">${icon('dashboard')}Ver panel ejecutivo</a>
        <a class="btn btn-outline" href="#/asistente">${icon('chat')}Probar el asistente</a>
      </div>
    </section>

    <section>
      <div class="row" style="margin:6px 0 12px"><h2 style="font-size:17px">Elige un perfil para explorar</h2><span class="badge demo">Control de acceso de demostración</span></div>
      <div class="profiles">
        <button class="profile" data-role="cliente">
          <div class="ic">${icon('user')}</div><h3>Cliente</h3>
          <p>Consulta productos, disponibilidad, pedidos y políticas públicas. No ve costos ni datos de otros clientes.</p>
        </button>
        <button class="profile" data-role="sucursal">
          <div class="ic">${icon('store')}</div><h3>Personal de sucursal</h3>
          <p>Existencias exactas por sucursal, políticas internas, quejas y revisión de respuestas del asistente.</p>
        </button>
        <button class="profile" data-role="finanzas">
          <div class="ic">${icon('coins')}</div><h3>Finanzas / Dirección</h3>
          <p>Acceso completo: facturas de proveedores, costos, duplicados y aprobación de la cola de revisión.</p>
        </button>
      </div>
    </section>

    <div class="grid g-main">
      <section class="card">
        <div class="card-head"><h2>Del problema a la solución</h2></div>
        <div class="problems" style="margin-top:12px;border-top:1px solid var(--line)">
          ${[
            ['Facturas en PDF y fotos dispersas', 'Document Intelligence extrae proveedor, folio, fecha y total', 'invoice'],
            ['Captura manual y pagos duplicados', 'Detección de duplicados exactos, por folio y por monto', 'copy'],
            ['Catálogos distintos por sucursal', 'Catálogo maestro con alias por sucursal', 'box'],
            ['Quejas sin historial', 'Language + Foundry clasifican tema y sentimiento', 'message'],
            ['Políticas contradictorias', 'El asistente cita versiones y escala conflictos', 'alert'],
            ['Datos sensibles sin control', 'Permisos por perfil aplicados en el servidor', 'shield'],
          ].map(([k, s, ic]) => `<div class="problem"><div class="k">Problema</div><div class="v">${k}</div><div class="s">${icon(ic)}${s}</div></div>`).join('')}
        </div>
      </section>
      <section class="card card-pad">
        <h2 style="font-size:15px">Recorrido sugerido para evaluar</h2>
        <ol class="steps" style="margin-top:10px">
          <li><span>Como <strong>Cliente</strong>, pregunta en el Asistente: «¿Cuántos días tengo para devolver?»</span></li>
          <li><span>Cambia a <strong>Finanzas</strong> y procesa las facturas de muestra.</span></li>
          <li><span>Procesa la foto de la factura A-10482 y observa el duplicado.</span></li>
          <li><span>Resuelve los casos en <strong>Revisión humana</strong>.</span></li>
          <li><span>Analiza una queja nueva y una imagen en <strong>Voz y visión</strong>.</span></li>
          <li><span>Revisa el estado real de cada servicio en <strong>IA responsable</strong>.</span></li>
        </ol>
      </section>
    </div>
    <div class="notice">${icon('info')}<div>Distribuidora Río Claro, sus sucursales, clientes, proveedores y documentos son <strong>ficticios</strong>. Las respuestas, extracciones y análisis sí se generan en vivo con servicios reales de Azure.</div></div>
  </div>`;
}

/* ============================== Panel ============================== */

async function renderDashboard(view) {
  const d = await api('/api/dashboard');
  const k = d.kpis;
  const kpi = (ic, label, value, foot, alert) => `<div class="card kpi ${alert ? 'alert' : ''}"><div class="label">${icon(ic)}${label}</div><div class="value">${value}</div><div class="foot">${foot}</div></div>`;
  const maxTopic = Math.max(1, ...d.topComplaints.map((t) => t.count));
  const s = d.sentiment;
  view.innerHTML = `
  <div class="stack">
    <div class="kpis">
      ${kpi('chat', 'Consultas atendidas', k.consultas, `${k.consultasSinEvidencia} sin evidencia suficiente`)}
      ${kpi('invoice', 'Facturas procesadas', k.facturasProcesadas, `${k.facturasValidadas} validadas o aprobadas`)}
      ${kpi('alert', 'Facturas en revisión', k.facturasPendientes, d.montoEnRevision != null ? `${money(d.montoEnRevision)} retenidos` : 'Monto visible para Finanzas', k.facturasPendientes > 0)}
      ${kpi('copy', 'Posibles duplicados', k.posiblesDuplicados, 'Detectados antes de pagar', k.posiblesDuplicados > 0)}
      ${kpi('message', 'Comentarios analizados', k.comentariosAnalizados, `${k.revisionesPendientes} casos en revisión humana`)}
    </div>

    <div class="grid g-main">
      <section class="card">
        <div class="card-head"><h2>Actividad de los últimos 7 días</h2><div class="right legend"><span><i style="background:#1d5c69"></i>Consultas</span><span><i style="background:#c9933a"></i>Facturas</span></div></div>
        <div class="card-pad chart">${barChart(d.trend, ['consultas', 'facturas'], ['#1d5c69', '#c9933a'])}</div>
      </section>
      <section class="card">
        <div class="card-head"><h2>Sentimiento de clientes</h2><span class="hint">Azure AI Language</span></div>
        <div class="card-pad row" style="gap:22px">
          ${donut(Object.entries(SENTIMENT).map(([key, v]) => ({ label: v.label, value: s[key] || 0, color: v.color })))}
          <div class="stack" style="gap:8px">${Object.entries(SENTIMENT).map(([key, v]) => `<div class="row small"><i class="dot" style="color:${v.color}"></i>${v.label}<strong style="margin-left:auto">${s[key] || 0}</strong></div>`).join('')}</div>
        </div>
      </section>
    </div>

    <div class="grid g-main">
      <section class="card">
        <div class="card-head"><h2>Principales motivos de queja</h2><a class="right btn btn-sm btn-ghost" href="#/quejas">Ver análisis ${icon('arrow')}</a></div>
        <div class="card-pad">
          ${d.topComplaints.length ? d.topComplaints.map((t) => `<div class="hbar"><span>${esc(t.topic)}</span><div class="track"><div class="fill ${t.negative ? 'neg' : ''}" style="width:${(t.count / maxTopic) * 100}%"></div></div><strong class="num">${t.count}</strong></div>`).join('') : '<div class="empty">Analizando comentarios…</div>'}
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>Actividad reciente</h2></div>
        <div class="card-pad" style="padding-top:6px">
          ${d.activity.length ? `<ul class="feed">${d.activity.slice(0, 7).map((a) => `<li><div class="ic">${icon({ asistente: 'chat', factura: 'invoice', quejas: 'message', revision: 'check', vision: 'eye' }[a.type] || 'spark')}</div><div><div>${esc(a.message)}</div><time>${timeAgo(a.at)}</time></div></li>`).join('')}</ul>` : '<div class="empty">Aún no hay actividad. Empieza con el asistente o las facturas.</div>'}
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2>Desabasto por sucursal</h2><span class="hint">Catálogo de demostración</span><a class="right btn btn-sm btn-ghost" href="#/catalogo">Inventario ${icon('arrow')}</a></div>
      <div class="card-pad row wrap" style="gap:8px">${d.lowStock.map((p) => `<span class="badge bad">${esc(p.name)} · ${esc(p.branch)}</span>`).join('') || '<span class="muted">Sin productos agotados.</span>'}</div>
    </section>
  </div>`;
}

/* ============================== Asistente ============================== */

const SUGGESTIONS = {
  cliente: ['¿Cuántos días tengo para devolver un producto?', '¿Tienen aceite vegetal en Sucursal Costa?', '¿Cuál es el estatus del pedido PED-24852?', '¿Hacen entregas gratis?', '¿Venden pintura para exteriores?'],
  sucursal: ['¿Cuánto frijol negro hay en cada sucursal?', '¿Qué descuento por volumen aplica a 45 cajas?', '¿Por qué está retenido el pedido PED-24879?', '¿Qué es "BLANQUEADOR 1L" en el catálogo maestro?'],
  finanzas: ['¿Cuándo debe ir una factura a revisión humana?', '¿Cuál es el margen del café soluble?', '¿Qué productos están agotados en Sucursal Bajío?', '¿Quién puede ver los datos bancarios de proveedores?'],
};

async function renderAssistant(view) {
  view.innerHTML = `
  <div class="chat">
    <section class="card chat-main">
      <div class="messages" id="messages"></div>
      <form class="composer" id="composer">
        <button type="button" class="btn icon-btn mic" id="micBtn" title="Preguntar por voz (Azure AI Speech)" aria-label="Preguntar por voz">${icon('mic')}</button>
        <textarea id="prompt" rows="1" placeholder="Pregunta sobre productos, inventario, pedidos o políticas…" aria-label="Pregunta"></textarea>
        <button class="btn btn-primary icon-btn" id="sendBtn" aria-label="Enviar">${icon('send')}</button>
      </form>
    </section>
    <aside class="stack chat-side">
      <div class="card card-pad">
        <div class="small muted">Respondiendo como</div>
        <div style="font-weight:600;margin-top:2px">${esc(session.info.roles.find((r) => r.id === session.role).label)}</div>
        <div class="small" style="margin-top:2px">${icon('store')} ${esc(branchName(session.branch))}</div>
      </div>
      <div class="card card-pad">
        <div style="font-weight:600;font-size:14px;margin-bottom:10px">Cómo responde Río</div>
        <ul class="small" style="padding-left:18px;margin:0;color:var(--ink-2);display:flex;flex-direction:column;gap:6px">
          <li>Consulta herramientas de catálogo, inventario, pedidos y políticas antes de responder.</li>
          <li>Cita cada dato con su fuente y su sucursal.</li>
          <li>Si no hay evidencia o hay políticas contradictorias, lo dice y lo envía a revisión humana.</li>
        </ul>
        <div class="small muted" style="margin-top:10px">Modelo: <span class="mono">${esc(session.info.model)}</span> en Microsoft Foundry</div>
      </div>
    </aside>
  </div>`;
  drawMessages();
  const prompt = $('#prompt');
  $('#composer').addEventListener('submit', (e) => { e.preventDefault(); sendMessage(prompt.value); });
  prompt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(prompt.value); } });
  prompt.addEventListener('input', () => { prompt.style.height = 'auto'; prompt.style.height = `${prompt.scrollHeight}px`; });
  $('#micBtn').addEventListener('click', toggleRecording);
}

function drawMessages(pending = false) {
  const box = $('#messages');
  if (!box) return;
  if (!session.chat.length && !pending) {
    box.innerHTML = `<div style="margin:auto;max-width:520px;text-align:center">
      <div class="brand-mark" style="margin:0 auto 12px;width:46px;height:46px"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M3 15c3-5 6 1 9-2.5S17 10 21 11"/></svg></div>
      <h2 style="font-size:19px">Hola, soy Río</h2>
      <p class="muted" style="margin:6px 0 18px">Respondo con información de la sucursal activa y siempre te digo de dónde sale cada dato.</p>
      <div class="chips" style="justify-content:center">${SUGGESTIONS[session.role].map((s) => `<button class="chip" data-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    </div>`;
    return;
  }
  const STATUS = {
    OK: '<span class="badge ok"><i class="dot"></i>Con evidencia</span>',
    SIN_EVIDENCIA: '<span class="badge warn"><i class="dot"></i>Sin evidencia suficiente · en revisión</span>',
    REVISION: '<span class="badge warn"><i class="dot"></i>Conflicto de políticas · en revisión</span>',
    ERROR: '<span class="badge bad"><i class="dot"></i>Error del servicio</span>',
  };
  box.innerHTML = session.chat.map((m, i) => (m.role === 'user'
    ? `<div class="msg user"><div class="bubble">${esc(m.content)}</div>${m.voice ? '<div class="meta">' + icon('mic') + ' Transcrito con Azure AI Speech</div>' : ''}</div>`
    : `<div class="msg bot"><div class="bubble">${md(m.content)}</div>
        <div class="meta">${STATUS[m.status] || ''}${m.branch ? `<span class="badge info">${icon('store')}${esc(m.branch.name)}</span>` : ''}
          ${m.status !== 'ERROR' ? `<button class="btn btn-sm btn-ghost" data-speak="${i}" title="Escuchar (Azure AI Speech)">${icon('speaker')}Escuchar</button>` : ''}</div>
        ${m.sources?.length ? `<div class="meta">Fuentes: ${m.sources.map((s) => `<span class="source">${esc(s)}</span>`).join('')}</div>` : ''}
      </div>`)).join('') + (pending ? '<div class="msg bot"><div class="bubble typing"><span></span><span></span><span></span></div><div class="meta">Consultando herramientas…</div></div>' : '');
  box.scrollTop = box.scrollHeight;
}

let sending = false;
async function sendMessage(text, voice = false) {
  text = (text || '').trim();
  if (!text || sending) return;
  sending = true;
  const history = session.chat.filter((m) => m.status !== 'ERROR').map(({ role, content }) => ({ role, content }));
  session.chat.push({ role: 'user', content: text, voice });
  if ($('#prompt')) { $('#prompt').value = ''; $('#prompt').style.height = 'auto'; }
  drawMessages(true);
  $('#sendBtn') && ($('#sendBtn').disabled = true);
  try {
    const r = await api('/api/assistant', { method: 'POST', json: { message: text, history } });
    session.chat.push({ role: 'assistant', content: r.answer, status: r.status, sources: r.sources, branch: r.branch });
    if (r.reviewId) toast('La respuesta se envió a revisión humana.', 'ok');
  } catch (error) {
    session.chat.push({ role: 'assistant', content: `No pude responder: ${error.message}`, status: 'ERROR' });
  } finally {
    sending = false;
    drawMessages();
    $('#sendBtn') && ($('#sendBtn').disabled = false);
    refreshPending();
  }
}

/* -------- Voz: grabación WAV 16 kHz para Azure AI Speech -------- */

const recorder = { stream: null, ctx: null, node: null, chunks: [], active: false, rate: 48000 };

async function toggleRecording() {
  const btn = $('#micBtn');
  if (recorder.active) return stopRecording();
  if (!navigator.mediaDevices?.getUserMedia) return toast('Tu navegador no permite grabar audio.', 'bad');
  try {
    recorder.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch {
    return toast('No se concedió acceso al micrófono.', 'bad');
  }
  recorder.ctx = new (window.AudioContext || window.webkitAudioContext)();
  recorder.rate = recorder.ctx.sampleRate;
  const source = recorder.ctx.createMediaStreamSource(recorder.stream);
  recorder.node = recorder.ctx.createScriptProcessor(4096, 1, 1);
  recorder.chunks = [];
  recorder.node.onaudioprocess = (e) => recorder.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  source.connect(recorder.node);
  recorder.node.connect(recorder.ctx.destination);
  recorder.active = true;
  btn.classList.add('recording');
  btn.title = 'Detener y enviar';
  toast('Escuchando… toca de nuevo para enviar.', 'ok');
  recorder.timer = setTimeout(() => recorder.active && stopRecording(), 15000);
}

async function stopRecording() {
  clearTimeout(recorder.timer);
  recorder.active = false;
  $('#micBtn')?.classList.remove('recording');
  recorder.node.disconnect();
  recorder.stream.getTracks().forEach((t) => t.stop());
  await recorder.ctx.close();
  const wav = encodeWav(recorder.chunks, recorder.rate, 16000);
  const box = $('#messages');
  if (box) box.insertAdjacentHTML('beforeend', '<div class="msg user" id="sttPending"><div class="bubble typing"><span></span><span></span><span></span></div><div class="meta">Transcribiendo con Azure AI Speech…</div></div>');
  try {
    const r = await api('/api/speech/stt', { method: 'POST', body: wav, headers: { 'Content-Type': 'audio/wav' } });
    $('#sttPending')?.remove();
    if (r.status !== 'Success' || !r.text) return toast('No se reconoció voz. Intenta hablar más cerca del micrófono.', 'bad');
    sendMessage(r.text, true);
  } catch (error) {
    $('#sttPending')?.remove();
    toast(error.message, 'bad');
  }
}

function encodeWav(chunks, inRate, outRate) {
  const length = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  chunks.forEach((c) => { merged.set(c, offset); offset += c.length; });
  const ratio = inRate / outRate;
  const outLength = Math.floor(merged.length / ratio);
  const buffer = new ArrayBuffer(44 + outLength * 2);
  const view = new DataView(buffer);
  const write = (o, s) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + outLength * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, outRate, true); view.setUint32(28, outRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, outLength * 2, true);
  for (let i = 0; i < outLength; i += 1) {
    const sample = Math.max(-1, Math.min(1, merged[Math.floor(i * ratio)]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

let currentAudio = null;
async function speak(text, btn) {
  try {
    if (currentAudio) currentAudio.pause();
    btn && (btn.disabled = true);
    const blob = await api('/api/speech/tts', { method: 'POST', json: { text } });
    currentAudio = new Audio(URL.createObjectURL(blob));
    await currentAudio.play();
  } catch (error) {
    toast(`Voz no disponible: ${error.message}`, 'bad');
  } finally {
    btn && (btn.disabled = false);
  }
}

/* ============================== Facturas ============================== */

let samplesCache = null;
async function getSamples() {
  if (!samplesCache) samplesCache = await api('/api/samples');
  return samplesCache;
}

const INVOICE_STATUS = {
  validada: '<span class="badge ok"><i class="dot"></i>Validada</span>',
  en_revision: '<span class="badge warn"><i class="dot"></i>En revisión</span>',
  aprobada: '<span class="badge ok"><i class="dot"></i>Aprobada</span>',
  rechazada: '<span class="badge bad"><i class="dot"></i>Rechazada</span>',
};

async function renderInvoices(view) {
  if (!roleCan[session.role].invoices) { view.innerHTML = lockedNotice('Facturas de proveedores'); return; }
  const [list, samples] = await Promise.all([api('/api/invoices'), getSamples()]);
  view.innerHTML = `
  <div class="stack">
    <div class="grid g-main">
      <section class="card card-pad stack" style="gap:14px">
        <div class="row"><h2 style="font-size:15px">Cargar factura</h2><span class="badge info">Azure AI Document Intelligence · prebuilt-invoice</span></div>
        <label class="dropzone" id="dropzone">
          ${icon('upload')}
          <div style="font-weight:600;margin-top:6px">Arrastra un PDF o una foto de la factura</div>
          <div class="small muted">PDF, JPG, PNG o TIFF · máximo 8 MB · se guarda en Azure Blob Storage</div>
          <input type="file" id="fileInput" accept=".pdf,image/*" hidden>
        </label>
        <div id="processing"></div>
      </section>
      <section class="card card-pad">
        <div class="row" style="margin-bottom:10px"><h2 style="font-size:15px">Facturas de muestra</h2><span class="badge demo">Ficticias</span></div>
        <div class="sample-list">${samples.invoices.map((s) => `<div class="sample">${icon('file')}<div class="t"><div>${esc(s.title)}</div><div class="e">Esperado: ${esc(s.expected)}</div></div><a class="btn btn-sm btn-ghost hide-mobile" href="/samples/${esc(s.file)}" target="_blank" rel="noopener" title="Ver archivo">${icon('eye')}</a><button class="btn btn-sm" data-sample="${esc(s.file)}">Procesar</button></div>`).join('')}</div>
      </section>
    </div>
    <section class="card">
      <div class="card-head"><h2>Facturas procesadas</h2><span class="hint">Umbral de revisión: confianza menor a ${pct(session.info.reviewThreshold)}</span></div>
      <div class="table-wrap" style="margin-top:12px">${invoiceTable(list)}</div>
    </section>
  </div>`;

  const input = $('#fileInput');
  const zone = $('#dropzone');
  input.addEventListener('change', () => input.files[0] && uploadInvoice(input.files[0]));
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('over'); if (e.dataTransfer.files[0]) uploadInvoice(e.dataTransfer.files[0]); });
  window.__invoices = list;
}

function invoiceTable(list) {
  if (!list.length) return `<div class="empty">${icon('invoice')}<div>Aún no hay facturas. Procesa una muestra o carga un archivo.</div></div>`;
  return `<table class="table"><thead><tr><th>ID</th><th>Proveedor</th><th>Folio</th><th>Fecha</th><th class="num">Total</th><th>Confianza</th><th>Estado</th></tr></thead><tbody>
    ${list.map((i) => `<tr class="clickable" data-invoice="${i.id}"><td class="mono">${i.id}</td><td>${esc(i.fields.proveedor || '—')}${i.duplicates?.length ? ' <span class="badge bad">Duplicado</span>' : ''}</td><td class="mono">${esc(i.fields.folio || '—')}</td><td>${esc(i.fields.fecha || '—')}</td><td class="num">${money(i.fields.total)}</td><td>${confBar(i.overallConfidence)}</td><td>${INVOICE_STATUS[i.status] || i.status}</td></tr>`).join('')}
  </tbody></table>`;
}

async function runInvoice(promise) {
  const box = $('#processing');
  const steps = ['Guardando original en Blob Storage', 'Extrayendo campos con Document Intelligence', 'Calculando confianza y buscando duplicados'];
  let step = 0;
  const draw = () => { box.innerHTML = `<div class="progress-steps">${steps.map((s, i) => `<div class="${i < step ? 'done' : i === step ? 'active' : ''}">${i < step ? icon('check') : i === step ? '<span class="spinner"></span>' : '<span class="dot" style="margin:0 5px"></span>'}${s}</div>`).join('')}</div>`; };
  draw();
  const timer = setInterval(() => { if (step < 2) { step += 1; draw(); } }, 2200);
  try {
    const invoice = await promise;
    clearInterval(timer);
    box.innerHTML = '';
    toast(invoice.status === 'validada' ? `${invoice.id} validada automáticamente.` : `${invoice.id} enviada a revisión humana.`, 'ok');
    await router();
    showInvoice(invoice);
  } catch (error) {
    clearInterval(timer);
    box.innerHTML = `<div class="notice bad">${icon('alert')}<div>${esc(error.message)}</div></div>`;
  }
}

function uploadInvoice(file) {
  const form = new FormData();
  form.append('file', file);
  runInvoice(api('/api/invoices', { method: 'POST', body: form }));
}

function showInvoice(inv) {
  const f = inv.fields;
  const rows = [['Proveedor', f.proveedor, inv.confidence.proveedor], ['Folio', f.folio, inv.confidence.folio], ['Fecha', f.fecha, inv.confidence.fecha], ['Total', money(f.total), inv.confidence.total]];
  openDrawer(`${inv.id} · ${inv.fileName}`, `
    <div class="row wrap">${INVOICE_STATUS[inv.status]}<span class="badge">${inv.source === 'muestra' ? 'Muestra' : 'Carga'} · ${esc(branchName(inv.branch))}</span>${inv.supplierId ? `<span class="badge info">Padrón ${inv.supplierId}</span>` : '<span class="badge warn">Proveedor no registrado</span>'}</div>
    ${inv.reviewReasons?.length ? `<div class="notice warn">${icon('alert')}<div><strong>Motivos de revisión</strong><ul style="margin:6px 0 0;padding-left:18px">${inv.reviewReasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div></div>` : `<div class="notice">${icon('check')}<div>Todos los campos clave superan el umbral de confianza y no hay duplicados.</div></div>`}
    <div><div class="small muted" style="margin-bottom:8px">Campos extraídos · confianza por campo</div>
      <table class="table"><tbody>${rows.map(([k, v, c]) => `<tr><td class="muted" style="width:90px">${k}</td><td><strong>${esc(v ?? 'No detectado')}</strong></td><td style="width:150px">${confBar(c)}</td></tr>`).join('')}</tbody></table></div>
    <dl class="kv"><dt>Subtotal</dt><dd>${money(f.subtotal)}</dd><dt>Impuestos</dt><dd>${money(f.impuestos)}</dd><dt>Moneda</dt><dd>${esc(f.moneda)}</dd><dt>Cliente</dt><dd>${esc(f.cliente || '—')}</dd><dt>Huella SHA-256</dt><dd class="mono">${esc(inv.fileHash)}</dd><dt>Almacenado en</dt><dd class="mono">${esc(inv.blobPath || 'Memoria (Blob no configurado)')}</dd></dl>
    ${inv.duplicates?.length ? `<div><div class="small muted" style="margin-bottom:6px">Duplicados detectados</div>${inv.duplicates.map((d) => `<div class="notice bad" style="margin-bottom:6px">${icon('copy')}<div><strong>${d.type === 'exacto' ? 'Archivo idéntico' : d.type === 'folio' ? 'Folio repetido' : 'Posible duplicado'}</strong> · ${esc(d.detail)}</div></div>`).join('')}</div>` : ''}
    <div class="row wrap">${inv.blobName ? `<button class="btn" data-open-original="${inv.id}">${icon('file')}Ver original</button>` : ''}<a class="btn" href="#/revision">${icon('check')}Ir a revisión</a></div>`);
}

/* ============================== Catálogo ============================== */

async function renderCatalog(view) {
  const data = await api('/api/catalog');
  const categories = [...new Set(data.items.map((i) => i.category))];
  view.innerHTML = `
  <div class="stack">
    <div class="row wrap">
      <input class="input" id="catSearch" placeholder="Buscar por nombre, SKU o nombre de sucursal (ej. BLANQUEADOR)" style="max-width:420px">
      <select class="select" id="catFilter"><option value="">Todas las categorías</option>${categories.map((c) => `<option>${c}</option>`).join('')}</select>
      <label class="row small" style="gap:6px"><input type="checkbox" id="catIncons"> Solo nombres inconsistentes</label>
      <span class="spacer" style="flex:1"></span>
      <span class="badge demo">Catálogo de demostración</span>
    </div>
    ${!data.exactStock ? `<div class="notice">${icon('info')}<div>Como <strong>Cliente</strong> ves disponibilidad general. Las existencias exactas y costos están restringidos por perfil.</div></div>` : ''}
    <section class="card"><div class="table-wrap" id="catTable"></div></section>
    <section class="card card-pad">
      <div class="row"><h2 style="font-size:15px">Inconsistencias de catálogo detectadas</h2><span class="badge warn">${data.items.filter((i) => i.inconsistent).length} productos</span></div>
      <p class="small muted" style="margin:6px 0 0">El mismo artículo se registra con nombres distintos en cada sucursal. El catálogo maestro los unifica con un SKU único y el asistente reconoce ambos nombres.</p>
    </section>
  </div>`;

  const draw = () => {
    const q = $('#catSearch').value.toLowerCase();
    const cat = $('#catFilter').value;
    const onlyInc = $('#catIncons').checked;
    const items = data.items.filter((i) => (!cat || i.category === cat) && (!onlyInc || i.inconsistent)
      && (!q || `${i.sku} ${i.name} ${Object.values(i.branchNames).join(' ')}`.toLowerCase().includes(q)));
    const stockCell = (v) => {
      if (typeof v === 'number') return `<td class="num ${v === 0 ? '' : ''}">${v === 0 ? '<span class="badge bad">0</span>' : v < 20 ? `<span class="badge warn">${v}</span>` : v}</td>`;
      return `<td><span class="badge ${v === 'Agotado' ? 'bad' : v === 'Pocas' ? 'warn' : 'ok'}">${v}</span></td>`;
    };
    $('#catTable').innerHTML = `<table class="table"><thead><tr><th>SKU</th><th>Producto</th><th class="num">Precio</th>${data.canSeeCosts ? '<th class="num">Costo</th><th class="num">Margen</th>' : ''}${data.branches.map((b) => `<th class="${b.id === session.branch ? '' : ''}">${b.id}${b.id === session.branch ? ' ●' : ''}</th>`).join('')}</tr></thead><tbody>
      ${items.map((i) => `<tr><td class="mono">${i.sku}</td><td><div>${esc(i.name)}</div><div class="small muted">${esc(i.category)} · ${esc(i.unit)}</div>${i.inconsistent ? `<div class="row wrap" style="gap:4px;margin-top:4px">${Object.entries(i.branchNames).map(([b, n]) => `<span class="badge warn" title="Nombre en ${esc(branchName(b))}">${b}: ${esc(n)}</span>`).join('')}</div>` : ''}</td><td class="num">${money(i.price)}</td>${data.canSeeCosts ? `<td class="num">${money(i.cost)}</td><td class="num">${i.margin}%</td>` : ''}${data.branches.map((b) => stockCell(i.stock[b.id])).join('')}</tr>`).join('') || `<tr><td colspan="9"><div class="empty">Sin resultados.</div></td></tr>`}
    </tbody></table>`;
  };
  ['input', 'change'].forEach((ev) => view.addEventListener(ev, (e) => { if (['catSearch', 'catFilter', 'catIncons'].includes(e.target.id)) draw(); }));
  draw();
}

/* ============================== Quejas ============================== */

async function renderComplaints(view) {
  const data = await api('/api/complaints');
  const max = Math.max(1, ...data.topics.map((t) => t.count));
  view.innerHTML = `
  <div class="stack">
    <div class="grid g-main">
      <section class="card card-pad stack" style="gap:12px">
        <div class="row wrap"><h2 style="font-size:15px">Analizar un comentario</h2><span class="badge info">Azure AI Language + Microsoft Foundry</span></div>
        <textarea class="input" id="complaintText" placeholder="Ej. El pedido llegó con dos días de retraso y faltaban cajas de leche." maxlength="1000"></textarea>
        <div class="row wrap">
          <select class="select" id="complaintBranch">${session.info.branches.map((b) => `<option value="${b.id}" ${b.id === session.branch ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
          <button class="btn btn-primary" id="analyzeBtn">${icon('spark')}Analizar</button>
        </div>
        <div id="complaintResult"></div>
      </section>
      <section class="card card-pad">
        <h2 style="font-size:15px">Problemas recurrentes</h2>
        <p class="small muted" style="margin:4px 0 12px">Temas con 2 o más menciones, por sucursal.</p>
        ${data.recurring.length ? data.recurring.slice(0, 6).map((t) => `<div style="padding:8px 0;border-bottom:1px solid #efe9df"><div class="row"><strong style="font-size:14px">${esc(t.topic)}</strong><span class="badge ${t.negative ? 'bad' : ''}" style="margin-left:auto">${t.count}</span></div><div class="small muted">${esc(t.branchesLabel)}</div></div>`).join('') : '<div class="empty">Analizando el lote inicial…</div>'}
      </section>
    </div>
    <section class="card">
      <div class="card-head"><h2>Temas de queja</h2><span class="hint">${data.total} comentarios analizados · lote de demostración + nuevos</span></div>
      <div class="card-pad">${data.topics.map((t) => `<div class="hbar"><span>${esc(t.topic)}</span><div class="track"><div class="fill ${t.negative ? 'neg' : ''}" style="width:${(t.count / max) * 100}%"></div></div><strong class="num">${t.count}</strong></div>`).join('')}</div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Comentarios</h2><div class="right segmented" id="sentFilter"><button class="active" data-s="">Todos</button><button data-s="negative">Negativos</button><button data-s="positive">Positivos</button></div></div>
      <div class="table-wrap" style="margin-top:12px" id="complaintTable"></div>
    </section>
  </div>`;

  const drawTable = (filter = '') => {
    const items = data.items.filter((c) => !filter || c.sentiment === filter);
    $('#complaintTable').innerHTML = `<table class="table"><thead><tr><th>Comentario</th><th>Sucursal</th><th>Tema</th><th>Sentimiento</th><th class="hide-mobile">Frases clave</th></tr></thead><tbody>${items.map((c) => `<tr><td style="min-width:240px">${esc(c.text)}${c.origin === 'demo' ? ' <span class="badge demo">demo</span>' : ''}${c.piiDetected?.length ? ' <span class="badge warn" title="Datos personales ocultados">PII ocultada</span>' : ''}</td><td>${c.branch}</td><td>${esc(c.topic)}</td><td><span class="badge ${SENTIMENT[c.sentiment]?.cls}">${SENTIMENT[c.sentiment]?.label || c.sentiment}</span></td><td class="small muted hide-mobile">${esc((c.keyPhrases || []).slice(0, 3).join(', '))}</td></tr>`).join('')}</tbody></table>`;
  };
  drawTable();
  $('#sentFilter').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    [...$('#sentFilter').children].forEach((x) => x.classList.toggle('active', x === b));
    drawTable(b.dataset.s);
  });
  $('#analyzeBtn').addEventListener('click', async () => {
    const text = $('#complaintText').value.trim();
    if (text.length < 5) return toast('Escribe un comentario más descriptivo.', 'bad');
    const btn = $('#analyzeBtn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Analizando…';
    try {
      const r = await api('/api/complaints', { method: 'POST', json: { text, branch: $('#complaintBranch').value } });
      const s = SENTIMENT[r.sentiment];
      $('#complaintResult').innerHTML = `<div class="card card-pad fade-in" style="background:var(--surface-2)">
        <div class="row wrap"><span class="badge ${s.cls}">${s.label}</span><span class="badge info">${esc(r.topic)}</span>${r.needsReview ? '<span class="badge warn">Enviado a revisión</span>' : ''}${r.piiDetected.length ? `<span class="badge warn">PII ocultada: ${esc(r.piiDetected.join(', '))}</span>` : ''}</div>
        <dl class="kv" style="margin-top:12px"><dt>Positivo / Neutral / Negativo</dt><dd class="mono">${pct(r.scores.positive)} / ${pct(r.scores.neutral)} / ${pct(r.scores.negative)}</dd><dt>Confianza del tema</dt><dd>${pct(r.topicConfidence)}</dd><dt>Frases clave</dt><dd>${esc(r.keyPhrases.join(', ') || '—')}</dd><dt>Texto almacenado</dt><dd>${esc(r.text)}</dd></dl></div>`;
      $('#complaintText').value = '';
      toast('Comentario analizado y registrado.', 'ok');
      refreshPending();
    } catch (error) {
      $('#complaintResult').innerHTML = `<div class="notice bad">${icon('alert')}<div>${esc(error.message)}</div></div>`;
    } finally {
      btn.disabled = false; btn.innerHTML = `${icon('spark')}Analizar`;
    }
  });
}

/* ============================== Voz y visión ============================== */

async function renderVision(view) {
  const samples = await getSamples();
  view.innerHTML = `
  <div class="stack">
    <div class="grid g-2">
      <section class="card card-pad stack" style="gap:12px">
        <div class="row wrap"><h2 style="font-size:15px">Analizar una imagen</h2><span class="badge info">Azure AI Vision + Foundry multimodal</span></div>
        <label class="dropzone" id="imgZone">${icon('camera')}<div style="font-weight:600;margin-top:6px">Toma o sube una foto</div><div class="small muted">Etiquetas de producto, anaqueles, mercancía dañada o facturas fotografiadas</div><input type="file" id="imgInput" accept="image/jpeg,image/png" capture="environment" hidden></label>
        <div class="sample-list">${samples.images.map((s) => `<div class="sample"><img src="/samples/${esc(s.file)}" alt="" width="44" height="34" style="object-fit:cover;border-radius:6px"><div class="t">${esc(s.title)}</div><button class="btn btn-sm" data-vsample="${esc(s.file)}">Analizar</button></div>`).join('')}</div>
      </section>
      <section class="card card-pad stack" style="gap:12px">
        <div class="row wrap"><h2 style="font-size:15px">Consulta por voz</h2><span class="badge info">Azure AI Speech · es-MX</span></div>
        <p class="small muted" style="margin:0">Habla tu pregunta: se transcribe con Speech, la responde el agente en Foundry y puedes escucharla con voz neuronal.</p>
        <div class="row wrap"><a class="btn btn-primary" href="#/asistente">${icon('mic')}Abrir asistente con micrófono</a><button class="btn" id="ttsDemo">${icon('speaker')}Probar voz neuronal</button></div>
        <div class="notice">${icon('info')}<div>El navegador pedirá permiso de micrófono. El audio se envía al servidor y de ahí a Azure AI Speech; no se almacena.</div></div>
      </section>
    </div>
    <div id="visionResult"></div>
  </div>`;
  const input = $('#imgInput');
  input.addEventListener('change', () => {
    if (!input.files[0]) return;
    const form = new FormData(); form.append('image', input.files[0]);
    runVision(api('/api/vision', { method: 'POST', body: form }), URL.createObjectURL(input.files[0]));
  });
  $('#ttsDemo').addEventListener('click', (e) => speak('Hola, soy Río, el asistente de Distribuidora Río Claro. ¿En qué te puedo ayudar hoy?', e.currentTarget));
}

async function runVision(promise, preview) {
  const box = $('#visionResult');
  box.innerHTML = '<div class="card card-pad row"><span class="spinner"></span>Analizando imagen con Azure AI Vision y Foundry…</div>';
  try {
    const r = await promise;
    const it = r.interpretation || {};
    box.innerHTML = `<div class="grid g-2 fade-in">
      <section class="card card-pad stack" style="gap:12px">
        <img src="${preview}" alt="Imagen analizada" style="width:100%;max-height:320px;object-fit:contain;border-radius:8px;background:var(--surface-2)">
        <div><div class="small muted" style="margin-bottom:6px">Azure AI Vision · etiquetas</div><div class="tag-cloud">${r.vision.tags.slice(0, 12).map((t) => `<span class="badge">${esc(t.name)} · ${pct(t.confidence)}</span>`).join('') || '<span class="muted small">Sin etiquetas</span>'}</div></div>
        <div><div class="small muted" style="margin-bottom:6px">Azure AI Vision · texto detectado (OCR)</div><div class="mono" style="background:var(--surface-2);padding:10px;border-radius:8px;max-height:160px;overflow:auto;white-space:pre-wrap">${esc(r.vision.text.join('\n') || 'Sin texto legible')}</div></div>
      </section>
      <section class="card card-pad stack" style="gap:12px">
        <div class="row wrap"><h2 style="font-size:15px">Interpretación de negocio</h2><span class="badge info">Foundry · ${esc(session.info.model)}</span>${it.requiere_revision ? '<span class="badge warn">Requiere revisión</span>' : ''}</div>
        <dl class="kv"><dt>Tipo</dt><dd>${esc(it.tipo || '—')}</dd><dt>Descripción</dt><dd>${esc(it.descripcion || '—')}</dd><dt>Confianza</dt><dd>${it.confianza != null ? confBar(Number(it.confianza)) : '—'}</dd><dt>Acción sugerida</dt><dd>${esc(it.accion_sugerida || '—')}</dd></dl>
        ${it.hallazgos?.length ? `<ul style="margin:0;padding-left:18px;font-size:14px">${it.hallazgos.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
        ${r.looksLikeInvoice ? `<div class="notice warn">${icon('invoice')}<div>Parece una factura. Para extraer folio y total con confianza por campo, procésala en el módulo <a href="#/facturas">Facturas</a> (Document Intelligence).</div></div>` : ''}
        <p class="small muted" style="margin:0">La interpretación es una sugerencia generada por IA; no modifica inventario ni pagos sin revisión.</p>
      </section></div>`;
  } catch (error) {
    box.innerHTML = `<div class="notice bad">${icon('alert')}<div>${esc(error.message)}</div></div>`;
  }
}

/* ============================== Revisión humana ============================== */

const REVIEW_TYPE = { factura: ['invoice', 'Factura'], asistente: ['chat', 'Respuesta del asistente'], comentario: ['message', 'Comentario'] };

async function renderReviews(view) {
  if (!roleCan[session.role].review) {
    view.innerHTML = `<div class="card card-pad"><div class="empty">${icon('shield')}<div><strong>Panel de revisión humana</strong></div><p class="small">Disponible para Personal de sucursal y Finanzas.</p><button class="btn btn-primary" data-role="sucursal">Cambiar a Personal de sucursal</button></div></div>`;
    return;
  }
  const reviews = await api('/api/reviews');
  const pending = reviews.filter((r) => r.status === 'pendiente');
  const done = reviews.filter((r) => r.status !== 'pendiente');
  const card = (r) => {
    const [ic, label] = REVIEW_TYPE[r.type] || ['info', r.type];
    const body = r.type === 'asistente'
      ? `<div class="small muted">Pregunta</div><div>${esc(r.question)}</div><div class="small muted" style="margin-top:8px">Respuesta propuesta</div><div style="white-space:pre-wrap;font-size:14px">${md(r.answer)}</div>${r.sources?.length ? `<div class="meta row wrap" style="margin-top:6px">${r.sources.map((s) => `<span class="source">${esc(s)}</span>`).join('')}</div>` : ''}`
      : `<div>${esc(r.summary || '')}</div>${r.reasons?.length ? `<ul class="small" style="margin:6px 0 0;padding-left:18px">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
    return `<article class="card card-pad stack" style="gap:10px">
      <div class="row wrap"><span class="badge info">${icon(ic)}${label}</span><span class="badge warn">${esc(r.reason)}</span><span class="small muted" style="margin-left:auto">${esc(branchName(r.branch))} · ${timeAgo(r.createdAt)}</span></div>
      ${body}
      ${r.status === 'pendiente' ? `<div class="row wrap"><input class="input" placeholder="Nota del revisor (opcional)" data-note="${r.id}" style="flex:1;min-width:180px">
        <button class="btn btn-primary btn-sm" data-decide="${r.id}" data-d="aprobado">${icon('check')}Aprobar</button>
        <button class="btn btn-sm" data-decide="${r.id}" data-d="corregido">Marcar corregido</button>
        <button class="btn btn-sm btn-danger" data-decide="${r.id}" data-d="rechazado">${icon('x')}Rechazar</button>
        ${r.invoiceId ? `<button class="btn btn-sm btn-ghost" data-show-invoice="${r.invoiceId}">Ver factura</button>` : ''}</div>`
        : `<div class="small"><span class="badge ${r.status === 'rechazado' ? 'bad' : 'ok'}">${r.status}</span> por ${esc(r.resolvedBy)} ${timeAgo(r.resolvedAt)}${r.note ? ` · “${esc(r.note)}”` : ''}</div>`}
    </article>`;
  };
  view.innerHTML = `
  <div class="stack">
    <div class="notice warn">${icon('alert')}<div>La IA no aprueba pagos ni publica respuestas dudosas por sí sola. Todo caso con baja confianza, duplicado, falta de evidencia o conflicto de políticas llega aquí.</div></div>
    <div class="row"><h2 style="font-size:16px">Pendientes</h2><span class="badge warn">${pending.length}</span></div>
    ${pending.length ? pending.map(card).join('') : `<div class="card"><div class="empty">${icon('check')}<div>No hay casos pendientes.</div></div></div>`}
    ${done.length ? `<div class="row" style="margin-top:8px"><h2 style="font-size:16px">Resueltos</h2><span class="badge">${done.length}</span></div>${done.slice(0, 15).map(card).join('')}` : ''}
  </div>`;
}

/* ============================== Transparencia ============================== */

async function renderTransparency(view) {
  const services = [
    ['foundry', 'Microsoft Foundry', `Modelo ${session.info.model}: agente con herramientas, clasificación de temas e interpretación de imágenes.`],
    ['documentIntelligence', 'Azure AI Document Intelligence', 'Modelo prebuilt-invoice: proveedor, folio, fecha, total y confianza por campo.'],
    ['language', 'Azure AI Language', 'Sentimiento, frases clave y detección/ocultamiento de datos personales.'],
    ['vision', 'Azure AI Vision', 'Image Analysis 4.0: OCR, etiquetas y objetos.'],
    ['speech', 'Azure AI Speech', 'Voz a texto y voz neuronal es-MX-DaliaNeural.'],
    ['blobStorage', 'Azure Blob Storage', 'Documentos originales y estado operativo en contenedores privados.'],
  ];
  view.innerHTML = `
  <div class="stack">
    <section class="card">
      <div class="card-head"><h2>Estado real de los servicios</h2><span class="hint" id="healthTime">Verificación en vivo</span><button class="btn btn-sm right" id="healthBtn">${icon('refresh')}Verificar</button></div>
      <div class="card-pad status-grid" id="healthGrid">${services.map(([id, name, desc]) => `<div class="svc" data-svc="${id}"><div class="row"><span class="n">${name}</span><span class="badge" style="margin-left:auto" data-state><span class="spinner"></span></span></div><div class="d">${desc}</div></div>`).join('')}</div>
      <div class="card-pad" style="padding-top:0"><div class="small muted">Plataforma: Azure App Service (Linux, Node.js 22). Las claves viven solo en la configuración del servidor; el navegador nunca las recibe.</div></div>
    </section>

    <div class="grid g-2">
      <section class="card card-pad">
        <h2 style="font-size:15px;margin-bottom:10px">Principios de IA responsable aplicados</h2>
        <ul class="steps">
          <li><div><strong>Fundamentación:</strong> el asistente solo responde con datos de sus herramientas y cita la fuente.</div></li>
          <li><div><strong>Supervisión humana:</strong> baja confianza, duplicados, falta de evidencia y conflictos van a revisión.</div></li>
          <li><div><strong>Privacidad:</strong> permisos por perfil en el servidor y ocultamiento automático de datos personales en quejas.</div></li>
          <li><div><strong>Transparencia:</strong> cada resultado indica qué servicio lo produjo y qué datos son de demostración.</div></li>
          <li><div><strong>Seguridad de contenido:</strong> filtros de contenido de Azure en el modelo y límite de uso por IP.</div></li>
        </ul>
      </section>
      <section class="card">
        <div class="card-head"><h2>Matriz de acceso por perfil</h2><span class="badge demo">Demostración</span></div>
        <div class="table-wrap" style="margin-top:10px"><table class="table matrix"><thead><tr><th>Dato</th><th>Cliente</th><th>Sucursal</th><th>Finanzas</th></tr></thead><tbody>
          ${[['Catálogo y precios', 1, 1, 1], ['Existencias exactas', 0, 1, 1], ['Políticas internas', 0, 1, 1], ['Montos y nombre de cliente en pedidos', 0, 1, 1], ['Costos y márgenes', 0, 0, 1], ['Facturas de proveedores', 0, 0, 1], ['Revisión humana', 0, 1, 1]]
            .map(([k, ...v]) => `<tr><td>${k}</td>${v.map((x) => `<td>${x ? '<span class="badge ok">Sí</span>' : '<span class="badge">No</span>'}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
      </section>
    </div>

    <section class="card card-pad">
      <h2 style="font-size:15px;margin-bottom:8px">Limitaciones conocidas</h2>
      <ul style="margin:0;padding-left:18px;color:var(--ink-2);font-size:14px;display:flex;flex-direction:column;gap:4px">
        <li>Los perfiles se eligen en pantalla para facilitar la evaluación; en producción se integraría Microsoft Entra ID.</li>
        <li>La base de conocimiento es un conjunto pequeño de datos ficticios; no se conecta a un ERP real.</li>
        <li>Plan gratuito F1: la primera carga tras inactividad puede tardar unos segundos.</li>
        <li>La transcripción de voz acepta fragmentos de hasta 15 segundos.</li>
        <li>Las interpretaciones de imágenes son sugerencias y no modifican datos.</li>
      </ul>
    </section>
  </div>`;
  const check = async () => {
    $('#healthBtn').disabled = true;
    try {
      const r = await api('/api/health?deep=1');
      Object.entries(r.checks).forEach(([id, c]) => {
        const el = $(`[data-svc="${id}"] [data-state]`);
        if (el) el.outerHTML = c.ok ? `<span class="badge ok" style="margin-left:auto" data-state><i class="dot"></i>Operativo${c.ms ? ` · ${c.ms} ms` : ''}</span>` : `<span class="badge bad" style="margin-left:auto" data-state title="${esc(c.error)}"><i class="dot"></i>No disponible</span>`;
      });
      $('#healthTime').textContent = `Verificado ${new Date(r.checkedAt).toLocaleTimeString('es-MX')}`;
    } catch (error) {
      toast(error.message, 'bad');
    } finally {
      $('#healthBtn').disabled = false;
    }
  };
  $('#healthBtn').addEventListener('click', check);
  check();
}

/* ============================== Eventos globales ============================== */

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-role],[data-ask],[data-speak],[data-sample],[data-invoice],[data-open-original],[data-decide],[data-show-invoice],[data-vsample]');
  if (!t) return;
  if (t.dataset.role) {
    setRole(t.dataset.role);
    if (t.classList.contains('profile')) location.hash = t.dataset.role === 'finanzas' ? '#/facturas' : '#/asistente';
    else router();
  } else if (t.dataset.ask) {
    sendMessage(t.dataset.ask);
  } else if (t.dataset.speak) {
    speak(session.chat[Number(t.dataset.speak)].content, t);
  } else if (t.dataset.sample) {
    document.querySelectorAll('[data-sample]').forEach((b) => { b.disabled = true; });
    runInvoice(api(`/api/invoices/sample/${encodeURIComponent(t.dataset.sample)}`, { method: 'POST' }));
  } else if (t.dataset.invoice) {
    const inv = (window.__invoices || []).find((i) => i.id === t.dataset.invoice);
    if (inv) showInvoice(inv);
  } else if (t.dataset.showInvoice) {
    const list = await api('/api/invoices');
    const inv = list.find((i) => i.id === t.dataset.showInvoice);
    if (inv) showInvoice(inv);
  } else if (t.dataset.openOriginal) {
    try {
      const blob = await api(`/api/invoices/${t.dataset.openOriginal}/file`);
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch (error) { toast(error.message, 'bad'); }
  } else if (t.dataset.decide) {
    const note = $(`[data-note="${t.dataset.decide}"]`)?.value || '';
    try {
      await api(`/api/reviews/${t.dataset.decide}`, { method: 'POST', json: { decision: t.dataset.d, note } });
      toast(`Caso ${t.dataset.d}.`, 'ok');
      router();
    } catch (error) { toast(error.message, 'bad'); }
  } else if (t.dataset.vsample) {
    runVision(api(`/api/vision/sample/${encodeURIComponent(t.dataset.vsample)}`, { method: 'POST' }), `/samples/${t.dataset.vsample}`);
  }
});

function setRole(role) {
  session.role = role;
  localSet('cauce.role', role);
  $('#roleSelect').value = role;
  session.chat = [];
  toast(`Perfil: ${session.info.roles.find((r) => r.id === role).label}`, 'ok');
}

async function boot() {
  session.info = await api('/api/session');
  $('#roleSelect').innerHTML = session.info.roles.map((r) => `<option value="${r.id}">${r.label}</option>`).join('');
  $('#branchSelect').innerHTML = session.info.branches.map((b) => `<option value="${b.id}">${b.name}</option>`).join('');
  $('#roleSelect').value = session.role;
  $('#branchSelect').value = session.branch;
  $('#roleSelect').addEventListener('change', (e) => { setRole(e.target.value); router(); });
  $('#branchSelect').addEventListener('change', (e) => { session.branch = e.target.value; localSet('cauce.branch', session.branch); session.chat = []; router(); });
  $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#drawerBackdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeDrawer());
  window.addEventListener('hashchange', router);
  router();
}

boot().catch((error) => {
  $('#view').innerHTML = `<div class="notice bad">${icon('alert')}<div>No se pudo iniciar la aplicación: ${esc(error.message)}</div></div>`;
});
