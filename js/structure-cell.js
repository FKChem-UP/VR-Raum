"use strict";

(function (F) {
  function read(source, {explicit = false, maxPositions = 512} = {}) {
    const {parse, numeric, cellMatrix, cartesian, symmetryPoint} = F.CIFStructure;
    const {values, loops} = parse(source);
    const lengths = ["a", "b", "c"].map(axis => numeric(values["_cell_length_" + axis]));
    const angles = ["alpha", "beta", "gamma"].map(axis => numeric(values["_cell_angle_" + axis]));
    const matrix = cellMatrix(lengths, angles);
    const sites = loops.find(loop => loop.names.includes("_atom_site_fract_x"));
    const symmetry = loops.find(loop => loop.names.includes("_symmetry_equiv_pos_as_xyz") ||
      loop.names.includes("_space_group_symop_operation_xyz"));
    if (!sites?.rows.length || (!explicit && !symmetry?.rows.length)) throw new Error("Atompositionen oder Symmetrie fehlen.");
    const wrap = n => { const x = n - Math.floor(n); return x > 1 - 1e-7 ? 0 : x; };
    const atoms = [];
    for (const site of sites.rows) {
      const label = site._atom_site_label;
      const element = /^([A-Z][a-z]?)(?:\d*[+-])?$/.exec(site._atom_site_type_symbol)?.[1];
      const occupancy = numeric(site._atom_site_occupancy ?? "1");
      if (!label || !element || occupancy <= 0 || occupancy > 1) throw new Error("Ungültige Atomposition in der CIF.");
      const position = ["x", "y", "z"].map(axis => numeric(site["_atom_site_fract_" + axis]));
      const images = [];
      for (const row of explicit ? [{_space_group_symop_operation_xyz:"x,y,z"}] : symmetry.rows) {
        const operation = row._symmetry_equiv_pos_as_xyz || row._space_group_symop_operation_xyz;
        const point = symmetryPoint(position, operation);
        if (point.length !== 3) throw new Error("Ungültige Symmetrieoperation.");
        const fractional = explicit ? point : point.map(wrap);
        if (images.some(other => other.every((value, axis) => {
          const difference = Math.abs(value - fractional[axis]);
          return Math.min(difference, 1 - difference) < 1e-7;
        }))) continue;
        images.push(fractional);
        const modelNumber = atoms.length + 1;
        if (modelNumber > maxPositions) throw new Error("Zu viele Positionen für die Zellansicht.");
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

  // Periodische Kanten verwenden explizite Zellbilder, nicht die Distanz
  // zwischen den in die Basiszelle zurückgefalteten Positionen.
  function neighbors(cell, a, cutoff, accepts) {
    const origin = cell.atoms[a];
    const found = [];
    cell.atoms.forEach((site, b) => {
      if (!accepts(site)) return;
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        const cellShift = [x, y, z];
        const deltaFractional = site.fractional.map((v, i) => v + cellShift[i] - origin.fractional[i]);
        const distanceAngstrom = Math.hypot(...F.CIFStructure.cartesian(deltaFractional, cell.cellMatrix));
        if (distanceAngstrom > 0.3 && distanceAngstrom <= cutoff) found.push({a,b,cellShift,deltaFractional,distanceAngstrom});
      }
    });
    return found.sort((a,b)=>a.distanceAngstrom-b.distanceAngstrom);
  }

  function molecularCell(cell) {
    const radii = {H:0.31,C:0.76,N:0.71,O:0.66,S:1.05};
    if (cell.atoms.some(a=>!(a.element in radii) || a.occupancy !== 1)) throw new Error("Geometrische Molekülrekonstruktion nicht für diese Besetzung oder Elemente verfügbar.");
    const seen = new Set();
    const atoms = cell.atoms.filter(atom=>{
      const key=atom.element+":"+atom.fractional.map(v=>Math.round(v*1e7)).join(",");
      if(seen.has(key))return false; seen.add(key); return true;
    });
    cell={...cell,atoms,cellAtomCount:atoms.length};
    const bonds = cell.atoms.flatMap((atom,a)=>neighbors(cell,a,2.35,site=>atom.element!=="H" || site.element!=="H")
      .filter(bond=>bond.b>a && bond.distanceAngstrom <= radii[atom.element]+radii[cell.atoms[bond.b].element]+0.22)
      .map(bond=>({...bond,id:`bond-${a}-${bond.b}-${bond.cellShift.join("_")}`})));
    if (!bonds.length) throw new Error("Keine geometrisch plausiblen Molekülbindungen gefunden.");
    return {...cell,bonds,measurePositions:true};
  }

  function molecule(cell) {
    const template = F.CIFStructure.cellComponents(cell).sort((a,b)=>b.states.length-a.states.length)[0];
    return {...cell, mode:"molecule", bonds:template.bonds, atoms:template.states.map(({index,shift},i)=>{
      const site=cell.atoms[index];
      const fractional=site.fractional.map((v,j)=>v+shift[j]);
      return {...site,fractional,modelNumber:i+1,positionAngstrom:F.CIFStructure.cartesian(fractional,cell.cellMatrix)};
    })};
  }

  function coordination(cell, centerElement, ligandElement, cutoff, count, centerLabel) {
    const center = cell.atoms.findIndex(a=>a.element===centerElement && (!centerLabel || a.cifLabel===centerLabel));
    if(center<0) throw new Error("Koordinationszentrum nicht in der CIF gefunden.");
    const contacts=neighbors(cell,center,cutoff,a=>a.element===ligandElement);
    if(contacts.length!==count) throw new Error("Erwartete Koordinationsschale nicht vollständig.");
    const origin=cell.atoms[center];
    const atoms=[{...origin, id:"center",modelNumber:1,positionAngstrom:[0,0,0]}, ...contacts.map((edge,i)=>({
      ...cell.atoms[edge.b],id:imageId(cell.atoms[edge.b],edge.cellShift),modelNumber:i+2,
      positionAngstrom:F.CIFStructure.cartesian(edge.deltaFractional,cell.cellMatrix)
    }))];
    const indexes = contacts.map((_,i)=>i+1);
    let polyhedra = [];
    if(count>=4 && count<=12) {
      try {
        F.CIF.polyhedronTriangles(indexes.map(i=>atoms[i].positionAngstrom));
        polyhedra = [{center:0,neighbors:indexes}];
      } catch (error) {
        if(error.message !== "Entartetes Koordinationspolyeder.")throw error;
        // Eine planare Schale ist messbar, aber kein räumliches Polyeder.
      }
    }
    return {...cell,mode:"coordination",atoms,bonds:contacts.map((edge,i)=>({id:`contact-${i}`,a:0,b:i+1,
      distanceAngstrom:edge.distanceAngstrom})),polyhedra};
  }

  function occupiedSites(cell) {
    const groups=new Map();
    for(const atom of cell.atoms){
      const key=atom.fractional.map(v=>Math.round(v*1e7)).join(",");
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(atom);
    }
    const atoms=[...groups.values()].map(entries=>{
      if(entries.length===1){
        const atom=entries[0];
        return atom.occupancy===1 ? atom : {...atom,displayLabel:`${atom.cifLabel} · ${Math.round(atom.occupancy*100)} %`};
      }
      const occupancy=entries.reduce((sum,a)=>sum+a.occupancy,0);
      if(occupancy>1.00001)throw new Error("Überlagerte Plätze besitzen zusammen mehr als 100 % Besetzung.");
      return {...entries[0],occupancy,siteOccupants:entries.map(a=>({element:a.element,occupancy:a.occupancy})),
        displayLabel:entries.map(a=>`${a.element} ${Math.round(100*a.occupancy)} %`).concat(
          occupancy < 0.99999 ? [`leer ${Math.round(100*(1-occupancy))} %`] : []).join(" / ")};
    });
    return {...cell,atoms,cellAtomCount:atoms.length,measurePositions:true};
  }

  F.StructureCell = {read, imageId, closedImages, expandContacts, molecularCell, molecule, coordination, occupiedSites};
})(window.FKCVR);