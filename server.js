/**
 * Río Claro Operaciones — servidor web del piloto AI-901.
 *
 * Expone la interfaz web (carpeta /public) y una API que orquesta los
 * servicios de Microsoft Foundry y Azure AI. Las claves de servicio solo
 * existen en el servidor (App Settings); el navegador nunca las recibe.
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const config = require('./src/config');
const store = require('./src/services/store');
const { attachRole, requirePermission, ROLES } = require('./src/services/access');
const assistant = require('./src/services/assistant');
const invoices = require('./src/services/invoices');
const complaints = require('./src/services/complaints');
const vision = require('./src/services/vision');
const cognitive = require('./src/azure/cognitive');
const { chatCompletion } = require('./src/azure/foundry');
const { branches, products, policies } = require('./src/data/demo-data');
const { branchName } = require('./src/services/knowledge');

const app = express();
const SAMPLES_DIR = path.join(__dirname, 'public', 'samples');
const ALLOWED_DOCS = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/bmp'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

/* ---------------------------- Seguridad base ---------------------------- */

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'microphone=(self), camera=(self)',
  });
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/api', attachRole);

/**
 * Límite de uso por IP para proteger el presupuesto del piloto: cada llamada
 * a un servicio de IA consume crédito de Azure.
 */
const usage = new Map();
function aiRateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const entry = usage.get(key) || { start: now, count: 0 };
  if (now - entry.start > windowMs) Object.assign(entry, { start: now, count: 0 });
  entry.count += 1;
  usage.set(key, entry);
  if (entry.count > 80) return res.status(429).json({ error: 'Se alcanzó el límite de uso de la demostración. Intenta de nuevo en unos minutos.' });
  return next();
}

/** Envuelve manejadores asíncronos y traduce errores de servicio. */
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    const status = error.service ? 502 : 500;
    console.error(`[${req.method} ${req.path}]`, error.message, error.detail || '');
    res.status(status).json({ error: error.service ? `${error.service} no respondió correctamente (${error.status}).` : 'Error interno al procesar la solicitud.', service: error.service || null });
  }
};

const requireService = (name, label) => (req, res, next) => (config.services[name]
  ? next()
  : res.status(503).json({ error: `${label} no está configurado en este despliegue.`, service: label }));

/* ------------------------------- Sesión -------------------------------- */

app.get('/api/session', (req, res) => {
  res.json({
    role: req.role,
    roles: Object.entries(ROLES).map(([id, r]) => ({ id, label: r.label })),
    branches,
    services: config.services,
    persistence: store.status(),
    model: config.ai.chatDeployment,
    reviewThreshold: config.reviewConfidenceThreshold,
  });
});

/* ------------------------------ Dashboard ------------------------------ */

app.get('/api/dashboard', handle(async (req, res) => {
  const state = store.get();
  const pendingReviews = state.reviews.filter((r) => r.status === 'pendiente');
  const complaintSummary = complaints.summary();
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10);
    const dayActivity = state.activity.filter((a) => a.at.startsWith(d));
    return {
      date: d,
      consultas: dayActivity.filter((a) => a.type === 'asistente').length,
      facturas: dayActivity.filter((a) => a.type === 'factura').length,
    };
  });
  const lowStock = products.flatMap((p) => Object.entries(p.stock).filter(([, q]) => q === 0).map(([b]) => ({ sku: p.sku, name: p.name, branch: branchName(b) })));
  res.json({
    kpis: {
      consultas: state.assistant.total,
      consultasSinEvidencia: state.assistant.insufficientEvidence,
      facturasProcesadas: state.invoices.length,
      facturasValidadas: state.invoices.filter((i) => i.status === 'validada' || i.status === 'aprobada').length,
      facturasPendientes: pendingReviews.filter((r) => r.type === 'factura').length,
      posiblesDuplicados: state.invoices.filter((i) => i.duplicates?.length).length,
      revisionesPendientes: pendingReviews.length,
      comentariosAnalizados: complaintSummary.total,
      imagenesAnalizadas: state.vision.total,
    },
    topComplaints: complaintSummary.topics.slice(0, 6),
    sentiment: complaintSummary.bySentiment,
    trend: days,
    lowStock: lowStock.slice(0, 8),
    activity: state.activity.slice(0, 12),
    montoEnRevision: req.role.canSeeInvoices
      ? state.invoices.filter((i) => i.status === 'en_revision').reduce((sum, i) => sum + (Number(i.fields.total) || 0), 0)
      : null,
  });
}));

app.get('/api/activity', (req, res) => res.json(store.get().activity.slice(0, 100)));

/* ------------------------------ Asistente ------------------------------ */

app.post('/api/assistant', aiRateLimit, requireService('foundry', 'Microsoft Foundry'), handle(async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Escribe una pregunta.' });
  const history = Array.isArray(req.body.history) ? req.body.history : [];
  res.json(await assistant.ask({ message, history, role: req.role }));
}));

