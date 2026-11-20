"use strict";

// Eng begrenzter Import für den vollständig ausgeschriebenen NaCl-P-1-Datensatz.
(function (F) {
  function createStructure(source, mode) {
    const {parse, numeric} = F.CIFStructure;
    const {values, loops} = parse(source);
    const fail = message => { throw new Error("NaCl-CIF: " + message); };
    if (mode !== "cell" && mode !== "coordination") fail("Nur Zelle und Koordinationsumgebung verfügbar.");
    const lengths = ["a", "b", "c"].map(axis => numeric(values["_cell_length_" + axis]));
    const angles = ["alpha", "beta", "gamma"].map(axis => numeric(values["_cell_angle_" + axis]));
    const edge = lengths[0];
    if (!(edge > 0) || lengths.some(value => Math.abs(value - edge) > 1e-7) ||
        angles.some(value => Math.abs(value - 90) > 1e-7)) fail("Kubische Zelle erwartet.");
    const symmetry = loops.find(loop => loop.names.includes("_symmetry_equiv_pos_as_xyz"));
    if (values["_symmetry_space_group_name_h-m"] !== "P 1" || values._symmetry_int_tables_number !== "1" ||
        !symmetry || symmetry.rows.length !== 1 ||
        symmetry.rows[0]._symmetry_equiv_pos_as_xyz.replace(/\s/g, "") !== "x,y,z") {
      fail("Explizite P 1-Zelle ohne weitere Symmetrieoperationen erwartet.");
    }
    const loop = loops.find(entry => entry.names.includes("_atom_site_fract_x"));
    if (!loop || loop.rows.length !== 8) fail("Acht explizite Ionenpositionen erwartet.");
    const atoms = loop.rows.map((row, index) => {
      const fractional = ["x", "y", "z"].map(axis => numeric(row["_atom_site_fract_" + axis]));
      const element = row._atom_site_type_symbol;
      if (numeric(row._atom_site_occupancy) !== 1 || fractional.some(value => value < 0 || value >= 1) ||
          !["Na", "Cl"].includes(element) || !row._atom_site_label) fail("Ungültige Ionenposition.");
      return {id: "nacl-site-" + (index + 1), modelNumber: index + 1, element,
        cifLabel: row._atom_site_label, fractional, positionAngstrom: fractional.map(value => value * edge)};
    });
    if (atoms.filter(atom => atom.element === "Na").length !== 4 ||
        new Set(atoms.map(atom => atom.cifLabel)).size !== 8 ||
        atoms.some((atom, i) => atoms.slice(i + 1).some(other => atom.fractional.every(
          (value, axis) => Math.abs(value - other.fractional[axis]) < 1e-7)))) {
      fail("Vier Na-, vier Cl-Positionen und eindeutige Labels erwartet.");
    }

    // Jedes periodische Abbild bleibt einzeln erhalten, auch wenn mehrere
    // Nachbarn in der CIF dasselbe Label tragen (z. B. +x und -x).
    function firstShell(center) {
      const neighbors = [];
      for (const atom of atoms) {
        if (atom.element === center.element) continue;
        for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
          const cellShift = [x, y, z];
          const fractional = atom.fractional.map((value, axis) => value + cellShift[axis]);
          const positionAngstrom = fractional.map((value, axis) => (value - center.fractional[axis]) * edge);
          const distance = Math.hypot(...positionAngstrom);
          if (distance <= edge / 2 + 1e-6) {
            if (Math.abs(distance - edge / 2) > 1e-6) fail("Unerwarteter kurzer Na–Cl-Kontakt.");
            neighbors.push({...atom, id: atom.id + ":" + cellShift.join(","), cellShift, fractional, positionAngstrom});
          }
        }
      }
      if (neighbors.length !== 6) fail("Sechs nächste Gegenionen je Ion erwartet.");
      return neighbors;
    }
    const shells = atoms.map(firstShell);
    const base = {kind: "nacl", name: "NaCl", mode, coordinateUnit: "angstrom",
      cellLengthsAngstrom: lengths, cellAnglesDegrees: angles, cellAtomCount: atoms.length,
      spaceGroup: {name: "P 1", number: "1"}, bonds: [], bondSegments: []};
    if (mode === "cell") return {...base, atoms};
    const index = atoms.findIndex(atom => atom.element === "Na");
    return {...base, atoms: [{...atoms[index], positionAngstrom: [0, 0, 0]}, ...shells[index]],
      polyhedra: [{center: 0, neighbors: [1, 2, 3, 4, 5, 6]}]};
  }

  F.NaClStructure = {createStructure};
})(window.FKCVR);