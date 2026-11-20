"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
let blocks = 0;
let measurementStops = 0;
const F = {Menu: {blockDrawing() { blocks++; }},
  Measure: {enabled: true, setEnabled(value) { this.enabled = value; measurementStops++; }}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/drawing.js"), "utf8"), {
  window: {FKCVR: F}, AFRAME: {THREE: {}}, console: {info() {}}
});
assert.equal(F.Draw.mode, "laser");
assert.equal(F.Draw.opacity, 0.35);
assert.equal(F.Draw.sample(null, {}, "right"), null, "Laser zeichnet niemals");
F.Draw.setMode("paint");
assert.equal(measurementStops, 1);
assert.equal(F.Measure.enabled, false);
assert.equal(F.Draw.sample(null, {}, "right"), null, "Kein Malen ohne Oberflächennormale");
F.Draw.setMode("invalid");
assert.equal(F.Draw.mode, "paint");
F.Draw.setMode("laser");
assert.equal(blocks, 2);
console.log("Zeichenmodustest bestanden: Laserstandard, exklusiver Malmodus, Triggerblock und Normalschutz.");