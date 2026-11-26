"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const created = [], result = {spawn: {x: 0, z: 6}};
const F = {RoomBuilder: {build() { return result; }}, create(tag, attrs, parent) {
  const el = {tag, attrs, parent, setAttribute(name, value) { attrs[name] = value; }};
  created.push(el); return el;
}};
let component;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/mo-xray-demo.js"), "utf8"), {
  window: {FKCVR: F}, AFRAME: {THREE: {}, registerComponent(name, spec) {
    assert.equal(name, "fkc-mo-xray"); component = spec;
  }}
});

const {frame, lines, voltage, current, kEdge, intensity, activate} = F.MoXray;
assert.equal(voltage, 50);
assert.equal(current, 1);
assert.equal(F.RoomBuilder.build({}, {id: "vorlesung-4"}), result);
assert.equal(created.length, 0);
const parent = {};
assert.equal(F.RoomBuilder.build(parent, {id: "vorlesung-5"}), result);
assert.equal(created.length, 1);
assert.equal(created[0].parent, parent);
assert.equal(created[0].attrs.class, "vr-action");
assert.equal(created[0].attrs["fkc-mo-xray"], "");

assert.ok(voltage > kEdge && kEdge > lines.alpha1.energy);
assert.ok(lines.alpha1.energy > lines.alpha2.energy);
assert.equal(intensity(voltage), 0);
assert.equal(intensity(voltage + 1), 0);
assert.ok(intensity(15) > 0);
for (const mode of ["alpha1", "alpha2"]) {
  assert.ok(!frame(mode, 1500).vacancy && frame(mode, 1500).photon === 0);
  assert.ok(frame(mode, 2100).vacancy && frame(mode, 2100).eject);
  assert.ok(frame(mode, 3600).transfer && frame(mode, 3600).photon === 0);
  assert.ok(!frame(mode, 4500).vacancy && frame(mode, 4500).photon > 0);
  assert.deepEqual(frame(mode, 6000), frame(mode, 0));
}
for (let t = 0; t < 6000; t += 50) {
  const f = frame("brake", t);
  assert.ok(!f.vacancy && !f.eject && !f.transfer);
}
assert.ok(frame("brake", 2600).photon > 0);
assert.ok(frame("brake", 3600).incoming[1] < frame("brake", 2000).incoming[1]);

const mesh = {}, demo = {controls: {w: 960, h: 250, mesh}, paused: false, showInfo: true,
  click: component.click, refresh() {}, renderFrame() {}};
const hit = {el: {components: {"fkc-mo-xray": demo}}, mesh, uv: {x: .5, y: .5}};
const press = id => {
  demo.buttons = [{id, x: 410, y: 100}]; assert.ok(activate(hit));
};
press("impact"); assert.equal(demo.infoKey, "impact");
press("impact"); assert.equal(demo.infoKey, null);
press("info-alpha2"); assert.equal(demo.infoKey, "alpha2");
press("info"); assert.equal(demo.showInfo, false); assert.equal(demo.infoKey, null);
press("pause"); assert.equal(demo.paused, true);
press("alpha2"); assert.equal(demo.paused, false); assert.equal(demo.mode, "alpha2");
press("auto"); assert.equal(demo.auto, true);
component.tick.call({...demo, clock: 5990, refresh() { assert.equal(this.mode, "alpha2"); }}, 0, 30);
F.Menu = {opened: true}; press("pause"); assert.equal(demo.paused, false);
assert.equal(activate({el: {}}), false);
console.log("Mo-Röntgendemo: Raum, Strahlungsabläufe, Spektrum und Bedienung geprüft.");