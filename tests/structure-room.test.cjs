"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const F = {};
const components = {};
const context = {window: {FKCVR: F}, console: {info() {}}, AFRAME: {THREE: {},
  registerComponent(name, definition) { components[name] = definition; }}};
for (const name of ["cif-structure", "nacl-structure", "structure-cell", "cif-model", "structure-room"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, "js", name + ".js"), "utf8"), context);
}
const directory = path.join(root, "assets/structures");
const names = fs.readdirSync(directory, {recursive: true}).filter(name => /\.cif$/i.test(name)).map(name => name.replace(/\\/g, "/"));
assert.deepEqual(Array.from(F.StructureRoom.catalog, entry => entry[0]).sort(), names.sort());
const expected = {"Cu.cif": 4, "H2O.cif": 36, "S8.cif": 128, "YBa2Cu3O7-x_tetragonal.cif": 14, "ZnS.cif": 8};
for (const entry of F.StructureRoom.catalog) {
  const choices = F.StructureRoom.variants(entry);
  for (const variant of choices) {
    const source = fs.readFileSync(path.join(root, variant.model), "utf8");
    const structure = F.CIF.createStructure(source, variant.cifMode);
    assert.ok(structure.atoms.length > 0);
    assert.ok(structure.atoms.every(atom => F.CIF.elements[atom.element] && atom.positionAngstrom.every(Number.isFinite)));
    if (variant.cifMode === "library-cell") {
      assert.equal(structure.atoms.length, expected[entry[0]], entry[0]);
      assert.equal(structure.bonds.length, 0);
      assert.ok(structure.atoms.every(atom => atom.fractional.every(x => x >= 0 && x < 1)));
      if (entry[0].startsWith("YBa")) {
        for (const [label, count] of [["Y1", 1], ["Ba1", 2], ["Cu1", 1], ["Cu2", 2], ["O1", 2], ["O2", 4], ["O3", 2]]) {
          assert.equal(structure.atoms.filter(atom => atom.cifLabel === label).length, count);
        }
        assert.equal(structure.atoms.filter(atom => atom.cifLabel === "O1" && atom.occupancy === 0.5).length, 2);
      }
    }
  }
}
const tablet = components["fkc-structure-tablet"];
let clicks = 0;
tablet.click.call({buttons: [{x: 36, y: 105, w: 402, action() { clicks++; }}]}, {x: 100 / 896, y: 1 - 130 / 730});
assert.equal(clicks, 1);
console.log("Strukturraum: acht CIF-Dateien, ihre Ansichten, Zellbelegungen und Tablet-Treffer geprüft.");