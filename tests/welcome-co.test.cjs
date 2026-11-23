"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const nodes = new Map();
const container = {querySelectorAll: () => []};
const F = {getScene: () => ({addEventListener() {}, querySelectorAll: () => []}), getNavigation: () => null,
  RoomBuilder: {build(parent, config, rooms) {
    assert.equal(parent, container);
    for (const [index, room] of rooms.entries()) {
      if (room.id === "team-b") nodes.set(`welcome-model-${index + 1}`, {});
    }
    return {};
  }}};
const context = {window: {FKCVR: F}, THREE: {}, AFRAME: {THREE: {}, registerComponent() {}},
  document: {getElementById: id => nodes.get(id)}, console: {info() {}}};
for (const name of ["cif-structure", "cif-model", "rooms", "vr-tools"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, "js", name + ".js"), "utf8"), context);
}
const index = F.rooms.findIndex(room => room.id === "team-b");
const station = F.rooms[index].stations[0];
for (const [id, prefix, count] of [["team-a", "A", 4], ["team-b", "B", 5]]) {
  const stations = F.rooms.find(room => room.id === id).stations;
  assert.equal(stations.length, count);
  assert.equal(new Set(stations.map(s => s.zone.accent)).size, count);
  assert.equal(new Set(stations.map(s => `${s.wall}:${s.along}`)).size, count);
  stations.forEach((s, i) => assert.ok(s.title.startsWith(`${prefix}${i + 1} · `)));
}
assert.ok(station.boardLines.some(line => line.includes("Co–Cl")));
assert.ok(station.boardLines.some(line => line.includes("zunächst nur Verbindung 2")));
const exhibit = F.welcomeRoom.exhibits.find(entry => entry.roomId === "team-b");
assert.equal(exhibit.model, "assets/structures/Co-Produkt1.cif");
assert.equal(exhibit.model, station.model);
assert.equal(exhibit.cifMode, "molecule");
assert.deepEqual(exhibit.variants, station.variants);
F.RoomBuilder.build(container, F.welcomeRoom, F.rooms);
const model = nodes.get(`welcome-model-${index + 1}`);
assert.equal(model.fkcVariantAlignment, "individual");
assert.equal(model.fkcVariantId, "co-complex");
assert.equal(model.fkcVariants.length, 3);
assert.equal(model.fkcModelSize, F.welcomeRoom.modelSize);
const expected = {molecule: 64, cell: 72, coordination: 7};
for (const variant of model.fkcVariants) {
  const structure = F.CIF.createStructure(fs.readFileSync(path.join(root, variant.model), "utf8"), variant.cifMode);
  assert.equal(structure.atoms.length, expected[variant.cifMode]);
  assert.ok(structure.atoms.every(atom => atom.positionAngstrom.every(Number.isFinite)));
}
console.log("Co-Begrüßungsmodell: Raumzuordnung, Varianten und CIF-Messkoordinaten geprüft.");