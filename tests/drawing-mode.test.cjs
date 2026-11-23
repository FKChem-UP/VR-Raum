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
const poster = {type: "action", el: {dataset: {roomId: "team-b"}}, normal: {}};
assert.equal(F.Draw.surfaceHit(poster), null, "Raumwechselposter bleiben unbemalbar");
assert.equal(F.Draw.surfaceHit({...poster,type:"surface"}), null, "Auch als Flächentreffer bleibt das Poster geschützt");
assert.equal(F.Draw.surfaceHit({type: "action", el: {dataset: {fkcHandMenu: "true"}}, normal: {}}), null);
assert.equal(F.Draw.surfaceHit(null), null);
const surface = {type: "model", normal: {}};
assert.equal(F.Draw.surfaceHit(surface), surface);
assert.ok(F.Draw.surfaceHit({type:"surface",normal:{},el:{dataset:{}}}));
F.Draw.setMode("invalid");
assert.equal(F.Draw.mode, "paint");
F.Draw.setMode("laser");
assert.equal(F.Draw.surfaceHit(poster), null);
assert.equal(blocks, 2);
console.log("Zeichenmodustest bestanden: Laserstandard, exklusiver Malmodus, Triggerblock und Normalschutz.");