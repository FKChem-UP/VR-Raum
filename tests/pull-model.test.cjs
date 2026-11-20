"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const window = {};
const components = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/vr-controls.js"), "utf8"), {
  window, THREE: {}, AFRAME: {registerComponent(name, component) { components[name] = component; }}
});
const F = window.FKCVR;
assert.ok(F.pullStep(5, 2, 0.02) > F.pullStep(5, 0.1, 0.02));
assert.ok(F.pullStep(5, 99, 0.02) <= 2.5 * 0.02);
assert.equal(F.pullStep(0.05, 2, 0.02), 0);
assert.equal(F.pullStep(5, 2, 0), 0);
const grabber = Object.assign({pulling: {}, grabbed: null}, components["fkc-grabber"]);
grabber.end();
assert.equal(grabber.pulling, null, "Loslassen beendet Ansaugen ohne Nachlauf");
console.log("Ansaugtest bestanden: Beschleunigung, Begrenzung, Stillstand und Loslassen.");