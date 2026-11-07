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
  assert.ok(Math.abs(actual - expected) <= tolerance);
}

test("指定例の全中間値と値入結果をfull precisionで計算する", () => {
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

test("裸原価0以下は指定メッセージを返して順計算を止める", () => {
  for (const rawCost of [0, -1]) {
    const result = calculate({ ...example, rawCost });
    assert.equal(result.ok, false);
    assert.equal(result.errors.rawCost.message, "裸原価は0円より大きい値を入力してください。");
    assert.equal(result.finishedCost, undefined);
    assert.equal(result.marginRate, null);
  }
});

test("売価0以下は指定メッセージを返して値入結果を出さない", () => {
  for (const sellingPrice of [0, -1]) {
    const result = calculate({ ...example, sellingPrice });
    assert.equal(result.ok, false);
    assert.equal(result.errors.sellingPrice.message, "売価は0円より大きい値を入力してください。");
    assert.equal(result.marginAmount, null);
    assert.equal(result.marginRate, null);
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

test("ロス率は0以上100%未満に制限する", () => {
  assert.equal(calculate({ ...example, lossRate: 0 }).ok, true);
  for (const lossRate of [-1, 100]) {
    const result = calculate({ ...example, lossRate });
    assert.equal(result.ok, false);
    assert.equal(result.errors.rate.field, "lossRate");
    assert.equal(result.finishedCost, undefined);
  }
});

test("本部費率と消耗品比率は0以上100%未満に制限する", () => {
  assert.equal(calculate({ ...example, hqRate: 0, suppliesRate: 0 }).ok, true);
  for (const [field, value] of [["hqRate", -1], ["hqRate", 100], ["suppliesRate", -1], ["suppliesRate", 100]]) {
    const result = calculate({ ...example, [field]: value });
    assert.equal(result.ok, false);
    assert.equal(result.errors.rate.field, field);
    assert.equal(result.finishedCost, undefined);
  }
});

test("売価が未入力でも完成品原価は計算し、値入結果は未計算にする", () => {
  const result = calculate({ ...example, sellingPrice: null });
  assertClose(result.finishedCost, 1386.9201030927834);
  assert.equal(result.marginAmount, null);
  assert.equal(result.marginRate, null);
  assert.equal(result.errors.sellingPrice.code, "missing");
});

test("計算オーバーフローは無限値を結果に出さない", () => {
  const result = calculate({ ...example, rawCost: 1.7e308 });
  assert.equal(result.ok, false);
  assert.equal(result.errors.calculation.code, "overflow");
  assert.equal(result.finishedCost, undefined);
});
