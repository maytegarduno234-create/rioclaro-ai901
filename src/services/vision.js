/**
 * Análisis de imágenes: Azure AI Vision (OCR, etiquetas, objetos) más una
 * interpretación de negocio con el modelo multimodal de Microsoft Foundry.
 * Ambos resultados se muestran por separado para que sea claro qué servicio
 * produjo cada dato.
 */
const { analyzeImage } = require('../azure/cognitive');
const { chatJson } = require('../azure/foundry');
const store = require('./store');

async function analyze(buffer, contentType) {
  const vision = await analyzeImage(buffer);

  const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
  const interpretation = await chatJson(
    `Eres analista de operaciones de una distribuidora de abarrotes. Analiza la imagen y responde JSON:
{"tipo":"factura|producto|mercancia_danada|anaquel|entrega|otro","descripcion":"<máx 40 palabras>","hallazgos":["..."],"accion_sugerida":"<una acción concreta>","requiere_revision":true|false,"confianza":<0-1>}
No inventes datos que no se vean en la imagen. Si algo no es legible dilo.`,
    [
      { type: 'text', text: `Texto detectado por OCR: ${vision.text.slice(0, 40).join(' | ') || '(sin texto)'}` },
      { type: 'image_url', image_url: { url: dataUrl } },
    ],
    800,
  );

  const looksLikeInvoice = interpretation.tipo === 'factura' || /factura|folio|subtotal|iva/i.test(vision.text.join(' '));
  const state = store.get();
  state.vision.total += 1;
  store.logActivity('vision', `Imagen analizada: ${interpretation.tipo || 'sin tipo'}`);
  return { vision, interpretation, looksLikeInvoice };
}

module.exports = { analyze };
