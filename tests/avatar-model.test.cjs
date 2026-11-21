"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
class Group {
  constructor() {
    this.children = [];
    this.position = this.scale = {set() {}};
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
  window: {FKCVR: F}, AFRAME: {THREE: {Group, Mesh, SphereGeometry: Resource,
    CylinderGeometry: Resource, TorusGeometry: Resource, BoxGeometry: Resource, MeshStandardMaterial: Resource}}
});
const models = F.AvatarModels;
assert.deepEqual(models.appearance("participant"), models.appearance("participant"));
const looks = Array.from({length: 30}, (_, i) => models.appearance("participant-" + i));
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
console.log("Avatar: stabiles Aussehen, Körperteile, Zeigehände und Freigabe geprüft.");