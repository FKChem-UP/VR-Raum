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
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8,
  actual + " ≠ " + expected);
near(F.Measure.angle([1, 0, 0], [0, 0, 0], [0, 1, 0]), 90);
near(F.Measure.angle([1, 0, 0], [0, 0, 0], [-1, 0, 0]), 180);
near(F.Measure.angle([1, 0, 0], [0, 0, 0], [1, 1, 0]), 45);
near(F.Measure.torsion([1, 0, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]), 90);
near(F.Measure.torsion([1, 0, 0], [0, 0, 0], [0, 0, 1], [0, -1, 1]), -90);
near(F.Measure.torsion([1, 0, 0], [0, 0, 0], [0, 0, 1], [1, 0, 1]), 0);
near(Math.abs(F.Measure.torsion([1, 0, 0], [0, 0, 0], [0, 0, 1], [-1, 0, 1])), 180);
assert.throws(() => F.Measure.angle([0, 0, 0], [0, 0, 0], [1, 0, 0]), /nicht definiert/);
assert.throws(() => F.Measure.torsion([0, 0, -1], [0, 0, 0], [0, 0, 1], [1, 0, 1]), /nicht definiert/);
const transform = point => [-point[1] * 4 + 3, point[0] * 4 - 7, point[2] * 4 + 2];
near(F.Measure.torsion(...[[1, 0, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]].map(transform)), 90);
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
F.Measure.setMode("angle");
assert.equal(F.Measure.mode, "angle");
assert.equal(F.Measure.enabled, true);
F.Measure.setMode("unknown");
assert.equal(F.Measure.mode, "angle");
const atoms = [
  {id: "a", cifLabel: "C1", positionAngstrom: [1, 0, 0]},
  {id: "b", cifLabel: "C2", positionAngstrom: [0, 0, 0]},
  {id: "c", cifLabel: "C3", positionAngstrom: [0, 1, 0]},
  {id: "d", cifLabel: "C4", positionAngstrom: [0, 1, 1]}
];
const meshes = atoms.map(atom => ({userData: {fkcAtom: atom}}));
const visual = {fkcStructure: {mode: "molecule", atoms},
  object3D: {traverse(callback) { meshes.forEach(callback); }}};
const root = {querySelector: () => visual};
const labels = {measureLabels: new Map()};
let labelText;
const component = Object.assign({
  el: {components: {"fkc-atom-labels": labels}},
  line: {visible: false}, label: {visible: false},
  canvas: {getContext: () => ({measureText: text => ({width: text.length * 20}),
    clearRect() {}, fillRect() {}, strokeText() {}, fillText(text) { labelText = text; }})},
  texture: {repeat: {set() {}}}
}, components["fkc-measurements"]);
F.setStatus = () => {};
component.reset();
const selectAtom = index => component.select({el: root, mesh: meshes[index]});
selectAtom(0);
assert.equal(labels.measureLabels.size, 1);
selectAtom(1);
assert.equal(labels.measureLabels.size, 2);
selectAtom(2);
assert.equal(labels.measureLabels.size, 3);
assert.equal(labelText, "90.0°");
assert.equal(component.labelWidth, 140);
selectAtom(3);
assert.equal(component.points.length, 1, "Nach Ergebnis neue Auswahl");
selectAtom(3);
assert.equal(component.points.length, 0, "Erneuter Atomklick nimmt Auswahl zurück");
assert.equal(labels.measureLabels.size, 0);
F.Measure.mode = "distance";
component.select({el: root, mesh: {userData: {fkcBond: {a: 0, b: 1}}}});
assert.equal(component.points.length, 2);
assert.equal(labelText, "1.000 Å");
assert.equal(labels.measureLabels.size, 2);
component.reset();
assert.equal(labels.measureLabels.size, 0, "Messreset entfernt nur Messlabels");
F.Measure.mode = "torsion";
[0, 1, 2, 3].forEach(selectAtom);
assert.equal(component.points.length, 4);
assert.equal(labelText, "-90.0°");
visual.fkcStructure.mode = "cell";
component.reset();
selectAtom(0);
assert.equal(component.points.length, 0, "Keine ungeprüfte periodische Zellmessung");
F.Measure.setEnabled(false);
F.Measure.toggleMode("distance");
assert.equal(F.Measure.enabled, true);
assert.equal(F.Measure.mode, "distance");
F.Measure.toggleMode("angle");
assert.equal(F.Measure.enabled, true);
assert.equal(F.Measure.mode, "angle");
F.Measure.toggleMode("angle");
assert.equal(F.Measure.enabled, false, "Aktiver Button beendet Messmodus");
console.log("Distanztest bestanden: Å-Geometrie, Symmetrie und exklusive Messmodus-Weiterleitung.");
console.log("Winkel-/Torsionstests bestanden: 0/45/90/180°, ±90°, entartete Geometrie und Transformationsinvarianz.");
console.log("Messauswahltests bestanden: Atom-/Bindungsklicks, Messlabels, Rücknahme, kompakte Ergebnisbreite und Zell-Ausschluss.");