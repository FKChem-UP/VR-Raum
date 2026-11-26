"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,".."), F={}, components={};
const context={window:{FKCVR:F},document:{createElement:()=>({getContext:()=>ctx,toDataURL:()=>"data:"})},
  AFRAME:{THREE:{Vector3:class {},CanvasTexture:class {},PlaneGeometry:class {},MeshBasicMaterial:class {},Mesh:class {}},
    registerComponent(name,definition){components[name]=definition;}}};
for(const file of ["cif-structure","structure-cell","cif-model","ybco-lesson","rooms"])
  vm.runInNewContext(fs.readFileSync(path.join(root,"js",file+".js"),"utf8"),context);
const lesson=F.YbcoLesson;
const read=record=>F.CIF.createStructure(fs.readFileSync(path.join(root,record.model),"utf8"),record.cifMode);
const get=(step,option=0,group=1,index=0,settings)=>read(lesson.models(step,option,group,settings)[index]);
assert.equal(lesson.steps.length,12);
for(const [step,entry] of lesson.steps.entries())for(const option of (entry[3].length?entry[3]:[null]).keys()){
  const records=lesson.models(step,option,1);
  assert.equal(records.length,step===0 || step===4?2:1);
  for(const record of records){
    const s=read(record);
    assert.ok(s.atoms.length && s.measurePositions,record.title);
    assert.ok(s.atoms.every(a=>F.CIF.elements[a.element] && a.positionAngstrom.every(Number.isFinite)));
    for(const bond of s.bonds){
      const a=s.atoms[bond.a], b=s.atoms[bond.b];
      const distance=Math.hypot(...a.positionAngstrom.map((v,i)=>v-b.positionAngstrom[i]));
      assert.ok(Math.abs(distance-bond.distanceAngstrom)<1e-8,record.title);
    }
  }
}
const fractionalCount=(s,el)=>s.atoms.filter(a=>a.element===el).reduce((sum,a)=>sum+a.cellWeight*a.occupancy,0);
for(const [el,total] of [["Y",1],["Ba",2],["Cu",3],["O",6.91]])assert.ok(Math.abs(fractionalCount(get(3),el)-total)<1e-9);
const perov=get(4,0,1,1);
for(const [el,total] of [["Ca",1],["Ti",1],["O",3]])assert.equal(fractionalCount(perov,el),total);
assert.equal(get(1,3).lessonOverlay.arg,"F");
assert.deepEqual(["cell","P","I","F"].map(mode=>lesson.centeringPoints(mode).length),[0,8,9,14]);
assert.equal(lesson.centeringPoints("F").filter(p=>p.filter(v=>v===.5).length===2).length,6);
assert.equal(lesson.mirrorStroke({x:620,y:234},{x:620,y:384}),0);
assert.equal(lesson.mirrorStroke({x:545,y:309},{x:695,y:309}),1);
assert.equal(lesson.mirrorStroke({x:782,y:309},{x:932,y:309}),2);
assert.equal(lesson.mirrorStroke({x:545,y:239},{x:548,y:242}),null);
for(const [g,total] of [[1,4],[2,6],[3,8],[4,10]])assert.equal(get(6,0,g).bonds.length,total);
assert.deepEqual(Array.from(get(6,1).distanceGroups,g=>[g.count,Number(g.distance.toFixed(3))]),[[4,2.744],[2,2.877],[2,2.957],[2,2.991]]);
assert.ok(get(7).atoms.some(a=>a.element==="Ba"));
assert.equal(get(8).bonds.length,4);assert.equal(get(8,1).bonds.length,2);
assert.equal(get(9).bonds.length,5);
assert.equal(new Set(get(11).atoms.map(a=>a.fractional[0])).size,1);
assert.equal(new Set(get(11,1).atoms.filter(a=>a.cifLabel==="Cu2").map(a=>a.fractional[2])).size,1);
const network=get(11,2,1,0,{cell:true});
assert.equal(network.mode,"cell-complete");
assert.ok(network.bonds.some(b=>network.atoms[b.a].fractional.some(v=>v<0 || v>1)));
assert.equal(new Set(network.atoms.filter(a=>a.cifLabel==="Cu2").map(a=>a.fractional[2])).size,2);
const shells=get(10,0,1,0,{sites:lesson.steps[10][3]});
assert.ok(shells.polyhedra.length>=5 && shells.bonds.length>10);
for(const b of shells.bonds){const a=shells.atoms[b.a],c=shells.atoms[b.b];
  assert.ok(Math.abs(Math.hypot(...a.positionAngstrom.map((v,i)=>v-c.positionAngstrom[i]))-b.distanceAngstrom)<1e-8);}
