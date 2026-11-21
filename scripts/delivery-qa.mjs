/** Pure validation helpers for delivery QA; no network or database access. */
export function isValidSiteUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.host);
  } catch {
    return false;
  }
}

export function isPackAmountValid(pack, rawAmount) {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (pack === "enterprise") return amount >= 8333;
  if (pack === "professional") return amount >= 2916 && amount < 8333;
  if (pack === "starter") return amount < 2916;
  return false;
}

export function isOrderAmountConsistent(orderAmount, deliveryAmount) {
  const order = Number(orderAmount);
  const delivery = Number(deliveryAmount);
  return Number.isFinite(order) && Number.isFinite(delivery) && Math.abs(order - delivery) < 0.005;
}
