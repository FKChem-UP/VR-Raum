"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
class Object3D {
  constructor(geometry, material) {
    this.geometry = geometry; this.material = material; this.children = []; this.userData = {};
    const vector = () => ({set(x, y, z) { Object.assign(this, {x, y, z}); }});
    this.position = vector(); this.scale = vector(); this.rotation = {};
  }
  add(object) { this.children.push(object); }
}
class Resource { dispose() { this.disposed = true; } }
class Texture extends Resource {
  constructor() { super(); this.repeat = {set() {}}; }
}
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
let laserHand = "right";
const F = {HandMenu: {laserHand: () => laserHand}, buttonPressed: (gp, index) => gp.buttons[index].pressed};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/pico-controller-model.js"), "utf8"), {
  window: {FKCVR: F}, document: {createElement: () => ({getContext: () => ({clearRect() {}, fillText() {},
    fillRect() {}, measureText: text => ({width: text.length * 20})})})},
  AFRAME: {registerComponent() {}, THREE: {Group: Object3D, Mesh: Object3D,
    SphereGeometry: Resource, CylinderGeometry: Resource, PlaneGeometry: Resource,
    BufferGeometry: Geometry, Float32BufferAttribute: Float32Array,
    MeshStandardMaterial: Material, MeshBasicMaterial: Material, CanvasTexture: Texture,
    Line: Object3D, LineBasicMaterial: Material,
    Sprite: class extends Object3D { constructor(material) { super(null, material); } }, SpriteMaterial: Material}}
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
  built.showLabels({joystick: "Bewegen"});
  const sprite = built.group.children.at(-1);
  const leader = built.group.children.at(-2);
  assert.equal(sprite.visible, true);
  assert.equal(leader.name, "controller-help-line-joystick");
  assert.equal(leader.visible, true);
  assert.ok(Array.from(leader.geometry.position.slice(0, 3)).every((value, i) =>
    Math.abs(value - [stick.x, stick.y, stick.z][i]) < 1e-7));
  assert.ok(sprite.scale.x > 0);
  built.showLabels({});
  assert.equal(sprite.visible, false);
  assert.equal(leader.visible, false);
  if (hand === "right") {
    built.showLabels({B: "Steuerhilfe"});
    const help = built.group.children.at(-1);
    const smallHeight = help.scale.y;
    const cap = built.controls.get("B").mesh.position;
    assert.ok(Math.hypot(help.position.x - cap.x, help.position.y - cap.y, help.position.z - cap.z) < 0.04);
    built.showLabels({B: "Steuerhilfe aus"});
    assert.ok(help.scale.y > smallHeight);
  }
  built.dispose();
  assert.equal(sprite.material.disposed, true);
  assert.equal(sprite.material.map.disposed, true);
  assert.equal(leader.geometry.disposed, true);
  assert.equal(leader.material.disposed, true);
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
const {controlLabels} = F.PicoModels;
assert.equal(controlLabels("right", false, -1, "right").B, "Steuerhilfe");
const right = controlLabels("right", true, -1, "right");
assert.equal(right.B, "Steuerhilfe aus");
assert.equal(right.A, "Modell zurücksetzen");
assert.equal(right.palm, undefined);
const left = controlLabels("left", true, -1, "right");
assert.equal(left.Y, "Hauptmenü");
assert.equal(left.X, undefined);
assert.equal(left.trigger, undefined);
assert.match(left.palm, /Handfläche drehen/);
assert.equal(controlLabels("right", true, -1, "left").trigger, undefined);
assert.match(controlLabels("right", true, -1, "left").palm, /Handfläche drehen/);
assert.equal(controlLabels("left", true, -1, "left", true).trigger, "Zeichnen / Auswählen");
assert.equal(controlLabels("left", false, 0, "right").joystick, "Bewegen");
assert.equal(controlLabels("right", false, 0, "right").joystick, "Drehen");
for (laserHand of ["left", "right"]) {
  const otherHand = laserHand === "left" ? "right" : "left";
  F.PicoModels.tutorial("question");
  assert.equal(F.PicoModels.highlights[laserHand][0], "trigger");
  assert.equal(F.PicoModels.highlights[otherHand].length, 0);
  assert.equal(controlLabels(laserHand, false, "question", laserHand).trigger, "Trigger: Auswählen");
  assert.equal(controlLabels(otherHand, false, "question", laserHand).trigger, undefined);
}
F.PicoModels.tutorial(-1);
console.log("Pico-Modelltest bestanden: zwei Modelle, getrennte Tastenmaterialien, unabhängiges Rotlicht und Ressourcenabbau.");