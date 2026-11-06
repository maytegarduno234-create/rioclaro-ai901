/**
 * Clientes REST para Azure AI Document Intelligence, Azure AI Language,
 * Azure AI Vision y Azure AI Speech, todos expuestos por el mismo recurso
 * multiservicio de Microsoft Foundry.
 */
const config = require('../config');
const { requestJson, sleep, AzureServiceError } = require('./http');

const keyHeader = () => ({ 'Ocp-Apim-Subscription-Key': config.ai.key });

/* ------------------------------------------------------------------ */
/* Document Intelligence: modelo precompilado de facturas              */
/* ------------------------------------------------------------------ */

async function analyzeInvoice(buffer, contentType) {
  const url = `${config.ai.endpoint}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30&locale=es-MX`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...keyHeader(), 'Content-Type': contentType || 'application/octet-stream' },
    body: buffer,
  });
  if (response.status !== 202) {
    throw new AzureServiceError('Document Intelligence', response.status, (await response.text()).slice(0, 500));
  }
  const operationUrl = response.headers.get('operation-location');
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(attempt < 5 ? 1000 : 2000);
    const { body } = await requestJson('Document Intelligence', operationUrl, { headers: keyHeader() });
    if (body.status === 'succeeded') return body.analyzeResult;
    if (body.status === 'failed') throw new AzureServiceError('Document Intelligence', 'failed', JSON.stringify(body.error || {}));
  }
  throw new AzureServiceError('Document Intelligence', 'timeout', 'El análisis no terminó a tiempo');
}

/* ------------------------------------------------------------------ */
/* Language: sentimiento y frases clave                                */
/* ------------------------------------------------------------------ */

async function analyzeText(kind, texts) {
  const url = `${config.ai.endpoint}/language/:analyze-text?api-version=2023-04-01`;
  const results = [];
  for (let i = 0; i < texts.length; i += 5) {
    const chunk = texts.slice(i, i + 5);
    const { body } = await requestJson('Azure AI Language', url, {
      method: 'POST',
      headers: { ...keyHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        analysisInput: { documents: chunk.map((text, index) => ({ id: String(i + index), language: 'es', text })) },
        parameters: kind === 'SentimentAnalysis' ? { opinionMining: false } : {},
      }),
    });
    results.push(...body.results.documents);
  }
  return results.sort((a, b) => Number(a.id) - Number(b.id));
}

async function sentiment(texts) {
  const docs = await analyzeText('SentimentAnalysis', texts);
  return docs.map((doc) => ({ sentiment: doc.sentiment, scores: doc.confidenceScores }));
}

async function keyPhrases(texts) {
  const docs = await analyzeText('KeyPhraseExtraction', texts);
  return docs.map((doc) => doc.keyPhrases || []);
}

async function detectPii(texts) {
  const docs = await analyzeText('PiiEntityRecognition', texts);
  return docs.map((doc) => ({ redactedText: doc.redactedText, entities: (doc.entities || []).map((e) => e.category) }));
}

/* ------------------------------------------------------------------ */
/* Vision: OCR, etiquetas y objetos                                    */
/* ------------------------------------------------------------------ */

async function analyzeImage(buffer) {
  const url = `${config.ai.endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read,tags,objects&language=es`;
  const { body } = await requestJson('Azure AI Vision', url, {
    method: 'POST',
    headers: { ...keyHeader(), 'Content-Type': 'application/octet-stream' },
    body: buffer,
  });
  const lines = (body.readResult?.blocks || []).flatMap((block) => block.lines.map((line) => line.text));
  return {
    text: lines,
    tags: (body.tagsResult?.values || []).map((t) => ({ name: t.name, confidence: t.confidence })),
    objects: (body.objectsResult?.values || []).map((o) => ({ name: o.tags?.[0]?.name, confidence: o.tags?.[0]?.confidence })),
    size: body.metadata,
  };
}

/* ------------------------------------------------------------------ */
/* Speech: voz a texto y texto a voz                                   */
/* ------------------------------------------------------------------ */

async function speechToText(wavBuffer) {
  const url = `https://${config.ai.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=es-MX&format=detailed`;
  const { body } = await requestJson('Azure AI Speech', url, {
    method: 'POST',
    headers: { ...keyHeader(), 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json' },
    body: wavBuffer,
  });
  const best = body.NBest?.[0];
  return { status: body.RecognitionStatus, text: body.DisplayText || '', confidence: best?.Confidence ?? null };
}

function escapeXml(text) {
  return text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

async function textToSpeech(text) {
  const url = `https://${config.ai.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<speak version="1.0" xml:lang="es-MX"><voice name="es-MX-DaliaNeural">${escapeXml(text.slice(0, 1200))}</voice></speak>`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...keyHeader(), 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'rio-claro-operaciones' },
    body: ssml,
  });
  if (!response.ok) throw new AzureServiceError('Azure AI Speech', response.status, await response.text());
  return Buffer.from(await response.arrayBuffer());
}

module.exports = { analyzeInvoice, sentiment, keyPhrases, detectPii, analyzeImage, speechToText, textToSpeech };
