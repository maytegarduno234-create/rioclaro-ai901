/**
 * Persistencia del piloto.
 *
 * El estado operativo (facturas, cola de revisión, quejas analizadas y
 * actividad) se guarda como JSON en Azure Blob Storage y los documentos
 * originales se guardan en un contenedor privado. Si Blob Storage no está
 * configurado, el estado vive solo en memoria y el panel lo indica.
 */
const { BlobServiceClient } = require('@azure/storage-blob');
const config = require('../config');

const STATE_BLOB = 'app-state.json';

const emptyState = () => ({
  version: 1,
  invoices: [],
  reviews: [],
  complaints: [],
  activity: [],
  assistant: { total: 0, insufficientEvidence: 0, byRole: {}, byBranch: {} },
  vision: { total: 0 },
  voice: { transcriptions: 0, syntheses: 0 },
});

let state = emptyState();
let docsContainer = null;
let stateContainer = null;
let saveTimer = null;
let lastSaveError = null;

async function init() {
  if (!config.services.blobStorage) return;
  const service = BlobServiceClient.fromConnectionString(config.storage.connectionString);
  docsContainer = service.getContainerClient(config.storage.documentsContainer);
  stateContainer = service.getContainerClient(config.storage.stateContainer);
  await docsContainer.createIfNotExists();
  await stateContainer.createIfNotExists();
  const blob = stateContainer.getBlockBlobClient(STATE_BLOB);
  if (await blob.exists()) {
    const buffer = await blob.downloadToBuffer();
    state = { ...emptyState(), ...JSON.parse(buffer.toString('utf8')) };
  }
}

function get() {
  return state;
}

/** Programa un guardado diferido para agrupar escrituras consecutivas. */
function save() {
  if (!stateContainer) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const data = Buffer.from(JSON.stringify(state));
      await stateContainer.getBlockBlobClient(STATE_BLOB).uploadData(data, { blobHTTPHeaders: { blobContentType: 'application/json' } });
      lastSaveError = null;
    } catch (error) {
      lastSaveError = error.message;
    }
  }, 400);
}

async function saveDocument(name, buffer, contentType) {
  if (!docsContainer) return null;
  const blob = docsContainer.getBlockBlobClient(name);
  await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
  return `${config.storage.documentsContainer}/${name}`;
}

async function readDocument(name) {
  if (!docsContainer) return null;
  const blob = docsContainer.getBlockBlobClient(name);
  if (!(await blob.exists())) return null;
  const props = await blob.getProperties();
  return { buffer: await blob.downloadToBuffer(), contentType: props.contentType };
}

function logActivity(type, message, meta = {}) {
  state.activity.unshift({ id: `ACT-${Date.now().toString(36)}`, at: new Date().toISOString(), type, message, ...meta });
  state.activity = state.activity.slice(0, 200);
  save();
}

/** Restablece el estado (solo para la demostración). */
function reset() {
  state = emptyState();
  save();
}

const status = () => ({ persistent: Boolean(stateContainer), lastSaveError });

module.exports = { init, get, save, saveDocument, readDocument, logActivity, reset, status };
