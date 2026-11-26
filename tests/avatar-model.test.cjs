"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
class Group {
  constructor() {
    this.children = [];
    const vector = () => ({set(...values) { this.values = values; }});
    this.position = vector();
    this.scale = vector();
    this.rotation = {};
  }
  add(...objects) { this.children.push(...objects); }
  removeFromParent() { this.removed = true; }
}
class Resource { dispose() { this.disposed = true; } }
class Mesh extends Group {
  constructor(geometry, material) { super(); Object.assign(this, {geometry, material}); }
}
let disposedControllers = 0;
const F = {Settings: {}, PicoModels: {build: () => ({group: new Group(), dispose() { disposedControllers++; }})}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/avatar-model.js"), "utf8"), {
  window: {FKCVR: F}, document: {createElement: () => ({getContext: () => ({fillRect() {}, fillText() {}})})},
  AFRAME: {THREE: {Group, Mesh, SphereGeometry: Resource, CylinderGeometry: Resource, TorusGeometry: Resource,
    BoxGeometry: Resource, MeshStandardMaterial: Resource, CanvasTexture: Resource,
    Sprite: class extends Group { constructor(material) { super(); this.material = material; } },
    SpriteMaterial: class extends Resource { constructor(options) { super(); Object.assign(this, options); } }}}
});
const models = F.AvatarModels;
assert.deepEqual(models.appearance("participant"), models.appearance("participant"));
const looks = Array.from({length: 30}, (_, i) => models.appearance("participant-" + i));
const share = Array.from({length: 2048}, (_,i)=>models.appearance(`session-${i}`).feminine)
  .filter(Boolean).length / 2048;
assert.ok(share > 0.45 && share < 0.55);
assert.equal(models.feminineLook({form:"slim",style:"hat"},false),true);
assert.equal(models.feminineLook({form:"classic",style:"hat"},false),models.feminineLook({form:"classic",style:"hat"},true));
assert.equal(new Set(looks.map(look => look.accessory)).size, 3);
assert.ok(new Set(looks.map(look => look.color)).size > 1);
const avatar = models.build("participant");
assert.equal(avatar.group.children.length, 4);
assert.ok(avatar.head.children.length >= 7);
assert.ok(avatar.body.children.length >= 2);
avatar.setHands(true);
assert.equal(avatar.left.children[0].visible, false);
assert.equal(avatar.right.children[1].visible, true);
avatar.setHands(false);
assert.equal(avatar.right.children[0].visible, true);
assert.equal(avatar.left.children[1].visible, false);
assert.equal(models.showsHands(), false);
F.Settings.showPointingHands = true;
assert.equal(models.showsHands(), true);
F.Tutorial = {active: true};
assert.equal(models.showsHands(), false);
avatar.dispose();
assert.equal(disposedControllers, 2);
assert.equal(avatar.group.removed, true);
assert.equal(avatar.head.children[0].geometry.disposed, true);
assert.equal(avatar.left.children[1].children[0].material.disposed, true);
for (const style of ["hat", "monocle", "cape", "glasses", "mohawk", "hair", "crown", "antenna", "headband", "none"]) {
  const custom = models.build("participant", {name: "Laborfuchs", form: "slim", color: "#31749b", style});
  const badge = custom.body.children.at(-1);
  assert.ok(badge.material.map);
  custom.dispose();
  assert.equal(badge.material.map.disposed, true);
}
const narrow = models.build("one", {form: "slim", style: "none"});
const broad = models.build("two", {form: "broad", style: "cape"});
for (const form of ["slim", "round", "oval", "classic"]) {
  const model = models.build("rear", {form, style: "none"});
  const [skull] = model.head.children;
  const hair = model.head.children.find(mesh => mesh.name === "hair-back");
  assert.ok(hair && hair.position.values[2] + hair.scale.values[2] > skull.position.values[2] + skull.scale.values[2]);
  assert.ok(hair.position.values[1] - hair.scale.values[1] < skull.position.values[1] - skull.scale.values[1]);
  model.dispose();
}
assert.ok(broad.head.children[0].scale.values[0] > narrow.head.children[0].scale.values[0] * 1.5);
assert.ok(broad.body.children[0].scale.values[0] > narrow.body.children[0].scale.values[0] * 1.5);
assert.notEqual(broad.body.children[0].scale.values[1], narrow.body.children[0].scale.values[1]);
for (const form of ["broad", "compact"]) {
  const model = models.build("jaw", {form, style: "none"});
  const jaw = model.head.children[1];
  const mouth = model.head.children.at(-1);
  assert.ok(mouth.position.values[2] < jaw.position.values[2] - jaw.scale.values[2], "Mund liegt vor dem Kiefer");
  model.dispose();
}
narrow.dispose();
broad.dispose();
console.log("Avatar: stabiles Aussehen, Körperteile, Zeigehände und Freigabe geprüft.");