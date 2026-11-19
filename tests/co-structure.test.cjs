"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const window = {FKCVR: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/cif-structure.js"), "utf8"), {window});
const api = window.FKCVR.CIFStructure;
const source = fs.readFileSync(path.join(__dirname, "../assets/structures/Co-Produkt1.cif"), "utf8");
const structure = api.read(source);
assert.equal(structure.spaceGroup, "P -1");
assert.equal(structure.operations.length, 2);
assert.ok(structure.parsed.values._shelx_space_group_comment.includes("symmetry"));
assert.ok(structure.parsed.values._shelx_res_file.includes("HKLF 4"));
assert.ok(Math.abs(structure.volume - 765.8) < 0.5);
assert.equal(new Set(structure.atoms.map(atom => atom.id)).size, structure.atoms.length);
assert.equal(new Set(structure.atoms.map(atom => atom.element)).size, 6);
assert.ok(structure.atoms.every(atom => atom.occupancy === 1));
assert.ok(structure.atoms.filter(atom => atom.element !== "H").every(atom => atom.uAnisoCIF && atom.uAnisoCIF.length === 6));
assert.ok(structure.atoms.filter(atom => atom.element === "H").every(atom => atom.uAnisoCIF === null));
assert.ok(structure.bonds.length > 0);
for (const bond of structure.bonds) {
  assert.ok(Math.abs(bond.calculatedDistanceAngstrom - bond.reportedDistanceAngstrom) < 0.005,
    bond.a + "–" + bond.b + ": " + bond.calculatedDistanceAngstrom + " vs " + bond.reportedDistanceAngstrom);
}
assert.ok(structure.bonds.some(bond => bond.symmetry2 === "2_666"));
assert.throws(() => api.parse("_test\n;\ntext"), /Nicht geschlossenes/);
assert.throws(() => api.symmetryPoint([0, 0, 0], "alert(x),y,z"), /Symmetrieterm/);
const cubic = api.cellMatrix([2, 2, 2], [90, 90, 90]);
const point = api.cartesian([0.5, 0.5, 0.5], cubic);
assert.ok(point.every(value => Math.abs(value - 1) < 1e-10));
console.log("Co-Strukturgrundlage bestanden:", {
  asymmetricSites: structure.atoms.length,
  nonHydrogenSites: structure.atoms.filter(atom => atom.element !== "H").length,
  listedBonds: structure.bonds.length,
  volumeAngstrom3: structure.volume,
  maxBondDeviationAngstrom: Math.max(...structure.bonds.map(bond =>
    Math.abs(bond.calculatedDistanceAngstrom - bond.reportedDistanceAngstrom)))
});