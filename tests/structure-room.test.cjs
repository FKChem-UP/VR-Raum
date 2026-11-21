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
for (const name of ["cif-structure", "nacl-structure", "structure-cell", "zns-structure", "cif-model", "structure-room", "rooms"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, "js", name + ".js"), "utf8"), context);
}
const directory = path.join(root, "assets/structures");
const names = fs.readdirSync(directory, {recursive: true}).filter(name => /\.cif$/i.test(name)).map(name => name.replace(/\\/g, "/"));
assert.deepEqual(Array.from(F.StructureRoom.catalog, entry => entry[0]).sort(), names.sort());
const expected = {"Cu.cif": 4, "H2O.cif": 36, "S8.cif": 128, "YBa2Cu3O7-x_tetragonal.cif": 14};
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
const zns = F.welcomeRoom.exhibits.find(exhibit => exhibit.roomId === "vorlesung-7");
const znsChoices = F.StructureRoom.variants(F.StructureRoom.catalog.find(entry => entry[0] === "ZnS.cif"));
assert.equal(zns.model, znsChoices[0].model);
assert.equal(zns.cifMode, "zns-closed-cell");
assert.deepEqual(Array.from(znsChoices, variant => variant.cifMode), ["cell", "coordination"]);
assert.deepEqual(Array.from(zns.variants, variant => variant.cifMode), ["zns-closed-cell", "zns-sites", "zns-zn", "zns-s"]);
for (const variant of [...zns.variants, ...znsChoices]) {
  const source = fs.readFileSync(path.join(root, variant.model), "utf8");
  const model = F.CIF.createStructure(source, variant.cifMode);
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
  const distance = 5.45027 * Math.sqrt(3) / 4;
  assert.equal(model.kind, "zns");
  const centerElement = variant.cifMode === "zns-s" ? "S" : "Zn";
  if (zns.variants.includes(variant)) {
    assert.equal(model.contactDepth, 0);
    let previous = model;
    for (let depth = 1; depth <= F.CIF.maxContactDepth; depth++) {
      const expanded = F.ZnSStructure.withContactDepth(model, depth);
      assert.equal(expanded.contactDepth, depth);
      assert.ok(expanded.atoms.length > previous.atoms.length);
      assert.ok(expanded.atoms.length <= 256);
      assert.equal(new Set(expanded.atoms.map(atom => atom.id)).size, expanded.atoms.length);
      assert.equal(new Set(expanded.bonds.map(bond => bond.id)).size, expanded.bonds.length);
      previous.atoms.forEach((atom, index) => assert.deepEqual(expanded.atoms[index], atom));
      for (const bond of expanded.bonds) {
        const a = expanded.atoms[bond.a], b = expanded.atoms[bond.b];
        assert.notEqual(a.element, b.element);
        close(Math.hypot(...b.positionAngstrom.map((value, i) => value - a.positionAngstrom[i])), distance);
      }
      expanded.atoms.slice(previous.atoms.length).forEach((_, index) => {
        const next = index + previous.atoms.length;
        assert.ok(expanded.bonds.some(bond => bond.b === next && bond.a < previous.atoms.length));
      });
      if (depth === 1 && model.mode === "coordination") {
        assert.equal(expanded.atoms.length, 17);
        assert.equal(expanded.bonds.length, 16);
        assert.ok(expanded.atoms.slice(5).every(atom => atom.element === centerElement));
      }
      if (model.mode === "cell") assert.equal(expanded.bondSegments.length, expanded.bonds.length * 2);
      previous = expanded;
    }
  } else assert.equal(model.contactExpansion, undefined, "Tablet bleibt unverändert");
  for (const bond of model.bonds) {
    assert.equal(model.atoms[bond.a].element, centerElement);
    assert.equal(model.atoms[bond.b].element, centerElement === "Zn" ? "S" : "Zn");
    close(bond.distanceAngstrom, distance);
  }
  if (variant.cifMode === "zns-sites") {
    assert.equal(model.atoms.length, 8);
    assert.equal(model.bonds.length, 0);
    assert.deepEqual(Array.from(model.atoms, atom => atom.cifLabel), ["Zn0", "Zn1", "Zn2", "Zn3", "S4", "S5", "S6", "S7"]);
  } else if (variant.cifMode === "zns-closed-cell") {
    assert.equal(model.atoms.length, 18);
    assert.equal(new Set(model.atoms.map(atom => atom.id)).size, 18);
    assert.equal(model.cellAtomCount, 8);
    for (const element of ["Zn", "S"]) {
      close(model.atoms.filter(atom => atom.element === element).reduce((sum, atom) => sum + atom.cellWeight, 0), 4);
    }
    for (const [weight, count] of [[1 / 8, 8], [1 / 2, 6], [1, 4]]) {
      assert.equal(model.atoms.filter(atom => atom.cellWeight === weight).length, count);
    }
    assert.ok(model.atoms.every(atom => atom.fractional.every(value => value >= 0 && value <= 1)));
    assert.equal(model.bonds.length, 16);
    assert.equal(model.bondSegments.length, 32);
    for (const bond of model.bonds) {
      close(Math.hypot(...model.atoms[bond.b].positionAngstrom.map((value, i) => value - model.atoms[bond.a].positionAngstrom[i])), distance);
    }
  } else if (variant.cifMode === "cell") {
    assert.equal(model.atoms.length, 8);
    assert.equal(model.bonds.length, 16);
    assert.equal(new Set(model.bonds.map(bond => bond.id)).size, 16);
    model.atoms.forEach((_, index) => assert.equal(model.bonds.filter(bond => bond.a === index || bond.b === index).length, 4));
    for (const bond of model.bonds) {
      const pieces = model.bondSegments.filter(piece => piece.bondId === bond.id);
      const total = pieces.reduce((sum, piece) => {
        for (const value of [...piece.startAngstrom, ...piece.endAngstrom]) assert.ok(value >= -1e-6 && value <= 5.450271);
        return sum + Math.hypot(...piece.endAngstrom.map((value, axis) => value - piece.startAngstrom[axis]));
      }, 0);
      close(total, distance);
    }
  } else {
    assert.equal(model.atoms.length, 5);
    assert.equal(model.bonds.length, 4);
    assert.equal(model.atoms[0].element, centerElement);
    if (centerElement === "Zn") assert.ok(model.atoms.slice(1).some(atom => atom.cellShift.some(Boolean)));
    const points = model.polyhedra[0].neighbors.map(index => model.atoms[index].positionAngstrom);
    assert.equal(F.CIF.polyhedronTriangles(points).length, 4);
    assert.ok(F.CIF.availableStyles(model).some(style => style.id === "polyhedral"));
    for (const [i, a] of points.entries()) {
      close(Math.hypot(...a), distance);
      for (const b of points.slice(i + 1)) close(a.reduce((sum, value, axis) => sum + value * b[axis], 0) / distance ** 2, -1 / 3);
    }
  }
}
const tablet = components["fkc-structure-tablet"];
let clicks = 0;
tablet.click.call({buttons: [{x: 36, y: 105, w: 402, action() { clicks++; }}]}, {x: 100 / 896, y: 1 - 130 / 730});
assert.equal(clicks, 1);
console.log("Strukturraum und ZnS: Tablet-Regression, CIF-Plätze, geschlossene Zelle, beide Tetraeder und je drei Kontaktschalen geprüft.");