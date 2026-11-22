"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = {}, components = {};
const context = {window: {FKCVR: F}, AFRAME: {THREE: {}, registerComponent(name, component) { components[name] = component; }}};
for (const file of ["bragg-tutorial", "tutorial"]) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js", file + ".js"), "utf8"), context);
}
const B = F.Bragg, s = B.initial();
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10);
const g = B.geometry(B.bragg), other = B.geometry(B.comparison);
assert.ok(g.matched && !other.matched);
close(g.extra, 1); close(other.extra, 1.5);
close(Math.cos(other.periods * 2 * Math.PI), -1);
assert.equal(B.progress(0, false, true, true, s), 0);
assert.equal(B.progress(0, true, false, false, s), 1);
assert.equal(B.progress(1, true, true, false, s), 2);
assert.equal(B.progress(2, true, true, true, s), 3);
B.command(s, "play"); assert.equal(B.progress(3, true, true, true, s), 3);
s.time = 4; assert.equal(B.progress(3, true, true, true, s), 4);
B.command(s, "slow"); assert.equal(B.progress(4, true, true, true, s), 5); close(s.angle, B.bragg);
B.command(s, "compare"); assert.equal(B.progress(5, true, true, true, s), 6);
B.command(s, "play"); assert.equal(B.progress(6, true, true, true, s), 7);
for (let i = 0; i < 90; i++) B.command(s, "plus"); assert.equal(s.angle, 70);
for (let i = 0; i < 90; i++) B.command(s, "minus"); assert.equal(s.angle, 10);
B.command(s, "reset"); assert.deepEqual(s, B.initial());

// Übergang ohne Raumwechsel oder Neubau der Tafel; Station nur durch Auswahl aktivieren.
const board = {}, station = {el: {}, state: s};
F.releaseModel = F.invalidateHits = () => {}; B.station = () => station;
const tutorial = Object.assign({board, group: {}, target: {object3D: {visible: true}},
  body: {querySelectorAll: () => []}, el: {components: {}}}, components["fkc-tutorial"]);
F.Tutorial.active = true; tutorial.beginAnimation();
assert.equal(tutorial.board, board); assert.equal(tutorial.phase, "bragg");
tutorial.click({el: station.el}); assert.equal(tutorial.selectedAnimation, null);
tutorial.animationStep = 1; tutorial.click({el: station.el}); assert.equal(tutorial.selectedAnimation, station.el);
tutorial.animationStep = 5;
assert.equal(F.Tutorial.menuTarget({components: {"fkc-tutorial": tutorial}}, station.el), "compare");
console.log("Bragg-Geometrie, Phase, Winkelgrenzen, Steuerung und Tutorialfortsetzung geprüft.");