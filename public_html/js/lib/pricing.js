/** Recargo por anillado: precio por copia, solo si se eligió esa terminación. */
export const ringCharge = (item, priceRing) => (item.finish === 'anillado' ? item.copies * priceRing : 0);

/** Mayor descuento aplicable: el escalón con min_pages más alto que no supere totalPages. 0 si ninguno aplica. */
export function bestDiscountPercent(totalPages, tiers = []) {
  let bestMinPages = -1;
  let bestPercent = 0;

  for (const tier of tiers) {
    if (totalPages >= tier.min_pages && tier.min_pages > bestMinPages) {
      bestMinPages = tier.min_pages;
      bestPercent = Number(tier.discount_percent);
    }
  }

  return bestPercent;
}

/** Total estimado de un ítem del carrito: páginas × copias × precio por página, con descuento por cantidad, + recargo. */
export function itemTotal(item, pricePerSheet, priceRing, tiers = []) {
  const totalPages = (item.pageCount ?? 1) * item.copies;
  const subtotal = totalPages * pricePerSheet;
  const discountPercent = bestDiscountPercent(totalPages, tiers);

  return subtotal - (subtotal * discountPercent) / 100 + ringCharge(item, priceRing);
}
