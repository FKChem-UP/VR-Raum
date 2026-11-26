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
const entry = {marker: {scale: {setScalar() {}}}};
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
demo.updateInformation();
assert.equal(demo.infoPanel.visible, false, "Anvisieren allein öffnet die Karte nicht");
assert.equal(F.XrayDemo.activate(hit), true);
assert.equal(placed, 1);
assert.equal(demo.infoPanel.visible, true);
result = null;
demo.updateInformation();
assert.equal(demo.infoPanel.visible, true, "Wegsehen schließt die Karte nicht");
assert.equal(highlighted, 1);
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
console.log("Röntgen-Info: Treffer, Klick, Wegsehen, Menüpriorität und Schließen geprüft.");