"use strict";

(function(F){
  const poreRadius = 11.5;
  function build(source, mode) {
    if (!/^[\t ]*data_FIQCEN[\t \r]*$/im.test(source)) throw new Error("HKUST-1-Gerüst benötigt den geprüften FIQCEN-Export.");
    const S=F.StructureCell;
    // O2 bildet die Carboxylatgruppen. O1 ist der axiale O-Platz, O3 ein
    // zusätzlicher O-Platz ohne eindeutige Gastbesetzung im Export.
    const axial=mode==="axial" || mode==="node";
    const labels=new Set(["Cu1","O2","C1","C2","C3","H1",...(axial?["O1"]:[])]);
    const cell=S.network(S.read(source,{labels,mergeTolerance:0.005,maxPositions:800}),[
      ["Cu","Cu",2.8],["Cu","O",2.3],["C","C",1.7],["C","O",1.5],["C","H",1.25]
    ]);
    const expected={Cu1:[48,axial?"CuOOOOO":"CuOOOO"],O2:[192,"CCu"],C1:[96,"CCC"],C2:[96,"COO"],C3:[96,"CCH"],H1:[96,"C"]};
    if(axial)expected.O1=[48,"Cu"];
    const adjacency=cell.atoms.map(()=>[]);
    for(const bond of cell.bonds){adjacency[bond.a].push(cell.atoms[bond.b].element);adjacency[bond.b].push(cell.atoms[bond.a].element);}
    for(const [label,[count,neighbors]] of Object.entries(expected)){
      const indices=cell.atoms.flatMap((atom,i)=>atom.cifLabel===label?[i]:[]);
      if(indices.length!==count || indices.some(i=>adjacency[i].sort().join("")!==neighbors)){
        throw new Error(`HKUST-1: Gerüstprüfung für ${label} fehlgeschlagen.`);
      }
    }
    if(mode==="node"){
      const siteIndex=cell.atoms.findIndex(atom=>atom.element==="Cu");
      const center=cell.atoms[siteIndex];
      const origin=center.fractional;
      const seed={...center,siteIndex,cellShift:[0,0,0],positionAngstrom:[0,0,0],modelNumber:1};
      const core=S.expandContacts(cell,cell.bonds,[seed],1,origin,1400);
      return {...cell,...core,mode:"sites",name:"HKUST-1 · Cu-Knoten",measurePositions:true,
        contactDepth:0,contactExpansion:{cell,bonds:cell.bonds,origin,limit:1400}};
    }
    if(mode==="pore"){
      // Die große Kavität liegt um (0,0,0). Kopien aus angrenzenden Zellen
      // ergeben ihre Wand auf allen Seiten, statt sie am Ursprung abzuschneiden.
      const seeds=[];
      for(let x=-1;x<=0;x++)for(let y=-1;y<=0;y++)for(let z=-1;z<=0;z++){
        const cellShift=[x,y,z];
        cell.atoms.forEach((atom,siteIndex)=>{
          const fractional=atom.fractional.map((v,i)=>v+cellShift[i]);
          const positionAngstrom=F.CIFStructure.cartesian(fractional,cell.cellMatrix);
          if(Math.hypot(...positionAngstrom)<=poreRadius)seeds.push({...atom,siteIndex,cellShift,fractional,positionAngstrom,
            id:S.imageId(atom,cellShift),modelNumber:seeds.length+1});
        });
      }
      // Eine zusätzliche Schale vervollständigt die direkten Nachbarn am Schnittrand.
      const core=S.expandContacts(cell,cell.bonds,seeds,1,[0,0,0],1400);
      return {...cell,...core,mode:"sites",name:"HKUST-1 · Große Pore",measurePositions:true,
        contactDepth:0,contactExpansion:{cell,bonds:cell.bonds,origin:[0,0,0],limit:1400}};
    }
    if(mode!=="cell" && !axial)throw new Error("Unbekannte HKUST-1-Ansicht.");
    const result=S.expandable({...cell,atoms:S.closedImages(cell),name:axial ? "HKUST-1 · Axiale O-Plätze" : "HKUST-1 · Gerüstzelle",
      measurePositions:true},cell);
    result.contactExpansion.limit=1800;
    return F.CIF.contactStructure(result,0);
  }

  F.HKUSTStructure={build};
})(window.FKCVR);