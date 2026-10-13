const REQUIRED_FIELDS = ["rawCost", "sellingPrice", "yieldRate"];

export function calculate(input) {
  const values = {
    rawCost: input.rawCost,
    sellingPrice: input.sellingPrice,
    hqRate: input.hqRate ?? 0,
    yieldRate: Object.hasOwn(input, "yieldRate") ? input.yieldRate : 100,
    suppliesRate: input.suppliesRate ?? 0,
  };

  for (const field of REQUIRED_FIELDS) {
    if (values[field] === "" || values[field] === null || values[field] === undefined) {
      return { ok: false, error: "missing", field };
    }
  }

  for (const [field, rawValue] of Object.entries(values)) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return { ok: false, error: "invalid", field };
    if (value < 0) return { ok: false, error: "negative", field };
    values[field] = value;
  }

  if (values.sellingPrice === 0) return { ok: false, error: "sale-price-zero", field: "sellingPrice" };
  if (values.yieldRate === 0) return { ok: false, error: "yield-zero", field: "yieldRate" };

  const hqAdjustedCost = values.rawCost * (1 + values.hqRate / 100);
  const yieldAdjustedCost = hqAdjustedCost / (values.yieldRate / 100);
  const finishedCost = yieldAdjustedCost * (1 + values.suppliesRate / 100);
  const marginAmount = values.sellingPrice - finishedCost;
  const marginRate = marginAmount / values.sellingPrice * 100;

  return {
    ok: true,
    hqAdjustedCost,
    yieldAdjustedCost,
    finishedCost,
    marginAmount,
    marginRate,
  };
}
