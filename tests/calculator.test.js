import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../calculator.js";

test("100%歩留まりでは各段階と値入率を計算する", () => {
  const result = calculate({ rawCost: 1000, sellingPrice: 2000, hqRate: 10, yieldRate: 100, suppliesRate: 5 });
  assert.equal(result.ok, true);
  assert.equal(result.hqAdjustedCost, 1100);
  assert.equal(result.yieldAdjustedCost, 1100);
  assert.equal(result.finishedCost, 1155);
  assert.equal(result.marginAmount, 845);
  assert.equal(result.marginRate, 42.25);
});

test("80%歩留まりでは歩留後原価が上がる", () => {
  const result = calculate({ rawCost: 1000, sellingPrice: 2000, hqRate: 10, yieldRate: 80, suppliesRate: 5 });
  assert.equal(result.ok, true);
  assert.equal(result.hqAdjustedCost, 1100);
  assert.equal(result.yieldAdjustedCost, 1375);
  assert.equal(result.finishedCost, 1443.75);
  assert.equal(result.marginAmount, 556.25);
  assert.equal(result.marginRate, 27.8125);
});

test("売価0円は値入率を計算せずエラーを返す", () => {
  assert.deepEqual(calculate({ rawCost: 1000, sellingPrice: 0 }), { ok: false, error: "sale-price-zero", field: "sellingPrice" });
});

test("歩留まり0%はゼロ除算せずエラーを返す", () => {
  assert.deepEqual(calculate({ rawCost: 1000, sellingPrice: 2000, yieldRate: 0 }), { ok: false, error: "yield-zero", field: "yieldRate" });
});

test("必須項目が未入力なら未計算として扱う", () => {
  assert.deepEqual(calculate({ rawCost: 1000, sellingPrice: null }), { ok: false, error: "missing", field: "sellingPrice" });
});

test("歩留まり欄を消した場合は100%と誤認せず入力を求める", () => {
  assert.deepEqual(calculate({ rawCost: 1000, sellingPrice: 2000, yieldRate: null }), { ok: false, error: "missing", field: "yieldRate" });
});

test("負の比率や原価は拒否する", () => {
  assert.deepEqual(calculate({ rawCost: 1000, sellingPrice: 2000, hqRate: -1 }), { ok: false, error: "negative", field: "hqRate" });
});
