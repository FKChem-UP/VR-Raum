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
const complex = api.reconstructCoHeavy(structure);
const coordination = api.createCoStructure(source, "coordination");
const fullComplex = api.createCoStructure(source, "molecule");
assert.equal(coordination.atoms.length, 7);
assert.equal(coordination.bonds.length, 6);
assert.equal(coordination.atoms[0].element, "Co");
assert.ok(coordination.atoms[0].positionAngstrom.every(value => value === 0));
assert.equal(coordination.atoms.filter(atom => atom.element === "N").length, 2);
assert.equal(coordination.atoms.filter(atom => atom.element === "O").length, 2);
assert.equal(coordination.atoms.filter(atom => atom.element === "Cl").length, 2);
assert.equal(new Set(coordination.atoms.map(atom => atom.id)).size, 7);
assert.equal(fullComplex.polyhedra.length, 2);
for (const atom of coordination.atoms) {
  const original = fullComplex.atoms.find(entry => entry.id === atom.id);
  assert.equal(original.cifLabel, atom.cifLabel);
  assert.equal(original.modelNumber, atom.modelNumber);
  assert.deepEqual(original.cellShift, atom.cellShift);
}
for (const bond of coordination.bonds) {
  assert.equal(bond.a, 0);
  assert.ok(Math.abs(Math.hypot(...coordination.atoms[bond.b].positionAngstrom) - bond.distanceAngstrom) < 0.005);
}
console.log("Co-Koordinationsansicht bestanden: 7 Atome, 6 Bindungen, originale IDs und Symmetrieabbilder.");
const environment3 = api.environmentCandidates(fullComplex, 3);
const environment5 = api.environmentCandidates(fullComplex, 5);
assert.ok(environment3.length > 0);
assert.ok(environment5.length >= environment3.length);
assert.equal(new Set(environment5.map(candidate => candidate.id)).size, environment5.length);
assert.ok(environment3.every(candidate => environment5.some(entry => entry.id === candidate.id)));
assert.ok(environment5.some(candidate => candidate.atoms.length === 64));
assert.ok(environment5.some(candidate => candidate.atoms.length === 3));
assert.ok(environment5.some(candidate => candidate.atoms.length === 1));
for (const candidate of environment5) {
  assert.ok([1, 3, 64].includes(candidate.atoms.length), "Vollständige Bestandteile");
  assert.ok(candidate.minimumDistanceAngstrom <= 5 + 1e-8);
  for (const bond of candidate.bonds) {
    const a = candidate.atoms[bond.a].positionAngstrom;
    const b = candidate.atoms[bond.b].positionAngstrom;
    assert.ok(Math.abs(Math.hypot(...b.map((value,axis) => value-a[axis]))-bond.distanceAngstrom) < 0.005);
  }
  assert.ok(candidate.atoms.every(atom => !fullComplex.atoms.some(original =>
    original.cifLabel === atom.cifLabel && original.fractional.every((value,axis) => Math.abs(value-atom.fractional[axis]) < 1e-7))));
}
assert.throws(() => api.environmentCandidates(coordination, 3), /nur für/);
assert.throws(() => api.environmentCandidates(fullComplex, 9), /nur für/);
console.log("Umgebung numerisch bestanden:", environment3.length, "Kandidaten bei 3 Å;", environment5.length, "bei 5 Å.");
for (const mode of ["molecule", "cell"]) {
  const model = api.createCoStructure(source, mode);
  console.log("Co-Modell", mode, model.atoms.length, "Atome", model.bonds.length, "Bindungen", model.excludedSites || "");
  assert.equal(new Set(model.atoms.map(atom => atom.id)).size, model.atoms.length);
  if (mode === "cell") {
    assert.equal(model.atoms.length, 72);
    assert.equal(model.bonds.length, 76);
    model.atoms.forEach(atom => assert.ok(atom.fractional.every(value => value >= 0 && value < 1)));
  } else {
    assert.equal(model.atoms.length, 64);
    assert.equal(model.bonds.length, 72);
    assert.equal(model.excludedSites.join(","), "O1,H3,H2,Cl03");
    assert.equal(model.atoms.filter(atom => atom.element === "Co").length, 2);
    assert.ok(model.atoms.some(atom => atom.element === "H"));
    for (const bond of model.bonds) {
      const a = model.atoms[bond.a].positionAngstrom;
      const b = model.atoms[bond.b].positionAngstrom;
      assert.ok(Math.abs(Math.hypot(...b.map((value, axis) => value - a[axis])) - bond.distanceAngstrom) < 0.005);
    }
  }
}
assert.equal(complex.atoms.filter(atom => atom.element === "Co").length, 2);
assert.ok(complex.atoms.every(atom => atom.element !== "H"));
assert.equal(new Set(complex.atoms.map(atom => atom.id)).size, complex.atoms.length);
for (const bond of complex.bonds) {
  const a = complex.atoms[bond.a].positionAngstrom;
  const b = complex.atoms[bond.b].positionAngstrom;
  assert.ok(Math.abs(Math.hypot(...b.map((value, i) => value - a[i])) -
    bond.reportedDistanceAngstrom) < 0.005);
}
for (let i = 0; i < complex.atoms.length; i++) {
  if (complex.atoms[i].element !== "Co") continue;
  assert.equal(complex.bonds.filter(bond => bond.a === i || bond.b === i).length, 6);
}
console.log("Co-Nicht-H-Rekonstruktion bestanden:", complex.atoms.length, "Atome,", complex.bonds.length,
  "Bindungen, zwei Co-Zentren mit je sechs Nachbarn.");
console.log("Co-Strukturgrundlage bestanden:", {
  asymmetricSites: structure.atoms.length,
  nonHydrogenSites: structure.atoms.filter(atom => atom.element !== "H").length,
  listedBonds: structure.bonds.length,
  volumeAngstrom3: structure.volume,
  maxBondDeviationAngstrom: Math.max(...structure.bonds.map(bond =>
    Math.abs(bond.calculatedDistanceAngstrom - bond.reportedDistanceAngstrom)))
});