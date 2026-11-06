/**
 * Cliente del modelo generativo desplegado en Microsoft Foundry.
 * Usa la API v1 compatible con OpenAI del recurso Foundry (chat completions
 * con llamadas a herramientas y entrada multimodal).
 */
const config = require('../config');
const { requestJson } = require('./http');

async function chatCompletion({ messages, tools, temperature, responseFormat, maxTokens = 1200 }) {
  const body = {
    model: config.ai.chatDeployment,
    messages,
    max_completion_tokens: maxTokens,
  };
  if (tools && tools.length) body.tools = tools;
  if (temperature !== undefined) body.temperature = temperature;
  if (responseFormat) body.response_format = responseFormat;

  const { body: result } = await requestJson('Microsoft Foundry', `${config.ai.openaiEndpoint}/openai/v1/chat/completions`, {
    method: 'POST',
    headers: { 'api-key': config.ai.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, 90000);
  return result;
}

/** Solicita una respuesta JSON y la interpreta de forma segura. */
async function chatJson(systemPrompt, userContent, maxTokens = 1500) {
  const result = await chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    responseFormat: { type: 'json_object' },
    maxTokens,
  });
  const content = result.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  }
}

module.exports = { chatCompletion, chatJson };
