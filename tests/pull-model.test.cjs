"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const window = {};
const components = {};
class Matrix {
  copy(other) { Object.assign(this, other); return this; }
  invert() { this.offset = -this.offset / this.scale; this.scale = 1 / this.scale; return this; }
  multiplyMatrices(a, b) { this.scale = a.scale * b.scale; this.offset = a.offset + a.scale * b.offset; }
}
class Bounds {
  constructor(min, max) { this.min = min; this.max = max; }
  makeEmpty() { this.min = Infinity; this.max = -Infinity; return this; }
  isEmpty() { return this.min > this.max; }
  clone() { return new Bounds(this.min, this.max); }
  applyMatrix4(matrix) { this.min = this.min * matrix.scale + matrix.offset; this.max = this.max * matrix.scale + matrix.offset; return this; }
  union(other) { this.min = Math.min(this.min, other.min); this.max = Math.max(this.max, other.max); }
  getSize(out) { return Object.assign(out, {x: this.max - this.min, y: 0, z: 0}); }
  getCenter(out) { return Object.assign(out, {x: (this.min + this.max) / 2}); }
}
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/vr-controls.js"), "utf8"), {
  window, THREE: {Matrix4: Matrix, Box3: Bounds, Vector3: class {}},
  AFRAME: {registerComponent(name, component) { components[name] = component; }}
});
const F = window.FKCVR;
assert.ok(F.pullStep(5, 2, 0.02) > F.pullStep(5, 0.1, 0.02));
assert.ok(F.pullStep(5, 99, 0.02) <= 2.5 * 0.02);
assert.equal(F.pullStep(0.05, 2, 0.02), 0);
assert.equal(F.pullStep(5, 2, 0), 0);
const grabber = Object.assign({pulling: {}, grabbed: null}, components["fkc-grabber"]);
grabber.end();
assert.equal(grabber.pulling, null, "Loslassen beendet Ansaugen ohne Nachlauf");
const box = {updateWorldMatrix() {}};
const fragment = {visible: true, updateWorldMatrix() {}};
const root = {modelReady: true, querySelector: () => ({object3D: box}), components: {
  "fkc-manipulable": {hands: [], start: () => true}
}};
const state = {selected: new Set(), records: new Map([["fragment", {built: {group: fragment}}]])};
F.CIF = {environmentState: () => state};
Object.assign(grabber, {el: {object3D: {getWorldPosition() {}}, components: {}, sceneEl: {components: {}, querySelectorAll: () => [root]}},
  position: {distanceTo: () => 1}, bounds: {setFromObject(object) { this.object = object; }, isEmpty: () => false,
    clampPoint() {}, distanceToPoint() { assert.equal(this.object, fragment); return 0.03; }}});
grabber.start(); assert.equal(grabber.grabbed, null, "Transparente Vorschau bietet keinen Griff");
state.selected.add("fragment"); grabber.start(); assert.equal(grabber.grabbed, root, "Griff am übernommenen Fragment bewegt das Gesamtmodell");

// Hitbox und Visual teilen einen bereits verschobenen und skalierten Modellkörper.
const frame = {matrixWorld: {scale: 2, offset: 10}, updateWorldMatrix() {}};
const hitbox = {object3D: {parent: frame, position: {copy(center) { this.x = center.x; }}},
  setAttribute(name, value) { assert.equal(name, "geometry"); this.width = value.width; }};
const model = {object3D: frame, querySelector: () => hitbox};
const atom = offset => ({isMesh: true, matrixWorld: {scale: 1, offset}, geometry: {boundingBox: new Bounds(-1, 1)}});
const base = atom(10), extra = atom(16);
const mesh = {children: [base], updateWorldMatrix() {}, traverseVisible(fn) { this.children.forEach(fn); }};
const visual = {getObject3D: () => mesh, closest: () => model, components: {},
  object3D: Object.freeze({position: -1, scale: 0.5})};
const normalizer = Object.assign({el: visual, data: {padding: 0.06}}, components["fkc-normalize"]);
visual.components["fkc-normalize"] = normalizer;
assert.ok(normalizer.refreshGripBounds());
assert.equal(hitbox.width, 1.06);
mesh.children.push(extra);
assert.ok(normalizer.refreshGripBounds());
assert.equal(hitbox.width, 4.06);
assert.equal(hitbox.object3D.position.x, 1.5);
mesh.children.pop();
assert.ok(normalizer.refreshGripBounds());
assert.equal(hitbox.width, 1.06);
assert.equal(hitbox.object3D.position.x, 0);
console.log("Greiftest bestanden: Ansaugen, übernommene Fragmente und mitwachsende Hitbox.");