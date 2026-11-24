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
const get=(step,option=0,group=1,index=0)=>read(lesson.models(step,option,group)[index]);
assert.equal(lesson.steps.length,11);
for(const [step,entry] of lesson.steps.entries())for(const option of entry[3].keys()){
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
for(const [el,total] of [["Y",1],["Ba",2],["Cu",3],["O",6.91]])assert.ok(Math.abs(fractionalCount(get(3,4),el)-total)<1e-9);
const perov=get(4,1,1,1);
for(const [el,total] of [["Ca",3],["Ti",3],["O",9]])assert.equal(fractionalCount(perov,el),total);
assert.ok(get(1,3).atoms.length<get(1).atoms.length);
for(const [g,total] of [[1,4],[2,6],[3,8],[4,10]])assert.equal(get(6,0,g).bonds.length,total);
assert.deepEqual(Array.from(get(6,1).distanceGroups,g=>[g.count,Number(g.distance.toFixed(3))]),[[4,2.744],[2,2.877],[2,2.957],[2,2.991]]);
assert.equal(get(7).bonds.length,4);assert.equal(get(7,1).bonds.length,2);
assert.equal(get(8).bonds.length,5);
assert.ok(get(9).atoms.some(a=>a.element==="Ba"));
assert.equal(new Set(get(10).atoms.map(a=>a.fractional[0])).size,1);
assert.equal(new Set(get(10,1).atoms.filter(a=>a.cifLabel==="Cu2").map(a=>a.fractional[2])).size,1);
const teamA=F.rooms.find(room=>room.id==="team-a");
assert.equal(teamA.entrances.length,5);
assert.equal(new Set(teamA.entrances.map(([id])=>id)).size,5);
for(const [id] of teamA.entrances)assert.ok(F.rooms.some(room=>room.id===id));
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
assert.equal(stations.length,12);
assert.equal(pedestals.length,14,"Zentrales Podest, neun Einzel- und zwei Doppelstationen");
assert.ok(!layout.isWalkable(0,-3.65) && layout.isWalkable(-5.7,-3.65) && layout.isWalkable(5.7,-3.65));
const boards=stations.map(el=>{const b=Object.assign({el},components["fkc-ybco-lesson"]);b.init();return b;});
const [main]=boards;
const center=boards[2], comparison=boards[5], ba=boards[7];
assert.equal(allModels.length,2,"Beim Öffnen nur der geführte Phasenvergleich");
const press=(b,x,y)=>b.click({x:x/1024,y:1-y/700});
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
assert.equal(new Set(allModels.map(m=>m.index)).size,allModels.length);
console.log("YBCO: elf Lehrschritte, Tafelnavigation und unabhängige Übungsstationen mit Laden auf Abruf geprüft.");