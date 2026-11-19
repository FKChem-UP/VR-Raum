"use strict";

// Erste numerische Co-Importgrundlage, noch nicht in index.html eingebunden.
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
  F.CIFStructure = {parse, numeric, cellMatrix, cartesian, symmetryPoint, read};
})(window.FKCVR = window.FKCVR || {});