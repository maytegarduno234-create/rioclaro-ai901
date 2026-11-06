/**
 * Utilidades HTTP compartidas por los clientes de servicios de Azure AI.
 */

class AzureServiceError extends Error {
  constructor(service, status, detail) {
    super(`${service} respondió ${status}`);
    this.service = service;
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Ejecuta una petición y devuelve JSON. Lanza AzureServiceError con el detalle
 * del servicio si la respuesta no es exitosa.
 */
async function requestJson(service, url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new AzureServiceError(service, response.status, text.slice(0, 500));
    }
    return { body: text ? JSON.parse(text) : {}, headers: response.headers };
  } catch (error) {
    if (error.name === 'AbortError') throw new AzureServiceError(service, 'timeout', 'Tiempo de espera agotado');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { AzureServiceError, requestJson, sleep };
