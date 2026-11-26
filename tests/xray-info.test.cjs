"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const F = {Menu: {render() {}}, RoomBuilder: {build() {}}, findHit: () => null};
const components = {};
const el = {isConnected: true, sceneEl: {}, components: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/xray-demo.js"), "utf8"), {
  window: {FKCVR: F}, document: {getElementById: () => el},
  AFRAME: {THREE: {}, registerComponent(name, spec) { components[name] = spec; }}
});
let placed = 0, highlighted = 0;
const markerMesh = {};
const entry = {marker: {children: [markerMesh], visible: true, scale: {setScalar() {}}}};
const demo = {...components["fkc-xray-demo"], el, shown: true, infoPanel: {}, highlight: {},
  findInformationHit() { return result; }, infoLookup: new Map(),
  drawInformation() {}, placeInformation() { placed++; }, updateHighlight() { highlighted++; }};
el.components["fkc-xray-demo"] = demo;
demo.infoMeshes = [];
const vector = {clone() { return this; }, negate() { return this; }, dot() { return -1; }};
const ray = {ray: {direction: vector}};
const target = {};
demo.infoLookup.set(target, entry);
let result = {object: target, point: vector};
const hit = F.findHit(ray, true);
demo.infoLookup.set(markerMesh, entry);
assert.equal(demo.markerFromHit(hit), null);
result = {object: markerMesh, point: vector};
demo.mouseInfo = demo.markerFromHit(F.findHit(ray, true));
assert.equal(demo.mouseInfo, entry);
demo.updateInformation();
assert.equal(demo.infoPanel.visible, false, "Anvisieren allein öffnet die Karte nicht");
assert.equal(highlighted, 1, "Anvisieren markiert den zugehörigen Bereich");
demo.mouseInfo = null;
assert.equal(F.XrayDemo.activate(hit), true);
assert.equal(placed, 1);
assert.equal(demo.infoPanel.visible, true);
result = null;
demo.updateInformation();
assert.equal(demo.infoPanel.visible, true, "Wegsehen schließt die Karte nicht");
assert.equal(highlighted, 2);
F.Menu.opened = true;
demo.updateInformation();
assert.equal(demo.infoPanel.visible, false);
F.Menu.opened = false;
demo.updateInformation();
assert.equal(demo.infoPanel.visible, true);
result = {object: demo.infoPanel, point: vector};
F.XrayDemo.activate(F.findHit(ray, true));
assert.equal(demo.selectedInfo, null);
assert.equal(demo.infoPanel.visible, false, "Klick auf die Karte schließt sie");
assert.equal(F.XrayDemo.activate({}), false);
const {projectDirection, angleGuides} = F.XrayDemo;
const radius = 4.7;
for (const beta of [0, 20, 35, 50, 65].map(deg => deg * Math.PI / 180)) {
  const points = angleGuides(beta, radius, 2.8, 2.3);
  assert.ok(points.length > 0 && points.length % 6 === 0);
  for (let i = 0; i < points.length; i += 3) {
    const [x, y] = points.slice(i, i + 2);
    assert.ok(Math.abs(x) < 1.4 && Math.abs(y) < 1.15);
    const z = radius * Math.cos(beta) - x * Math.sin(beta);
    const degrees = Math.acos(z / Math.hypot(radius, x, y)) * 180 / Math.PI;
    assert.ok(Math.abs(degrees / 5 - Math.round(degrees / 5)) < 1e-8);
  }
}
const [x, y] = projectDirection(Math.sin(0.2), 0, Math.cos(0.2), 0, 1, radius);
assert.ok(Math.abs(Math.hypot(x, y) - radius * Math.tan(0.2)) < 1e-10);
console.log("Röntgen-Info: Treffer, Klick, Wegsehen, Menüpriorität und Schließen geprüft.");