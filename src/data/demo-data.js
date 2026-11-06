/**
 * Datos de demostración de Distribuidora Río Claro.
 *
 * Todos los registros de este archivo son FICTICIOS y fueron creados para el
 * piloto AI-901. No corresponden a clientes, proveedores ni personas reales.
 * Algunos datos contienen inconsistencias intencionales (nombres de producto
 * distintos entre sucursales, políticas contradictorias) porque forman parte
 * del problema de negocio que el piloto debe hacer visible.
 */

const branches = [
  { id: 'CEN', name: 'Sucursal Centro (Matriz)', city: 'Río Claro', manager: 'Gerencia Centro' },
  { id: 'NOR', name: 'Sucursal Norte', city: 'Valle Alto', manager: 'Gerencia Norte' },
  { id: 'ORI', name: 'Sucursal Oriente', city: 'Las Palmas', manager: 'Gerencia Oriente' },
  { id: 'BAJ', name: 'Sucursal Bajío', city: 'San Telmo', manager: 'Gerencia Bajío' },
  { id: 'COS', name: 'Sucursal Costa', city: 'Puerto Ámbar', manager: 'Gerencia Costa' },
];

/**
 * Catálogo maestro. `branchNames` refleja cómo cada sucursal registra el mismo
 * artículo hoy (catálogos inconsistentes). `stock` es inventario por sucursal.
 */
