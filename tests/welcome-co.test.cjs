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
for (const name of ["cif-structure", "structure-cell", "cif-model", "rooms", "vr-tools"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, "js", name + ".js"), "utf8"), context);
}
const index = F.rooms.findIndex(room => room.id === "team-b");
const teamB = F.rooms[index];
const station = teamB.stations[1];
assert.equal(teamB.zones[0].models.length, 4);
assert.ok(teamB.zones[0].models.slice(2).every(entry => !entry.model));
assert.equal(teamB.zones[4].wall, "back");
assert.equal(teamB.zones[4].along, 0);
const counts = {BENZIL03_monoklin:156, BENZIL04_trigonal:156, HKUST_1_mitH:65, HKUST_1_ohneH:57,
  Nebenprodukt_VUXBUL:240, YBa2Cu3O7_2016:13, YBa2Cu3O7_2026:13, YBa2Cu3O6_tetragonal_HT:12,
  Eu_Komplex2017:544, Verbindung1_cis_Co_Edukt:156, CoFe2O4:80, Nikotinsaeureamid_NICOAM05:300,
  AgHgI4_Tieftemperaturform:7, AgHgI4_Hochtemperaturform:12, Vanillin_YUHTEA:152};
const referenced = [];
for (const [id, prefix, count] of [["team-a", "A", 4], ["team-b", "B", 5]]) {
  const team = F.rooms.find(room => room.id === id);
  const {zones, stations} = team;
  assert.equal(zones.length, count);
  assert.equal(new Set(zones.map(s => s.accent)).size, count);
  assert.equal(new Set(stations.map(s => `${s.wall}:${s.along}`)).size, stations.length);
  zones.forEach((z, i) => {
    assert.ok(z.title.startsWith(`${prefix}${i + 1} · `));
    assert.ok(z.x0 >= -team.width / 2 && z.x1 <= team.width / 2);
    assert.ok(z.z0 >= -team.depth / 2 && z.z1 <= team.depth / 2);
    for (const other of zones.slice(i + 1)) {
      assert.ok(z.x0 >= other.x1 || z.x1 <= other.x0 || z.z0 >= other.z1 || z.z1 <= other.z0);
    }
  });
  const area = zones.reduce((sum, z) => sum + (z.x1 - z.x0) * (z.z1 - z.z0), 0);
  assert.ok(Math.abs(area - team.width * team.depth) < 1e-8);
  for (const s of stations.filter(entry => entry.model?.startsWith("assets/praktikum/"))) {
    const file = path.basename(s.model);
    referenced.push(file);
    assert.match(s.info, /^Quelle:/);
    const structure = F.CIF.createStructure(fs.readFileSync(path.join(root,s.model), "utf8"), s.cifMode);
    assert.equal(structure.atoms.length, counts[file.replace(/\.cif$/, "").replaceAll("-", "_")], file);
    assert.ok(structure.measurePositions);
    assert.ok(structure.atoms.every(atom => F.CIF.elements[atom.element] && atom.positionAngstrom.every(Number.isFinite)),file);
  }
}
assert.deepEqual(referenced.sort(), fs.readdirSync(path.join(root,"assets/praktikum")).filter(file=>file.endsWith(".cif")).sort());
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