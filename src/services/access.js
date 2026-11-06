/**
 * Control de acceso por rol (demostración).
 *
 * El piloto simula tres perfiles para mostrar cómo se protegen los datos
 * sensibles. El rol se aplica en el SERVIDOR: el navegador solo indica el
 * perfil elegido y el backend filtra la información. En producción el rol
 * provendría de Microsoft Entra ID (App Service Authentication).
 */
const { branches } = require('../data/demo-data');

const ROLES = {
  cliente: { label: 'Cliente', canSeeCosts: false, canSeeInternalPolicies: false, canSeeInvoices: false, canReview: false, exactStock: false },
  sucursal: { label: 'Personal de sucursal', canSeeCosts: false, canSeeInternalPolicies: true, canSeeInvoices: false, canReview: true, exactStock: true },
  finanzas: { label: 'Finanzas / Dirección', canSeeCosts: true, canSeeInternalPolicies: true, canSeeInvoices: true, canReview: true, exactStock: true },
};

function resolveRole(req) {
  const role = ROLES[req.get('x-demo-role')] ? req.get('x-demo-role') : 'cliente';
  const branchHeader = req.get('x-demo-branch');
  const branch = branches.some((b) => b.id === branchHeader) ? branchHeader : 'CEN';
  return { id: role, branch, ...ROLES[role] };
}

/** Middleware que adjunta `req.role` a cada petición. */
function attachRole(req, _res, next) {
  req.role = resolveRole(req);
  next();
}

/** Middleware que exige un permiso concreto. */
function requirePermission(permission) {
  return (req, res, next) => {
    if (req.role?.[permission]) return next();
    return res.status(403).json({ error: 'Tu perfil no tiene acceso a esta información.', role: req.role?.label });
  };
}

module.exports = { ROLES, attachRole, requirePermission };
