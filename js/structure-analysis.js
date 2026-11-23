"use strict";

(function (F) {
  const T = AFRAME.THREE;
  const mean = points => points[0].map((_,i)=>points.reduce((sum,p)=>sum+p[i],0)/points.length);
  const sub = (a,b) => a.map((v,i)=>v-b[i]);
  const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

  function ring(points) {
    if(points.length<3)throw new Error("Mindestens drei Ringatome auswählen.");
    const center=mean(points), vectors=points.map(p=>sub(p,center));
    // Flächennormale aus umlaufend gewählten Positionen; keine Reihenfolge aus Atomlabels erraten.
    const normal=[0,0,0];
    vectors.forEach((p,i)=>cross(p,vectors[(i+1)%vectors.length]).forEach((n,j)=>{normal[j]+=n;}));
    const size=Math.hypot(...normal);
    if(size<1e-8)throw new Error("Ringatome in Umlaufrichtung auswählen.");
    const axis=normal.map(n=>n/size);
    if(vectors.some(p=>Math.abs(dot(p,axis))>0.15))throw new Error("Die Auswahl bildet keinen annähernd planaren Ring.");
    return {center,axis};
  }

  function compare(first,second) {
    const delta=sub(second.center,first.center), signed=dot(delta,first.axis);
    return {distance:Math.hypot(...delta), angle:Math.acos(Math.min(1,Math.abs(dot(first.axis,second.axis))))*180/Math.PI,
      height:Math.abs(signed), offset:Math.hypot(...delta.map((v,i)=>v-signed*first.axis[i]))};
  }

  const visualOf=root=>root?.querySelector(".model-visual");
  F.StructureAnalysis = {
    ring,compare, state:null, revision:0,
    cancel(){
      for(const {mark} of this.state?.points.values() || [])this.removeMark(mark);
      for(const mark of this.state?.ringMarks || [])this.removeMark(mark);
      this.state=null;this.revision++;
    },
    initScene(scene){
      scene.addEventListener("exit-vr",()=>this.cancel());
    },
    removeMark(mark){mark.removeFromParent();mark.geometry.dispose();mark.material.dispose();},
    begin(root){
      const visual=visualOf(root);if(!visual?.fkcStructure)return;
      this.cancel();F.AtomPlane?.cancel();F.Measure?.setEnabled(false);
      this.state={root,visual,group:visual.getObject3D("mesh"),points:new Map(),ringMarks:[],first:null,result:null,ringMode:false};
      this.revision++;
    },
    validate(root){
      const state=this.state;
      if(!state)return false;
      if(!state.root.isConnected || visualOf(state.root)!==state.visual || state.visual.getObject3D("mesh")!==state.group || root!==state.root){this.cancel();return false;}
      return true;
    },
    click(hit){
      if(!this.validate(hit.el))return false;
      const mesh=hit.mesh, atom=mesh?.userData.fkcAtom;
      if(!atom?.positionAngstrom)return true;
      const state=this.state, environment=mesh.userData.fkcEnvironmentId;
      if(state.result)return true;
      if(environment && !F.CIF.environmentState(hit.el)?.selected.has(environment))return true;
      if(state.ringMode && state.first?.meshes.includes(mesh))return true;
      if(state.points.has(mesh)){
        this.removeMark(state.points.get(mesh).mark);state.points.delete(mesh);
      }else{
        if(state.points.size>=32)return true;
        const center=state.visual.object3D.worldToLocal(mesh.getWorldPosition(new T.Vector3()));
        const scale=state.visual.object3D.getWorldScale(new T.Vector3()).x;
        const mark=new T.Mesh(new T.SphereGeometry(0.009/scale,12,8),new T.MeshBasicMaterial({
          color:state.first?0x32dec8:0xffce42,depthTest:false,depthWrite:false}));
        mark.position.copy(center);mark.userData.fkcDrawing=true;mark.renderOrder=1050;mark.raycast=()=>{};
        state.visual.object3D.add(mark);state.points.set(mesh,{atom,mark});
      }
      this.revision++;return true;
    },
    apply(polyhedron){
      const state=this.state;
      if(!state || (polyhedron && state.points.size!==1))return;
      if(F.CIF.extendSelection(state.root,new Set([...state.points.values()].map(entry=>entry.atom.id)),polyhedron))this.begin(state.root);
    },
    acceptRing(){
      const state=this.state;
      if(!state || state.result)return;
      try{
        const current=ring([...state.points.values()].map(p=>p.atom.positionAngstrom));
        current.meshes=[...state.points.keys()];
        const points=[...state.points.values()].map(p=>p.mark.position.toArray());
        current.localCenter=mean(points);
        const outline=new T.LineLoop(new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p))),
          new T.LineBasicMaterial({color:state.first?0x32dec8:0xffce42,depthTest:false,depthWrite:false}));
        outline.raycast=()=>{};outline.renderOrder=1050;
        state.visual.object3D.add(outline);state.ringMarks.push(outline);
        state.ringMarks.push(...[...state.points.values()].map(p=>p.mark));state.points.clear();
        if(!state.first){state.first=current;}
        else {
          state.result=compare(state.first,current);
          const line=new T.Line(new T.BufferGeometry().setFromPoints([state.first.localCenter,current.localCenter].map(p=>new T.Vector3(...p))),
            new T.LineBasicMaterial({color:0xffffff,depthTest:false,depthWrite:false}));
          line.raycast=()=>{};line.renderOrder=1051;
          state.visual.object3D.add(line);state.ringMarks.push(line);
        }
        this.revision++;
      }catch(error){F.setStatus(error.message);}
    }
  };
  AFRAME.registerComponent?.("fkc-structure-analysis", {
    init(){F.StructureAnalysis.initScene(this.el);},
    tick(){const state=F.StructureAnalysis.state;if(state)F.StructureAnalysis.validate(state.root);}
  });
})(window.FKCVR);