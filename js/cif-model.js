"use strict";

(function (F) {
  const T = AFRAME.THREE;

  /*
   * CIF-C60-1
   *
   * Erster, bewusst begrenzter CIF-Import:
   * - kubische, vollständig besetzte Kohlenstoffstruktur;
   * - 240 Atome pro Elementarzelle;
   * - vier getrennte C60-Käfige;
   * - pro Käfig 60 Atome, 90 Bindungen, Grad 3.
   *
   * Kein allgemeiner CIF-Parser für beliebige Kristallstrukturen.
   * Keine Auswertung von CIF-Inhalten mit eval / new Function.
   *
   * Strukturkoordinaten bleiben in Angstrom gespeichert.
   * fkc-normalize skaliert nur die sichtbare Darstellung.
   */

  const BOND_MIN = 0.9;
  const BOND_MAX = 1.85;
  const EPS = 0.00001;

  function fail(message) {
    throw new Error("CIF-C60-1: " + message);
  }

  function number(value) {
    // Beispiel: 14.2957(3) -> 14.2957
    const result = Number(
      String(value).replace(/\(\d+\)$/, "")
    );

    if (!Number.isFinite(result)) {
      fail("Ungültiger Zahlenwert: " + value);
    }

    return result;
  }

  function wrap(value) {
    return value - Math.floor(value);
  }

  /*
   * Kleiner Tokenizer für die vorliegende CIF:
   * einfache / doppelte Anführungszeichen und Kommentare.
   * Mehrzeilige Semikolon-Textfelder werden bewusst abgelehnt.
   */
  function tokenize(source) {
    const result = [];

    String(source).replace(/\r/g, "").split("\n").forEach(line => {
      if (line.startsWith(";")) {
        fail("Mehrzeilige CIF-Textfelder werden noch nicht unterstützt.");
      }

      const expression = /'([^']*)'|"([^"]*)"|([^\s#]+)|(#.*$)/g;
      let match;

      while ((match = expression.exec(line))) {
        if (match[4] !== undefined) break;

        result.push(
          match[1] !== undefined
            ? match[1]
            : match[2] !== undefined
              ? match[2]
              : match[3]
        );
      }
    });

    return result;
  }

  function parseCIF(source) {
    const tokens = tokenize(source);
    const values = {};
    const loops = [];

    let index = 0;

    function control(token) {
      return (
        token.startsWith("_") ||
        /^(loop_|stop_|data_.*|save_.*|global_)$/i.test(token)
      );
    }

    while (index < tokens.length) {
      const token = tokens[index++];

      if (token.toLowerCase() === "loop_") {
        const names = [];

        while (
          index < tokens.length &&
          tokens[index].startsWith("_")
        ) {
          names.push(tokens[index++].toLowerCase());
        }

        if (!names.length) fail("CIF-Schleife ohne Spaltennamen.");

        const entries = [];

        while (
          index < tokens.length &&
          !control(tokens[index])
        ) {
          entries.push(tokens[index++]);
        }

        if (entries.length % names.length !== 0) {
          fail("Unvollständige Zeile in einer CIF-Schleife.");
        }

        const rows = [];

        for (let offset = 0; offset < entries.length; offset += names.length) {
          const row = {};

          names.forEach((name, column) => {
            row[name] = entries[offset + column];
          });

          rows.push(row);
        }

        loops.push({names, rows});
      } else if (token.startsWith("_")) {
        if (index >= tokens.length || control(tokens[index])) {
          fail("Fehlender Wert für " + token);
        }

        values[token.toLowerCase()] = tokens[index++];
      } else if (!/^data_/i.test(token)) {
        fail("Nicht unterstütztes CIF-Token: " + token);
      }
    }

    return {values, loops};
  }

  function fraction(text) {
    const parts = text.split("/");

    if (parts.length > 2) fail("Ungültiger Bruch: " + text);

    const numerator = Number(parts[0]);
    const denominator = parts.length === 2 ? Number(parts[1]) : 1;

    if (
      !Number.isFinite(numerator) ||
      !Number.isFinite(denominator) ||
      denominator === 0
    ) {
      fail("Ungültiger Bruch: " + text);
    }

    return numerator / denominator;
  }

  /*
   * Unterstützt die in deiner CIF enthaltenen Operationen:
   * x, -y, z+1/2 usw.
   */
  function compileCoordinate(expression) {
    const text = expression.replace(/\s/g, "").toLowerCase();

    if (!text) fail("Leere Symmetriekoordinate.");

    const terms = text.match(/[+-]?[^+-]+/g);

    if (!terms || terms.join("") !== text) {
      fail("Ungültige Symmetriekoordinate: " + expression);
    }

    const coefficients = [0, 0, 0];
    let offset = 0;

    terms.forEach(term => {
      const sign = term.startsWith("-") ? -1 : 1;
      const body = term.replace(/^[+-]/, "");
      const axis = ["x", "y", "z"].indexOf(body);

      if (axis >= 0) {
        coefficients[axis] += sign;
      } else if (/^\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?$/.test(body)) {
        offset += sign * fraction(body);
      } else {
        fail("Nicht unterstützte Symmetriekoordinate: " + expression);
      }
    });

    return point => (
      offset +
      coefficients[0] * point[0] +
      coefficients[1] * point[1] +
      coefficients[2] * point[2]
    );
  }

  function readStructure(source) {
    const parsed = parseCIF(source);
    const v = parsed.values;

    const lengths = [
      number(v._cell_length_a),
      number(v._cell_length_b),
      number(v._cell_length_c)
    ];

    const angles = [
      number(v._cell_angle_alpha),
      number(v._cell_angle_beta),
      number(v._cell_angle_gamma)
    ];

    if (
      lengths.some(value => value <= 0) ||
      Math.max(...lengths) - Math.min(...lengths) > EPS ||
      angles.some(value => Math.abs(value - 90) > EPS)
    ) {
      fail("Dieser erste Import unterstützt nur kubische Zellen.");
    }

    const atomLoop = parsed.loops.find(loop =>
      loop.names.includes("_atom_site_fract_x")
    );

    const symmetryLoop = parsed.loops.find(loop =>
      loop.names.includes("_symmetry_equiv_pos_as_xyz") ||
      loop.names.includes("_space_group_symop_operation_xyz")
    );

    if (!atomLoop || !symmetryLoop) {
      fail("Atompositionen oder Symmetrieoperationen fehlen.");
    }

    const operations = symmetryLoop.rows.map((row, index) => {
      const expression =
        row._symmetry_equiv_pos_as_xyz ||
        row._space_group_symop_operation_xyz;

      const parts = expression.split(",");

      if (parts.length !== 3) {
        fail("Eine Symmetrieoperation muss drei Koordinaten enthalten.");
      }

      return {
        id:
          row._symmetry_equiv_pos_site_id ||
          row._space_group_symop_id ||
          String(index + 1),
        expression,
        calculate: parts.map(compileCoordinate)
      };
    });

    const atoms = [];

    atomLoop.rows.forEach(row => {
      if (row._atom_site_type_symbol !== "C") {
        fail("Dieser erste Test unterstützt ausschließlich Kohlenstoff.");
      }

      if (
        row._atom_site_occupancy !== undefined &&
        Math.abs(number(row._atom_site_occupancy) - 1) > EPS
      ) {
        fail("Teilbesetzte Atompositionen werden noch nicht unterstützt.");
      }

      const original = [
        number(row._atom_site_fract_x),
        number(row._atom_site_fract_y),
        number(row._atom_site_fract_z)
      ];

      operations.forEach(operation => {
        const position = operation.calculate.map(fn => wrap(fn(original)));

        // Periodische Dubletten auch an Zellgrenzen erkennen.
        const duplicate = atoms.some(atom => (
          atom.fractional.every((value, axis) => {
            const delta = value - position[axis];
            return Math.abs(delta - Math.round(delta)) < EPS;
          })
        ));

        if (duplicate) return;

        atoms.push({
          element: "C",
          cifLabel: row._atom_site_label,
          symmetryId: operation.id,
          symmetryExpression: operation.expression,
          fractional: position
        });
      });
    });

    if (atoms.length !== 240) {
      fail(
        "Erwartet wurden 240 Atome pro Zelle, gefunden wurden " +
        atoms.length + "."
      );
    }

    return {
      lengths, angles, atoms,
      spaceGroup: {
        name: v["_space_group_name_h-m_alt"] ||
          v["_symmetry_space_group_name_h-m"] || "Nicht angegeben",
        number: v._space_group_it_number || v._symmetry_int_tables_number || ""
      }
    };
  }

  /*
   * Periodischer Bindungsgraph.
   * Bei dieser kubischen C60-Zelle ist die komponentenweise
   * Minimum-Image-Berechnung zulässig.
   */
  function extractMolecule(structure) {
    const atoms = structure.atoms;
    const lengths = structure.lengths;
    const neighbors = atoms.map(() => []);

    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const delta = atoms[j].fractional.map((value, axis) => {
          const difference = value - atoms[i].fractional[axis];
          return difference - Math.round(difference);
        });

        const distance = Math.hypot(
          delta[0] * lengths[0],
          delta[1] * lengths[1],
          delta[2] * lengths[2]
        );

        if (distance < BOND_MIN) {
          fail("Ungewöhnlich kurzer C–C-Abstand: " + distance.toFixed(4) + " Å.");
        }

        if (distance <= BOND_MAX) {
          neighbors[i].push({index: j, delta});
          neighbors[j].push({
            index: i,
            delta: delta.map(value => -value)
          });
        }
      }
    }

    if (neighbors.some(entries => entries.length !== 3)) {
      fail("Nicht jedes Atom hat genau drei Bindungspartner.");
    }

    const visited = new Set();
    const molecules = [];

    for (let seed = 0; seed < atoms.length; seed++) {
      if (visited.has(seed)) continue;

      const indices = [seed];
      const unfolded = new Map([
        [seed, atoms[seed].fractional.slice()]
      ]);

      visited.add(seed);

      for (let cursor = 0; cursor < indices.length; cursor++) {
        const current = indices[cursor];
        const position = unfolded.get(current);

        neighbors[current].forEach(edge => {
          const nextPosition = position.map(
            (value, axis) => value + edge.delta[axis]
          );

          if (unfolded.has(edge.index)) {
            const known = unfolded.get(edge.index);

            if (known.some((value, axis) =>
              Math.abs(value - nextPosition[axis]) > EPS
            )) {
              fail("Bindungsgraph bildet keinen endlichen, geschlossenen Käfig.");
            }

            return;
          }

          if (visited.has(edge.index)) {
            fail("Widersprüchliche Molekülzuordnung.");
          }

          visited.add(edge.index);
          unfolded.set(edge.index, nextPosition);
          indices.push(edge.index);
        });
      }

      const count = indices.reduce(
        (sum, atomIndex) => sum + neighbors[atomIndex].length,
        0
      ) / 2;

      if (indices.length !== 60 || count !== 90) {
        fail(
          "Ein Käfig hat " + indices.length +
          " Atome und " + count + " Bindungen statt 60 / 90."
        );
      }

      const center = [0, 0, 0];

      indices.forEach(atomIndex => {
        unfolded.get(atomIndex).forEach((value, axis) => {
          center[axis] += value / indices.length;
        });
      });

      const centerInCell = center.map(wrap);
      const score = centerInCell.reduce(
        (sum, value) => sum + (value - 0.5) ** 2,
        0
      );

      molecules.push({indices, unfolded, center, centerInCell, score});
    }

    if (molecules.length !== 4) {
      fail("Erwartet wurden vier getrennte C60-Käfige.");
    }

    // Den Käfig mit dem Zentrum am nächsten zur Zellmitte wählen.
    molecules.sort((a, b) => a.score - b.score);
    const chosen = molecules[0];

    const localIndex = new Map(
      chosen.indices.map((globalIndex, index) => [globalIndex, index])
    );

    const resultAtoms = chosen.indices.map((globalIndex, index) => {
      const original = atoms[globalIndex];
      const unfolded = chosen.unfolded.get(globalIndex);

      return {
        id: "atom-" + (index + 1),
        modelNumber: index + 1,
        element: original.element,
        cifLabel: original.cifLabel,
        symmetryId: original.symmetryId,
        symmetryExpression: original.symmetryExpression,
        fractional: original.fractional.slice(),
        cellShift: unfolded.map(
          (value, axis) => Math.round(value - original.fractional[axis])
        ),
        positionAngstrom: unfolded.map(
          (value, axis) => (value - chosen.center[axis]) * lengths[axis]
        )
      };
    });

    const bonds = [];

    chosen.indices.forEach(globalIndex => {
      neighbors[globalIndex].forEach(edge => {
        const a = localIndex.get(globalIndex);
        const b = localIndex.get(edge.index);

        if (a >= b) return;

        const pa = resultAtoms[a].positionAngstrom;
        const pb = resultAtoms[b].positionAngstrom;

        bonds.push({
          id: "bond-" + (bonds.length + 1),
          a,
          b,
          distanceAngstrom: Math.hypot(
            pb[0] - pa[0],
            pb[1] - pa[1],
            pb[2] - pa[2]
          )
        });
      });
    });

    return {
      kind: "c60",
      coordinateUnit: "angstrom",
      cellLengthsAngstrom: lengths.slice(),
      cellAnglesDegrees: structure.angles.slice(),
      spaceGroup: structure.spaceGroup,
      cellAtomCount: atoms.length,
      moleculeCount: molecules.length,
      moleculeCentersFractional: molecules.map(item =>
        item.centerInCell.slice()
      ),
      chosenCenterFractional: chosen.centerInCell.slice(),
      bondCutoffAngstrom: BOND_MAX,
      atoms: resultAtoms,
      bonds,
      cellAtoms: atoms.map((atom, index) => ({
        ...atom,
        id: "cell-atom-" + (index + 1),
        modelNumber: index + 1,
        fractional: atom.fractional.slice(),
        positionAngstrom: atom.fractional.map(
          (value, axis) => value * lengths[axis]
        )
      })),
      cellBonds: neighbors.flatMap((entries, a) => entries
        .filter(edge => a < edge.index)
        .map(edge => ({
          id: "cell-bond-" + (a + 1) + "-" + (edge.index + 1),
          a,
          b: edge.index,
          deltaFractional: edge.delta.slice(),
          distanceAngstrom: Math.hypot(...edge.delta.map(
            (value, axis) => value * lengths[axis]
          ))
        })))
    };
  }

  /*
   * Eine kurze periodische Bindung an den Zellflächen teilen.
   * Jedes Teilstück wird anhand seines Mittelpunkts in [0, 1]^3
   * zurückverschoben. Dadurch entstehen keine langen Querstreben.
   */
  function cellBondSegments(structure, bonds = structure.bonds) {
    return bonds.flatMap(bond => {
      const start = structure.atoms[bond.a].fractional;
      const delta = bond.deltaFractional;
      const cuts = [0, 0.5, 1];

      delta.forEach((value, axis) => {
        if (Math.abs(value) < EPS) return;
        [0, 1].forEach(boundary => {
          const t = (boundary - start[axis]) / value;
          if (t > EPS && t < 1 - EPS) cuts.push(t);
        });
      });

      const sorted = cuts.sort((a, b) => a - b)
        .filter((value, index, values) =>
          index === 0 || value - values[index - 1] > EPS
        );

      return sorted.slice(1).map((end, index) => {
        const begin = sorted[index];
        const shift = start.map((value, axis) =>
          Math.floor(value + delta[axis] * (begin + end) / 2)
        );
        const point = t => {
          const fractional = start.map((value, axis) => value + delta[axis] * t - shift[axis]);
          return structure.cellMatrix ? F.CIFStructure.cartesian(fractional, structure.cellMatrix) :
            fractional.map((value, axis) => value * structure.cellLengthsAngstrom[axis]);
        };
        return {
          id: bond.id + "-segment-" + (index + 1),
          bondId: bond.id,
          a: bond.a,
          b: bond.b,
          half: (begin + end) / 2 < 0.5 ? 0 : 1,
          from: begin, to: end,
          startAngstrom: point(begin),
          endAngstrom: point(end)
        };
      });
    });
  }

  // Erzeuge kurze sichtbare Teilstücke; die Lücken laufen über Zellflächen
  // hinweg im selben Rhythmus weiter. Keine Bindungs- oder Trefferobjekte.
  function hydrogenContactDashes(structure) {
    if (!["cell", "cell-complete"].includes(structure.mode)) return [];
    return (structure.hydrogenContacts || []).flatMap(contact => {
      const start = structure.atoms[contact.a].positionAngstrom;
      const end = structure.atoms[contact.b].positionAngstrom;
      const segments = structure.mode === "cell" ? cellBondSegments(structure, [contact]) :
        [{from: 0, to: 1, startAngstrom: start, endAngstrom: end}];
      const length = Math.hypot(...F.CIFStructure.cartesian(contact.deltaFractional, structure.cellMatrix));
      if (length < EPS) return [];
      const period = 0.34 / length;
      const dash = 0.20 / length;
      return segments.flatMap(segment => {
        const points = [];
        const point = t => segment.startAngstrom.map((value, axis) => value +
          (segment.endAngstrom[axis] - value) * (t - segment.from) / (segment.to - segment.from));
        for (let t = Math.floor(segment.from / period) * period; t < segment.to; t += period) {
          const a = Math.max(t, segment.from);
          const b = Math.min(t + dash, segment.to);
          if (b - a > EPS) points.push([point(a), point(b)]);
        }
        return points;
      });
    });
  }

  function createStructure(source, mode = "molecule") {
    if (!["molecule", "cell", "coordination"].includes(mode)) {
      fail("Unbekannter Darstellungsmodus: " + mode);
    }
    if (/^[ \t]*data_NaCl[ \t\r]*$/im.test(source)) {
      return F.NaClStructure.createStructure(source, mode);
    }
    if (/^[ \t]*_atom_site_aniso_label(?:[ \t\r\n]|$)/im.test(source)) {
      if (!F.CIFStructure) throw new Error("Co-Strukturmodul nicht geladen.");
      const parsed = F.CIFStructure.parse(source);
      const sites = parsed.loops.find(loop => loop.names.includes("_atom_site_label") &&
        loop.names.includes("_atom_site_type_symbol") && loop.names.includes("_atom_site_fract_x"));
      // Das Elementsymbol ist unabhängig vom frei vergebenen CIF-Atomlabel.
      if (sites && sites.rows.some(row => row._atom_site_type_symbol === "Co")) {
        const structure = F.CIFStructure.createCoStructure(source, mode, parsed);
        if (mode === "cell") structure.bondSegments = cellBondSegments(structure);
        return structure;
      }
    }
    // Auch die Zellansicht muss die Einzelkäfigprüfungen bestehen.
    if (mode === "coordination") fail("Koordinationsansicht für diese Struktur nicht verfügbar.");
    const molecule = extractMolecule(readStructure(source));
    if (mode === "molecule") return {...molecule, mode};
    const cell = {
      ...molecule,
      mode,
      chosenCenterFractional: null,
      atoms: molecule.cellAtoms,
      bonds: molecule.cellBonds
    };
    cell.bondSegments = cellBondSegments(cell);
    return cell;
  }

  // Numerisch prüfbarer Einstieg, unabhängig von sichtbarer VR-Skalierung.
  const styles = [
    {id: "ball-stick", title: "Ball-and-Stick", atomRadius: 0.32, bondRadius: 0.10},
    {id: "space-filling", title: "Space-Filling", atomRadius: 1.70, bondRadius: 0},
    {id: "wires", title: "Wires", atomRadius: 0.025, bondRadius: 0.025},
    {id: "capped-sticks", title: "Capped Sticks", atomRadius: 0.14, bondRadius: 0.14},
    {id: "polyhedral", title: "Polyhedral", atomRadius: 0.32, bondRadius: 0.10}
  ];
  const elements = {
    H: {color: "#eeeeee", vdw: 1.20}, C: {color: "#515151", vdw: 1.70},
    N: {color: "#3055ee", vdw: 1.55}, O: {color: "#ee3333", vdw: 1.52},
    Cl: {color: "#35c935", vdw: 1.75},
    Co: {color: "#ed709b", vdw: 2.00}, Na: {color: "#8359dc", vdw: 2.27}
  };

  // Konvexe Hülle aus echten Nachbarpositionen; koplanare Flächen nur einmal
  // triangulieren, keine idealisierten Oktaeder oder neuen chemischen Bindungen.
  function polyhedronTriangles(points) {
    const sub = (a, b) => a.map((value, axis) => value - b[axis]);
    const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const unit = a => { const length = Math.hypot(...a); return a.map(value => value / length); };
    if (points.length < 4 || points.some(point => point.length !== 3 || point.some(value => !Number.isFinite(value)))) {
      throw new Error("Ungültige Polyederpunkte.");
    }
    const tolerance = 1e-7 * Math.max(1, ...points.map(point => Math.hypot(...sub(point, points[0]))));
    const faces = new Map();
    for (let a = 0; a < points.length - 2; a++) {
      for (let b = a + 1; b < points.length - 1; b++) {
        for (let c = b + 1; c < points.length; c++) {
          let normal = cross(sub(points[b], points[a]), sub(points[c], points[a]));
          if (Math.hypot(...normal) < tolerance * tolerance) continue;
          normal = unit(normal);
          const distances = points.map(point => dot(normal, sub(point, points[a])));
          const positive = distances.some(value => value > tolerance);
          const negative = distances.some(value => value < -tolerance);
          if (positive && negative || !positive && !negative) continue;
          if (positive) normal = normal.map(value => -value);
          const vertices = distances.map((value, index) => Math.abs(value) <= tolerance ? index : -1).filter(index => index >= 0);
          faces.set(vertices.join(","), {vertices, normal});
        }
      }
    }
    if (faces.size < 4) throw new Error("Entartetes Koordinationspolyeder.");
    const triangles = [];
    for (const {vertices, normal} of faces.values()) {
      const center = [0, 1, 2].map(axis => vertices.reduce((sum, index) => sum + points[index][axis], 0) / vertices.length);
      const u = unit(sub(points[vertices[0]], center));
      const v = cross(normal, u);
      vertices.sort((a, b) => Math.atan2(dot(sub(points[a], center), v), dot(sub(points[a], center), u)) -
        Math.atan2(dot(sub(points[b], center), v), dot(sub(points[b], center), u)));
      for (let i = 1; i < vertices.length - 1; i++) triangles.push([vertices[0], vertices[i], vertices[i + 1]]);
    }
    return triangles;
  }

  function availableStyles(structure) {
    return styles.filter(style => style.id !== "polyhedral" || structure && structure.polyhedra && structure.polyhedra.length);
  }

  function applyStyle(group, styleId) {
    if (group.userData.fkcEnvironment) group.userData.fkcEnvironment.refresh = true;
    if (styleId === "polyhedral" && !availableStyles(group.userData.fkcStructure).some(style => style.id === styleId)) {
      styleId = "ball-stick";
    }
    const style = styles.find(entry => entry.id === styleId);
    if (!style) throw new Error("Nicht unterstützter CIF-Style: " + styleId);
    group.traverse(mesh => {
      if (mesh.userData.fkcHydrogenContacts) {
        mesh.visible = !!group.userData.fkcShowHydrogenContacts && !group.userData.fkcHideHydrogen;
      } else if (mesh.userData.fkcAtom) {
        mesh.visible = !(group.userData.fkcHideHydrogen && mesh.userData.fkcAtom.element === "H");
        // 1,70 Å: verwendete Van-der-Waals-Radiuskonvention für Kohlenstoff.
        // Die übrigen Radien sind rein visuelle Darstellungsradien.
        const element = elements[mesh.userData.fkcAtom.element];
        if (!element) throw new Error("Unbekanntes Darstellungselement.");
        mesh.scale.setScalar(styleId === "space-filling" ? element.vdw :
          styleId === "ball-stick" ? style.atomRadius * (group.userData.fkcAtomScale || 1) *
            (mesh.userData.fkcAtom.element === "H" ? 0.5 : 1) : style.atomRadius);
      } else if (mesh.userData.fkcPolyhedron) {
        mesh.visible = styleId === "polyhedral";
      } else if (mesh.userData.fkcBond) {
        mesh.visible = style.bondRadius > 0;
        const structure = group.userData.fkcStructure;
        const bond = mesh.userData.fkcBond;
        if (group.userData.fkcHideHydrogen && structure &&
            [bond.a, bond.b].some(index => structure.atoms[index] && structure.atoms[index].element === "H")) mesh.visible = false;
        mesh.scale.x = mesh.scale.z = style.bondRadius * (styleId === "ball-stick" ? group.userData.fkcBondThickness || 1 : 1);
        if (mesh.userData.fkcElementMaterial) {
          const mode = styleId === "ball-stick" ? group.userData.fkcBondColorMode || "auto" : "auto";
          mesh.material = (mode === "element" || mode === "auto" && ["wires", "capped-sticks"].includes(styleId))
            ? mesh.userData.fkcElementMaterial : mesh.userData.fkcNeutralMaterial;
          if (mesh.userData.fkcNeutralMaterial.color) {
            mesh.userData.fkcNeutralMaterial.color.set(mode === "uniform" ? group.userData.fkcBondColor || "#949494" : "#949494");
          }
        }
      }
    });
    group.userData.fkcStyle = styleId;
  }

  F.CIF = {
    createStructure, styles, availableStyles, polyhedronTriangles, applyStyle, elements, hydrogenContactDashes,
    setHydrogenContacts(root, enabled) {
      const visual = root && root.querySelector(".model-visual");
      const mesh = visual && visual.getObject3D("mesh");
      if (!mesh || !visual.fkcStructure?.hydrogenContacts?.length || root.fkcPendingVisual) return false;
      root.fkcShowHydrogenContacts = !!enabled;
      mesh.userData.fkcShowHydrogenContacts = root.fkcShowHydrogenContacts;
      applyStyle(mesh, mesh.userData.fkcStyle || "ball-stick");
      return true;
    },
    setAtomOptions(root, hideHydrogen, atomScale) {
      if (atomScale !== undefined && ![0.5, 0.75, 1].includes(atomScale)) return false;
      const visual = root && root.querySelector(".model-visual");
      const group = visual && visual.getObject3D("mesh");
      if (!group || !visual.fkcStructure || root.fkcPendingVisual) return false;
      const labels = F.getScene().components["fkc-atom-labels"];
      if (labels) labels.clear();
      if (hideHydrogen !== undefined) root.fkcHideHydrogen = !!hideHydrogen;
      if (atomScale !== undefined) root.fkcAtomScale = atomScale;
      group.userData.fkcHideHydrogen = root.fkcHideHydrogen;
      group.userData.fkcAtomScale = root.fkcAtomScale || 1;
      applyStyle(group, group.userData.fkcStyle || "ball-stick");
      this.updateEnvironment(group);
      F.invalidateHits();
      return true;
    },
    setCompleteCell(root, enabled) {
      const visual = root && root.querySelector(".model-visual");
      const component = visual && visual.components["fkc-cif-model"];
      if (!component || !component.built || !["cell", "cell-complete"].includes(visual.fkcStructure.mode) ||
          !visual.fkcStructure.cellMatrix || !visual.fkcStructure.name.startsWith("Co-Produkt1")) return false;
      const cell = component.originalCell || visual.fkcStructure;
      component.originalCell = cell;
      const structure = enabled ? F.CIFStructure.completeCell(cell) : cell;
      const built = buildMesh(structure);
      Object.assign(built.group.userData, {fkcHideHydrogen: root.fkcHideHydrogen,
        fkcShowHydrogenContacts: root.fkcShowHydrogenContacts,
        fkcAtomScale: root.fkcAtomScale || 1, fkcBondThickness: root.fkcBondThickness || 1,
        fkcBondColorMode: root.fkcBondColorMode || "auto", fkcBondColor: root.fkcBondColor || "#949494"});
      applyStyle(built.group, root.fkcStyle || "ball-stick");
      F.releaseModel(root);
      const labels = F.getScene().components["fkc-atom-labels"];
      if (labels) labels.clear();
      component.built.dispose();
      component.built = built;
      visual.fkcStructure = structure;
      visual.setObject3D("mesh", built.group);
      F.invalidateHits();
      return true;
    },
    setBondThickness(root, factor) {
      if (![0.5, 0.75, 1].includes(factor)) return false;
      const visual = root && root.querySelector(".model-visual");
      const group = visual && visual.getObject3D("mesh");
      if (!group || !visual.fkcStructure || root.fkcPendingVisual) return false;
      root.fkcBondThickness = factor;
      group.userData.fkcBondThickness = factor;
      applyStyle(group, group.userData.fkcStyle || "ball-stick");
      this.updateEnvironment(group);
      F.invalidateHits();
      return true;
    },
    environmentState(root) {
      const visual = root && root.querySelector(".model-visual");
      const group = visual && visual.getObject3D("mesh");
      return group && group.userData.fkcEnvironment;
    },
    setEnvironment(root, enabled, radius) {
      const visual = root && root.querySelector(".model-visual");
      const group = visual && visual.getObject3D("mesh");
      if (!group || !visual.fkcStructure.environmentCell || root.fkcPendingVisual) return false;
      if (radius !== undefined && ![1.5, 2, 2.5, 3, 4, 5].includes(radius)) return false;
      const state = group.userData.fkcEnvironment;
      state.radius = radius === undefined ? state.radius : radius;
      if (enabled && F.Measure && F.Measure.enabled) F.Measure.setEnabled(false);
      state.enabled = !!enabled;
      const candidates = F.CIFStructure.environmentCandidates(visual.fkcStructure, state.radius);
      state.available = new Set(candidates.map(candidate => candidate.id));
      for (const candidate of candidates) {
        if (state.records.has(candidate.id)) continue;
        const built = buildMesh(candidate);
        const materials = new Map();
        built.group.traverse(mesh => {
          if (!mesh.isMesh) return;
          for (const key of ["material", "fkcElementMaterial", "fkcNeutralMaterial"]) {
            const source = key === "material" ? mesh.material : mesh.userData[key];
            if (!source) continue;
            if (!materials.has(source)) materials.set(source, source.clone());
            if (key === "material") mesh.material = materials.get(source);
            else mesh.userData[key] = materials.get(source);
          }
          mesh.userData.fkcEnvironmentId = candidate.id;
        });
        group.add(built.group);
        state.records.set(candidate.id, {built, materials, candidate});
      }
      this.updateEnvironment(group);
      F.invalidateHits();
      F.setStatus("Umgebung: " + candidates.length + " Kandidaten, " + state.selected.size + " übernommen.");
      return true;
    },
    updateEnvironment(group) {
      const state = group.userData.fkcEnvironment;
      if (!state) return;
      for (const [id, record] of state.records) {
        const selected = state.selected.has(id);
        record.built.group.visible = selected || state.enabled && state.available.has(id);
        record.built.group.userData.fkcBondColorMode = group.userData.fkcBondColorMode;
        record.built.group.userData.fkcBondColor = group.userData.fkcBondColor;
        record.built.group.userData.fkcBondThickness = group.userData.fkcBondThickness;
        record.built.group.userData.fkcHideHydrogen = group.userData.fkcHideHydrogen;
        record.built.group.userData.fkcAtomScale = group.userData.fkcAtomScale;
        applyStyle(record.built.group, group.userData.fkcStyle || "ball-stick");
        for (const material of record.materials.values()) {
          material.transparent = !selected;
          material.opacity = selected ? 1 : 0.25;
          material.depthWrite = selected;
        }
      }
      state.refresh = false;
    },
    clickEnvironment(hit) {
      const id = hit.mesh && hit.mesh.userData.fkcEnvironmentId;
      if (!id) return false;
      const state = this.environmentState(hit.el);
      if (!state) return false;
      // Ergänzungen in dieser Etappe nicht als Basis-Bondindices messen.
      if (!state.enabled) { F.setStatus("Umgebung einschalten, um Ergänzungen abzuwählen."); return true; }
      if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
      const visual = hit.el.querySelector(".model-visual");
      this.updateEnvironment(visual.getObject3D("mesh"));
      F.invalidateHits();
      F.setStatus(state.selected.size + " Umgebungsbestandteile übernommen.");
      return true;
    },
    resetEnvironment(root) {
      const state = this.environmentState(root);
      if (!state) return;
      state.selected.clear();
      this.setEnvironment(root, false);
    },
    setBondAppearance(root, mode, color) {
      if (!["auto", "element", "uniform"].includes(mode) || color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) return false;
      const visual = root && root.querySelector(".model-visual");
      const mesh = visual && visual.getObject3D("mesh");
      if (!mesh || !visual.fkcStructure || root.fkcPendingVisual) return false;
      root.fkcBondColorMode = mode;
      if (color !== undefined) root.fkcBondColor = color;
      mesh.userData.fkcBondColorMode = mode;
      mesh.userData.fkcBondColor = root.fkcBondColor || "#949494";
      applyStyle(mesh, mesh.userData.fkcStyle || "ball-stick");
      this.updateEnvironment(mesh);
      F.invalidateHits();
      return true;
    },
    setStyle(root, styleId) {
      const visual = root && root.querySelector(".model-visual");
      const mesh = visual && visual.getObject3D("mesh");
      if (!mesh || !visual.fkcStructure || root.fkcPendingVisual ||
          !availableStyles(visual.fkcStructure).some(style => style.id === styleId)) return false;
      const scene = F.getScene();
      const labels = scene && scene.components["fkc-atom-labels"];
      if (labels) labels.clear();
      applyStyle(mesh, styleId);
      this.updateEnvironment(mesh);
      root.fkcStyle = styleId;
      // Anzeigegröße/Griffbereich an geänderte Atomradien anpassen.
      const normalize = visual.components["fkc-normalize"];
      if (normalize) {
        // Umgebung darf die Basis beim Stylewechsel nicht unerwartet verkleinern.
        const environment = mesh.userData.fkcEnvironment;
        const records = environment ? [...environment.records.values()] : [];
        records.forEach(record => mesh.remove(record.built.group));
        try { normalize.normalize(); }
        finally { records.forEach(record => mesh.add(record.built.group)); }
      }
      F.invalidateHits();
      return true;
    }
  };

  function buildMesh(structure) {
    const group = new T.Group();
    group.name = (structure.name || "C60") + "-from-CIF-" + structure.mode;
    group.userData.fkcStructure = structure;
    if (structure.environmentCell) group.userData.fkcEnvironment = {
      enabled: false, radius: 3, selected: new Set(), records: new Map(), available: new Set()
    };
    const polyhedronGeometries = [];
    const polyhedronMaterials = [];

    const sphere = new T.SphereGeometry(1, 24, 16);
    const cylinder = new T.CylinderGeometry(1, 1, 1, 12);

    const atomMaterials = new Map();

    const bondMaterial = new T.MeshStandardMaterial({
      name: "CIF-Bond",
      color: "#949494",
      roughness: 0.55,
      metalness: 0
    });

    const frameMaterial = new T.MeshStandardMaterial({
      name: "CIF-Cell-frame", color: "#2998c2", roughness: 0.6, metalness: 0
    });

    const axis = new T.Vector3(0, 1, 0);

    structure.atoms.forEach(atom => {
      if (!atomMaterials.has(atom.element)) {
        if (!elements[atom.element]) throw new Error("Unbekanntes Darstellungselement: " + atom.element);
        atomMaterials.set(atom.element, new T.MeshStandardMaterial({name: "CIF-" + atom.element,
          color: elements[atom.element].color, roughness: 0.45, metalness: 0}));
      }
      const atomMaterial = atomMaterials.get(atom.element);
      const mesh = new T.Mesh(sphere, atomMaterial);

      mesh.name = atom.id;
      mesh.position.fromArray(atom.positionAngstrom);

      // Darstellungsradius, kein physikalischer Atomradius.
      mesh.scale.setScalar(0.32);
      mesh.userData.fkcAtom = atom;
      const originalRaycast = mesh.raycast;
      const center = new T.Vector3();
      const worldScale = new T.Vector3();
      const hitPoint = new T.Vector3();
      const hitSphere = new T.Sphere();
      // Analytische Trefferfläche, keine zusätzliche sichtbare Geometrie/Bounds.
      mesh.raycast = function (raycaster, intersections) {
        if (!["wires", "capped-sticks"].includes(group.userData.fkcStyle)) {
          originalRaycast.call(this, raycaster, intersections);
          return;
        }
        this.getWorldPosition(center);
        this.getWorldScale(worldScale);
        const localRadius = this.scale.x;
        hitSphere.center.copy(center);
        hitSphere.radius = Math.max(worldScale.x, worldScale.y, worldScale.z) * 0.22 / localRadius;
        if (!raycaster.ray.intersectSphere(hitSphere, hitPoint)) return;
        const distance = raycaster.ray.origin.distanceTo(hitPoint);
        if (distance < raycaster.near || distance > raycaster.far) return;
        intersections.push({distance, point: hitPoint.clone(), object: this});
      };

      group.add(mesh);
    });

    function rod(startArray, endArray, name, material, radius, metadata, elementMaterial) {
      const start = new T.Vector3().fromArray(startArray);
      const end = new T.Vector3().fromArray(endArray);
      const direction = end.clone().sub(start);
      const length = direction.length();
      if (length < EPS) return;
      const mesh = new T.Mesh(cylinder, material);
      mesh.name = name;
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(axis, direction.normalize());
      mesh.scale.set(radius, length, radius);
      if (metadata) mesh.userData.fkcBond = metadata;
      if (elementMaterial) {
        mesh.userData.fkcElementMaterial = elementMaterial;
        mesh.userData.fkcNeutralMaterial = material;
      }
      group.add(mesh);
    }

    if (structure.mode === "cell" || structure.mode === "cell-complete") {
      if (structure.mode === "cell") structure.bondSegments.forEach(segment => rod(
        segment.startAngstrom, segment.endAngstrom,
        segment.id, bondMaterial, 0.10, segment,
        atomMaterials.get(structure.atoms[segment.half === 0 ? segment.a : segment.b].element)
      ));
      // Zwölf Kanten; Atommittelpunkte in [0, 1), Kugeln nicht beschnitten.
      structure.cellLengthsAngstrom.forEach((length, axisIndex) => {
        const other = [0, 1, 2].filter(index => index !== axisIndex);
        [0, 1].forEach(u => [0, 1].forEach(v => {
          const start = [0, 0, 0];
          start[other[0]] = u * structure.cellLengthsAngstrom[other[0]];
          start[other[1]] = v * structure.cellLengthsAngstrom[other[1]];
          const end = start.slice();
          end[axisIndex] = length;
          const convert = point => structure.cellMatrix ? F.CIFStructure.cartesian(
            point.map((value, axis) => value / structure.cellLengthsAngstrom[axis]), structure.cellMatrix) : point;
          rod(convert(start), convert(end), "cell-edge-" + axisIndex + u + v,
            frameMaterial, 0.035);
        }));
      });
    }
    if (structure.mode !== "cell") {
      structure.bonds.forEach(bond => {
        const start = structure.atoms[bond.a].positionAngstrom;
        const end = structure.atoms[bond.b].positionAngstrom;
        const midpoint = start.map((value, axis) => (value + end[axis]) / 2);
        rod(start, midpoint, bond.id + "-a", bondMaterial, 0.10, bond,
          atomMaterials.get(structure.atoms[bond.a].element));
        rod(midpoint, end, bond.id + "-b", bondMaterial, 0.10, bond,
          atomMaterials.get(structure.atoms[bond.b].element));
      });
    }

    (structure.polyhedra || []).forEach(environment => {
      const points = environment.neighbors.map(index => structure.atoms[index].positionAngstrom);
      const triangles = polyhedronTriangles(points);
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(
        triangles.flatMap(triangle => triangle.flatMap(index => points[index])), 3));
      geometry.computeVertexNormals();
      const material = new T.MeshStandardMaterial({
        color: elements[structure.atoms[environment.center].element].color,
        transparent: true, opacity: 0.20, side: T.DoubleSide, depthWrite: false,
        roughness: 0.65, metalness: 0
      });
      const mesh = new T.Mesh(geometry, material);
      mesh.name = "coordination-polyhedron-" + structure.atoms[environment.center].id;
      mesh.userData.fkcPolyhedron = environment;
      mesh.visible = false;
      mesh.raycast = function () {}; // Flächen blockieren weder Atome noch Bindungen.
      group.add(mesh);
      polyhedronGeometries.push(geometry);
      polyhedronMaterials.push(material);
    });
    const dashes = hydrogenContactDashes(structure);
    let contactLines;
    if (dashes.length) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(dashes.flat(2), 3));
      contactLines = new T.LineSegments(geometry, new T.LineBasicMaterial({color: "#df2525"}));
      contactLines.userData.fkcHydrogenContacts = true;
      contactLines.visible = false;
      contactLines.raycast = function () {};
      group.add(contactLines);
    }
    return {
      group,
      dispose: function () {
        if (contactLines) {
          contactLines.geometry.dispose();
          contactLines.material.dispose();
        }
        const environment = group.userData.fkcEnvironment;
        if (environment) for (const record of environment.records.values()) {
          record.materials.forEach(material => material.dispose());
          record.built.dispose();
        }
        polyhedronGeometries.forEach(geometry => geometry.dispose());
        polyhedronMaterials.forEach(material => material.dispose());
        sphere.dispose();
        cylinder.dispose();
        atomMaterials.forEach(material => material.dispose());
        bondMaterial.dispose();
        frameMaterial.dispose();
      }
    };
  }

  /*
   * Gemeinsamer Einstieg für bisherige GLBs und neue CIFs.
   */
  F.loadModelVisual = function (visual, source, mode = "molecule") {
    if (/\.cif(?:[?#].*)?$/i.test(source)) {
      visual.setAttribute("fkc-cif-model", {src: source, mode});
    } else {
      visual.setAttribute("gltf-model", "url(" + source + ")");
    }
  };

  AFRAME.registerComponent("fkc-cif-model", {
    schema: {
      src: {type: "string", default: ""},
      mode: {type: "string", default: "molecule"}
    },

    init: function () {
      this.requestId = 0;
      this.abortController = null;
      this.built = null;
    },

    update: function () {
      this.load();
    },

    load: async function () {
      const requestId = ++this.requestId;

      if (this.abortController) this.abortController.abort();
      this.abortController = new AbortController();

      if (this.built) {
        this.el.removeObject3D("mesh");
        this.built.dispose();
        this.built = null;
      }

      this.el.fkcStructure = null;

      if (!this.data.src) return;

      try {
        const response = await fetch(this.data.src, {
          signal: this.abortController.signal
        });

        if (!response.ok) {
          fail("Datei konnte nicht geladen werden: HTTP " + response.status);
        }

        const source = await response.text();

        if (requestId !== this.requestId || !this.el.isConnected) return;

        const structure = createStructure(source, this.data.mode);
        const built = buildMesh(structure);
        const root = this.el.closest(".interactable");
        built.group.userData.fkcBondColorMode = root && root.fkcBondColorMode || "auto";
        built.group.userData.fkcBondColor = root && root.fkcBondColor || "#949494";
        built.group.userData.fkcBondThickness = root && root.fkcBondThickness || 1;
        built.group.userData.fkcHideHydrogen = root && root.fkcHideHydrogen;
        built.group.userData.fkcShowHydrogenContacts = root && root.fkcShowHydrogenContacts;
        built.group.userData.fkcAtomScale = root && root.fkcAtomScale || 1;
        applyStyle(built.group, (root && root.fkcStyle) || "ball-stick");

        this.built = built;
        this.el.fkcStructure = structure;
        this.el.setObject3D("mesh", built.group);

        /*
         * Vorhandene Normalisierung und Variantenpipeline nutzen.
         */
        this.el.emit("model-loaded", {
          format: "cif",
          model: built.group
        });

        if (F.invalidateHits) F.invalidateHits();

        console.info(
          "CIF: Struktur aufgebaut:",
          {
            atomsInCell: structure.cellAtomCount,
            mode: structure.mode,
            moleculesInCell: structure.moleculeCount,
            atomsInModel: structure.atoms.length,
            bondsInModel: structure.bonds.length,
            chosenCenterFractional: structure.chosenCenterFractional,
            moleculeCentersFractional: structure.moleculeCentersFractional,
            bondRangeAngstrom: structure.bonds.length ? [
              Math.min(...structure.bonds.map(b => b.distanceAngstrom)),
              Math.max(...structure.bonds.map(b => b.distanceAngstrom))
            ] : null
          }
        );

        F.setStatus(structure.kind === "nacl" ? "NaCl-Modell aufgebaut: " + structure.atoms.length + " Ionen." :
          "CIF-Modell aufgebaut: " + structure.atoms.length + " Atome und " + structure.bonds.length + " Bindungen.");
      } catch (error) {
        if (
          requestId !== this.requestId ||
          error.name === "AbortError" ||
          !this.el.isConnected
        ) return;

        console.error("CIF-C60-1: Import fehlgeschlagen.", error);

        F.setStatus("CIF-Modell nicht geladen: " + error.message);

        this.el.emit("model-error", {
          format: "cif",
          src: this.data.src,
          error
        });
      }
    },

    remove: function () {
      this.requestId++;

      if (this.abortController) this.abortController.abort();

      this.el.removeObject3D("mesh");

      if (this.built) this.built.dispose();

      this.built = null;
      this.el.fkcStructure = null;

      if (F.invalidateHits) F.invalidateHits();
    }
  });

  console.info(
    "FKC-VR CIF-C60-1 geladen: begrenzter CIF-Import für den C60-Test."
  );
})(window.FKCVR);
