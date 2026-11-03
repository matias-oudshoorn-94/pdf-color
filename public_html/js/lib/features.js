/**
 * Funciones del sitio que se pueden apagar sin borrar su código.
 * Poner en true para volver a ofrecerlas.
 */

// Envío a domicilio: apagado, solo se ofrece retiro en sucursal. Oculta la opción en el
// checkout y las menciones al envío en el sitio. Los pedidos viejos con envío se siguen
// mostrando igual. Ojo: el servidor todavía acepta pedidos con envío (OrderController).
export const SHIPPING_ENABLED = false;
