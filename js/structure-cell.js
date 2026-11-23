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
    const operations = symmetry?.rows.map(row=>row._symmetry_equiv_pos_as_xyz || row._space_group_symop_operation_xyz) || [];
    return {kind: "positions", name: "CIF-Zellpositionen", mode: "cell", atoms, bonds: [], bondSegments: [], operations,
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
      return {...atom, id: imageId(atom, cellShift), sourceSiteId:atom.id, siteIndex, cellShift, fractional,
          cellWeight: 1 / (xs.length * ys.length * zs.length),
          positionAngstrom: F.CIFStructure.cartesian(fractional, cell.cellMatrix)};
      })));
    }).map((atom, index) => ({...atom, modelNumber: index + 1}));
  }

  // Strukturregeln liefern die Kanten; die Suche kennt keine Elementsymbole.
  function expandContacts(cell, contacts, seeds, depth, origin = [0, 0, 0], limit = 256) {
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
          if (atoms.length >= limit) throw new Error("Zu viele Positionen für die Kontakterweiterung.");
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

  function network(cell, rules) {
    const edges = new Map();
    cell.atoms.forEach((atom, a) => {
      for (const [center, ligand, cutoff, label] of rules) {
        if (atom.element !== center || (label && atom.cifLabel !== label)) continue;
        for (const edge of neighbors(cell,a,cutoff,site=>site.element===ligand)) {
          const forward = `${a}:${edge.b}:${edge.cellShift.join(",")}`;
          const reverse = `${edge.b}:${a}:${edge.cellShift.map(n=>-n).join(",")}`;
          const id = [forward,reverse].sort()[0];
          if (!edges.has(id)) edges.set(id,{...edge,id});
        }
      }
    });
    return {...cell,bonds:[...edges.values()]};
  }

  function expandable(base, cell, origin = [0,0,0]) {
    if (!cell.bonds.length) return base;
    const atoms = base.atoms.map(atom=>{
      const siteIndex = cell.atoms.findIndex(site=>site.id===(atom.sourceSiteId || atom.id));
      if(siteIndex<0)throw new Error("Basisplatz für die Kontakterweiterung fehlt.");
      return {...atom,siteIndex,cellShift:atom.cellShift || [0,0,0]};
    });
    return {...base,atoms,contactExpansion:{cell,bonds:cell.bonds,origin,limit:600},contactDepth:0};
  }

  function excerpt(cell, copperPair) {
    const radii={H:0.31,C:0.76,O:0.66};
    const bonds=[];
    cell.atoms.forEach((a,i)=>cell.atoms.slice(i+1).forEach((b,j)=>{
      const pair=[a.element,b.element].sort().join(":");
      const cutoff=pair==="Cu:Cu" ? (copperPair ? 2.8 : 0) : pair==="Cu:O" ? 2.4 :
        radii[a.element] && radii[b.element] && pair!=="H:H" ? radii[a.element]+radii[b.element]+0.22 : 0;
      const distanceAngstrom=Math.hypot(...a.positionAngstrom.map((n,k)=>n-b.positionAngstrom[k]));
      if(distanceAngstrom>0.55 && distanceAngstrom<=cutoff) bonds.push({id:`excerpt-${i}-${i+j+1}`,a:i,b:i+j+1,cellShift:[0,0,0],distanceAngstrom});
    }));
    return {...cell,mode:"sites",bonds,measurePositions:true};
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
    const donors=new Map(), protonated=new Set();
    for(const bond of bonds) {
      const {a,b,deltaFractional:delta}=bond;
      const h=atoms[a].element==="H"?a:atoms[b].element==="H"?b:-1;
      if(h<0)continue;
      const d=h===a?b:a;
      if(!["N","O"].includes(atoms[d].element))continue;
      protonated.add(d);
      if(!donors.has(h))donors.set(h,{d,vector:F.CIFStructure.cartesian(h===a?delta:delta.map(n=>-n),cell.cellMatrix)});
    }
    const hydrogenContacts=[];
    for(const [h,{d,vector}] of donors) {
      for(const edge of neighbors(cell,h,2.6,atom=>["N","O"].includes(atom.element))) {
        if(edge.distanceAngstrom<1.4 || (atoms[edge.b].element==="N" && protonated.has(edge.b)))continue;
        const direction=F.CIFStructure.cartesian(edge.deltaFractional,cell.cellMatrix);
        const cosine=vector.reduce((sum,v,i)=>sum+v*direction[i],0)/(Math.hypot(...vector)*edge.distanceAngstrom);
        if(cosine> -0.5 || Math.hypot(...direction.map((n,i)=>n-vector[i]))>3.5)continue;
        hydrogenContacts.push({...edge,donorLabel:atoms[d].cifLabel, hydrogenLabel:atoms[h].cifLabel,
          acceptorLabel:atoms[edge.b].cifLabel,inferred:true});
      }
    }
    return {...cell,bonds,hydrogenContacts,measurePositions:true};
  }

  function molecule(cell) {
    const template = F.CIFStructure.cellComponents(cell).sort((a,b)=>b.states.length-a.states.length)[0];
    return {...cell, mode:"molecule", environmentCell:cell,originAngstrom:[0,0,0],hydrogenContacts:[],bonds:template.bonds, atoms:template.states.map(({index,shift},i)=>{
      const site=cell.atoms[index];
      const fractional=site.fractional.map((v,j)=>v+shift[j]);
      return {...site,fractional,modelNumber:i+1,positionAngstrom:F.CIFStructure.cartesian(fractional,cell.cellMatrix)};
    })};
  }

  function independentMolecules(cell) {
    const seen = new Set(), atoms=[], bonds=[];
    for(const part of F.CIFStructure.cellComponents(cell)){
      const sites=part.states.map(({index,shift})=>{
        const atom=cell.atoms[index], fractional=atom.fractional.map((v,i)=>v+shift[i]);
        return {...atom,fractional,positionAngstrom:F.CIFStructure.cartesian(fractional,cell.cellMatrix)};
      });
      const signatures=cell.operations.map(operation=>sites.map(atom=>atom.element+":"+
        F.CIFStructure.symmetryPoint(atom.fractional,operation).map(v=>((Math.round(v*1e6)%1e6+1e6)%1e6)).join(",")).sort().join(";")).sort();
      const key=signatures[0];
      if(seen.has(key))continue;
      seen.add(key);
      const offset=atoms.length;
      atoms.push(...sites.map((atom,i)=>({...atom,modelNumber:offset+i+1})));
      bonds.push(...part.bonds.map(b=>({...b,a:b.a+offset,b:b.b+offset})));
    }
    return {...cell,mode:"molecule",atoms,bonds,hydrogenContacts:[],environmentCell:cell,originAngstrom:[0,0,0],independentCount:seen.size};
  }

  function supercell(cell, repeats) {
    const atoms=[], copies=new Map();
    const key=(site,shift)=>`${site}:${shift.join(",")}`;
    for(let x=0;x<repeats[0];x++)for(let y=0;y<repeats[1];y++)for(let z=0;z<repeats[2];z++){
      cell.atoms.forEach((atom,i)=>{
        const shift=[x,y,z], fractional=atom.fractional.map((v,a)=>v+shift[a]);
        copies.set(key(i,shift),atoms.length);
        atoms.push({...atom,id:imageId(atom,shift),cellShift:shift,siteIndex:i,modelNumber:atoms.length+1,
          fractional:fractional.map((v,a)=>v/repeats[a]),positionAngstrom:F.CIFStructure.cartesian(fractional,cell.cellMatrix)});
      });
    }
    const copyEdges=edges=>edges.flatMap(edge=>atoms.flatMap((atom,a)=>{
      if(atom.siteIndex!==edge.a)return [];
      const shift=edge.deltaFractional.map((v,i)=>Math.round(v+cell.atoms[edge.a].fractional[i]-cell.atoms[edge.b].fractional[i])+atom.cellShift[i]);
      const b=copies.get(key(edge.b,shift));
      return b===undefined ? [] : [{...edge,a,b,id:`${edge.id || "contact"}:${a}:${b}`,
        deltaFractional:edge.deltaFractional.map((v,i)=>v/repeats[i])}];
    }));
    return {...cell,mode:"cell-complete",atoms,bonds:copyEdges(cell.bonds),hydrogenContacts:copyEdges(cell.hydrogenContacts),
      cellAtomCount:atoms.length,cellMatrix:cell.cellMatrix.map((v,i)=>v.map(n=>n*repeats[i])),
      cellLengthsAngstrom:cell.cellLengthsAngstrom.map((v,i)=>v*repeats[i]),showHydrogenByDefault:true};
  }

  function coordination(cell, centerElement, ligandElement, cutoff, count, centerLabel) {
    const center = cell.atoms.findIndex(a=>a.element===centerElement && (!centerLabel || a.cifLabel===centerLabel));
    if(center<0) throw new Error("Koordinationszentrum nicht in der CIF gefunden.");
    const contacts=neighbors(cell,center,cutoff,a=>a.element===ligandElement);
    if(contacts.length!==count) throw new Error("Erwartete Koordinationsschale nicht vollständig.");
    const origin=cell.atoms[center];
    const atoms=[{...origin, id:"center",sourceSiteId:origin.id,modelNumber:1,positionAngstrom:[0,0,0]}, ...contacts.map((edge,i)=>({
      ...cell.atoms[edge.b],sourceSiteId:cell.atoms[edge.b].id,cellShift:edge.cellShift,id:imageId(cell.atoms[edge.b],edge.cellShift),modelNumber:i+2,
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

  F.StructureCell = {read, imageId, closedImages, expandContacts, network, expandable, excerpt, molecularCell, molecule, independentMolecules, supercell, coordination, occupiedSites};
})(window.FKCVR);