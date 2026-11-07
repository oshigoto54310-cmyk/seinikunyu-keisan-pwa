import { calculate } from "./calculator.js";

const SETTINGS_KEY = "demo_niku-margin-settings-v1";
const DEFAULT_SETTINGS = { hqRate: "5", suppliesRate: "2.5" };
const form = document.querySelector("#calculator-form");
const fields = Object.fromEntries(
  ["rawCost", "sellingPrice", "yieldRate", "lossRate", "hqRate", "suppliesRate"]
    .map((name) => [name, form.elements.namedItem(name)]),
);
for (const field of Object.values(fields)) {
  field.addEventListener("focus", () => field.select());
}
const resultElements = {
  panel: document.querySelector(".result-panel"),
  rate: document.querySelector("#margin-rate"),
  amount: document.querySelector("#margin-amount"),
  finished: document.querySelector("#finished-cost"),
  hq: document.querySelector("#hq-cost"),
  yield: document.querySelector("#yield-cost"),
  supplies: document.querySelector("#supplies-cost"),
  loss: document.querySelector("#loss-cost"),
  message: document.querySelector("#result-message"),
  saveStatus: document.querySelector("#save-status"),
  settingsPreview: document.querySelector("#settings-preview"),
};
const yenFormat = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const rateFormat = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function readNumber(field) {
  return field.value.trim() === "" ? null : Number(field.value);
}

function inputValues() {
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, readNumber(field)]));
}

function formatYen(value) {
  return Number.isFinite(value) ? yenFormat.format(value) : "—";
}

function formatRate(value) {
  return Number.isFinite(value) ? rateFormat.format(value) : "—";
}

function updateSettingsPreview() {
  const displayRate = (field) => field.value.trim() === "" ? "—" : `${field.value.trim()}%`;
  resultElements.settingsPreview.textContent = `本部 ${displayRate(fields.hqRate)}・消耗品 ${displayRate(fields.suppliesRate)}`;
}

function setValue(element, value, unit) {
  element.replaceChildren(document.createTextNode(value));
  const span = document.createElement("span");
  span.textContent = unit;
  element.append(span);
}

function setMarginRate(value) {
  resultElements.rate.replaceChildren(document.createTextNode(formatRate(value)));
  const percent = document.createElement("span");
  percent.textContent = "%";
  resultElements.rate.append(percent);

  if (!Number.isFinite(value)) {
    resultElements.rate.style.removeProperty("--margin-rate-size");
    return;
  }
  const panelWidth = resultElements.panel.clientWidth || window.innerWidth;
  const usableWidth = Math.max(80, panelWidth - 44);
  const baseSize = Math.min(78, Math.max(54, window.innerWidth * 0.16));
  const characterCount = Array.from(`${formatRate(value)}%`).length;
  const safeSize = usableWidth / (characterCount * 0.62);
  resultElements.rate.style.setProperty("--margin-rate-size", `${Math.min(baseSize, safeSize)}px`);
}

function updateFieldValidity(result) {
  const invalidNames = new Set();
  const { errors } = result;
  for (const error of [errors.rate, errors.rawCost, errors.sellingPrice]) {
    if (error && error.code !== "missing") invalidNames.add(error.field);
  }
  for (const [name, field] of Object.entries(fields)) {
    if (invalidNames.has(name)) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }
}

function updateMainMessage(result) {
  const { errors } = result;
  const blockingError = errors.rate
    ?? (errors.rawCost?.code !== "missing" ? errors.rawCost : null)
    ?? (errors.sellingPrice?.code !== "missing" ? errors.sellingPrice : null)
    ?? errors.calculation;

  if (blockingError) {
    resultElements.message.textContent = blockingError.message;
    resultElements.panel.classList.add("has-error");
    return;
  }

  resultElements.panel.classList.remove("has-error");
  if (errors.rawCost?.code === "missing") {
    resultElements.message.textContent = errors.sellingPrice?.code === "missing"
      ? "裸原価と売価を入力すると計算します。"
      : "裸原価を入力すると完成品原価を計算します。";
  } else if (errors.sellingPrice?.code === "missing") {
    resultElements.message.textContent = "売価を入力すると値入率を計算します。";
  } else {
    resultElements.message.textContent = result.marginRate < 0 ? "売価が完成品原価を下回っています。" : "";
  }
}

function render() {
  updateSettingsPreview();
  const result = calculate(inputValues());
  updateFieldValidity(result);

  setMarginRate(result.marginRate);
  setValue(resultElements.amount, formatYen(result.marginAmount), "円/kg");
  setValue(resultElements.finished, formatYen(result.finishedCost), "円/kg");
  setValue(resultElements.hq, formatYen(result.hqAdjustedCost), "円/kg");
  setValue(resultElements.yield, formatYen(result.yieldAdjustedCost), "円/kg");
  setValue(resultElements.supplies, formatYen(result.suppliesAdjustedCost), "円/kg");
  setValue(resultElements.loss, formatYen(result.lossAdjustedCost), "円/kg");
  resultElements.panel.classList.toggle("is-negative", Number.isFinite(result.marginRate) && result.marginRate < 0);
  updateMainMessage(result);
}

function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    const saved = stored ? JSON.parse(stored) : null;
    let shouldSave = !stored;
    for (const name of ["hqRate", "suppliesRate"]) {
      const rawValue = saved?.[name];
      const hasValue = rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== "";
      const value = Number(rawValue);
      if (hasValue && Number.isFinite(value) && value >= 0) {
        fields[name].value = String(value);
      } else {
        fields[name].value = DEFAULT_SETTINGS[name];
        shouldSave = true;
      }
    }
    if (shouldSave) saveSettings();
  } catch {
    resultElements.saveStatus.textContent = "設定を読み込めません";
    resultElements.saveStatus.classList.add("is-error");
  }
}

function saveSettings() {
  try {
    const settings = Object.fromEntries(["hqRate", "suppliesRate"].map((name) => [name, fields[name].value]));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    resultElements.saveStatus.textContent = "この端末に保存";
    resultElements.saveStatus.classList.remove("is-error");
  } catch {
    resultElements.saveStatus.textContent = "端末に保存できません";
    resultElements.saveStatus.classList.add("is-error");
  }
}

form.addEventListener("input", (event) => {
  if (event.target === fields.hqRate || event.target === fields.suppliesRate) saveSettings();
  render();
});

document.querySelector("#clear-product").addEventListener("click", () => {
  fields.rawCost.value = "";
  fields.sellingPrice.value = "";
  fields.yieldRate.value = "100";
  fields.lossRate.value = "0";
  render();
  fields.rawCost.focus({ preventScroll: true });
});

form.addEventListener("submit", (event) => event.preventDefault());

loadSettings();
render();
window.addEventListener("resize", render);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
