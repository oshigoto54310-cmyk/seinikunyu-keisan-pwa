import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../calculator.js";

const example = {
  rawCost: 1000,
  sellingPrice: 1800,
  yieldRate: 80,
  lossRate: 3,
  hqRate: 5,
  suppliesRate: 2.5,
};

function assertClose(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

test("指定された順計算の全中間値を丸めずに計算する", () => {
  const result = calculate(example);
  assert.equal(result.ok, true);
  assert.equal(result.hqAdjustedCost, 1050);
  assert.equal(result.yieldAdjustedCost, 1312.5);
  assertClose(result.suppliesAdjustedCost, 1345.3125);
  assertClose(result.lossAdjustedCost, 1345.3125 / 0.97);
  assert.equal(result.finishedCost, result.lossAdjustedCost);
  assertClose(result.marginAmount, 1800 - result.finishedCost);
  assertClose(result.marginRate, 22.948883161512036);
});

test("歩留まり100%では歩留補正を行わずに計算する", () => {
  const result = calculate({ ...example, yieldRate: 100, lossRate: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.hqAdjustedCost, 1050);
  assert.equal(result.yieldAdjustedCost, 1050);
  assert.equal(result.suppliesAdjustedCost, 1076.25);
  assert.equal(result.lossAdjustedCost, 1076.25);
  assert.equal(result.finishedCost, 1076.25);
});

test("目標25%から売価、100g切り上げ参考値、許容裸原価を逆算する", () => {
  const result = calculate({ ...example, targetMarginRate: 25 });
  assertClose(result.requiredSellingPrice, 1849.2268041237112);
  assert.equal(result.reference100gPrice, 185);
  assertClose(result.referenceMarginRate, 25.031345778768465);
  assertClose(result.allowableRawCost, 973.3797909407667);
});

test("目標30%の必要売価を逆算する", () => {
  const result = calculate({ ...example, targetMarginRate: 30 });
  assertClose(result.requiredSellingPrice, 1981.3144329896907);
});

test("売価が空欄でも原価側だけで必要売価を表示し、許容裸原価は空にする", () => {
  const result = calculate({ ...example, sellingPrice: null, targetMarginRate: 25 });
  assertClose(result.finishedCost, 1386.9201030927834);
  assertClose(result.requiredSellingPrice, 1849.2268041237112);
  assert.equal(result.marginRate, null);
  assert.equal(result.allowableRawCost, null);
});

test("許容裸原価は裸原価が空欄でも売価と条件から計算する", () => {
  const result = calculate({ ...example, rawCost: null, targetMarginRate: 25 });
  assert.equal(result.finishedCost, undefined);
  assertClose(result.allowableRawCost, 973.3797909407667);
});

test("目標値入率は0より大きく100未満で、範囲外なら逆算を止める", () => {
  for (const targetMarginRate of [0, 100, -1, 101]) {
    const result = calculate({ ...example, targetMarginRate });
    assert.equal(result.ok, true);
    assert.equal(result.errors.targetMarginRate.message, "目標値入率は0%より大きく100%未満の値を入力してください。");
    assert.equal(result.requiredSellingPrice, null);
    assert.equal(result.allowableRawCost, null);
  }
});

test("裸原価0以下は指定メッセージを返して順計算を止める", () => {
  for (const rawCost of [0, -1]) {
    const result = calculate({ ...example, rawCost, targetMarginRate: 25 });
    assert.equal(result.ok, false);
    assert.equal(result.errors.rawCost.message, "裸原価は0円より大きい値を入力してください。");
    assert.equal(result.finishedCost, undefined);
    assert.equal(result.marginRate, null);
    assertClose(result.allowableRawCost, 973.3797909407667);
  }
});

test("売価0以下は順計算の値入結果と許容裸原価を出さない", () => {
  for (const sellingPrice of [0, -1]) {
    const result = calculate({ ...example, sellingPrice, targetMarginRate: 25 });
    assert.equal(result.ok, false);
    assert.equal(result.marginAmount, null);
    assert.equal(result.marginRate, null);
    assert.equal(result.allowableRawCost, null);
  }
});

test("歩留まりは0より大きく100以下に制限する", () => {
  assert.equal(calculate({ ...example, yieldRate: 100 }).ok, true);
  for (const yieldRate of [0, -1, 100.1]) {
    const result = calculate({ ...example, yieldRate });
    assert.equal(result.ok, false);
    assert.equal(result.errors.rate.field, "yieldRate");
    assert.equal(result.finishedCost, undefined);
  }
});

test("ロス率は0以上100未満に制限する", () => {
  assert.equal(calculate({ ...example, lossRate: 0 }).ok, true);
  for (const lossRate of [-1, 100]) {
    const result = calculate({ ...example, lossRate });
    assert.equal(result.ok, false);
    assert.equal(result.errors.rate.field, "lossRate");
    assert.equal(result.finishedCost, undefined);
  }
});

test("本部費率と消耗品比率は0以上100未満に制限する", () => {
  assert.equal(calculate({ ...example, hqRate: 0, suppliesRate: 0 }).ok, true);
  for (const [field, value] of [["hqRate", -1], ["hqRate", 100], ["suppliesRate", -1], ["suppliesRate", 100]]) {
    const result = calculate({ ...example, [field]: value });
    assert.equal(result.ok, false);
    assert.equal(result.errors.rate.field, field);
    assert.equal(result.finishedCost, undefined);
  }
});

test("裸原価または売価が未入力でも独立して計算できる部分は維持する", () => {
  const noRawCost = calculate({ ...example, rawCost: null, targetMarginRate: 25 });
  assert.equal(noRawCost.ok, false);
  assertClose(noRawCost.allowableRawCost, 973.3797909407667);

  const noSellingPrice = calculate({ ...example, sellingPrice: null, targetMarginRate: 25 });
  assertClose(noSellingPrice.requiredSellingPrice, 1849.2268041237112);
  assert.equal(noSellingPrice.allowableRawCost, null);
});

test("計算オーバーフローは無限値を結果に出さない", () => {
  const result = calculate({ ...example, rawCost: 1.7e308, targetMarginRate: 25 });
  assert.equal(result.ok, false);
  assert.equal(result.errors.calculation.code, "overflow");
  assert.equal(result.finishedCost, undefined);
  assert.equal(result.requiredSellingPrice, null);
});
