"use strict";

(function (F) {
  function read(source) {
    const {parse, numeric, cellMatrix, cartesian, symmetryPoint} = F.CIFStructure;
    const {values, loops} = parse(source);
    const lengths = ["a", "b", "c"].map(axis => numeric(values["_cell_length_" + axis]));
    const angles = ["alpha", "beta", "gamma"].map(axis => numeric(values["_cell_angle_" + axis]));
    const matrix = cellMatrix(lengths, angles);
    const sites = loops.find(loop => loop.names.includes("_atom_site_fract_x"));
    const symmetry = loops.find(loop => loop.names.includes("_symmetry_equiv_pos_as_xyz") ||
      loop.names.includes("_space_group_symop_operation_xyz"));
    if (!sites?.rows.length || !symmetry?.rows.length) throw new Error("Atompositionen oder Symmetrie fehlen.");
    const wrap = n => { const x = n - Math.floor(n); return x > 1 - 1e-7 ? 0 : x; };
    const atoms = [];
    for (const site of sites.rows) {
      const label = site._atom_site_label;
      const element = /^([A-Z][a-z]?)(?:\d*[+-])?$/.exec(site._atom_site_type_symbol)?.[1];
      const occupancy = numeric(site._atom_site_occupancy ?? "1");
      if (!label || !element || occupancy <= 0 || occupancy > 1) throw new Error("Ungültige Atomposition in der CIF.");
      const position = ["x", "y", "z"].map(axis => numeric(site["_atom_site_fract_" + axis]));
      const images = [];
      for (const row of symmetry.rows) {
        const operation = row._symmetry_equiv_pos_as_xyz || row._space_group_symop_operation_xyz;
        const point = symmetryPoint(position, operation);
        if (point.length !== 3) throw new Error("Ungültige Symmetrieoperation.");
        const fractional = point.map(wrap);
        if (images.some(other => other.every((value, axis) => {
          const difference = Math.abs(value - fractional[axis]);
          return Math.min(difference, 1 - difference) < 1e-7;
        }))) continue;
        images.push(fractional);
        const modelNumber = atoms.length + 1;
        if (modelNumber > 512) throw new Error("Zu viele Positionen für den Strukturraum.");
        atoms.push({id: "site-" + modelNumber, modelNumber, cifLabel: label, element, occupancy, fractional,
          positionAngstrom: cartesian(fractional, matrix)});
      }
    }
    return {kind: "positions", name: "CIF-Zellpositionen", mode: "cell", atoms, bonds: [], bondSegments: [],
      cellAtomCount: atoms.length, cellMatrix: matrix, cellLengthsAngstrom: lengths, cellAnglesDegrees: angles,
      spaceGroup: {name: values["_space_group_name_h-m_alt"] || values["_symmetry_space_group_name_h-m"] || "Nicht angegeben",
        number: values._space_group_it_number || values._symmetry_int_tables_number || ""}};
  }
  // Ein periodisches Abbild ist durch Basisplatz und ganzzahligen Versatz eindeutig.
  const imageId = (atom, shift) => `${atom.id}:${shift.join(",")}`;
  function closedImages(cell) {
    return cell.atoms.flatMap((atom, siteIndex) => {
      const [xs, ys, zs] = atom.fractional.map(value => value === 0 ? [0, 1] : [0]);
      return xs.flatMap(x => ys.flatMap(y => zs.map(z => {
        const cellShift = [x, y, z];
        const fractional = atom.fractional.map((value, axis) => value + cellShift[axis]);
        return {...atom, id: imageId(atom, cellShift), siteIndex, cellShift, fractional,
          cellWeight: 1 / (xs.length * ys.length * zs.length),
          positionAngstrom: F.CIFStructure.cartesian(fractional, cell.cellMatrix)};
      })));
    }).map((atom, index) => ({...atom, modelNumber: index + 1}));
  }

  // Strukturregeln liefern die Kanten; die Suche kennt keine Elementsymbole.
  function expandContacts(cell, contacts, seeds, depth, origin = [0, 0, 0]) {
    const adjacency = cell.atoms.map(() => []);
    for (const bond of contacts) {
      adjacency[bond.a].push({site: bond.b, shift: bond.cellShift, bond});
      adjacency[bond.b].push({site: bond.a, shift: bond.cellShift.map(value => -value), bond});
    }
    const atoms = seeds.slice();
    const indices = new Map(atoms.map((atom, index) => [imageId(cell.atoms[atom.siteIndex], atom.cellShift), index]));
    let first = 0;
    for (let step = 0; step < depth; step++) {
      const end = atoms.length;
      for (; first < end; first++) {
        const current = atoms[first];
        for (const edge of adjacency[current.siteIndex]) {
          const base = cell.atoms[edge.site];
          const cellShift = current.cellShift.map((value, axis) => value + edge.shift[axis]);
          const id = imageId(base, cellShift);
          if (indices.has(id)) continue;
          if (atoms.length >= 256) throw new Error("Zu viele Positionen für die Kontakterweiterung.");
          const fractional = base.fractional.map((value, axis) => value + cellShift[axis]);
          const positionAngstrom = F.CIFStructure.cartesian(fractional.map((value, axis) => value - origin[axis]), cell.cellMatrix);
          indices.set(id, atoms.length);
          atoms.push({...base, id, siteIndex: edge.site, cellShift, fractional, positionAngstrom, modelNumber: atoms.length + 1});
        }
      }
    }
    const bonds = atoms.flatMap((atom, a) => adjacency[atom.siteIndex].flatMap(edge => {
      const shift = atom.cellShift.map((value, axis) => value + edge.shift[axis]);
      const b = indices.get(imageId(cell.atoms[edge.site], shift));
      return b === undefined || b <= a ? [] : [{id: `${atom.id}/${atoms[b].id}`, a, b,
        distanceAngstrom: edge.bond.distanceAngstrom}];
    }));
    return {atoms, bonds};
  }

  F.StructureCell = {read, imageId, closedImages, expandContacts};
})(window.FKCVR);