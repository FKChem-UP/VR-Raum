"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = {Settings: {laserHand: "right"}};
const components = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/hand-menu.js"), "utf8"), {
  window: {FKCVR: F},
  AFRAME: {THREE: {}, registerComponent: (name, component) => { components[name] = component; }}
});
const state = {open: false, since: null};
assert.equal(F.HandMenu.gate(state, true, 0.9, 0), false);
assert.equal(F.HandMenu.gate(state, true, 0.9, 299), false);
assert.equal(F.HandMenu.gate(state, true, 0.9, 300), true);
assert.equal(F.HandMenu.gate(state, true, 0.6, 400), true, "Hysterese hält Menü offen");
assert.equal(F.HandMenu.gate(state, true, 0.4, 450), false);
assert.equal(F.HandMenu.gate(state, true, 0.6, 500), false, "Schwelle zum Öffnen höher");
assert.equal(F.HandMenu.gate(state, true, 0.9, 600), false);
assert.equal(F.HandMenu.gate(state, false, 0.9, 950), false);
assert.equal(state.since, null, "Trackingverlust/Greifen/Hauptmenü setzt Verzögerung zurück");
let hidden = 0;
let blocked = 0;
F.getScene = () => ({components: {"fkc-hand-menu": {hide() { hidden++; }}}});
F.Menu = {blockDrawing() { blocked++; }};
assert.equal(F.HandMenu.laserHand(), "right");
F.HandMenu.setLaserHand("left");
assert.equal(F.HandMenu.laserHand(), "left");
assert.equal(hidden, 1);
assert.equal(blocked, 1);
F.HandMenu.setLaserHand("invalid");
assert.equal(F.HandMenu.laserHand(), "left");
F.HandMenu.setLaserHand("right");
assert.equal(F.HandMenu.laserHand(), "right");
assert.ok(components["fkc-hand-menu"]);
// Viewerpose muss Vorrang vor einer möglicherweise versetzten XR-Kamera haben.
const position = {
  copy(value) { this.value = value; return this; },
  applyMatrix4(matrix) { this.matrix = matrix; return this; }
};
const reference = {};
const matrixWorld = {};
let rigUpdated = false;
const rig = {object3D: {
  matrixWorld,
  updateWorldMatrix() { rigUpdated = true; }
}};
const viewerPosition = {x: 0.1, y: 1.6, z: 0.2};
const scene = {
  renderer: {xr: {getReferenceSpace: () => reference}},
  frame: {getViewerPose(space) {
    assert.equal(space, reference);
    return {transform: {position: viewerPosition}};
  }},
  camera: {getWorldPosition() { throw new Error("Keine XR-Kamera statt Viewerpose verwenden"); }}
};
assert.equal(F.HandMenu.readViewerHead(scene, rig, position), true);
assert.equal(position.value, viewerPosition);
assert.equal(position.matrix, matrixWorld);
assert.equal(rigUpdated, true);
scene.frame.getViewerPose = () => null;
assert.equal(F.HandMenu.readViewerHead(scene, rig, position), false);
let cameraUpdated = false;
const fallback = {camera: {
  updateWorldMatrix() { cameraUpdated = true; },
  getWorldPosition(out) { out.copy(viewerPosition); }
}};
assert.equal(F.HandMenu.readViewerHead(fallback, null, position), true);
assert.equal(cameraUpdated, true);
assert.equal(F.HandMenu.readViewerHead({}, null, position), false);
const ctx = {};
for (const method of ["fillRect", "fillText", "strokeRect", "beginPath", "moveTo", "lineTo", "stroke", "arc", "fill"]) {
  ctx[method] = function () {};
}
let mode = "distance";
let enabled = false;
F.Measure = {
  titles: {distance: "Distanz", angle: "Winkel", torsion: "Torsion"},
  counts: {distance: 2, angle: 3, torsion: 4},
  get mode() { return mode; }, get enabled() { return enabled; },
  toggleMode(value) { enabled = !(enabled && mode === value); mode = value; }
};
F.CIF = {styles: ["ball-stick", "space-filling", "wires", "capped-sticks"].map(id => ({id})), setStyle() {}};
F.AtomLabels = {setMode() {}};
const model = {
  dataset: {title: "C60"},
  fkcVariants: [1, 2, 3].map(id => ({id, title: "Ansicht " + id})),
  querySelector: () => ({object3D: {traverse() {}}})
};
const menu = Object.assign({ctx, model, offset: 0, texture: {},
  el: {components: {"fkc-measurements": {reset() {}}}}}, components["fkc-hand-menu"]);
const structure = {mode: "molecule", atoms: new Array(60), spaceGroup: {name: "Pa-3"}};
menu.render(structure);
assert.ok(menu.buttons.every(button => button.y + button.h <= 900), "Alle Buttons innerhalb der Fläche");
assert.equal(menu.buttons.length, 13, "3 Ansichten, 4 Styles, Labels, 3 Messmodi, 2 Resets");
const distanceButton = menu.buttons[8];
const angleButton = menu.buttons[9];
distanceButton.action();
assert.equal(enabled, true);
assert.equal(mode, "distance");
angleButton.action();
assert.equal(mode, "angle");
assert.equal(enabled, true);
angleButton.action();
assert.equal(enabled, false);
console.log("Handmenü-Logiktest bestanden: Handwahl, Einblendverzögerung, Hysterese und Rücksetzung.");
console.log("Direktmenütest bestanden: Buttonlayout und exklusive Messmodusumschaltung ohne Untermenü.");
console.log("Viewerpose-Test bestanden: Augenmittelpunkt, Rig-Transformation, Trackingverlust und Kamera-Rückfall.");