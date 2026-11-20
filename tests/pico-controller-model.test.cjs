"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
class Object3D {
  constructor(geometry, material) {
    this.geometry = geometry; this.material = material; this.children = []; this.userData = {};
    this.position = this.scale = {set() {}}; this.rotation = {};
  }
  add(object) { this.children.push(object); }
}
class Resource { dispose() { this.disposed = true; } }
class Material extends Resource {
  constructor(options) {
    super(); Object.assign(this, options);
    this.color = {value: options.color, set(value) { this.value = value; }};
    this.emissive = {set(value) { this.value = value; }};
  }
}
const F = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/pico-controller-model.js"), "utf8"), {
  window: {FKCVR: F}, document: {createElement: () => ({getContext: () => ({clearRect() {}, fillText() {}})})},
  AFRAME: {registerComponent() {}, THREE: {Group: Object3D, Mesh: Object3D,
    SphereGeometry: Resource, CylinderGeometry: Resource, PlaneGeometry: Resource,
    MeshStandardMaterial: Material, MeshBasicMaterial: Material, CanvasTexture: Resource}}
});
for (const hand of ["left", "right"]) {
  const built = F.PicoModels.build(hand);
  assert.equal(built.controls.size, 5);
  assert.equal(new Set([...built.controls.values()].map(entry => entry.material)).size, 5);
  assert.ok(built.controls.has(hand === "left" ? "X" : "A"));
  assert.ok(!built.controls.has(hand === "left" ? "A" : "X"));
  for (const name of F.PicoModels.buttons(hand)) {
    built.highlight([name]);
    for (const [other, entry] of built.controls) assert.equal(entry.material.emissive.value, other === name ? "#ff0000" : "#000000");
  }
  built.highlight([]);
  assert.ok([...built.controls.values()].every(entry => entry.material.color.value === entry.color));
  built.dispose();
  assert.ok([...built.controls.values()].every(entry => entry.material.disposed));
}
F.PicoModels.tutorial(0);
assert.equal(F.PicoModels.highlights.left[0], "joystick");
F.PicoModels.tutorial(2);
assert.equal(F.PicoModels.highlights.right[0], "grip");
assert.equal(F.PicoModels.setHighlights("left", ["A"]), false);
assert.equal(F.PicoModels.setHighlights("right", ["trigger", "A", "B"]), true);
F.PicoModels.tutorial(-1);
assert.equal(F.PicoModels.highlights.right.length, 0);
console.log("Pico-Modelltest bestanden: zwei Modelle, getrennte Tastenmaterialien, unabhängiges Rotlicht und Ressourcenabbau.");