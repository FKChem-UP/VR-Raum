"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = {};
const components = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/measurements.js"), "utf8"), {
  window: {FKCVR: F},
  AFRAME: {THREE: {}, registerComponent(name, component) { components[name] = component; }}
});
assert.equal(F.Measure.distance([0, 0, 0], [3, 4, 0]), 5);
assert.equal(F.Measure.distance([1, 2, 3], [1, 2, 3]), 0);
assert.equal(F.Measure.distance([3, 4, 0], [0, 0, 0]), 5);
let calls = 0;
F.getScene = () => ({components: {"fkc-measurements": {
  reset() { calls++; }, select() { calls++; }
}}});
F.Menu = {blockDrawing() {}};
assert.equal(F.Measure.click({type: "model"}), false);
F.Measure.setEnabled(true);
assert.equal(calls, 1);
assert.equal(F.Measure.click({type: "action"}), false);
assert.equal(F.Measure.click({type: "model"}), true);
assert.equal(calls, 2);
F.Measure.setEnabled(false);
assert.equal(F.Measure.click({type: "model"}), false);
console.log("Distanztest bestanden: Å-Geometrie, Symmetrie und exklusive Messmodus-Weiterleitung.");