/**
 * Precios del carrito. Es el mismo cálculo que hace el servidor al crear el pedido
 * (OrderController + PriceTier); acá es solo el estimado en vivo.
 *
 * priceTiers viene de /price-tiers: { doble: [{min_pages, price_per_page}], simple: [...] },
 * cada lista ordenada por min_pages.
 */

/** Recargo por anillado: precio por copia, solo si se eligió esa terminación. */
export const ringCharge = (item, priceRing) => (item.finish === 'anillado' ? item.copies * priceRing : 0);

/** Páginas que definen el rango de precio: páginas del archivo × copias. */
export const totalPages = (item) => (item.pageCount ?? 1) * (item.copies ?? 1);

/**
 * Precio por página del ítem según su faz y su cantidad de páginas: el del rango con
 * "desde" más alto que no la supere (si queda por debajo del primero, el primero).
 */
export function pricePerPage(item, priceTiers) {
  const tiers = priceTiers?.[item.doubleSide === false ? 'simple' : 'doble'] ?? [];
  const pages = totalPages(item);
  let price = tiers.length ? Number(tiers[0].price_per_page) : 0;

  for (const tier of tiers) {
    if (pages >= tier.min_pages) price = Number(tier.price_per_page);
  }

  return price;
}

/** Total estimado de un ítem: páginas × copias × precio por página del rango, + recargo por anillado. */
export function itemTotal(item, priceTiers, priceRing) {
  return totalPages(item) * pricePerPage(item, priceTiers) + ringCharge(item, priceRing);
}
