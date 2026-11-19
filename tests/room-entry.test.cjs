"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/room-entry.js"), "utf8"), {
  window: {FKCVR: F}, AFRAME: {THREE: {}, registerComponent() {}}
});
const target = {isConnected: true};
let state = {target, started: 100};
assert.equal(F.RoomEntry.advance(state, target, true, 100).progress, 0);
assert.equal(F.RoomEntry.advance(state, target, true, 600).progress, 0.5);
assert.equal(F.RoomEntry.advance(state, target, true, 1099).complete, false);
assert.equal(F.RoomEntry.advance(state, target, true, 1100).complete, true);
assert.equal(F.RoomEntry.advance(state, target, true, 1200).complete, false);
for (const [hit, pressed] of [[target, false], [null, true], [{isConnected: true}, true]]) {
  state = {target, started: 0};
  assert.equal(F.RoomEntry.advance(state, hit, pressed, 500).complete, false);
  assert.equal(state.target, null);
}
state = {target, started: 0};
target.isConnected = false;
assert.equal(F.RoomEntry.advance(state, target, true, 1000).complete, false);
console.log("Raumeintrittstest bestanden: 1 Sekunde, Fortschritt, Loslassen, Zielwechsel, entferntes Poster und einmaliger Abschluss.");