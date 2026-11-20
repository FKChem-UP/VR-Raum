"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const F = {};
const context = {window: {FKCVR: F}, AFRAME: {THREE: {}, registerComponent() {}}, console: {info() {}}};
for (const script of ["cif-structure", "nacl-structure", "cif-model", "rooms"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, "js", script + ".js"), "utf8"), context);
}

const station = F.rooms.find(room => room.id === "vorlesung-6").stations[0];
assert.equal(station.model, "assets/structures/NaCl.cif");
assert.equal(station.cifMode, "cell");
assert.equal(station.variants[0].cifMode, station.cifMode);
const source = fs.readFileSync(path.join(root, station.model), "utf8");
const [cell, coordination] = station.variants.map(variant => F.CIF.createStructure(source, variant.cifMode));
assert.equal(cell.spaceGroup.name, "P 1");
assert.equal(cell.cellLengthsAngstrom[0], 5.691694);
assert.equal(cell.atoms.length, 8);
for (const element of ["Na", "Cl"]) assert.equal(cell.atoms.filter(atom => atom.element === element).length, 4);
assert.equal(cell.bondSegments.length, 0);
assert.equal(cell.bonds.length, 0);
assert.equal(coordination.bonds.length, 0, "Keine kovalenten Bindungen im Ionengitter");
assert.equal(coordination.atoms.length, 7);
assert.equal(coordination.atoms[0].element, "Na");
const neighbors = coordination.atoms.slice(1);
assert.ok(neighbors.every(atom => atom.element === "Cl"));
assert.equal(new Set(neighbors.map(atom => atom.id)).size, 6);
assert.equal(new Set(neighbors.map(atom => atom.cifLabel)).size, 3, "CIF-Labels bleiben bei periodischen Abbildern erhalten");
assert.ok(neighbors.some(atom => atom.cellShift.some(value => value < 0)));
const distance = cell.cellLengthsAngstrom[0] / 2;
for (const ion of cell.atoms) {
  // Unabhängige Kontrolle um jede Na- und Cl-Position mit größerem Suchbereich.
  const distances = [];
  for (const other of cell.atoms.filter(atom => atom.element !== ion.element)) {
    for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) for (let z = -2; z <= 2; z++) {
      distances.push(Math.hypot(...other.positionAngstrom.map((value, axis) =>
        value + [x, y, z][axis] * cell.cellLengthsAngstrom[axis] - ion.positionAngstrom[axis])));
    }
  }
  distances.sort((a, b) => a - b);
  assert.ok(distances.slice(0, 6).every(value => Math.abs(value - distance) < 1e-7));
  assert.ok(distances[6] > distance + 0.1);
}
const points = neighbors.map(atom => atom.positionAngstrom);
assert.ok(points.every(point => Math.abs(Math.hypot(...point) - distance) < 1e-7));
assert.equal(F.CIF.polyhedronTriangles(points).length, 8);
assert.ok(F.CIF.availableStyles(coordination).some(style => style.id === "polyhedral"));
assert.ok(!F.CIF.availableStyles(cell).some(style => style.id === "polyhedral"));
assert.throws(() => F.CIF.createStructure(source, "molecule"), /Nur Zelle/);
assert.throws(() => F.CIF.createStructure(source.replace("5.69169400", "6.0"), "cell"), /Kubische Zelle/);
console.log("NaCl: Station, Zellbelegung, sechs Gegenionen pro Ion, periodische Abbilder und Oktaeder geprüft.");