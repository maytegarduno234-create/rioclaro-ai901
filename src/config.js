/**
 * Configuración de la aplicación.
 *
 * Todos los valores sensibles se leen de variables de entorno (App Settings de
 * Azure App Service). Ningún secreto se guarda en el código ni se envía al
 * navegador.
 */

function env(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

const config = {
  port: Number(env('PORT', 8080)),

  /** Recurso Microsoft Foundry (tipo AIServices, multiservicio). */
  ai: {
    endpoint: env('AZURE_AI_ENDPOINT').replace(/\/$/, ''), // https://<recurso>.cognitiveservices.azure.com
    openaiEndpoint: env('AZURE_OPENAI_ENDPOINT').replace(/\/$/, ''), // https://<recurso>.openai.azure.com
    key: env('AZURE_AI_KEY'),
    chatDeployment: env('AZURE_CHAT_DEPLOYMENT', 'gpt-5.6-luna'),
    region: env('AZURE_AI_REGION', 'canadacentral'),
  },

  storage: {
    connectionString: env('AZURE_STORAGE_CONNECTION_STRING'),
    documentsContainer: env('AZURE_STORAGE_DOCS_CONTAINER', 'facturas'),
    stateContainer: env('AZURE_STORAGE_STATE_CONTAINER', 'estado'),
  },

  /** Umbral de confianza por debajo del cual una extracción va a revisión humana. */
  reviewConfidenceThreshold: Number(env('REVIEW_CONFIDENCE_THRESHOLD', 0.8)),
};

config.services = {
  foundry: Boolean(config.ai.openaiEndpoint && config.ai.key),
  documentIntelligence: Boolean(config.ai.endpoint && config.ai.key),
  language: Boolean(config.ai.endpoint && config.ai.key),
  vision: Boolean(config.ai.endpoint && config.ai.key),
  speech: Boolean(config.ai.key && config.ai.region),
  blobStorage: Boolean(config.storage.connectionString),
};

module.exports = config;