const products = [
  { sku: 'ABA-1001', name: 'Aceite vegetal 1 L', category: 'Abarrotes', unit: 'Caja 12 pzas', price: 486, cost: 402, stock: { CEN: 140, NOR: 62, ORI: 18, BAJ: 95, COS: 0 }, branchNames: { NOR: 'ACEITE VEG 1LT', COS: 'Aceite comestible litro' } },
  { sku: 'ABA-1002', name: 'Arroz grano largo 1 kg', category: 'Abarrotes', unit: 'Bulto 20 pzas', price: 512, cost: 431, stock: { CEN: 210, NOR: 120, ORI: 75, BAJ: 160, COS: 44 }, branchNames: { ORI: 'ARROZ SUPER EXTRA 1K' } },
  { sku: 'ABA-1003', name: 'Frijol negro 900 g', category: 'Abarrotes', unit: 'Bulto 20 pzas', price: 598, cost: 505, stock: { CEN: 88, NOR: 40, ORI: 33, BAJ: 12, COS: 51 }, branchNames: { BAJ: 'Frijol neg. 1kg', COS: 'FRIJOL NEGRO 900G' } },
  { sku: 'ABA-1004', name: 'Azúcar estándar 2 kg', category: 'Abarrotes', unit: 'Bulto 10 pzas', price: 455, cost: 389, stock: { CEN: 64, NOR: 0, ORI: 22, BAJ: 47, COS: 30 }, branchNames: {} },
  { sku: 'ABA-1005', name: 'Atún en agua 140 g', category: 'Abarrotes', unit: 'Caja 48 pzas', price: 1104, cost: 948, stock: { CEN: 35, NOR: 28, ORI: 9, BAJ: 20, COS: 41 }, branchNames: { NOR: 'ATUN AGUA 140', ORI: 'Atún lata chica' } },
  { sku: 'ABA-1006', name: 'Pasta para sopa 200 g', category: 'Abarrotes', unit: 'Caja 50 pzas', price: 402, cost: 330, stock: { CEN: 190, NOR: 85, ORI: 70, BAJ: 110, COS: 66 }, branchNames: {} },
  { sku: 'BEB-2001', name: 'Agua purificada 600 ml', category: 'Bebidas', unit: 'Paquete 24 pzas', price: 138, cost: 104, stock: { CEN: 420, NOR: 260, ORI: 180, BAJ: 300, COS: 390 }, branchNames: { COS: 'AGUA 600 PAQ' } },
  { sku: 'BEB-2002', name: 'Jugo de naranja 1 L', category: 'Bebidas', unit: 'Caja 12 pzas', price: 384, cost: 316, stock: { CEN: 52, NOR: 14, ORI: 0, BAJ: 26, COS: 19 }, branchNames: { ORI: 'Jugo naranja lt' } },
  { sku: 'BEB-2003', name: 'Café soluble 200 g', category: 'Bebidas', unit: 'Caja 12 pzas', price: 1248, cost: 1060, stock: { CEN: 30, NOR: 22, ORI: 12, BAJ: 8, COS: 15 }, branchNames: {} },
  { sku: 'LAC-3001', name: 'Leche UHT entera 1 L', category: 'Lácteos', unit: 'Caja 12 pzas', price: 312, cost: 268, stock: { CEN: 300, NOR: 140, ORI: 96, BAJ: 210, COS: 75 }, branchNames: { NOR: 'LECHE ENTERA UHT', BAJ: 'Leche larga vida 1L' } },
  { sku: 'LAC-3002', name: 'Queso fresco 400 g', category: 'Lácteos', unit: 'Caja 10 pzas', price: 690, cost: 575, stock: { CEN: 24, NOR: 10, ORI: 6, BAJ: 18, COS: 3 }, branchNames: {} },
  { sku: 'LAC-3003', name: 'Yogur natural 1 kg', category: 'Lácteos', unit: 'Caja 8 pzas', price: 368, cost: 300, stock: { CEN: 40, NOR: 18, ORI: 15, BAJ: 0, COS: 12 }, branchNames: { COS: 'YOGHURT NAT 1KG' } },
  { sku: 'LIM-4001', name: 'Detergente en polvo 1 kg', category: 'Limpieza', unit: 'Caja 10 pzas', price: 425, cost: 352, stock: { CEN: 150, NOR: 70, ORI: 48, BAJ: 90, COS: 60 }, branchNames: { ORI: 'DETERG. POLVO KG' } },
  { sku: 'LIM-4002', name: 'Cloro 1 L', category: 'Limpieza', unit: 'Caja 15 pzas', price: 210, cost: 168, stock: { CEN: 260, NOR: 115, ORI: 80, BAJ: 140, COS: 95 }, branchNames: { NOR: 'BLANQUEADOR 1L', COS: 'Cloro litro' } },
  { sku: 'LIM-4003', name: 'Jabón líquido para manos 500 ml', category: 'Limpieza', unit: 'Caja 12 pzas', price: 504, cost: 420, stock: { CEN: 45, NOR: 30, ORI: 4, BAJ: 26, COS: 22 }, branchNames: {} },
  { sku: 'LIM-4004', name: 'Papel higiénico 4 rollos', category: 'Limpieza', unit: 'Bulto 12 paquetes', price: 552, cost: 470, stock: { CEN: 98, NOR: 55, ORI: 37, BAJ: 61, COS: 0 }, branchNames: { BAJ: 'PH 4R' } },
  { sku: 'DES-5001', name: 'Vaso desechable 10 oz', category: 'Desechables', unit: 'Caja 1,000 pzas', price: 640, cost: 520, stock: { CEN: 75, NOR: 33, ORI: 20, BAJ: 41, COS: 58 }, branchNames: { COS: 'VASO TERMICO 10' } },
  { sku: 'DES-5002', name: 'Plato desechable 9 in', category: 'Desechables', unit: 'Caja 500 pzas', price: 455, cost: 370, stock: { CEN: 60, NOR: 25, ORI: 11, BAJ: 30, COS: 44 }, branchNames: {} },
  { sku: 'DES-5003', name: 'Bolsa para basura 90x120', category: 'Desechables', unit: 'Rollo 100 pzas', price: 389, cost: 310, stock: { CEN: 110, NOR: 48, ORI: 25, BAJ: 66, COS: 39 }, branchNames: { NOR: 'BOLSA JUMBO NEGRA' } },
  { sku: 'BOT-6001', name: 'Galletas surtidas 1 kg', category: 'Botanas', unit: 'Caja 6 pzas', price: 534, cost: 446, stock: { CEN: 70, NOR: 35, ORI: 28, BAJ: 40, COS: 16 }, branchNames: {} },
  { sku: 'BOT-6002', name: 'Cacahuate salado 1 kg', category: 'Botanas', unit: 'Caja 10 pzas', price: 1180, cost: 990, stock: { CEN: 22, NOR: 9, ORI: 14, BAJ: 0, COS: 25 }, branchNames: { ORI: 'CACAHUATE SAL KG' } },
];

const customers = [
  { id: 'CLI-0142', name: 'Abarrotes La Glorieta (demo)', branch: 'CEN', creditDays: 30 },
  { id: 'CLI-0387', name: 'Minisúper Don Aurelio (demo)', branch: 'NOR', creditDays: 15 },
  { id: 'CLI-0611', name: 'Cafetería Punto Norte (demo)', branch: 'NOR', creditDays: 0 },
  { id: 'CLI-0905', name: 'Hotel Bahía Serena (demo)', branch: 'COS', creditDays: 45 },
  { id: 'CLI-1210', name: 'Comedor Industrial Vértice (demo)', branch: 'BAJ', creditDays: 30 },
  { id: 'CLI-1488', name: 'Tienda Los Fresnos (demo)', branch: 'ORI', creditDays: 15 },
];

