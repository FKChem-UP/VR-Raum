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
const {projectDirection, angleGuides, scanFrame, scanModes, reflectionTolerance,
  beamstop, stopEntrance, blockedByBeamstop} = F.XrayDemo;
assert.ok(reflectionTolerance > 0.0035 && reflectionTolerance < 0.01);
assert.ok(beamstop.center + beamstop.length / 2 < 4.7 * 40 / 60 - 0.012,
  "Beamstop steht auch vor der nächstgelegenen Detektorfläche bei 0°");
assert.equal(blockedByBeamstop({x: 0, y: 0, z: 1}), true);
assert.equal(blockedByBeamstop({x: 0, y: 0.04, z: 1}), true);
assert.equal(blockedByBeamstop({x: 0.09, y: 0, z: 1}), false);
assert.equal(stopEntrance, beamstop.center - beamstop.length / 2);
for (const mode of Object.keys(scanModes)) {
  const frames = [0, 5, 10, 15, 20].map(time => scanFrame(mode, time));
  assert.equal(new Set(frames.map(frame => frame.omega)).size, mode === "detector" ? 1 : 5);
  assert.equal(new Set(frames.map(frame => frame.detector)).size, mode === "crystal" ? 1 : 5);
  assert.equal(frames.at(-1).detector, mode === "crystal" ? 20 : 0);
  frames.forEach((frame, index) => {
    assert.deepEqual(scanFrame(mode, index * 5 + 3.9), frame, "Belichtung verändert keine Achsen");
    const slew = scanFrame(mode, index * 5 + 4.5);
    assert.ok(slew.moving);
    assert.equal(slew.omega === frame.omega, mode === "detector");
    assert.equal(slew.detector === frame.detector, mode === "crystal");
  });
}
const control = {...components["fkc-xray-demo"], shown: true, scanMode: "step", time: 0,
  clearSpots() {}, clearInformation() {}, updateFrame(force) { assert.ok(force); }};
control.setScanMode("detector");
assert.equal(control.scanMode, "detector");
assert.equal(control.paused, true);
for (const time of [5, 10, 15, 20, 0]) { control.nextFrame(); assert.equal(control.time, time); }
control.setScanMode("crystal");
control.showZeroAngle();
assert.equal(control.scanMode, "detector");
assert.equal(scanFrame(control.scanMode, control.time).detector, 0);
Object.assign(control, {detectorDistance: 60, exposure: 1, time: 6});
control.setDetectorDistance(40);
assert.equal(control.time, 6);
assert.equal(control.detectorRadius, 4.7 * 40 / 60);
control.setExposure(5);
assert.equal(control.exposure, 5);
assert.equal(control.time, 6);
assert.equal(control.paused, true);
control.time = 9.5;
control.setDetectorDistance(100);
assert.equal(control.time, 5, "Änderung während der Fahrt kehrt zur letzten Messposition zurück");
control.setDetectorDistance(90);
assert.equal(control.detectorDistance, 100);
const {spotStyle} = F.XrayDemo;
assert.ok(spotStyle(40, 1).opacity > spotStyle(60, 1).opacity);
assert.ok(spotStyle(60, 1).opacity > spotStyle(100, 1).opacity);
assert.ok(spotStyle(100, 1).radius > spotStyle(40, 1).radius);
assert.ok(spotStyle(100, 5).opacity > spotStyle(100, 0.2).opacity);
assert.equal(spotStyle(100, 5).radius, spotStyle(100, 0.2).radius);
const radius = 4.7;
const labels = [];
for (const beta of [0, 20, 35, 50, 65].map(deg => deg * Math.PI / 180)) {
  const points = angleGuides(beta, radius, 2.8, 2.3, labels);
  assert.ok(points.length > 0 && points.length % 6 === 0);
  for (let i = 0; i < points.length; i += 3) {
    const [x, y] = points.slice(i, i + 2);
    assert.ok(Math.abs(x) < 1.4 && Math.abs(y) < 1.15);
    const z = radius * Math.cos(beta) - x * Math.sin(beta);
    const degrees = Math.acos(z / Math.hypot(radius, x, y)) * 180 / Math.PI;
    assert.ok(Math.abs(degrees / 5 - Math.round(degrees / 5)) < 1e-8);
  }
  assert.ok(labels.length >= 2, "Jede Detektorstellung hat mehrere Beschriftungen");
  assert.equal(new Set(labels.map(label => label.degrees)).size, labels.length);
  for (const [index, {degrees, x, y}] of labels.entries()) {
    const z = radius * Math.cos(beta) - x * Math.sin(beta);
    assert.ok(Math.abs(Math.acos(z / Math.hypot(radius, x, y)) * 180 / Math.PI - degrees) < 1e-8);
    assert.ok(Math.abs(x) < 1.21 && y < 0.96);
    assert.ok(labels.slice(0, index).every(label => Math.abs(label.x - x) >= 0.36 || Math.abs(label.y - y) >= 0.20));
  }
}
const [x, y] = projectDirection(Math.sin(0.2), 0, Math.cos(0.2), 0, 1, radius);
assert.ok(Math.abs(Math.hypot(x, y) - radius * Math.tan(0.2)) < 1e-10);
console.log("Röntgen-Info: Treffer, Klick, Wegsehen, Menüpriorität und Schließen geprüft.");