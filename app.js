import { calculate } from "./calculator.js";

const SETTINGS_KEY = "niku-margin-settings-v2";
const LEGACY_SETTINGS_KEY = "niku-margin-settings-v1";
const DEFAULT_SETTINGS = { hqRate: "5", suppliesRate: "2.5" };
const form = document.querySelector("#calculator-form");
const fields = Object.fromEntries(
  ["rawCost", "sellingPrice", "yieldRate", "lossRate", "hqRate", "suppliesRate"].map((name) => [name, form.elements.namedItem(name)]),
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
  loss: document.querySelector("#loss-cost"),
  message: document.querySelector("#result-message"),
  saveStatus: document.querySelector("#save-status"),
  settingsPreview: document.querySelector("#settings-preview"),
};
const yenFormat = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 });
const rateFormat = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function readNumber(field) {
  return field.value.trim() === "" ? null : Number(field.value);
}

function inputValues() {
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, readNumber(field)]));
}

function formatYen(value) {
  return yenFormat.format(value);
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

function showEmpty(message, hasError = false) {
  resultElements.panel.classList.toggle("has-error", hasError);
  resultElements.panel.classList.remove("is-negative");
  resultElements.rate.replaceChildren(document.createTextNode("—"));
  const percent = document.createElement("span");
  percent.textContent = "%";
  resultElements.rate.append(percent);
  setValue(resultElements.amount, "—", "円/kg");
  setValue(resultElements.finished, "—", "円/kg");
  setValue(resultElements.hq, "—", "円/kg");
  setValue(resultElements.yield, "—", "円/kg");
  setValue(resultElements.loss, "—", "円/kg");
  resultElements.message.textContent = message;
}

function errorMessage(result) {
  if (result.error === "missing" && result.field === "yieldRate") return "歩留まりを入力してください。";
  if (result.error === "sale-price-zero") return "売価は0円より大きい値を入力してください。";
  if (result.error === "yield-zero") return "歩留まりは0%より大きい値を入力してください。";
  if (result.error === "loss-rate-range") return "ロス率は0%以上100%未満を入力してください。";
  if (result.error === "negative") return "率・原価・売価に負の値は入力できません。";
  if (result.error === "invalid") return "数値を確認してください。";
  return "裸原価と売価を入力すると計算します。";
}

function render() {
  updateSettingsPreview();
  const result = calculate(inputValues());
  if (!result.ok) {
    showEmpty(errorMessage(result), result.error !== "missing");
    return;
  }

  resultElements.panel.classList.remove("has-error");
  resultElements.panel.classList.toggle("is-negative", result.marginRate < 0);
  resultElements.rate.replaceChildren(document.createTextNode(rateFormat.format(result.marginRate)));
  const percent = document.createElement("span");
  percent.textContent = "%";
  resultElements.rate.append(percent);
  setValue(resultElements.amount, formatYen(result.marginAmount), "円/kg");
  setValue(resultElements.finished, formatYen(result.finishedCost), "円/kg");
  setValue(resultElements.hq, formatYen(result.hqAdjustedCost), "円/kg");
  setValue(resultElements.yield, formatYen(result.yieldAdjustedCost), "円/kg");
  setValue(resultElements.loss, formatYen(result.lossAdjustedCost), "円/kg");
  resultElements.message.textContent = result.marginRate < 0 ? "売価が完成品原価を下回っています。" : "";
}

function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    const legacyStored = stored ? null : localStorage.getItem(LEGACY_SETTINGS_KEY);
    const saved = stored || legacyStored ? JSON.parse(stored || legacyStored) : null;
    const isLegacyDefault = !stored && saved && Number(saved.hqRate) === 0 && Number(saved.suppliesRate) === 0;
    let shouldSave = !stored || isLegacyDefault;
    for (const name of ["hqRate", "suppliesRate"]) {
      const rawValue = isLegacyDefault ? DEFAULT_SETTINGS[name] : saved?.[name];
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
