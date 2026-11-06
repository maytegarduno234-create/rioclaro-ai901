/**
 * Análisis de comentarios y quejas.
 *
 * - Azure AI Language: sentimiento, frases clave y detección/redacción de PII.
 * - Microsoft Foundry: clasificación por tema con una taxonomía cerrada.
 * - Reglas locales: agregación de problemas recurrentes por tema y sucursal.
 */
const language = require('../azure/cognitive');
const { chatJson } = require('../azure/foundry');
const { feedback } = require('../data/demo-data');
const { branchName } = require('./knowledge');
const store = require('./store');

const TOPICS = [
  'Entrega tardía',
  'Pedido incompleto',
  'Producto dañado',
  'Desabasto de inventario',
  'Facturación y cobros',
  'Políticas contradictorias',
  'Cadena de frío y caducidad',
  'Catálogo inconsistente',
  'Atención y comunicación',
  'Seguridad de datos',
  'Elogio',
];

async function classifyTopics(texts) {
  const prompt = `Clasifica cada comentario de cliente en UNO de estos temas: ${TOPICS.join('; ')}.
Devuelve JSON: {"items":[{"i":<índice>,"tema":"<tema exacto>","confianza":<0 a 1>}]}. Si ningún tema aplica con claridad usa el más cercano y confianza baja.`;
  const result = await chatJson(prompt, texts.map((t, i) => `${i}. ${t}`).join('\n'), 2500);
  const byIndex = new Map((result.items || []).map((item) => [Number(item.i), item]));
  return texts.map((_, i) => {
    const item = byIndex.get(i);
    const topic = TOPICS.includes(item?.tema) ? item.tema : 'Atención y comunicación';
    return { topic, topicConfidence: item ? Number(item.confianza) || 0.5 : 0.3 };
  });
}

async function analyzeMany(entries, origin) {
  const texts = entries.map((e) => e.text);
  const [pii, sentiments, phrases] = await Promise.all([
    language.detectPii(texts),
    language.sentiment(texts),
    language.keyPhrases(texts),
  ]);
  const topics = await classifyTopics(pii.map((p, i) => p.redactedText || texts[i]));
  return entries.map((entry, i) => ({
    id: `COM-${Date.now().toString(36).toUpperCase()}-${i}`,
    branch: entry.branch,
    text: pii[i].redactedText || entry.text,
    piiDetected: pii[i].entities,
    sentiment: sentiments[i].sentiment,
    scores: sentiments[i].scores,
    keyPhrases: phrases[i],
    ...topics[i],
    origin,
    analyzedAt: new Date().toISOString(),
    needsReview: topics[i].topicConfidence < 0.6 || sentiments[i].sentiment === 'mixed',
  }));
}

/** Analiza el lote de demostración una sola vez y lo guarda. */
async function ensureSeedAnalyzed() {
  const state = store.get();
  if (state.complaints.some((c) => c.origin === 'demo')) return false;
  const analyzed = await analyzeMany(feedback.map(([branch, text]) => ({ branch, text })), 'demo');
  state.complaints.push(...analyzed);
  store.logActivity('quejas', `Lote de demostración analizado (${analyzed.length} comentarios)`);
  return true;
}

async function analyzeOne(text, branch) {
  const [result] = await analyzeMany([{ text, branch }], 'usuario');
  const state = store.get();
  state.complaints.unshift(result);
  if (result.needsReview) {
    state.reviews.unshift({
      id: `REV-${Date.now().toString(36).toUpperCase()}`,
      type: 'comentario',
      createdAt: result.analyzedAt,
      status: 'pendiente',
      reason: 'Clasificación con baja confianza o sentimiento mixto',
      branch,
      summary: result.text,
      complaintId: result.id,
    });
  }
  store.logActivity('quejas', `Comentario analizado: ${result.topic} (${result.sentiment})`);
  return result;
}

function summary() {
  const complaints = store.get().complaints;
  const byTopic = {};
  const bySentiment = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  const byBranch = {};
  for (const c of complaints) {
    bySentiment[c.sentiment] = (bySentiment[c.sentiment] || 0) + 1;
    if (c.topic === 'Elogio') continue;
    byTopic[c.topic] = byTopic[c.topic] || { topic: c.topic, count: 0, negative: 0, branches: {} };
    byTopic[c.topic].count += 1;
    if (c.sentiment === 'negative') byTopic[c.topic].negative += 1;
    byTopic[c.topic].branches[c.branch] = (byTopic[c.topic].branches[c.branch] || 0) + 1;
    byBranch[c.branch] = (byBranch[c.branch] || 0) + (c.sentiment === 'negative' ? 1 : 0);
  }
  const topics = Object.values(byTopic).sort((a, b) => b.count - a.count);
  const recurring = topics
    .filter((t) => t.count >= 2)
    .map((t) => ({
      ...t,
      branchesLabel: Object.entries(t.branches).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${branchName(id)} (${n})`).join(', '),
    }));
  return { total: complaints.length, topics, recurring, bySentiment, byBranch, items: complaints.slice(0, 120) };
}

module.exports = { TOPICS, ensureSeedAnalyzed, analyzeOne, summary };
