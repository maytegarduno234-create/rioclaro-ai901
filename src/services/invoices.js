/**
 * Procesamiento de facturas con Azure AI Document Intelligence.
 *
 * Flujo: guardar original en Blob Storage → extraer campos con el modelo
 * precompilado de facturas → calcular confianza → detectar duplicados →
 * validar montos → decidir si requiere revisión humana.
 */
const crypto = require('crypto');
const config = require('../config');
const { analyzeInvoice } = require('../azure/cognitive');
const { suppliers } = require('../data/demo-data');
const { normalize } = require('./knowledge');
const store = require('./store');

const KEY_FIELDS = [
  ['proveedor', 'VendorName'],
  ['folio', 'InvoiceId'],
  ['fecha', 'InvoiceDate'],
  ['total', 'InvoiceTotal'],
];

function fieldValue(field) {
  if (!field) return null;
  if (field.valueCurrency) return field.valueCurrency.amount;
  if (field.valueDate) return field.valueDate;
  if (field.valueNumber !== undefined) return field.valueNumber;
  return field.valueString ?? field.content ?? null;
}

const normalizeFolio = (folio) => normalize(folio).replace(/\s|^0+/g, '');
const normalizeVendor = (name) => normalize(name).replace(/\b(s a|de c v|s de r l|sa|cv|srl)\b/g, '').replace(/\s+/g, ' ').trim();

function matchSupplier(vendorName) {
  if (!vendorName) return null;
  const target = normalizeVendor(vendorName);
  return suppliers.find((s) => {
    const known = normalizeVendor(s.name);
    return known === target || known.includes(target) || target.includes(known.split(' ').slice(0, 2).join(' '));
  }) || null;
}

function findDuplicates(invoice, existing) {
  const findings = [];
  for (const other of existing) {
    if (other.id === invoice.id) continue;
    if (other.fileHash === invoice.fileHash) {
      findings.push({ type: 'exacto', invoiceId: other.id, detail: `Mismo archivo que ${other.id} (${other.fileName}).` });
      continue;
    }
    const sameVendor = invoice.vendorKey && other.vendorKey === invoice.vendorKey;
    if (sameVendor && invoice.folioKey && other.folioKey === invoice.folioKey) {
      findings.push({ type: 'folio', invoiceId: other.id, detail: `Folio ${invoice.fields.folio} ya registrado para este proveedor en ${other.id}.` });
      continue;
    }
    if (sameVendor && invoice.fields.total && other.fields.total && Math.abs(invoice.fields.total - other.fields.total) < 0.5) {
      const days = Math.abs(new Date(invoice.fields.fecha) - new Date(other.fields.fecha)) / 86400000;
      if (Number.isNaN(days) || days <= 45) {
        findings.push({ type: 'posible', invoiceId: other.id, detail: `Mismo proveedor y mismo total que ${other.id} con folio distinto.` });
      }
    }
  }
  return findings;
}

async function processInvoice({ buffer, fileName, contentType, branch, source = 'carga' }) {
  const state = store.get();
  const id = `FAC-${String(state.invoices.length + 1).padStart(4, '0')}`;
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const blobName = `${id}-${fileName.replace(/[^\w.-]/g, '_')}`;
  const blobPath = await store.saveDocument(blobName, buffer, contentType);

  const result = await analyzeInvoice(buffer, contentType);
  const doc = result.documents?.[0];
  const rawFields = doc?.fields || {};

  const fields = {};
  const confidence = {};
  for (const [key, diName] of KEY_FIELDS) {
    fields[key] = fieldValue(rawFields[diName]);
    confidence[key] = rawFields[diName] ? Number((rawFields[diName].confidence ?? 0).toFixed(3)) : 0;
  }
  fields.subtotal = fieldValue(rawFields.SubTotal);
  fields.impuestos = fieldValue(rawFields.TotalTax);
  fields.moneda = rawFields.InvoiceTotal?.valueCurrency?.currencyCode || 'MXN';
  fields.cliente = fieldValue(rawFields.CustomerName);

  const overallConfidence = Math.min(...Object.values(confidence));
  const supplier = matchSupplier(fields.proveedor);
  const invoice = {
    id,
    fileName,
    fileHash,
    blobPath,
    blobName: blobPath ? blobName : null,
    contentType,
    source,
    branch,
    processedAt: new Date().toISOString(),
    fields,
    confidence,
    overallConfidence: Number(overallConfidence.toFixed(3)),
    documentConfidence: doc?.confidence ?? null,
    supplierId: supplier?.id || null,
    vendorKey: fields.proveedor ? normalizeVendor(fields.proveedor) : null,
    folioKey: fields.folio ? normalizeFolio(fields.folio) : null,
    pages: result.pages?.length || 0,
  };

  const reasons = [];
  const missing = KEY_FIELDS.filter(([key]) => fields[key] === null || fields[key] === undefined).map(([key]) => key);
  if (missing.length) reasons.push(`Campos no detectados: ${missing.join(', ')}`);
  if (overallConfidence < config.reviewConfidenceThreshold) reasons.push(`Confianza ${Math.round(overallConfidence * 100)}% menor al umbral de ${Math.round(config.reviewConfidenceThreshold * 100)}%`);
  if (fields.subtotal != null && fields.impuestos != null && fields.total != null && Math.abs(fields.subtotal + fields.impuestos - fields.total) > 1) {
    reasons.push(`Subtotal + impuestos (${(fields.subtotal + fields.impuestos).toFixed(2)}) no coincide con el total (${fields.total.toFixed(2)})`);
  }
  if (fields.proveedor && !supplier) reasons.push('Proveedor no registrado en el padrón');

  invoice.duplicates = findDuplicates(invoice, state.invoices);
  if (invoice.duplicates.length) reasons.push(...invoice.duplicates.map((d) => `Duplicado (${d.type}): ${d.detail}`));

  invoice.reviewReasons = reasons;
  invoice.status = reasons.length ? 'en_revision' : 'validada';
  state.invoices.unshift(invoice);

  if (reasons.length) {
    state.reviews.unshift({
      id: `REV-${Date.now().toString(36).toUpperCase()}`,
      type: 'factura',
      createdAt: invoice.processedAt,
      status: 'pendiente',
      reason: reasons[0],
      reasons,
      invoiceId: id,
      branch,
      summary: `${fields.proveedor || 'Proveedor sin detectar'} · folio ${fields.folio || '—'} · ${fields.total != null ? `$${Number(fields.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : 'total sin detectar'}`,
    });
  }
  store.logActivity('factura', `${id} procesada${reasons.length ? ' · enviada a revisión' : ' · validada'}`, { invoiceId: id });
  return invoice;
}

module.exports = { processInvoice };
