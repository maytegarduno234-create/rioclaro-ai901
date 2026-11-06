/**
 * Base de conocimiento del asistente: búsqueda sobre catálogo, inventario,
 * pedidos y políticas de demostración. Cada resultado incluye su fuente para
 * que el asistente pueda citarla.
 */
const { branches, products, customers, orders, policies } = require('../data/demo-data');

const normalize = (text = '') => text.toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');
const tokens = (text) => normalize(text).split(/\s+/).filter((t) => t.length > 2);
const branchName = (id) => branches.find((b) => b.id === id)?.name || id;

function score(query, haystack) {
  const target = normalize(haystack);
  return tokens(query).reduce((total, token) => total + (target.includes(token) ? 1 : target.includes(token.slice(0, 4)) ? 0.5 : 0), 0);
}

function availability(qty) {
  if (qty <= 0) return 'Agotado';
  if (qty < 20) return 'Pocas unidades';
  return 'Disponible';
}

function productView(product, role, branch) {
  const view = {
    sku: product.sku,
    nombre: product.name,
    categoria: product.category,
    presentacion: product.unit,
    precio_mxn: product.price,
    sucursal_consultada: branchName(branch),
    disponibilidad: availability(product.stock[branch] ?? 0),
    nombres_en_sucursales: product.branchNames,
    fuente: `Catálogo maestro ${product.sku}`,
  };
  if (role.exactStock) {
    view.existencia_sucursal = product.stock[branch] ?? 0;
    view.existencia_por_sucursal = product.stock;
  }
  if (role.canSeeCosts) view.costo_mxn = product.cost;
  return view;
}

function searchCatalog(query, role, branch) {
  const ranked = products
    .map((p) => ({ p, s: score(query, `${p.sku} ${p.name} ${p.category} ${Object.values(p.branchNames).join(' ')}`) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5);
  return ranked.map((r) => productView(r.p, role, branch));
}

function checkInventory(sku, role, branch) {
  const product = products.find((p) => normalize(p.sku) === normalize(sku)) || searchCatalogRaw(sku);
  if (!product) return null;
  const view = productView(product, role, branch);
  view.otras_sucursales_con_existencia = Object.entries(product.stock)
    .filter(([id, qty]) => id !== branch && qty > 0)
    .map(([id, qty]) => (role.exactStock ? `${branchName(id)}: ${qty}` : branchName(id)));
  return view;
}

function searchCatalogRaw(query) {
  return products.map((p) => ({ p, s: score(query, `${p.name} ${Object.values(p.branchNames).join(' ')}`) })).sort((a, b) => b.s - a.s).find((r) => r.s > 0)?.p;
}

function findOrder(folio, role) {
  const order = orders.find((o) => normalize(o.id).replace(/ /g, '') === normalize(folio).replace(/ /g, ''));
  if (!order) return null;
  const customer = customers.find((c) => c.id === order.customerId);
  const view = {
    folio: order.id,
    sucursal: branchName(order.branch),
    fecha: order.date,
    estatus: order.status,
    entrega_estimada: order.eta || 'Sin fecha: requiere liberación',
    articulos: order.items.map(([sku, qty]) => `${qty} x ${products.find((p) => p.sku === sku)?.name || sku}`),
    fuente: `Sistema de pedidos ${order.id}`,
  };
  if (role.id !== 'cliente') {
    view.cliente = customer?.name;
    view.total_mxn = order.total;
  } else {
    view.nota_privacidad = 'Datos del cliente y montos ocultos para el perfil Cliente.';
  }
  return view;
}

function searchPolicies(query, role) {
  const allowed = policies.filter((p) => p.audience === 'publica' || role.canSeeInternalPolicies);
  const ranked = allowed
    .map((p) => ({ p, s: score(query, `${p.title} ${p.topic} ${p.text}`) + (normalize(query).includes(p.topic) ? 2 : 0) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 4);
  const results = ranked.map(({ p }) => ({
    id: p.id,
    titulo: p.title,
    version: p.version,
    responsable: p.owner,
    texto: p.text,
    fuente: `${p.id} (${p.title}, v${p.version})`,
    contradice_a: p.conflictsWith.filter((id) => allowed.some((a) => a.id === id)),
  }));
  const restricted = policies.filter((p) => p.audience !== 'publica' && !role.canSeeInternalPolicies && score(query, `${p.title} ${p.topic}`) > 0).length;
  return { resultados: results, conflicto_detectado: results.some((r) => r.contradice_a.length > 0), documentos_restringidos_para_tu_perfil: restricted };
}

module.exports = { searchCatalog, checkInventory, findOrder, searchPolicies, branchName, normalize };
