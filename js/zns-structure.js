"use strict";

(function (F) {
  // Spezialansichten für die vollständig ausgeschriebene kubische Zinkblende-CIF.
  function createStructure(source, mode) {
    const fail = message => { throw new Error("ZnS-CIF: " + message); };
    if (!["cell", "coordination", "zns-sites", "zns-closed-cell", "zns-zn", "zns-s"].includes(mode)) {
      fail("Unbekannte Ansicht.");
    }
    const cell = F.StructureCell.read(source);
    const {atoms, cellLengthsAngstrom: lengths, cellAnglesDegrees: angles} = cell;
    const edge = lengths[0];
    const eps = 1e-6;
    if (!(edge > 0) || lengths.some(value => Math.abs(value - edge) > eps) ||
        angles.some(value => Math.abs(value - 90) > eps)) fail("Kubische Zelle erwartet.");
    if (cell.spaceGroup.number !== "1" || atoms.length !== 8 || new Set(atoms.map(atom => atom.cifLabel)).size !== 8 ||
        atoms.filter(atom => atom.element === "Zn").length !== 4 ||
        atoms.filter(atom => atom.element === "S").length !== 4 ||
        atoms.some(atom => atom.occupancy !== 1)) fail("Vier vollbesetzte Zn- und vier S-Positionen erwartet.");

    const distance = edge * Math.sqrt(3) / 4;
    const bonds = [];
    const degree = atoms.map(() => 0);
    atoms.forEach((center, a) => {
      if (center.element !== "Zn") return;
      atoms.forEach((atom, b) => {
        if (atom.element !== "S") return;
        for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
          const cellShift = [x, y, z];
          const deltaFractional = atom.fractional.map((value, axis) => value + cellShift[axis] - center.fractional[axis]);
          const distanceAngstrom = Math.hypot(...deltaFractional) * edge;
          if (distanceAngstrom > distance + eps) continue;
          if (distanceAngstrom < distance - eps) fail("Unerwarteter kurzer Zn–S-Kontakt.");
          bonds.push({id: `zns-contact-${a}-${b}:${cellShift.join(",")}`, a, b, cellShift, deltaFractional, distanceAngstrom});
          degree[a]++;
          degree[b]++;
        }
      });
    });
    if (degree.some(value => value !== 4)) fail("Vier nächste Gegenionen je Position erwartet.");

    const base = {...cell, kind: "zns", name: "ZnS – Zinkblende", coordinateUnit: "angstrom", mode};
    if (mode === "cell") return {...base, bonds};
    if (mode === "zns-sites") return base;

    const {imageId, closedImages} = F.StructureCell;
    if (mode === "zns-closed-cell") {
      const images = closedImages(cell);
      const indices = new Map(images.map((atom, index) => [atom.id, index]));
      const visibleBonds = images.flatMap((atom, a) => bonds.filter(bond => bond.a === atom.siteIndex).flatMap(bond => {
        const shift = atom.cellShift.map((value, axis) => value + bond.cellShift[axis]);
        const b = indices.get(imageId(atoms[bond.b], shift));
        return b === undefined ? [] : [{...bond, id: `${images[a].id}/${images[b].id}`, a, b}];
      }));
      const bondSegments = visibleBonds.flatMap(bond => {
        const start = images[bond.a].positionAngstrom, end = images[bond.b].positionAngstrom;
        const middle = start.map((value, axis) => (value + end[axis]) / 2);
        return [[start, middle], [middle, end]].map(([startAngstrom, endAngstrom], half) => ({
          ...bond, id: `${bond.id}-${half}`, bondId: bond.id, half, startAngstrom, endAngstrom
        }));
      });
      return {...base, mode: "cell", atoms: images, bonds: visibleBonds, bondSegments};
    }

    const anion = mode === "zns-s";
    const center = atoms.findIndex(atom => atom.element === (anion ? "S" : "Zn"));
    const shell = anion ? bonds.filter(bond => bond.b === center).map(bond => ({...bond, a: bond.b, b: bond.a,
      cellShift: bond.cellShift.map(value => -value), deltaFractional: bond.deltaFractional.map(value => -value)})) :
      bonds.filter(bond => bond.a === center);
    const cartesian = F.CIFStructure.cartesian;
    const neighbors = shell.map(bond => {
      const atom = atoms[bond.b];
      return {...atom, id: imageId(atom, bond.cellShift), cellShift: bond.cellShift,
        fractional: atom.fractional.map((value, axis) => value + bond.cellShift[axis]),
        positionAngstrom: cartesian(bond.deltaFractional, cell.cellMatrix)};
    });
    return {...base, mode: "coordination", atoms: [{...atoms[center], positionAngstrom: [0, 0, 0]}, ...neighbors],
      bonds: shell.map((bond, index) => ({...bond, a: 0, b: index + 1})),
      polyhedra: [{center: 0, neighbors: [1, 2, 3, 4]}]};
  }

  F.ZnSStructure = {createStructure};
})(window.FKCVR);