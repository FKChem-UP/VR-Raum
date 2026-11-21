"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
class Vector {
  set(x, y, z) { Object.assign(this, {x, y, z}); return this; }
  multiply(v) { return this.set(this.x * v.x, this.y * v.y, this.z * v.z); }
  applyQuaternion() { return this; } // Für diesen Test gilt die Identitätsrotation.
}
let modes = new Set(["vr-mode"]);
let height = 1.08;
const scene = {is: mode => modes.has(mode), addEventListener() {},
  renderer: {xr: {getReferenceSpace: () => ({})}},
  frame: {getViewerPose: () => height === null ? null : {transform: {
    position: {x: 0.2, y: height, z: 0.3}, orientation: {x: 0, y: 0, z: 0, w: 1}
  }}}};
const F = {getScene: () => scene};
const camera = {object3D: {updateWorldMatrix() {}, getWorldPosition() {}, getWorldQuaternion() {}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8"), {
  window: {FKCVR: F}, document: {getElementById: () => camera},
  AFRAME: {THREE: {Quaternion: class {invert() { return this; }}}, registerComponent() {}}
});
let updates = 0;
const rig = {position: {x: 3, y: 0, z: 5}, scale: {x: 1, y: 1, z: 1}, quaternion: {},
  worldToLocal() {}, getWorldQuaternion() {}, updateWorldMatrix() { updates++; }};
F.app.scene = scene;
F.app.rig = {object3D: rig};
F.app.heightHead = new Vector();
F.app.heightQuaternion = {set() {}, identity() {}, premultiply() {}};
for (height of [1.08, 1.8, 0.6]) {
  F.app.updateVREyeHeight();
  assert.equal(height + rig.position.y, 1.6);
  assert.equal(rig.position.x, 3);
  assert.equal(rig.position.z, 5);
}
const last = rig.position.y;
height = null;
F.app.updateVREyeHeight();
assert.equal(rig.position.y, last, "Trackingverlust bewahrt den letzten gültigen Versatz");
height = 0.9;
modes = new Set(["vr-mode", "ar-mode"]);
F.app.updateVREyeHeight();
assert.equal(rig.position.y, last, "Keine Veränderung im AR-Modus");
modes.clear();
F.app.updateVREyeHeight();
assert.equal(rig.position.y, last, "Keine Höhenkorrektur im Desktopmodus");
assert.ok(updates >= 3);
console.log("VR-Augenhöhe: Sitzen, Stehen, Hocken, Trackingverlust sowie PC/AR-Abgrenzung geprüft.");