/* ------------------------------- Facturas ------------------------------ */

app.get('/api/invoices', requirePermission('canSeeInvoices'), (req, res) => {
  res.json(store.get().invoices.map(({ fileHash, vendorKey, folioKey, ...invoice }) => ({ ...invoice, fileHash: `${fileHash.slice(0, 12)}…` })));
});

app.post('/api/invoices', aiRateLimit, requirePermission('canSeeInvoices'), requireService('documentIntelligence', 'Document Intelligence'), upload.single('file'), handle(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Adjunta un PDF o una imagen.' });
  if (!ALLOWED_DOCS.includes(req.file.mimetype)) return res.status(415).json({ error: 'Formato no admitido. Usa PDF, JPG, PNG o TIFF.' });
  const invoice = await invoices.processInvoice({ buffer: req.file.buffer, fileName: req.file.originalname, contentType: req.file.mimetype, branch: req.role.branch });
  res.json(invoice);
}));

app.get('/api/samples', (req, res) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, 'manifest.json'), 'utf8'));
  res.json(manifest);
});

app.post('/api/invoices/sample/:file', aiRateLimit, requirePermission('canSeeInvoices'), requireService('documentIntelligence', 'Document Intelligence'), handle(async (req, res) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, 'manifest.json'), 'utf8'));
  const sample = manifest.invoices.find((s) => s.file === req.params.file);
  if (!sample) return res.status(404).json({ error: 'Muestra no encontrada.' });
  const buffer = fs.readFileSync(path.join(SAMPLES_DIR, sample.file));
  const contentType = sample.file.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
  res.json(await invoices.processInvoice({ buffer, fileName: sample.file, contentType, branch: req.role.branch, source: 'muestra' }));
}));

app.get('/api/invoices/:id/file', requirePermission('canSeeInvoices'), handle(async (req, res) => {
  const invoice = store.get().invoices.find((i) => i.id === req.params.id);
  if (!invoice?.blobName) return res.status(404).json({ error: 'Documento no disponible.' });
  const doc = await store.readDocument(invoice.blobName);
  if (!doc) return res.status(404).json({ error: 'Documento no disponible.' });
  res.set('Content-Type', doc.contentType).send(doc.buffer);
}));

/* -------------------------- Catálogo e inventario ---------------------- */

app.get('/api/catalog', (req, res) => {
  const role = req.role;
  res.json({
    branches,
    items: products.map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      unit: p.unit,
      price: p.price,
      cost: role.canSeeCosts ? p.cost : undefined,
      margin: role.canSeeCosts ? Math.round(((p.price - p.cost) / p.price) * 1000) / 10 : undefined,
      stock: role.exactStock ? p.stock : Object.fromEntries(Object.entries(p.stock).map(([b, q]) => [b, q <= 0 ? 'Agotado' : q < 20 ? 'Pocas' : 'Disponible'])),
      branchNames: p.branchNames,
      inconsistent: Object.keys(p.branchNames).length > 0,
    })),
    exactStock: role.exactStock,
    canSeeCosts: role.canSeeCosts,
  });
});

app.get('/api/policies', (req, res) => {
  res.json(policies.filter((p) => p.audience === 'publica' || req.role.canSeeInternalPolicies).map(({ text, ...p }) => ({ ...p, text })));
});

/* --------------------------- Quejas y comentarios ---------------------- */

app.get('/api/complaints', handle(async (req, res) => {
  if (config.services.language && config.services.foundry) {
    await complaints.ensureSeedAnalyzed().catch((error) => console.error('Análisis inicial de comentarios:', error.message));
  }
  res.json(complaints.summary());
}));

app.post('/api/complaints', aiRateLimit, requireService('language', 'Azure AI Language'), handle(async (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 1000);
  if (text.length < 5) return res.status(400).json({ error: 'Escribe un comentario más descriptivo.' });
  const branch = branches.some((b) => b.id === req.body.branch) ? req.body.branch : req.role.branch;
  res.json(await complaints.analyzeOne(text, branch));
}));

/* ---------------------------- Revisión humana -------------------------- */

app.get('/api/reviews', requirePermission('canReview'), (req, res) => {
  const visible = store.get().reviews.filter((r) => r.type !== 'factura' || req.role.canSeeInvoices);
  res.json(visible);
});