const orders = [
  { id: 'PED-24817', customerId: 'CLI-0142', branch: 'CEN', date: '2026-10-28', status: 'Entregado', total: 18450.0, items: [['ABA-1001', 10], ['LAC-3001', 20], ['BEB-2001', 15]], eta: '2026-10-30' },
  { id: 'PED-24852', customerId: 'CLI-0387', branch: 'NOR', date: '2026-11-02', status: 'En ruta', total: 9372.0, items: [['ABA-1002', 6], ['LIM-4002', 12]], eta: '2026-11-05' },
  { id: 'PED-24860', customerId: 'CLI-0905', branch: 'COS', date: '2026-11-03', status: 'Parcial: faltante de aceite', total: 27980.0, items: [['ABA-1001', 15], ['DES-5001', 8], ['BEB-2001', 40]], eta: '2026-11-07' },
  { id: 'PED-24871', customerId: 'CLI-1210', branch: 'BAJ', date: '2026-11-03', status: 'Preparando', total: 15620.0, items: [['ABA-1003', 10], ['LAC-3003', 6], ['ABA-1006', 12]], eta: '2026-11-06' },
  { id: 'PED-24879', customerId: 'CLI-1488', branch: 'ORI', date: '2026-11-04', status: 'Retenido: revisión de crédito', total: 6210.0, items: [['BEB-2002', 8], ['LIM-4003', 4]], eta: null },
  { id: 'PED-24883', customerId: 'CLI-0611', branch: 'NOR', date: '2026-11-04', status: 'Confirmado', total: 4980.0, items: [['BEB-2003', 3], ['DES-5001', 2]], eta: '2026-11-06' },
];

/**
 * Políticas internas. `audience` controla quién puede consultarlas:
 * - publica: clientes y personal
 * - interna: solo personal
 * `conflictsWith` documenta contradicciones conocidas entre documentos.
 */
const policies = [
  { id: 'POL-DEV-2024', title: 'Política de devoluciones (corporativa)', version: '2024-03', owner: 'Dirección Comercial', audience: 'publica', topic: 'devoluciones', text: 'Las devoluciones de mercancía se aceptan dentro de los 15 días naturales posteriores a la entrega, con factura y empaque original. Productos refrigerados (lácteos) solo se aceptan dentro de las primeras 24 horas y con evidencia fotográfica.', conflictsWith: ['POL-DEV-COS-2022'] },
  { id: 'POL-DEV-COS-2022', title: 'Lineamiento de devoluciones Sucursal Costa', version: '2022-08', owner: 'Gerencia Costa', audience: 'publica', topic: 'devoluciones', text: 'En Sucursal Costa las devoluciones se aceptan hasta 30 días después de la entrega. No se requiere empaque original para productos de limpieza.', conflictsWith: ['POL-DEV-2024'] },
  { id: 'POL-ENT-2025', title: 'Política de entregas', version: '2025-01', owner: 'Logística', audience: 'publica', topic: 'entregas', text: 'Pedidos confirmados antes de las 13:00 se entregan al día hábil siguiente dentro de la zona urbana de cada sucursal. Pedidos mayores a $25,000 MXN incluyen entrega sin costo. Zonas foráneas: 2 a 3 días hábiles.', conflictsWith: [] },
  { id: 'POL-CRE-2025', title: 'Política de crédito a clientes', version: '2025-06', owner: 'Finanzas', audience: 'publica', topic: 'credito', text: 'El crédito comercial se otorga a 15, 30 o 45 días según historial. Un pedido se retiene automáticamente cuando el cliente tiene saldo vencido mayor a 10 días. La liberación requiere autorización de Finanzas.', conflictsWith: [] },
  { id: 'POL-HOR-2026', title: 'Horarios de atención', version: '2026-01', owner: 'Operaciones', audience: 'publica', topic: 'horarios', text: 'Todas las sucursales atienden de lunes a viernes de 8:00 a 18:00 y sábados de 8:00 a 14:00. Sucursal Costa abre domingos de 9:00 a 13:00 durante temporada alta (diciembre a abril).', conflictsWith: [] },
  { id: 'POL-PAG-2025', title: 'Pagos a proveedores', version: '2025-09', owner: 'Finanzas', audience: 'interna', topic: 'pagos', text: 'Toda factura de proveedor debe validarse contra orden de compra antes de programar el pago. Facturas con folio repetido, total distinto a la orden de compra o confianza de extracción menor a 80% se envían a revisión humana. Pagos superiores a $50,000 MXN requieren doble autorización.', conflictsWith: [] },
  { id: 'POL-DAT-2025', title: 'Protección de datos personales y comerciales', version: '2025-11', owner: 'Cumplimiento', audience: 'interna', topic: 'datos', text: 'Costos de compra, datos bancarios de proveedores y saldos de clientes son información confidencial. Solo Finanzas y Dirección pueden consultarlos. El personal de sucursal solo ve datos de sus propios clientes.', conflictsWith: [] },
  { id: 'POL-DSC-2023', title: 'Descuentos por volumen (versión 2023)', version: '2023-02', owner: 'Dirección Comercial', audience: 'interna', topic: 'descuentos', text: 'Se otorga 5% de descuento en pedidos mayores a 50 cajas de una misma línea.', conflictsWith: ['POL-DSC-2025'] },
  { id: 'POL-DSC-2025', title: 'Descuentos por volumen (versión 2025)', version: '2025-04', owner: 'Dirección Comercial', audience: 'interna', topic: 'descuentos', text: 'El descuento por volumen es de 3% a partir de 40 cajas por línea y requiere aprobación del gerente de sucursal.', conflictsWith: ['POL-DSC-2023'] },
];

