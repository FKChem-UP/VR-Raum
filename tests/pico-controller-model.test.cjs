"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
class Object3D {
  constructor(geometry, material) {
    this.geometry = geometry; this.material = material; this.children = []; this.userData = {};
    this.position = this.scale = {set(x, y, z) { Object.assign(this, {x, y, z}); }}; this.rotation = {};
  }
  add(object) { this.children.push(object); }
}
class Resource { dispose() { this.disposed = true; } }
class Geometry extends Resource {
  setAttribute(name, values) { this[name] = values; }
  setIndex(index) { this.index = index; }
  computeVertexNormals() {}
}
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
    BufferGeometry: Geometry, Float32BufferAttribute: Float32Array,
    MeshStandardMaterial: Material, MeshBasicMaterial: Material, CanvasTexture: Resource}}
});
for (const hand of ["left", "right"]) {
  const built = F.PicoModels.build(hand);
  assert.equal(built.controls.size, 5);
  const shell = built.group.children.find(mesh => mesh.name === "housing").geometry;
  const points = shell.position;
  const top = Math.max(...points.filter((_, i) => i % 3 === 1));
  const tip = Array.from(points.slice(-6, -3));
  const deck = Array.from(points.slice(-3));
  assert.ok(tip[2] - deck[2] > deck[1] - tip[1], "Griffende zeigt stärker zum Körper (+Z) als nach unten");
  assert.ok(shell.index.every(index => index >= 0 && index < points.length / 3));
  const stick = built.controls.get("joystick").mesh.position;
  for (const key of hand === "left" ? ["X", "Y"] : ["A", "B"]) {
    const cap = built.controls.get(key).mesh.position;
    assert.ok(hand === "left" ? stick.x < cap.x : stick.x > cap.x);
    assert.ok(Math.hypot(stick.x - cap.x, stick.z - cap.z) > 0.018, "Freiraum zwischen Stick und Taste");
    const label = built.group.children.find(mesh => mesh.name === "label-" + key);
    assert.ok(cap.y + 0.002 > top && label.position.y > cap.y + 0.002, "Tastenkappe über Gehäuse, Schrift über Kappe");
  }
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