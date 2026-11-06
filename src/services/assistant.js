/**
 * Asistente inteligente (agente con herramientas) sobre Microsoft Foundry.
 *
 * El modelo no responde de memoria: debe llamar herramientas que consultan la
 * base de conocimiento y citar las fuentes devueltas. El servidor verifica la
 * evidencia y envía a revisión humana las respuestas sin evidencia o con
 * políticas contradictorias.
 */
const { chatCompletion } = require('../azure/foundry');
const knowledge = require('./knowledge');
const store = require('./store');

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'buscar_catalogo',
      description: 'Busca productos del catálogo por nombre, SKU o nombre usado en alguna sucursal. Devuelve precio, disponibilidad y fuente.',
      parameters: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_inventario',
      description: 'Consulta existencia de un producto (SKU o nombre) en la sucursal activa y en otras sucursales.',
      parameters: { type: 'object', properties: { sku_o_nombre: { type: 'string' }, sucursal: { type: 'string', description: 'Código de sucursal: CEN, NOR, ORI, BAJ o COS. Opcional.' } }, required: ['sku_o_nombre'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_pedido',
      description: 'Consulta el estatus de un pedido por folio (por ejemplo PED-24852).',
      parameters: { type: 'object', properties: { folio: { type: 'string' } }, required: ['folio'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_politicas',
      description: 'Busca políticas internas y comerciales (devoluciones, entregas, crédito, horarios, pagos, descuentos, datos). Indica si hay documentos contradictorios.',
      parameters: { type: 'object', properties: { tema: { type: 'string' } }, required: ['tema'] },
    },
  },
];

function systemPrompt(role) {
  return [
    'Eres "Río", el asistente de operaciones de Distribuidora Río Claro (empresa ficticia del piloto AI-901).',
    `Perfil de quien pregunta: ${role.label}. Sucursal activa: ${knowledge.branchName(role.branch)} (${role.branch}).`,
    'Reglas obligatorias:',
    '1. Usa SIEMPRE las herramientas antes de responder sobre productos, inventario, pedidos o políticas. Nunca inventes datos, precios, existencias ni plazos.',
    '2. Cita cada dato con su fuente entre corchetes, por ejemplo [Catálogo maestro ABA-1001] o [POL-DEV-2024].',
    '3. Indica siempre la sucursal a la que corresponde la información.',
    '4. Si las herramientas no devuelven evidencia suficiente, dilo claramente y no completes con suposiciones.',
    '5. Si dos políticas se contradicen, explica ambas versiones con su fuente, no elijas una por tu cuenta e indica que el caso se envió a revisión humana.',
    '6. Si el perfil no tiene acceso a cierta información, indícalo con cortesía sin revelar el contenido.',
    '7. Responde en español de México, en tono profesional y breve (máximo 120 palabras), con viñetas cuando ayuden.',
    'Al final agrega una línea exacta con el estado: "ESTADO: OK", "ESTADO: SIN_EVIDENCIA" o "ESTADO: REVISION".',
  ].join('\n');
}

function runTool(name, args, role) {
  const branch = args.sucursal && /^(CEN|NOR|ORI|BAJ|COS)$/i.test(args.sucursal) ? args.sucursal.toUpperCase() : role.branch;
  switch (name) {
    case 'buscar_catalogo': {
      const results = knowledge.searchCatalog(args.texto || '', role, branch);
      return { resultados: results, total: results.length };
    }
    case 'consultar_inventario': {
      const result = knowledge.checkInventory(args.sku_o_nombre || '', role, branch);
      return result ? { resultado: result } : { resultado: null, mensaje: 'Producto no encontrado en el catálogo maestro.' };
    }
    case 'consultar_pedido': {
      const result = knowledge.findOrder(args.folio || '', role);
      return result ? { resultado: result } : { resultado: null, mensaje: 'No existe un pedido con ese folio.' };
    }
    case 'buscar_politicas':
      return knowledge.searchPolicies(args.tema || '', role);
    default:
      return { error: 'Herramienta desconocida' };
  }
}

/** Extrae las fuentes citables de los resultados de herramientas. */
function collectEvidence(toolResults) {
  const sources = new Set();
  let hasEvidence = false;
  let conflict = false;
  for (const { result } of toolResults) {
    if (result.conflicto_detectado) conflict = true;
    const items = result.resultados || (result.resultado ? [result.resultado] : []);
    for (const item of items) {
      hasEvidence = true;
      if (item.fuente) sources.add(item.fuente);
    }
  }
  return { sources: [...sources], hasEvidence, conflict };
}

async function ask({ message, history = [], role }) {
  const messages = [
    { role: 'system', content: systemPrompt(role) },
    ...history.slice(-6).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 2000) })),
    { role: 'user', content: message.slice(0, 2000) },
  ];
  const toolResults = [];
  let finalText = '';

  for (let step = 0; step < 5; step += 1) {
    const completion = await chatCompletion({ messages, tools: TOOLS, maxTokens: 1200 });
    const choice = completion.choices?.[0]?.message;
    if (!choice) break;
    if (choice.tool_calls?.length) {
      messages.push({ role: 'assistant', content: choice.content || null, tool_calls: choice.tool_calls });
      for (const call of choice.tool_calls) {
        let args = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* argumentos inválidos: se usan vacíos */ }
        const result = runTool(call.function.name, args, role);
        toolResults.push({ tool: call.function.name, args, result });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }
    finalText = choice.content || '';
    break;
  }

  const statusMatch = finalText.match(/ESTADO:\s*(OK|SIN_EVIDENCIA|REVISION)/i);
  let status = statusMatch ? statusMatch[1].toUpperCase() : 'OK';
  const answer = finalText.replace(/\n?\s*ESTADO:\s*\w+\s*$/i, '').trim() || 'No pude generar una respuesta. Intenta reformular la pregunta.';
  const evidence = collectEvidence(toolResults);

  // Verificación del servidor: no depende solo de lo que declare el modelo.
  if (!evidence.hasEvidence && status === 'OK') status = 'SIN_EVIDENCIA';
  if (evidence.conflict) status = 'REVISION';

  const state = store.get();
  state.assistant.total += 1;
  state.assistant.byRole[role.id] = (state.assistant.byRole[role.id] || 0) + 1;
  state.assistant.byBranch[role.branch] = (state.assistant.byBranch[role.branch] || 0) + 1;
  if (status !== 'OK') state.assistant.insufficientEvidence += 1;

  let reviewId = null;
  if (status !== 'OK') {
    reviewId = `REV-${Date.now().toString(36).toUpperCase()}`;
    state.reviews.unshift({
      id: reviewId,
      type: 'asistente',
      createdAt: new Date().toISOString(),
      status: 'pendiente',
      reason: status === 'REVISION' ? 'Políticas contradictorias en la evidencia' : 'Respuesta sin evidencia suficiente',
      branch: role.branch,
      question: message,
      answer,
      sources: evidence.sources,
    });
  }
  store.logActivity('asistente', `Consulta atendida (${role.label}, ${role.branch})${status !== 'OK' ? ' · enviada a revisión' : ''}`, { status });

  return {
    answer,
    status,
    sources: evidence.sources,
    branch: { id: role.branch, name: knowledge.branchName(role.branch) },
    toolsUsed: toolResults.map((t) => t.tool),
    reviewId,
    model: process.env.AZURE_CHAT_DEPLOYMENT || 'gpt-5.6-luna',
  };
}

module.exports = { ask };