/** Proveedores ficticios y órdenes de compra para validar facturas. */
const suppliers = [
  { id: 'PRV-014', name: 'Lácteos Valle Sereno, S.A. de C.V.', category: 'Lácteos' },
  { id: 'PRV-022', name: 'Comercializadora Granos del Altiplano, S.A. de C.V.', category: 'Abarrotes' },
  { id: 'PRV-031', name: 'Higiene Total del Golfo, S. de R.L.', category: 'Limpieza' },
  { id: 'PRV-047', name: 'Empaques Ríos Unidos, S.A.', category: 'Desechables' },
  { id: 'PRV-053', name: 'Bebidas Manantial Azul, S.A. de C.V.', category: 'Bebidas' },
];

/** Comentarios y quejas de clientes (texto ficticio redactado para la demo). */
const feedback = [
  ['CEN', 'El repartidor llegó dos horas tarde y no avisó.'],
  ['CEN', 'Excelente atención en mostrador, resolvieron mi pedido rápido.'],
  ['CEN', 'Me cobraron dos veces la misma factura del mes pasado.'],
  ['CEN', 'La leche venía con fecha de caducidad muy próxima.'],
  ['CEN', 'Muy buen precio en el arroz, seguiré comprando.'],
  ['NOR', 'Pedí aceite y me dijeron que no había, pero en el sistema aparecía disponible.'],
  ['NOR', 'El pedido llegó incompleto, faltaron dos cajas de cloro.'],
  ['NOR', 'Nadie contesta el teléfono de la sucursal después de las 4.'],
  ['NOR', 'El chofer fue muy amable y acomodó la mercancía.'],
  ['NOR', 'El producto que llegó no coincide con el código que pedí, tienen nombres distintos.'],
  ['NOR', 'Tardaron una semana en responder mi aclaración de factura.'],
  ['ORI', 'Llegaron cajas de jugo golpeadas y una abierta.'],
  ['ORI', 'En la sucursal me dijeron que la devolución era de 30 días y en matriz que de 15.'],
  ['ORI', 'Siempre falta inventario de jugo, ya es la tercera vez este mes.'],
  ['ORI', 'La entrega fue puntual y completa, gracias.'],
  ['ORI', 'Me retuvieron el pedido por crédito sin avisarme antes.'],
  ['BAJ', 'El yogur llegó caliente, la cadena de frío no se respetó.'],
  ['BAJ', 'Me facturaron un precio diferente al de la cotización.'],
  ['BAJ', 'Buena variedad de productos de limpieza.'],
  ['BAJ', 'El repartidor no traía la factura impresa y tuve que pedirla por correo.'],
  ['BAJ', 'No había cacahuate y no me ofrecieron alternativa.'],
  ['BAJ', 'Pedí 10 cajas y llegaron 8, pero me cobraron 10.'],
  ['COS', 'La política de devoluciones es confusa, cada quien dice algo diferente.'],
  ['COS', 'Llegó tarde el pedido del hotel, afectó nuestro desayuno.'],
  ['COS', 'No tenían papel higiénico ni aceite, tuve que comprar en otro lado.'],
  ['COS', 'Atención amable por WhatsApp, respondieron en minutos.'],
  ['COS', 'Los vasos venían rotos en una caja completa.'],
  ['COS', 'Me pidieron mis datos bancarios por teléfono, eso no me dio confianza.'],
  ['CEN', 'El portal no muestra el estatus real de mi pedido.'],
  ['NOR', 'Me cobraron envío aunque el pedido era mayor a 25 mil pesos.'],
];

module.exports = { branches, products, customers, orders, policies, suppliers, feedback };