const study=(id,option=0,index=0)=>get(id==="oxygen" || id==="bragg"?0:11,0,1,index,{investigation:id,studyOption:option});
assert.equal(study("oxygen").lessonApical,"O4");
assert.equal(study("oxygen",0,1).lessonApical,"O1");
for(const [phase,expected] of [[0,[163.9,165.0]],[1,[166.9,166.9]]]){
  const layer=study("buckling",phase);
  assert.equal(layer.bonds.length,8);
  assert.deepEqual(Array.from(layer.lessonValues,a=>Number(a.toFixed(1))),expected);
}
const layers=study("bilayer",1);
assert.ok(layers.atoms.some(a=>a.cifLabel==="Y1"));
assert.equal(new Set(layers.atoms.filter(a=>a.cifLabel==="Cu2").map(a=>a.fractional[2])).size,4);
assert.ok(Math.abs(layers.lessonValues[0]+layers.lessonValues[1]-layers.lessonValues[2])<1e-10);
const braggA=study("bragg",2).lessonValues, braggB=study("bragg",2,1).lessonValues;
assert.ok(braggA[1]>braggA[3]);assert.equal(braggB[1],braggB[3]);
const teamA=F.rooms.find(room=>room.id==="team-a");
assert.equal(teamA.entrances.length,5);
assert.equal(new Set(teamA.entrances.map(([id])=>id)).size,5);
for(const [id] of teamA.entrances)assert.ok(F.rooms.some(room=>room.id===id));
assert.ok(F.rooms.find(room=>room.id==="versuch-nicotinamid").stations[0].model.endsWith("NICOAM05.cif"));
const texts=[];
const ctx={fillRect(){},fillText(label){texts.push(label);},measureText(label){return {width:label.length*14};}};
const board=Object.assign({step:0,option:0,group:1,texture:{},canvas:{getContext:()=>ctx}},components["fkc-ybco-lesson"]);
board.show=()=>board.render();
const click=(x,y)=>board.click({x:x/1024,y:1-y/700});
board.render();click(600,650);assert.equal(board.step,1);
click(820,565);assert.equal(board.contents,true);
click(180,96+3*83+20);assert.equal(board.step,6);
board.groups=4;click(140,230);assert.equal(board.group,2);
click(180,565);assert.equal(board.analysis,true);
assert.ok(texts.some(t=>t.includes("4 + 2 + 2 + 2")));
board.stepTo(0);
board.click({x:600/1024,y:1-650/700},{xr:true,now:1000});
board.click({x:600/1024,y:1-650/700},{xr:true,now:1020});
assert.equal(board.step,1,"Doppeltes Eingabeereignis überspringt keine Aufgabe");
board.click({x:600/1024,y:1-650/700},{xr:true,now:1700});
assert.equal(board.step,2);
board.click({x:620/1024,y:1-234/700},{xr:true,now:2400});
board.sampleStroke({x:620/1024,y:1-384/700},true);board.sampleStroke(null,false);
assert.equal(board.mirrors.join(","),"0");

const stations=[], pedestals=[], allModels=[];
F.releaseModel=()=>{};
F.create=(tag,attributes)=>{
  if(tag==="a-box" && attributes.height===.84)pedestals.push(attributes);
  return {dataset:{},setObject3D(){},setAttribute(name){if(name==="fkc-ybco-lesson")stations.push(this);}};
};
const config=F.rooms.find(room=>room.kind==="ybco-lesson");
const layout=lesson.build({},config,(_parent,record,index)=>{
  const node={record,index,object3D:{rotation:{}},querySelector:()=>({addEventListener(){}}),remove(){this.removed=true;}};
  allModels.push(node);return node;
},()=>{},()=>{});
assert.equal(stations.length,13);
assert.equal(pedestals.length,15,"Zentrales Podest, zehn Einzel- und zwei Doppelstationen");
assert.ok(!layout.isWalkable(0,-3.65) && layout.isWalkable(-5.7,-3.65) && layout.isWalkable(5.7,-3.65));
const boards=stations.map(el=>{const b=Object.assign({el},components["fkc-ybco-lesson"]);b.init();return b;});
const [main]=boards;
const center=boards[2], comparison=boards[5], ba=boards[7];
assert.equal(allModels.length,2,"Beim Öffnen nur der geführte Phasenvergleich");
const press=(b,x,y)=>b.click({x:x/1024,y:1-y/700});
press(boards[1],600,345);
press(boards[1],460,575);press(boards[1],150,330);
assert.equal(boards[1].investigation,"oxygen");
assert.equal(boards[1].roots.length,2);
assert.ok(main.roots.every(m=>!m.removed));
press(boards[1],260,655);
assert.equal(boards[1].investigation,null);
const last=boards.at(-1);
press(last,600,345);press(last,460,575);press(last,620,330);
assert.equal(last.investigation,"bilayer");assert.equal(last.roots.length,1);
press(last,250,655);assert.equal(last.step,11);
press(center,600,345);
assert.equal(center.roots.length,1);
const prior=center.roots[0];
press(comparison,600,345);
assert.ok(prior.removed && !center.roots.length);
assert.equal(comparison.roots.length,2);
const compareRoots=comparison.roots.slice();
press(ba,600,345);
assert.ok(compareRoots.every(m=>m.removed));
assert.equal(ba.step,6);
press(ba,500,650);
assert.equal(ba.roots.length,0);
assert.equal(main.step,0);
assert.ok(main.roots.every(m=>!m.removed),"Übungswechsel lässt die Lehrmodelle stehen");
const remaining=allModels.filter(m=>!m.removed);
assert.equal(new Set(remaining.map(m=>m.index)).size,remaining.length);
console.log("YBCO: zwölf Lehrschritte, Tafelnavigation, Spiegelstriche und unabhängige Übungen geprüft.");