app.post('/api/reviews/:id', requirePermission('canReview'), (req, res) => {
  const state = store.get();
  const review = state.reviews.find((r) => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'Elemento no encontrado.' });
  if (review.type === 'factura' && !req.role.canSeeInvoices) return res.status(403).json({ error: 'Solo Finanzas puede resolver facturas.' });
  const decision = ['aprobado', 'rechazado', 'corregido'].includes(req.body?.decision) ? req.body.decision : null;
  if (!decision) return res.status(400).json({ error: 'Decisión inválida.' });
  review.status = decision;
  review.resolvedAt = new Date().toISOString();
  review.resolvedBy = req.role.label;
  review.note = String(req.body.note || '').slice(0, 500);
  if (review.type === 'factura') {
    const invoice = state.invoices.find((i) => i.id === review.invoiceId);
    if (invoice) invoice.status = decision === 'aprobado' || decision === 'corregido' ? 'aprobada' : 'rechazada';
  }
  store.logActivity('revision', `${review.id} ${decision} por ${req.role.label}`);
  res.json(review);
});

/* ---------------------------- Voz y visión ----------------------------- */

app.post('/api/vision', aiRateLimit, requireService('vision', 'Azure AI Vision'), upload.single('image'), handle(async (req, res) => {
  if (!req.file || !req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Adjunta una imagen JPG o PNG.' });
  res.json(await vision.analyze(req.file.buffer, req.file.mimetype));
}));

app.post('/api/vision/sample/:file', aiRateLimit, requireService('vision', 'Azure AI Vision'), handle(async (req, res) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, 'manifest.json'), 'utf8'));
  const sample = manifest.images.find((s) => s.file === req.params.file);
  if (!sample) return res.status(404).json({ error: 'Muestra no encontrada.' });
  res.json(await vision.analyze(fs.readFileSync(path.join(SAMPLES_DIR, sample.file)), 'image/jpeg'));
}));

app.post('/api/speech/stt', aiRateLimit, requireService('speech', 'Azure AI Speech'), express.raw({ type: 'audio/wav', limit: '5mb' }), handle(async (req, res) => {
  if (!req.body?.length) return res.status(400).json({ error: 'No se recibió audio.' });
  const result = await cognitive.speechToText(req.body);
  store.get().voice.transcriptions += 1;
  store.save();
  res.json(result);
}));

app.post('/api/speech/tts', aiRateLimit, requireService('speech', 'Azure AI Speech'), handle(async (req, res) => {
  const text = String(req.body?.text || '').replace(/\[[^\]]+\]/g, '').replace(/[*#•]/g, '').trim();
  if (!text) return res.status(400).json({ error: 'Sin texto.' });
  const audio = await cognitive.textToSpeech(text);
  store.get().voice.syntheses += 1;
  store.save();
  res.set('Content-Type', 'audio/mpeg').send(audio);
}));

/* ------------------------ Diagnóstico de servicios --------------------- */

let healthCache = null;
app.get('/api/health', handle(async (req, res) => {
  if (!req.query.deep) return res.json({ ok: true, services: config.services, persistence: store.status() });
  if (healthCache && Date.now() - healthCache.at < 5 * 60 * 1000) return res.json(healthCache.data);
  const probe = async (fn) => {
    const start = Date.now();
    try { await fn(); return { ok: true, ms: Date.now() - start }; } catch (e) { return { ok: false, error: e.message }; }
  };
  const checks = {
    foundry: config.services.foundry ? await probe(() => chatCompletion({ messages: [{ role: 'user', content: 'Responde OK' }], maxTokens: 20 })) : { ok: false, error: 'No configurado' },
    language: config.services.language ? await probe(() => cognitive.sentiment(['Prueba de servicio'])) : { ok: false, error: 'No configurado' },
    documentIntelligence: config.services.documentIntelligence ? await probe(async () => {
      const r = await fetch(`${config.ai.endpoint}/documentintelligence/documentModels/prebuilt-invoice?api-version=2024-11-30`, { headers: { 'Ocp-Apim-Subscription-Key': config.ai.key } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }) : { ok: false, error: 'No configurado' },
    vision: config.services.vision ? await probe(() => cognitive.analyzeImage(fs.readFileSync(path.join(SAMPLES_DIR, 'producto-anaquel.jpg')))) : { ok: false, error: 'No configurado' },
    speech: config.services.speech ? await probe(() => cognitive.textToSpeech('Listo')) : { ok: false, error: 'No configurado' },
    blobStorage: store.status().persistent ? { ok: !store.status().lastSaveError, error: store.status().lastSaveError } : { ok: false, error: 'No configurado: estado en memoria' },
  };
  healthCache = { at: Date.now(), data: { checkedAt: new Date().toISOString(), checks } };
  res.json(healthCache.data);
}));

/* ----------------------------- Arranque -------------------------------- */

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

store.init()
  .catch((error) => console.error('No se pudo inicializar Blob Storage:', error.message))
  .finally(() => {
    app.listen(config.port, () => console.log(`Río Claro Operaciones escuchando en el puerto ${config.port}`));
    if (config.services.language && config.services.foundry) {
      complaints.ensureSeedAnalyzed().catch((error) => console.error('Análisis inicial de comentarios:', error.message));
    }
  });
