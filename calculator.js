const RATE_ERROR_MESSAGES = {
  hqRate: "本部費率は0%以上100%未満の値を入力してください。",
  suppliesRate: "消耗品比率は0%以上100%未満の値を入力してください。",
  yieldRate: "歩留まりは0%より大きく100%以下の値を入力してください。",
  lossRate: "ロス率は0%以上100%未満の値を入力してください。",
};

function parseValue(input, field, fallback) {
  const raw = Object.hasOwn(input, field) ? input[field] : fallback;
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
    return { state: "empty", value: null };
  }
  const value = Number(raw);
  return Number.isFinite(value)
    ? { state: "value", value }
    : { state: "invalid", value: null };
}

function invalidNumber(field) {
  return { code: "invalid", field, message: "数値を確認してください。" };
}

function percentError(field, parsed, min, minInclusive, max, maxInclusive) {
  if (parsed.state === "invalid") return invalidNumber(field);
  const { value } = parsed;
  const inRange = parsed.state === "value"
    && (minInclusive ? value >= min : value > min)
    && (maxInclusive ? value <= max : value < max);
  if (!inRange) {
    return {
      code: "range",
      field,
      message: RATE_ERROR_MESSAGES[field] ?? "入力値の範囲を確認してください。",
    };
  }
  return null;
}

function positiveValueError(field, parsed, label) {
  if (parsed.state === "empty") {
    return { code: "missing", field, message: `${label}を入力してください。` };
  }
  if (parsed.state === "invalid") return invalidNumber(field);
  if (parsed.value <= 0) {
    return {
      code: "range",
      field,
      message: field === "rawCost"
        ? "裸原価は0円より大きい値を入力してください。"
        : "売価は0円より大きい値を入力してください。",
    };
  }
  return null;
}

function targetRateError(parsed) {
  if (parsed.state === "empty") return null;
  if (parsed.state === "invalid") return invalidNumber("targetMarginRate");
  if (parsed.value <= 0 || parsed.value >= 100) {
    return {
      code: "range",
      field: "targetMarginRate",
      message: "目標値入率は0%より大きく100%未満の値を入力してください。",
    };
  }
  return null;
}

function isFiniteResult(values) {
  return Object.values(values).every(Number.isFinite);
}

export function calculate(input) {
  const rawCost = parseValue(input, "rawCost", undefined);
  const sellingPrice = parseValue(input, "sellingPrice", undefined);
  const hqRate = parseValue(input, "hqRate", 0);
  const yieldRate = parseValue(input, "yieldRate", 100);
  const lossRate = parseValue(input, "lossRate", 0);
  const suppliesRate = parseValue(input, "suppliesRate", 0);
  const targetMarginRate = parseValue(input, "targetMarginRate", undefined);

  const rateError = percentError("hqRate", hqRate, 0, true, 100, false)
    ?? percentError("suppliesRate", suppliesRate, 0, true, 100, false)
    ?? percentError("yieldRate", yieldRate, 0, false, 100, true)
    ?? percentError("lossRate", lossRate, 0, true, 100, false);
  const rawCostError = positiveValueError("rawCost", rawCost, "裸原価");
  const sellingPriceError = positiveValueError("sellingPrice", sellingPrice, "売価");
  const targetError = targetRateError(targetMarginRate);

  let calculationError = null;
  let costs = null;
  if (!rateError && !rawCostError) {
    const hqAdjustedCost = rawCost.value * (1 + hqRate.value / 100);
    const yieldAdjustedCost = hqAdjustedCost / (yieldRate.value / 100);
    const suppliesAdjustedCost = yieldAdjustedCost * (1 + suppliesRate.value / 100);
    const lossAdjustedCost = suppliesAdjustedCost / (1 - lossRate.value / 100);
    const calculated = { hqAdjustedCost, yieldAdjustedCost, suppliesAdjustedCost, lossAdjustedCost };
    if (isFiniteResult(calculated)) {
      costs = { ...calculated, finishedCost: lossAdjustedCost };
    } else {
      calculationError = { code: "overflow", field: "rawCost", message: "数値が大きすぎるため計算できません。" };
    }
  }

  let marginAmount = null;
  let marginRate = null;
  let forwardError = rateError ?? rawCostError ?? calculationError ?? sellingPriceError;
  if (!forwardError && costs) {
    const amount = sellingPrice.value - costs.finishedCost;
    const rate = amount / sellingPrice.value * 100;
    if (Number.isFinite(amount) && Number.isFinite(rate)) {
      marginAmount = amount;
      marginRate = rate;
      forwardError = null;
    } else {
      forwardError = { code: "overflow", field: "sellingPrice", message: "数値が大きすぎるため計算できません。" };
    }
  }

  let requiredSellingPrice = null;
  let reference100gPrice = null;
  let referenceMarginRate = null;
  let inverseCalculationError = null;
  if (!rateError && !rawCostError && !calculationError && !targetError && targetMarginRate.state === "value" && costs) {
    const requiredPrice = costs.finishedCost / (1 - targetMarginRate.value / 100);
    if (Number.isFinite(requiredPrice) && requiredPrice > 0) {
      requiredSellingPrice = requiredPrice;
      reference100gPrice = Math.ceil(requiredPrice / 10);
      const referenceSellingPrice = reference100gPrice * 10;
      const referenceRate = (referenceSellingPrice - costs.finishedCost) / referenceSellingPrice * 100;
      if (Number.isFinite(referenceRate)) referenceMarginRate = referenceRate;
      else inverseCalculationError = { code: "overflow", field: "targetMarginRate", message: "数値が大きすぎるため逆算できません。" };
    } else {
      inverseCalculationError = { code: "overflow", field: "targetMarginRate", message: "数値が大きすぎるため逆算できません。" };
    }
  }

  let allowableRawCost = null;
  if (!rateError && !targetError && targetMarginRate.state === "value" && !sellingPriceError) {
    const allowed = sellingPrice.value
      * (1 - targetMarginRate.value / 100)
      * (1 - lossRate.value / 100)
      / (1 + suppliesRate.value / 100)
      * (yieldRate.value / 100)
      / (1 + hqRate.value / 100);
    if (Number.isFinite(allowed)) allowableRawCost = allowed;
    else inverseCalculationError = { code: "overflow", field: "sellingPrice", message: "数値が大きすぎるため逆算できません。" };
  }

  const error = forwardError;
  return {
    ok: !forwardError,
    error: error?.code ?? null,
    field: error?.field ?? null,
    errors: {
      rate: rateError,
      rawCost: rawCostError,
      sellingPrice: sellingPriceError,
      targetMarginRate: targetError,
      calculation: calculationError,
      inverseCalculation: inverseCalculationError,
    },
    ...costs,
    marginAmount,
    marginRate,
    requiredSellingPrice,
    reference100gPrice,
    referenceMarginRate,
    allowableRawCost,
  };
}
