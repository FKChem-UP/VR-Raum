"use strict";

// Begrenzte Strukturgrundlage für das vorliegende Co-Produkt1-Testmodell.
(function (F) {
  function numeric(value) {
    const result = Number(String(value).replace(/\(\d+\)$/, ""));
    if (!Number.isFinite(result) || value === "." || value === "?") {
      throw new Error("Ungültiger CIF-Zahlenwert: " + value);
    }
    return result;
  }

  function parse(source) {
    const tokens = [];
    const lines = String(source).replace(/\r/g, "").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith(";")) {
        const text = [line.slice(1)];
        while (++i < lines.length && !lines[i].startsWith(";")) text.push(lines[i]);
        if (i === lines.length) throw new Error("Nicht geschlossenes CIF-Textfeld.");
        tokens.push({value: text.join("\n"), quoted: true});
        continue;
      }
      const expression = /'([^']*)'|"([^"]*)"|([^\s#]+)|(#.*$)/g;
      let match;
      while ((match = expression.exec(line))) {
        if (match[4] !== undefined) break;
        tokens.push({value: match[1] ?? match[2] ?? match[3],
          quoted: match[1] !== undefined || match[2] !== undefined});
      }
    }
    const control = token => token && !token.quoted &&
      (token.value.startsWith("_") || /^(loop_|stop_|data_.*|save_.*|global_)$/i.test(token.value));
    const values = {};
    const loops = [];
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i++];
      if (!token.quoted && token.value.toLowerCase() === "loop_") {
        const names = [];
        while (i < tokens.length && !tokens[i].quoted && tokens[i].value.startsWith("_")) {
          names.push(tokens[i++].value.toLowerCase());
        }
        if (!names.length) throw new Error("CIF-Schleife ohne Spalten.");
        const entries = [];
        while (i < tokens.length && !control(tokens[i])) entries.push(tokens[i++].value);
        if (entries.length % names.length) throw new Error("Unvollständige CIF-Schleife.");
        const rows = [];
        for (let offset = 0; offset < entries.length; offset += names.length) {
          rows.push(Object.fromEntries(names.map((name, column) => [name, entries[offset + column]])));
        }
        loops.push({names, rows});
      } else if (!token.quoted && token.value.startsWith("_")) {
        if (i === tokens.length || control(tokens[i])) throw new Error("CIF-Wert fehlt: " + token.value);
        values[token.value.toLowerCase()] = tokens[i++].value;
      }
    }
    return {values, loops};
  }

  function cellMatrix(lengths, angles) {
    if (lengths.some(value => !(value > 0)) || angles.some(value => !(value > 0 && value < 180))) {
      throw new Error("Ungültige Zellparameter.");
    }
    const [a, b, c] = lengths;
    const [alpha, beta, gamma] = angles.map(value => value * Math.PI / 180);
    const cx = c * Math.cos(beta);
    const cy = c * (Math.cos(alpha) - Math.cos(beta) * Math.cos(gamma)) / Math.sin(gamma);
    const cz2 = c * c - cx * cx - cy * cy;
    if (!(cz2 > 0)) throw new Error("Entartete Elementarzelle.");
    return [[a, 0, 0], [b * Math.cos(gamma), b * Math.sin(gamma), 0], [cx, cy, Math.sqrt(cz2)]];
  }
  const cartesian = (fractional, matrix) => [0, 1, 2].map(axis =>
    fractional.reduce((sum, value, i) => sum + value * matrix[i][axis], 0));

  function symmetryPoint(point, operation) {
    return operation.toLowerCase().replace(/\s/g, "").split(",").map(expression => {
      const terms = expression.match(/[+-]?[^+-]+/g) || [];
      if (terms.join("") !== expression) throw new Error("Unbekannte Symmetrie: " + operation);
      return terms.reduce((sum, term) => {
        const variable = /^([+-]?)([xyz])$/.exec(term);
        if (variable) return sum + (variable[1] === "-" ? -1 : 1) * point["xyz".indexOf(variable[2])];
        if (!/^[+-]?\d+(?:\/\d+)?$/.test(term)) throw new Error("Unbekannter Symmetrieterm: " + term);
        const [n, d = "1"] = term.split("/");
        if (Number(d) === 0) throw new Error("Ungültige Symmetriefraktion.");
        return sum + Number(n) / Number(d);
      }, 0);
    });
  }

  function read(source) {
    const parsed = parse(source);
    const rows = tag => (parsed.loops.find(loop => loop.names.includes(tag)) || {rows: []}).rows;
    const lengths = ["a", "b", "c"].map(axis => numeric(parsed.values["_cell_length_" + axis]));
    const angles = ["alpha", "beta", "gamma"].map(axis => numeric(parsed.values["_cell_angle_" + axis]));
    const matrix = cellMatrix(lengths, angles);
    const operations = rows("_space_group_symop_operation_xyz").map(row => row._space_group_symop_operation_xyz);
    if (!operations.length) throw new Error("Symmetrieoperationen fehlen.");
    const adps = new Map(rows("_atom_site_aniso_label").map(row => [row._atom_site_aniso_label,
      ["11", "22", "33", "23", "13", "12"].map(key => numeric(row["_atom_site_aniso_u_" + key]))]));
    const atoms = rows("_atom_site_label").map((row, i) => {
      const fractional = ["x", "y", "z"].map(axis => numeric(row["_atom_site_fract_" + axis]));
      return {id: "site-" + (i + 1), cifLabel: row._atom_site_label,
        element: row._atom_site_type_symbol, fractional,
        positionAngstrom: cartesian(fractional, matrix),
        occupancy: numeric(row._atom_site_occupancy),
        uAnisoCIF: adps.get(row._atom_site_label) || null};
    });
    const sites = new Map(atoms.map(atom => [atom.cifLabel, atom]));
    function image(label, code) {
      const atom = sites.get(label);
      if (!atom) throw new Error("Unbekanntes Bindungsatom: " + label);
      if (!code || code === ".") return atom.positionAngstrom.slice();
      const match = /^(\d+)_([0-9]{3})$/.exec(code);
      if (!match || !operations[Number(match[1]) - 1]) throw new Error("Unbekannter Symmetriecode: " + code);
      const fractional = symmetryPoint(atom.fractional, operations[Number(match[1]) - 1]);
      if (fractional.length !== 3) throw new Error("Symmetrieoperation ohne drei Koordinaten.");
      return cartesian(fractional.map((value, i) => value + Number(match[2][i]) - 5), matrix);
    }
    const bonds = rows("_geom_bond_atom_site_label_1").map(row => {
      const a = row._geom_bond_atom_site_label_1;
      const b = row._geom_bond_atom_site_label_2;
      const start = image(a, row._geom_bond_site_symmetry_1);
      const end = image(b, row._geom_bond_site_symmetry_2);
      return {a, b, symmetry2: row._geom_bond_site_symmetry_2,
        reportedDistanceAngstrom: numeric(row._geom_bond_distance),
        calculatedDistanceAngstrom: Math.hypot(...end.map((value, i) => value - start[i])),
        startAngstrom: start, endAngstrom: end};
    });
    const volume = matrix[0][0] * matrix[1][1] * matrix[2][2];
    return {atoms, bonds, operations, lengths, angles, matrix, volume,
      spaceGroup: parsed.values["_space_group_name_h-m_alt"], parsed};
  }
  function reconstructCoHeavy(structure, includeHydrogen = false) {
    if (structure.operations.length !== 2 ||
        structure.operations[0].replace(/\s/g, "") !== "x,y,z" ||
        structure.operations[1].replace(/\s/g, "") !== "-x,-y,-z") {
      throw new Error("Co-Rekonstruktion derzeit nur für vorliegende P-1-Operationen.");
    }
    const sites = new Map(structure.atoms.map(atom => [atom.cifLabel, atom]));
    const edges = new Map();
    const add = (a, edge) => {
      if (!edges.has(a)) edges.set(a, []);
      edges.get(a).push(edge);
    };
    for (const bond of structure.bonds) {
      let sign = 1;
      let shift = [0, 0, 0];
      if (bond.symmetry2 && bond.symmetry2 !== ".") {
        const match = /^(1|2)_([0-9]{3})$/.exec(bond.symmetry2);
        if (!match) throw new Error("Nicht unterstützter Co-Bindungscode.");
        sign = match[1] === "2" ? -1 : 1;
        shift = match[2].split("").map(value => Number(value) - 5);
      }
      add(bond.a, {label: bond.b, sign, shift, distance: bond.reportedDistanceAngstrom});
      add(bond.b, {label: bond.a, sign, shift: shift.map(value => -sign * value), distance: bond.reportedDistanceAngstrom});
    }
    const start = structure.atoms.find(atom => atom.element === "Co");
    if (!start) throw new Error("Kein Co-Zentrum gefunden.");
    const states = [{label: start.cifLabel, sign: 1, shift: [0, 0, 0]}];
    const key = state => state.label + ":" + state.sign + ":" + state.shift.join(",");
    const indexes = new Map([[key(states[0]), 0]]);
    const bonds = [];
    const bondKeys = new Set();
    for (let a = 0; a < states.length; a++) {
      if (states.length > 500) throw new Error("Periodisches Netzwerk statt begrenzter Co-Einheit.");
      const state = states[a];
      for (const edge of edges.get(state.label) || []) {
        const next = {label: edge.label, sign: state.sign * edge.sign,
          shift: edge.shift.map((value, axis) => state.shift[axis] + state.sign * value)};
        if (!includeHydrogen && sites.get(next.label).element === "H") continue;
        const id = key(next);
        if (!indexes.has(id)) { indexes.set(id, states.length); states.push(next); }
        const b = indexes.get(id);
        const bondKey = [Math.min(a, b), Math.max(a, b)].join(":");
        if (!bondKeys.has(bondKey)) {
          bondKeys.add(bondKey);
          bonds.push({a, b, reportedDistanceAngstrom: edge.distance});
        }
      }
    }
    const atoms = states.map((state, index) => {
      const site = sites.get(state.label);
      const fractional = site.fractional.map((value, axis) => state.sign * value + state.shift[axis]);
      return {...site, id: "co-heavy-" + (index + 1), modelNumber: index + 1,
        fractional, positionAngstrom: cartesian(fractional, structure.matrix),
        symmetrySign: state.sign, cellShift: state.shift.slice()};
    });
    return {atoms, bonds, omittedHydrogen: !includeHydrogen,
      description: includeHydrogen ? "Zusammenhängende Co-Einheit einschließlich geometrisch zugeordneter H-Atome." :
        "Zusammenhängende Nicht-H-Einheit aus expliziten CIF-Bindungen; keine H-Zuordnung."};
  }
  function createCoStructure(source, mode) {
    const structure = read(source);
    // Nur die vorliegende, vollständig besetzte Co-Teststruktur freigeben.
    if (structure.spaceGroup !== "P -1" || structure.atoms.length !== 36 ||
        structure.atoms.some(atom => atom.occupancy !== 1)) {
      throw new Error("Nicht unterstützte Co-Teststruktur.");
    }
    const hydrogenBonds = [];
    for (const hydrogen of structure.atoms.filter(atom => atom.element === "H")) {
      const candidates = [];
      for (const parent of structure.atoms.filter(atom => ["C", "N", "O"].includes(atom.element))) {
        structure.operations.forEach((operation, op) => {
          const fractional = symmetryPoint(parent.fractional, operation);
          for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
            const shift = [x, y, z];
            const position = cartesian(fractional.map((value, axis) => value + shift[axis]), structure.matrix);
            const length = Math.hypot(...position.map((value, axis) => value - hydrogen.positionAngstrom[axis]));
            if (length >= 0.6 && length <= 1.25) candidates.push({parent, op, shift, length, position});
          }
        });
      }
      candidates.sort((a, b) => a.length - b.length);
      if (candidates.length !== 1) throw new Error("H-Zuordnung nicht eindeutig: " + hydrogen.cifLabel);
      const candidate = candidates[0];
      hydrogenBonds.push({a: hydrogen.cifLabel, b: candidate.parent.cifLabel,
        symmetry2: (candidate.op + 1) + "_" + candidate.shift.map(value => value + 5).join(""),
        reportedDistanceAngstrom: candidate.length, calculatedDistanceAngstrom: candidate.length,
        startAngstrom: hydrogen.positionAngstrom.slice(), endAngstrom: candidate.position,
        inferredHydrogen: true});
    }
    structure.bonds.push(...hydrogenBonds);
    const base = {
      mode, name: "Co-Produkt1", cellLengthsAngstrom: structure.lengths,
      cellAnglesDegrees: structure.angles, cellMatrix: structure.matrix,
      spaceGroup: {name: structure.spaceGroup, number: "2"},
      hydrogenBondRule: "Eindeutiger C/N/O-Nachbar zwischen 0,6 und 1,25 Å; geometrisch ergänzt."
    };
    if (mode === "molecule") {
      const complex = reconstructCoHeavy(structure, true);
      const center = [0, 1, 2].map(axis => complex.atoms.reduce((sum, atom) => sum + atom.positionAngstrom[axis], 0) / complex.atoms.length);
      return {...base, atoms: complex.atoms.map(atom => ({...atom,
        positionAngstrom: atom.positionAngstrom.map((value, axis) => value - center[axis])})),
        bonds: complex.bonds.map((bond, i) => ({...bond, id: "co-bond-" + (i + 1),
          distanceAngstrom: bond.reportedDistanceAngstrom})),
        excludedSites: structure.atoms.filter(atom => !complex.atoms.some(entry => entry.cifLabel === atom.cifLabel)).map(atom => atom.cifLabel)};
    }
    if (mode !== "cell") throw new Error("Unbekannte Co-Ansicht.");
    const wrap = value => value - Math.floor(value);
    const atoms = [];
    const locate = (label, fractional) => {
      const point = fractional.map(wrap);
      return atoms.findIndex(atom => atom.cifLabel === label && atom.fractional.every((value, axis) => Math.abs(value - point[axis]) < 1e-7));
    };
    for (const site of structure.atoms) {
      structure.operations.forEach((operation, symmetryIndex) => {
        const fractional = symmetryPoint(site.fractional, operation).map(wrap);
        if (locate(site.cifLabel, fractional) !== -1) return;
        atoms.push({...site, id: "co-cell-" + (atoms.length + 1), modelNumber: atoms.length + 1,
          symmetryIndex, fractional, positionAngstrom: cartesian(fractional, structure.matrix)});
      });
    }
    const bonds = [];
    const keys = new Set();
    const inverse = position => {
      const z = position[2] / structure.matrix[2][2];
      const y = (position[1] - z * structure.matrix[2][1]) / structure.matrix[1][1];
      const x = (position[0] - y * structure.matrix[1][0] - z * structure.matrix[2][0]) / structure.matrix[0][0];
      return [x, y, z];
    };
    for (const bond of structure.bonds) {
      const start = inverse(bond.startAngstrom);
      const end = inverse(bond.endAngstrom);
      structure.operations.forEach(operation => {
        const aPoint = symmetryPoint(start, operation);
        const bPoint = symmetryPoint(end, operation);
        const a = locate(bond.a, aPoint);
        const b = locate(bond.b, bPoint);
        if (a < 0 || b < 0) throw new Error("Zellbindungsatom fehlt.");
        const key = [Math.min(a, b), Math.max(a, b)].join(":");
        if (keys.has(key)) return;
        keys.add(key);
        bonds.push({id: "co-cell-bond-" + (bonds.length + 1), a, b,
          deltaFractional: bPoint.map((value, axis) => value - aPoint[axis]),
          distanceAngstrom: bond.calculatedDistanceAngstrom});
      });
    }
    return {...base, atoms, bonds, cellAtomCount: atoms.length};
  }
  F.CIFStructure = {parse, numeric, cellMatrix, cartesian, symmetryPoint, read, reconstructCoHeavy, createCoStructure};
})(window.FKCVR = window.FKCVR || {});