"use strict";

(function(F){
  const T=AFRAME.THREE;
  const ortho="YBa2Cu3O7_2026.cif", tetra="YBa2Cu3O6_tetragonal_HT.cif", perov="CaTiO3.cif";
  const steps=[
    ["Kristallsysteme vergleichen","Welche Zellparameter verraten das Kristallsystem?","O₆: a = b ≠ c → tetragonal (P4/mmm). O₆.₉₁: a ≠ b ≠ c → orthorhombisch (Pmmm).",["Phasenvergleich"]],
    ["P-, I- und F-Zentrierung","Wohin müsste das markierte Eck-Cu bei I- oder F-Zentrierung abgebildet werden?","P: Eckpunkte. I: zusätzlich die Körpermitte. F: zusätzlich alle sechs Flächenmitten. Die Markierungen sind Vergleichspositionen, keine zusätzlichen Cu-Atome.",["Elementarzelle","P · Ecken","I · Körpermitte","F · Flächenmitten"]],
    ["Spiegelebenen von Pmmm","Zeichne je eine Linie für die Spiegel senkrecht zu a, b und c.","Die drei m stehen für Spiegelebenen senkrecht zu a, b und c. Hier werden drei repräsentative Ebenen bei ½ gezeichnet.",[]],
    ["Summenformel herleiten","Zähle jede Sorte: Ecke ⅛, Kante ¼, Fläche ½ und innen 1. Berücksichtige dann die Besetzung.","Y₁Ba₂Cu₃O₆.₉₁: O1 erscheint auf vier Randabbildern mit Gewicht ¼ und Besetzung 0,91.",["Alle","Y","Ba","Cu","O"]],
    ["Defektes Perowskitmotiv","Vergleiche YBCO mit einer kubischen CaTiO₃-Zelle. Was ändert sich im O-Gerüst?","Eine ideale Referenzzelle hat ABO₃. Auf drei Bausteine bezogen sind das A₃B₃O₉; YBCO ist geschichtet und sauerstoffärmer.",["Vollständige Zellen","Nur Kationen"]],
    ["Y-Koordination","Wie viele O-Nachbarn umgeben Y? Betrachte die Gruppen nach Abstand.","Y hat acht O-Nachbarpositionen. Die orthorhombische Verzerrung spaltet die Abstände auf.",["Nächste Abstandsgruppe","Alle acht","Polyeder"]],
    ["Ba-Koordination","Ergänze die O-Nachbarn nach Abstand. Liegt Ba wirklich in der Ebene der zuerst gezeigten vier O?","4 + 2 + 2 + 2 Positionen. Die zwei O1-Abbilder sind nur zu 91 % besetzt; das ist eine mittlere Struktur.",["Nächste Abstandsgruppe","Alle zehn","Polyeder"]],
    ["Vier O-Plätze vergleichen","Wähle O1 bis O4. Welche Cu-, Y- oder Ba-Plätze umgeben das gewählte O?","O1 gehört zur Kette, O2 und O3 liegen in der CuO₂-Ebene. O4 verbindet als apikales O die Cu-Umgebungen.",["O1","O2","O3","O4"]],
    ["Cu1 · Kettenplatz","Vergleiche den Cu1-Platz in O₆.₉₁ und O₆. Welche Nachbarn fehlen?","Cu1 hat in O₆.₉₁ zwei apikale und zwei teilbesetzte Ketten-O-Nachbarplätze; in O₆ bleiben die beiden apikalen O.",["O₆.₉₁","O₆"]],
    ["Cu2 · Ebenenplatz","Zähle die O-Nachbarn und beschreibe die Geometrie des zweiten Cu-Platzes.","Cu2 ist näherungsweise quadratisch-pyramidal koordiniert. Cu1 und Cu2 sind Platznamen, keine Oxidationszahlen.",["Nachbarn","Polyeder"]],
    ["Koordinationen in einer Zelle","Schalte die acht unabhängigen Plätze einzeln zu. Vergleiche ihre Nachbarschaften.","Farbige Hüllen und Stäbe zeigen die gewählten Koordinationen. Lineare oder planare Nachbarschaften haben keine räumliche Hülle.",["Y1","Ba1","Cu1","Cu2","O1","O2","O3","O4"]],
    ["Cu–O-Ketten und CuO₂-Ebenen","Vergleiche die Ausbreitungsrichtung der Cu–O-Kette und der CuO₂-Ebene.","Die Kette läuft entlang b, die Ebene parallel zu ab. Gezeigt wird das Strukturmotiv, keine Simulation der Supraleitung.",["Kette entlang b","Ebene parallel ab","Beide Motive"]]
  ];
  const rules=[["Cu","O",2.4,"Cu1"],["Cu","O",2.6,"Cu2"],["Y","O",2.65],["Ba","O",3.15]];
  const chemicalRules=[["Cu","O",2.4,"Cu1"],["Cu","O",2.6,"Cu2"]];
  const siteLabels=steps[10][3];
  const siteColors=["#087f8c","#a36713","#d75529","#7437c5","#db3768","#165bbb","#12833e","#8b4554"];
  const mirrorColors=["#eb4335","#279456","#426add"];
  const investigations={
    oxygen:{title:"Ist O1 immer O1?",question:"Markiere in beiden Zellen ein O zwischen Ketten-Cu und Ebenen-Cu."},
    bragg:{title:"Reflexe (200) und (020)",question:"Sagen a und b gleiche oder verschiedene Reflexpositionen voraus?"},
    buckling:{title:"Wie eben ist CuO₂?",question:"Miss Cu–O–Cu entlang a und b. Ist der Winkel wirklich 180°?"},
    bilayer:{title:"Warum Doppelschichten?",question:"Miss entlang c zwischen Cu2-Lagen. Welche gehören zusammen?"}
  };
  const extensions={0:["oxygen","bragg"],11:["buckling","bilayer"]};
  const cuKa=1.5406; // Cu Kα, Å
  const projections=[[0,1,545,234,150,150],[0,2,782,234,150,150]];
  const boardPoint=uv=>({x:uv.x*1024,y:(1-uv.y)*700});
  function mirrorStroke(start,end){
    for(const [h,v,x,y,w,height] of projections){
      if(![start,end].every(p=>p.x>=x-12 && p.x<=x+w+12 && p.y>=y-12 && p.y<=y+height+12))continue;
      if(Math.abs(end.y-start.y)>=height*.55 && Math.abs(start.x-x-w/2)<19 && Math.abs(end.x-x-w/2)<19)return h;
      if(Math.abs(end.x-start.x)>=w*.55 && Math.abs(start.y-y-height/2)<19 && Math.abs(end.y-y-height/2)<19)return v;
    }
    return null;
  }
  const S=()=>F.StructureCell;
  const cart=(p,c)=>F.CIFStructure.cartesian(p,c.cellMatrix);

  function closed(cell, filter=()=>true){
    const atoms=S().closedImages(cell).filter(filter);
    return {...cell,atoms,measurePositions:true};
  }

  function shell(cell,label,group=Infinity,poly=false){
    const center=cell.atoms.findIndex(a=>a.cifLabel===label);
    if(center<0)throw new Error("Koordinationsplatz fehlt: "+label);
    const origin=cell.atoms[center].fractional;
    const seed={...cell.atoms[center],siteIndex:center,cellShift:[0,0,0],positionAngstrom:[0,0,0]};
    const local=S().expandContacts(cell,cell.bonds,[seed],1,origin);
    const edges=local.bonds.filter(b=>b.a===0).sort((a,b)=>a.distanceAngstrom-b.distanceAngstrom);
    const groups=[];
    for(const edge of edges){
      if(!groups.length || edge.distanceAngstrom-groups.at(-1)[0].distanceAngstrom>0.001)groups.push([]);
      groups.at(-1).push(edge);
    }
    const visible=groups.slice(0,group).flat();
    const atoms=[seed,...visible.map(e=>local.atoms[e.b])];
    const indexes=visible.map((_,i)=>i+1);
    let polyhedra=[];
    if(poly && indexes.length>=4){
      try{F.CIF.polyhedronTriangles(indexes.map(i=>atoms[i].positionAngstrom));polyhedra=[{center:0,neighbors:indexes}];}
      catch(error){if(error.message!=="Entartetes Koordinationspolyeder.")throw error;}
    }
    return {...cell,mode:"coordination",atoms,bonds:visible.map((edge,i)=>({...edge,b:i+1})),polyhedra,
      lessonDistanceLabels:label==="Ba1",lessonProjection:closed(cell).atoms,lessonCenter:origin,
      measurePositions:true,defaultStyle:polyhedra.length?"polyhedral":"ball-stick",
      distanceGroups:groups.map(g=>({count:g.length,distance:g[0].distanceAngstrom})),visibleGroups:Math.min(group,groups.length)};
  }

  function cellShells(source,labels,group){
    const cell=S().network(S().read(source),rules), result={...closed(cell),mode:"cell-complete",bonds:[],polyhedra:[]};
    const key=a=>a.cifLabel+":"+a.positionAngstrom.map(v=>Math.round(v*1e6)).join(",");
    const index=new Map(result.atoms.map((a,i)=>[key(a),i]));
    const edges=new Set();
    for(const label of labels){
      const local=shell(cell,label,group,true);
      const origin=local.lessonCenter, translation=cart(origin,cell);
      const ids=local.atoms.map((a,i)=>{
        const positionAngstrom=a.positionAngstrom.map((v,j)=>v+translation[j]);
        const atom={...a,positionAngstrom,fractional:i===0?origin:a.fractional.map((v,j)=>v+a.cellShift[j])};
        const k=key(atom);
        if(!index.has(k)){index.set(k,result.atoms.length);result.atoms.push({...atom,id:k});}
        return index.get(k);
      });
      for(const b of local.bonds){
        const a=ids[b.a], end=ids[b.b], id=[a,end].sort((x,y)=>x-y).join(":");
        if(!edges.has(id)){edges.add(id);result.bonds.push({...b,id,a,b:end});}
      }
      const color=siteColors[siteLabels.indexOf(label)];
      for(const p of local.polyhedra)result.polyhedra.push({center:ids[p.center],neighbors:p.neighbors.map(i=>ids[i]),color,opacity:.14,selected:true});
    }
    return {...result,lessonProjection:closed(cell).atoms,lessonDistanceLabels:labels.length===1 && labels[0]==="Ba1"};
  }

  function motif(source,mode,withCell=false){
    const cell=S().network(S().read(source),chemicalRules);
    const seeds=[];
    const include=(a,f)=>mode!=="plane" && ["Cu1","O1"].includes(a.cifLabel) && (withCell?[0,1].includes(f[2]) && [0,1].includes(f[0]):f[2]===0 && f[0]===0) ||
      mode!=="chain" && ["Cu2","O2","O3"].includes(a.cifLabel) && (withCell ? f[2]>0 && f[2]<1 : f[2]>0.3 && f[2]<0.5);
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=0;z<=(withCell?1:0);z++)cell.atoms.forEach((atom,siteIndex)=>{
      const cellShift=[x,y,z],fractional=atom.fractional.map((v,i)=>v+cellShift[i]);
      if(include(atom,fractional))seeds.push({...atom,siteIndex,cellShift,fractional,id:S().imageId(atom,cellShift),positionAngstrom:cart(fractional,cell)});
    });
    const shown=S().expandContacts(cell,cell.bonds,seeds,0);
    if(!withCell)return {...cell,...shown,mode:"sites",measurePositions:true};
    const base=closed(cell), keys=new Set(shown.atoms.map(a=>a.id));
    return {...base,...shown,atoms:[...shown.atoms,...base.atoms.filter(a=>!keys.has(a.id))],mode:"cell-complete"};
  }

  function layerStudy(cell,view,arg){
    const cu=cell.atoms.find(a=>a.cifLabel==="Cu2" && a.fractional[2]<.5);
    const z=cu.fractional[2], [a,b,c]=cell.cellLengthsAngstrom;
    const fractional=[];
    if(view==="buckling"){
      const oak=[0,1].map(axis=>cell.atoms.find(o=>o.element==="O" && o.fractional[axis]===.5 && o.fractional[1-axis]===0 && Math.abs(o.fractional[2]-z)<.06));
      for(let x=0;x<=1;x++)for(let y=0;y<=1;y++){
        fractional.push([cu,[x,y,z]]);
        if(!x)fractional.push([oak[0],[.5,y,oak[0].fractional[2]]]);
        if(!y)fractional.push([oak[1],[x,.5,oak[1].fractional[2]]]);
      }
      const angles=oak.map((o,i)=>180-2*Math.atan2(Math.abs(o.fractional[2]-z)*c,[a,b][i]/2)*180/Math.PI);
      return {...layerModel(cell,fractional,angles,2.1),lessonOverlay:{cell,view:"layerAxes",arg:z}};
    }
    for(let k=0;k<2;k++)for(const cz of [z,1-z])for(const x of [0,1])for(const y of [0,1])fractional.push([cu,[x,y,cz+k]]);
    if(arg==="context")for(let k=0;k<2;k++)for(const atom of cell.atoms.filter(a=>["Y1","Cu1","O1"].includes(a.cifLabel)))
      fractional.push([atom,[atom.fractional[0],atom.fractional[1],atom.fractional[2]+k]]);
    return layerModel(cell,fractional,[(1-2*z)*c,2*z*c,c],0);
  }

  function layerModel(cell,entries,values,cutoff){
    const atoms=entries.map(([a,f],i)=>({...a,id:`layer-${i}`,modelNumber:i+1,fractional:f,positionAngstrom:cart(f,cell)}));
    const bonds=[];
    if(cutoff)for(const [a,cu] of atoms.entries())if(cu.element==="Cu")for(const [b,o] of atoms.entries())if(o.element==="O"){
      const distanceAngstrom=Math.hypot(...cu.positionAngstrom.map((v,i)=>v-o.positionAngstrom[i]));
      if(distanceAngstrom<=cutoff)bonds.push({a,b,distanceAngstrom,id:`layer-${a}-${b}`});
    }
    return {...cell,mode:"sites",atoms,bonds,measurePositions:true,lessonValues:values};
  }

  const reflex=d=>2*Math.asin(cuKa/(2*d))*180/Math.PI;

  function structure(source,mode){
    const [view,arg,amount]=mode.split(":");
    if(view==="shell")return shell(S().network(S().read(source),rules),arg,amount==="poly"?Infinity:Number(amount || Infinity),amount==="poly");
    if(view==="motif")return motif(source,arg,amount==="cell");
    if(view==="cell-shells")return cellShells(source,arg==="none"?[]:arg.split(","),Number(amount || Infinity));
    const cell=S().read(source);
    if(view==="buckling" || view==="bilayer")return layerStudy(cell,view,arg);
    if(view==="oxygen"){
      const label=cell.spaceGroup.number==="123"?"O1":"O4";
      const result=closed(cell);
      return {...result,lessonApical:label,lessonOverlay:{cell,view,arg}};
    }
    if(view==="bragg"){
      const ds=cell.cellLengthsAngstrom.slice(0,2).map(d=>d/2);
      return {...closed(cell),lessonValues:ds.flatMap(d=>[d,reflex(d)]),lessonOverlay:{cell,view,arg}};
    }
    if(view==="perov"){
      return closed(cell,a=>arg!=="cations" || a.element!=="O");
    }
    if(!["compare","centering","mirror","count","cations"].includes(view))throw new Error("Unbekannte YBCO-Lehransicht: "+view);
    const model=closed(cell,a=>view!=="count" || arg==="all" || a.element===arg);
    if(view==="centering" || view==="mirror" || view==="compare")model.lessonOverlay={cell,view,arg};
    if(view==="cations")model.atoms=model.atoms.filter(a=>a.element!=="O");
    return model;
  }

  function centeringPoints(mode){
    const points=[];
    if(mode!=="cell")for(const x of [0,1])for(const y of [0,1])for(const z of [0,1])points.push([x,y,z]);
    if(mode==="I")points.push([.5,.5,.5]);
    if(mode==="F")for(const edge of [0,1])points.push([.5,.5,edge],[.5,edge,.5],[edge,.5,.5]);
    return points;
  }

  function overlay(group,{cell,view,arg},resources){
    const add=(geometry,material,position)=>{
      const mesh=new T.Mesh(geometry,material);mesh.position.fromArray(position);mesh.raycast=()=>{};
      mesh.userData.fkcDrawing=true;group.add(mesh);resources.push(geometry,material);return mesh;
    };
    if(view==="centering"){
      add(new T.SphereGeometry(.47,16,12),new T.MeshBasicMaterial({wireframe:true,color:"#ed882b"}),cart([1,1,1],cell));
      for(const p of centeringPoints(arg))add(new T.SphereGeometry(.39,16,12),new T.MeshBasicMaterial({wireframe:true,color:"#642dc9"}),cart(p,cell));
    }
    if(view==="oxygen" && arg==="answer"){
      const label=cell.spaceGroup.number==="123"?"O1":"O4";
      for(const atom of S().closedImages(cell).filter(a=>a.cifLabel===label))
        add(new T.SphereGeometry(.43,14,10),new T.MeshBasicMaterial({wireframe:true,color:"#e68814"}),atom.positionAngstrom);
    }
    if(view==="layerAxes"){
      const origin=cart([-.16,-.16,arg],cell);
      cell.cellMatrix.slice(0,2).forEach((vector,i)=>{
        const axis=new T.ArrowHelper(new T.Vector3(...vector).normalize(),new T.Vector3(...origin),1.55,mirrorColors[i],.26,.16);
        axis.userData.fkcDrawing=true;
        axis.traverse(o=>{o.raycast=()=>{};});
        group.add(axis);resources.push(axis.line.material,axis.cone.material);
      });
    }
    if(view==="mirror" || view==="bragg"){
      for(const axis of arg==="none"?[]:arg.split(",").map(Number)){
        const other=[0,1,2].filter(i=>i!==axis), coords=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];
        for(const offset of view==="bragg"?[0,.5,1]:[.5]){
          const positions=coords.flatMap(([u,v])=>{const p=[0,0,0];p[axis]=offset;p[other[0]]=u;p[other[1]]=v;return cart(p,cell);});
          const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
          add(geometry,new T.MeshBasicMaterial({color:mirrorColors[axis],transparent:true,opacity:view==="bragg"?.19:.32,depthWrite:false,side:T.DoubleSide}),[0,0,0]);
        }
      }
    }
  }

  function distanceLabels(group,structure,resources){
    const materials=new Map();
    for(const bond of structure.bonds){
      const value=bond.distanceAngstrom.toFixed(3).replace(".",",");
      if(!materials.has(value)){
        const canvas=document.createElement("canvas");canvas.width=256;canvas.height=80;
        const ctx=canvas.getContext("2d");ctx.font="bold 51px Arial";ctx.textAlign="center";
        ctx.strokeStyle="#ffffff";ctx.lineWidth=8;ctx.strokeText(`${value} Å`,128,58);
        ctx.fillStyle="#251408";ctx.fillText(`${value} Å`,128,58);
        const texture=new T.CanvasTexture(canvas), material=new T.SpriteMaterial({map:texture,depthWrite:false});
        materials.set(value,material);resources.push(texture,material);
      }
      const a=structure.atoms[bond.a].positionAngstrom,b=structure.atoms[bond.b].positionAngstrom;
      const sprite=new T.Sprite(materials.get(value));sprite.position.fromArray(a.map((v,i)=>(v+b[i])/2+(i===1?.20:0)));
      sprite.scale.set(1.22,.38,1);sprite.raycast=()=>{};group.add(sprite);
    }
  }

  // Eine Zustandsbeschreibung pro Lehrschritt, keine dauerhaft geladenen Podeste.
  function models(step,option,group,{cell=false,mirrors=[],sites=[],investigation=null,studyOption=0,analysis=false}={}){
    const model=(file,mode,title,center)=>({model:"assets/praktikum/"+file,cifMode:"ybco-lesson:"+mode,title,center});
    const o=[1.91137,1.94648,5.844465], t=[1.9297,1.9297,5.907], p=[1.8975,1.8975,1.8975];
    const main=(mode,title)=>model(ortho,mode,title,mode.startsWith("shell:")?[0,0,0]:o);
    if(investigation==="oxygen" || investigation==="bragg"){
      const arg=investigation==="oxygen"?(analysis?"answer":"none"):["0","1","0,1"][studyOption];
      const mode=investigation+":"+arg;
      return [main(mode,"YBa₂Cu₃O₆.₉₁"),model(tetra,mode,"YBa₂Cu₃O₆",t)];
    }
    if(investigation==="buckling" || investigation==="bilayer"){
      const file=investigation==="buckling" && studyOption?tetra:ortho;
      return [model(file,investigation+":"+(studyOption?"context":"base"),investigations[investigation].title)];
    }
    if(step===0)return [main("compare","Phase A · YBa₂Cu₃O₆.₉₁"),model(tetra,"compare","Phase B · YBa₂Cu₃O₆",t)];
    if(step===1)return [main("centering:"+["cell","P","I","F"][option],"Pmmm · Zentrierung")];
    if(step===2)return [main("mirror:"+(mirrors.join(",")||"none"),"Pmmm · Spiegelebenen")];
    if(step===3)return [main("count:"+["all","Y","Ba","Cu","O"][option],"Summenformel · Randanteile")];
    if(step===4)return [main(option?"cations":"compare","YBa₂Cu₃O₆.₉₁"),model(perov,"perov:"+(option?"cations":"all"),"CaTiO₃ · kubische Zelle",p)];
    const local=(label,title,amount="Infinity",file=ortho)=>model(file,
      cell?`cell-shells:${label}:${amount==="poly"?"Infinity":amount}`:`shell:${label}:${amount}`,title,cell?(file===ortho?o:t):[0,0,0]);
    if(step===5 || step===6){const label=step===5?"Y":"Ba";return [local(label+"1",label+"–O · Abstandsgruppen",option===2?"poly":option===1?"Infinity":group)];}
    if(step===7)return [local("O"+(option+1),"O"+(option+1)+" · Nachbarn")];
    if(step===8)return [local("Cu1",option?"Cu1 · O₆":"Cu1 · O₆.₉₁","Infinity",option?tetra:ortho)];
    if(step===9)return [local("Cu2","Cu2 · Ebenenplatz",option?"poly":"Infinity")];
    if(step===10)return [main("cell-shells:"+(sites.join(",")||"none"),"YBCO · Koordinationen")];
    return [main("motif:"+["chain","plane","both"][option]+(cell?":cell":""),"Cu–O · Strukturmotive")];
  }

  function build(parent,config,makeModel,panel,addLights){
    addLights(parent);
    const flat=color=>({shader:"flat",color});
    const floor=(width,height,z,color,y=0)=>F.create("a-plane",{position:{x:0,y,z},rotation:"-90 0 0",width,height,material:flat(color)},parent);
    floor(18,26,-6,"#dee8ed");
    floor(8,6.8,0.15,"#d5e5d9",0.005);
    const colors={gold:"#a58b54",goldLight:"#d8c697"};
    const sign=(title,position,rotation,width,height,bg,roomId)=>{
      const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=160;
      const ctx=canvas.getContext("2d");ctx.fillStyle=bg;ctx.fillRect(0,0,1024,160);
      ctx.fillStyle="#ffffff";ctx.font="bold 63px Arial";ctx.textAlign="center";ctx.fillText(title,512,102,980);
      panel(parent,position,rotation,width,height,canvas.toDataURL(),roomId,colors);
    };
    sign("Zurück zu Team A",{x:0,y:1.6,z:5.2},"0 180 0",1.65,.42,"#355060","team-a");
    sign("YBCO · 1. Gemeinsam erkunden",{x:.2,y:3.45,z:-2.82},"0 0 0",5.4,.46,"#234a37");
    F.create("a-box",{position:"0 1.13 -3.65",width:8.6,height:2.26,depth:.14,material:flat("#466859")},parent);
    sign("2. Selbstständig üben",{x:0,y:2.64,z:-3.83},"0 180 0",3.9,.44,"#355669");
    for(const x of [-5.7,5.7])sign("Zu den Übungen ›",{x,y:1.8,z:-3.85},"0 0 0",1.9,.39,"#355669");

    const exercises={active:null,activate(board){
      if(this.active!==board){const previous=this.active;this.active=board;previous?.stopPractice();}
      board.stepTo(board.el.fkcExerciseStep);
    }};
    const obstacles=[];
    const pedestal=(x,z,color,w,depth=w)=>{
      obstacles.push({x,z,w,depth});
      F.create("a-box",{position:{x,y:.42,z},width:w,height:.84,depth,material:flat(color)},parent);
    };
    function station({step=null,x,y,z,angle=0}){
      const practice=step!==null, radians=angle*Math.PI/180;
      const point=(u,v)=>[x+u*Math.cos(radians)+v*Math.sin(radians),z-u*Math.sin(radians)+v*Math.cos(radians)];
      const [bx,bz]=point(0,0);
      const board=F.create("a-entity",{class:"vr-action",position:{x:bx,y,z:bz},rotation:`0 ${angle} 0`},parent);
      if(practice){
        board.fkcExerciseStep=step;
        board.fkcExercises=exercises;
        const count=models(step,0,1).length;
        for(let i=0;i<count;i++){
          const [px,pz]=point(count===1?0:(i===0?-.67:.67),1.2);
          pedestal(px,pz,"#597586",.70);
        }
      }else{
        pedestal(-1.25,-.8,"#315e46",2.78,.95);
      }
      board.fkcLessonModel=(record,index,count)=>{
        const [mx,mz]=practice?point(count===1?0:(index===0?-.67:.67),1.2):[count===1?-1.25:(index?-.55:-2.15),-.8];
        const root=makeModel(parent,record,practice?2+step*2+index:index,practice?{...config,modelSize:.94}:config,{x:mx,y:1.53,z:mz});
        if(record.center && !record.cifMode.includes("motif:")){
          root.fkcVariants=[];
          root.fkcVariantFrame={factor:(record.cifMode.includes("shell:")?.17:.105)*(practice?.73:1),center:new T.Vector3(...record.center)};
        }
        if(practice)root.object3D.rotation.y=radians;
        return root;
      };
      board.setAttribute("fkc-ybco-lesson", "");
    }
    station({x:1.35,y:1.89,z:-2.7});
    steps.forEach((_,step)=>{
      const left=step<4, rear=step>=8;
      station({step,x:rear?(step-9.5)*4.45:left?-7.8:7.8,y:1.94,
        z:rear?-17.8:-6.3-(step%4)*2.85,angle:rear?0:left?90:-90});
    });
    return {spawn:{x:0,z:3.3},isWalkable:(x,z)=>Math.abs(x)<8.55 && z>-18.5 && z<6.55 &&
      !(Math.abs(x)<4.35 && Math.abs(z+3.65)<.20) &&
      !obstacles.some(p=>Math.abs(x-p.x)<p.w/2+.14 && Math.abs(z-p.z)<p.depth/2+.14)};
  }

  F.YbcoLesson={steps,structure,models,overlay,build,mirrorStroke,centeringPoints,distanceLabels,
    selectAtom(hit){
      const board=hit.el.fkcLessonBoard, atom=hit.mesh?.userData.fkcAtom;
      if(board?.investigation==="oxygen" && atom){board.chooseOxygen(hit.el,atom);return true;}
      if(!board?.projectionVisible || !atom || !board.isCoordination())return false;
      board.highlight(atom.cifLabel);return true;
    }};
  AFRAME.registerComponent("fkc-ybco-lesson",{
    init(){
      this.el.dataset.fkcStructureTablet="true";
      this.practice=Number.isInteger(this.el.fkcExerciseStep);
      this.step=this.practice?this.el.fkcExerciseStep:0;
      this.option=0;this.group=1;this.roots=[];this.analysis=false;this.contents=false;
      this.cell=false;this.mirrors=[];this.sites=[];this.projectionVisible=true;
      this.canvas=document.createElement("canvas");this.canvas.width=1024;this.canvas.height=700;
      this.texture=new T.CanvasTexture(this.canvas);
      this.geometry=this.practice?new T.PlaneGeometry(2.42,1.65):new T.PlaneGeometry(3.3,2.26);
      this.material=new T.MeshBasicMaterial({map:this.texture});
      this.el.setObject3D("mesh",new T.Mesh(this.geometry,this.material));
      if(this.practice)this.render();else this.show();
    },
    stopPractice(){
      if(this.el.fkcExercises?.active===this)this.el.fkcExercises.active=null;
      this.clear();this.analysis=false;this.render();F.invalidateHits?.();
    },
    show(){
      this.clear();
      const records=models(this.step,this.option,this.group,this);
      this.detail="";this.projection=null;this.studyData=[];
      this.roots=records.map((record,i)=>{
        const root=this.el.fkcLessonModel(record,i,records.length);
        root.fkcLessonBoard=this;
        const visual=root.querySelector(".model-visual");
        visual.addEventListener("model-loaded",()=>{
          if(!this.roots.includes(root))return;
          const s=visual.fkcStructure;
          if(this.investigation)this.studyData[i]=s?.lessonValues;
          if(this.step===2 || this.isCoordination())this.projection=s?.lessonProjection || s?.atoms;
          if(s?.distanceGroups){
            this.groups=s.distanceGroups.length;
            this.detail=s.distanceGroups.slice(0,s.visibleGroups).map(g=>`${g.count} × ${g.distance.toFixed(3)} Å`).join("   ·   ");
          }
          if(this.selectedSite || this.investigation==="oxygen")this.updateHighlight();
          this.render();
        },{once:true});
        visual.addEventListener("model-error",()=>{
          if(this.roots.includes(root)){this.detail="Modell konnte nicht geladen werden: "+record.title;this.render();}
        },{once:true});
        return root;
      });
      this.render();F.invalidateHits?.();
    },
    stepTo(step){this.step=step;this.option=0;this.group=1;this.groups=0;this.analysis=false;this.contents=false;
      this.cell=false;this.mirrors=[];this.sites=[];this.selectedSite=null;this.projectionVisible=true;this.stroke=null;this.note="";
      this.investigation=null;this.studyMenu=false;this.show();},
    openStudy(id){this.investigation=id;this.studyOption=0;this.studyChoice=[];this.studyPicks=[];this.studyMenu=false;this.analysis=false;this.show();},
    chooseOxygen(root,atom){
      const i=this.roots.indexOf(root), visual=root.querySelector(".model-visual");
      if(i<0 || !visual?.fkcStructure)return;
      this.studyPicks[i]=atom.id;
      this.studyChoice[i]=atom.element!=="O"?"Wähle ein O-Atom":atom.cifLabel===visual.fkcStructure.lessonApical?"Richtig · apikaler Platz":"Noch nicht · Umgebung vergleichen";
      this.updateHighlight();
      this.render();
    },
    renderStudy(ctx,button,wrap){
      const id=this.investigation, study=investigations[id];
      ctx.fillStyle=this.practice?"#eaf2f7":"#eff5f0";ctx.fillRect(0,88,1024,612);
      ctx.fillStyle="#203f30";ctx.font="bold 40px Arial";ctx.fillText(study.title,32,145,960);
      wrap(study.question,193);
      const options={buckling:["YBa₂Cu₃O₆.₉₁","YBa₂Cu₃O₆"],bilayer:["Nur Cu2-Lagen","Y und Kettenlage dazu"],
        bragg:["(200)","(020)","Beide Netzebenen"]}[id] || [];
      options.forEach((label,i)=>button(32+i*320,265,306,label,()=>{this.studyOption=i;this.show();},i===this.studyOption));
      const num=(x,d=2)=>x.toFixed(d).replace(".",",");
      if(id==="oxygen"){
        wrap(`Links · O₆.₉₁: ${this.studyChoice?.[0] || "noch keine Auswahl"}`,290);
        wrap(`Rechts · O₆: ${this.studyChoice?.[1] || "noch keine Auswahl"}`,334);
        if(this.analysis)wrap("Apikal: O4 links, O1 rechts. Der Kettenplatz O1 der linken CIF fehlt rechts. Vergleiche Umgebungen, nicht nur Labels.",417);
      }
      if(id==="buckling" && !this.analysis)wrap("Bonus: Lege eine Ebene durch drei Cu2-Zentren. Miss den senkrechten Abstand von O zu dieser Ebene.",399);
      if(id==="buckling")wrap("Roter Pfeil: a · grüner Pfeil: b",360);
      if(id==="bilayer" && !this.analysis)wrap("Miss zwischen übereinanderliegenden Cu2-Zentren. Ergibt die Summe beider Abstände c?",399);
      const data=this.studyData?.[0];
      if(this.analysis && data){
        if(id==="buckling"){
          wrap(`Cu–O–Cu: entlang a ${num(data[0],1)}°, entlang b ${num(data[1],1)}°.`,399);
          wrap("Von der Kante sieht man: O liegt nicht in der Ebene der Cu-Zentren. Im tetragonalen Fall sind a und b äquivalent.",447);
        }
        if(id==="bilayer"){
          wrap(`Über Y: ${num(data[0])} Å. Über die Kettenlage: ${num(data[1])} Å. Summe: ${num(data[2])} Å = c.`,399);
          wrap("Miss zwischen übereinanderliegenden Cu2-Zentren, nicht entlang einer Diagonalen.",459);
        }
        if(id==="bragg" && this.studyData[1]){
          const both=[data,this.studyData[1]];
          wrap("Cu Kα₁ · λ = 1,5406 Å · berechnete Positionen, keine Intensitäten",372);
          both.forEach(([d1,t1,d2,t2],i)=>{
            const y=407+i*66;
            ctx.fillStyle="#203f30";ctx.font="24px Arial";
            ctx.fillText(`${i?"O₆":"O₆.₉₁"}   (200): ${num(d1,3)} Å / ${num(t1)}°    (020): ${num(d2,3)} Å / ${num(t2)}°`,32,y,960);
            ctx.fillStyle="#83958d";ctx.fillRect(220,y+19,630,2);
            [t1,t2].forEach((theta,j)=>{ctx.fillStyle=mirrorColors[j];
              const coincident=Math.abs(t1-t2)<.0001;
              ctx.fillRect(220+(theta-46)*315-2,y+8+(coincident?j*12:0),4,coincident?12:23);});
          });
          ctx.fillStyle="#203f30";ctx.font="21px Arial";ctx.fillText("46°",210,533);ctx.fillText("48° · 2θ",829,533);
        }
      }
      button(32,558,470,this.analysis?"Lösung ausblenden":"Lösung anzeigen",()=>{
        this.analysis=!this.analysis;if(id==="oxygen")this.show();else this.render();
      },this.analysis);
      button(520,558,470,"Modell neu zeigen",()=>this.show());
      button(32,632,958,"‹ Zur Ausgangsaufgabe",()=>{this.investigation=null;this.analysis=false;this.show();});
    },
    isCoordination(){return this.step>=5 && this.step<=10;},
    highlight(label){this.selectedSite=this.selectedSite===label?null:label;this.updateHighlight();this.render();},
    clearHighlights(){
      for(const ring of this.highlights || []){ring.removeFromParent();ring.geometry.dispose();ring.material.dispose();}
      this.highlights=[];
    },
    updateHighlight(){
      this.clearHighlights();
      const oxygen=this.investigation==="oxygen";
      if(!oxygen && (!this.projectionVisible || !this.selectedSite))return;
      for(const [i,root] of this.roots.entries()){
        const mesh=root.querySelector(".model-visual")?.getObject3D("mesh");
        const matching=[];
        mesh?.traverseVisible(m=>{const a=m.userData.fkcAtom;if(a && (oxygen?a.id===this.studyPicks?.[i]:a.cifLabel===this.selectedSite))matching.push(m);});
        for(const atom of matching){
          const ring=new T.Mesh(new T.SphereGeometry(1.24,12,8),new T.MeshBasicMaterial({color:"#ffbf16",wireframe:true,depthWrite:false}));
          ring.raycast=()=>{};ring.userData.fkcDrawing=true;atom.add(ring);this.highlights.push(ring);
        }
      }
    },
    finishStroke(){
      const stroke=this.stroke;this.stroke=null;
      const axis=mirrorStroke(stroke.start,stroke.end);
      if(axis===null){this.note="Ziehe eine lange Linie durch die Mitte der Projektion.";this.render();return;}
      if(this.mirrors.includes(axis)){this.note="Diese Ebene ist schon eingezeichnet. Wähle eine andere Richtung.";this.render();return;}
      this.mirrors.push(axis);this.note=`${this.mirrors.length} von 3 Ebenen eingezeichnet`;this.show();
    },
    sampleStroke(uv,held){
      if(!this.stroke?.xr)return;
      if(!held){this.finishStroke();return;}
      if(uv){this.stroke.end=boardPoint(uv);this.render();}
    },
    render(){
      const ctx=this.canvas.getContext("2d"),[title,question,answer,options]=steps[this.step];
      const color=this.practice?"#355669":"#234a37";
      ctx.fillStyle=this.practice?"#eaf2f7":"#eff5f0";ctx.fillRect(0,0,1024,700);
      ctx.fillStyle=color;ctx.fillRect(0,0,1024,88);
      ctx.fillStyle="#ffffff";ctx.font="bold 23px Arial";ctx.fillText(this.practice?"SELBSTSTÄNDIG ÜBEN":"GEFÜHRTE LEHRSTATION",32,29);
      ctx.font="bold 43px Arial";ctx.fillText(`${this.step+1}/${steps.length} · ${title}`,32,72,960);
      ctx.fillStyle=color;
      const wrap=(text,y)=>{let line="";ctx.font="30px Arial";for(const word of text.split(" ")){
        const next=line?`${line} ${word}`:word;
        if(line && ctx.measureText(next).width>950){ctx.fillText(line,32,y,950);y+=34;line=word;}else line=next;
      }if(line)ctx.fillText(line,32,y,950);};
      wrap(question,130);
      const button=(x,y,w,label,action,active=false)=>{
        ctx.fillStyle=active?"#ffd683":this.practice?"#cbdfea":"#cce3d1";ctx.fillRect(x,y,w,68);ctx.fillStyle=color;
        ctx.font="bold 26px Arial";ctx.fillText(label,x+14,y+43,w-28);this.buttons.push({x,y,w,action});
      };
      this.buttons=[];
      if(this.practice && this.el.fkcExercises.active!==this){
        wrap("Die Modelle werden erst beim Start dieser Übung geladen.",229);
        button(32,314,960,"Übung starten",()=>this.el.fkcExercises.activate(this));
        this.texture.needsUpdate=true;return;
      }
      if(this.investigation){this.renderStudy(ctx,button,wrap);this.texture.needsUpdate=true;return;}
      if(this.studyMenu){
        wrap("Wähle eine freiwillige Vertiefung.",219);
        extensions[this.step].forEach((id,i)=>button(32+i*488,300,470,investigations[id].title,()=>this.openStudy(id)));
        button(32,460,960,"Ausgangsmodell neu zeigen",()=>{this.studyMenu=false;this.show();});
        button(32,620,960,"‹ Zur Aufgabe",()=>{this.studyMenu=false;this.render();});
        this.texture.needsUpdate=true;return;
      }
      if(this.contents){
        ctx.fillStyle="#eff5f0";ctx.fillRect(0,0,1024,700);ctx.fillStyle="#203f30";
        ctx.font="bold 45px Arial";ctx.fillText("YBCO · Aufgabe wählen",32,64);
        steps.forEach(([name],i)=>button(32+(i%2)*488,96+Math.floor(i/2)*83,470,`${i+1} · ${name}`,()=>this.stepTo(i),i===this.step));
        button(520,620,470,"Zur aktuellen Aufgabe",()=>{this.contents=false;this.render();});
        this.texture.needsUpdate=true;return;
      }
      if(this.step===0){
        ctx.font="26px Arial";
        ctx.fillText("Links · YBa₂Cu₃O₆.₉₁ : a 3,82274   b 3,89296   c 11,68893 Å",32,220);
        ctx.fillText("Rechts · YBa₂Cu₃O₆ : a 3,8594   b 3,8594   c 11,814 Å",32,258);
        ctx.fillText("Alle Winkel: 90°. Gleicher Maßstab für beide Modelle.",32,296,950);
      }else{
        const mirror=this.step===2;
        const coord=this.isCoordination(), cols=this.step===10?4:2;
        const span=coord?500:976, w=span/cols-12;
        options.forEach((label,i)=>button(32+(i%cols)*span/cols,199+Math.floor(i/cols)*78,w,label,()=>{
          if(this.step===10){this.sites=this.sites.includes(label)?this.sites.filter(s=>s!==label):[...this.sites,label];this.show();return;}
          if((this.step===5 || this.step===6) && i===0)this.group=Math.min(this.group+1,this.groups || 1);
          this.option=i;this.show();
        },this.step===10?this.sites.includes(label):i===this.option));
        if(coord || this.step===11){
          if(this.step!==10)button(32,355,240,this.cell?"Lokaler Ausschnitt":coord?"Zelle + Polyeder":"Elementarzelle",()=>{this.cell=!this.cell;this.show();},this.cell);
          if(coord)button(this.step===10?32:282,355,240,this.projectionVisible?"Projektion aus":"Projektion an",()=>{
            this.projectionVisible=!this.projectionVisible;this.updateHighlight();this.render();},this.projectionVisible);
        }
        if(mirror){
          ctx.fillStyle=color;wrap("VR: Trigger halten und Linie ziehen. PC: Anfang und Ende anklicken.",194);
          button(32,355,470,"Zeichnung zurücksetzen",()=>{this.mirrors=[];this.stroke=null;this.note="";this.show();});
        }
        this.projected=[];
        if((mirror || coord && this.projectionVisible) && this.projection){
          projections.forEach(([h,v,x,y,w,ht],i)=>{
            ctx.fillStyle=color;ctx.font="24px Arial";ctx.fillText(`${i?"ac":"ab"}-Projektion`,x,y-12);
            ctx.strokeStyle="#48675a";ctx.lineWidth=2;ctx.strokeRect(x,y,w,ht);
            for(const atom of this.projection){
              const px=x+w*atom.fractional[h],py=y+ht*(1-atom.fractional[v]);
              const selected=atom.cifLabel===this.selectedSite;
              if(coord)this.projected.push({x:px,y:py,label:atom.cifLabel});
              ctx.fillStyle=selected?"#ffbf16":F.CIF.elements[atom.element].color;ctx.beginPath();
              ctx.arc(px,py,selected?8:4,0,2*Math.PI);ctx.fill();
            }
            for(const axis of mirror?this.mirrors:[]){
              ctx.fillStyle=mirrorColors[axis];
              if(axis===h)ctx.fillRect(x+w/2-2,y,4,ht);
              if(axis===v)ctx.fillRect(x,y+ht/2-2,w,4);
            }
            ctx.fillStyle=color;ctx.font="21px Arial";
            ctx.fillText("abc"[h],x+w+6,y+ht+3);ctx.fillText("abc"[v],x-19,y+13);
          });
          ctx.fillStyle=color;ctx.font="22px Arial";
          const selectedText=this.selectedSite ? `Markiert: ${this.selectedSite}${this.highlights?.length?"":" · nicht im Ausschnitt"}` : "Klick markiert den CIF-Platz";
          ctx.fillText(mirror?"Schematisch · Ebenen in Kantenansicht":selectedText,524,420,470);
          if(mirror && this.stroke){ctx.strokeStyle="#ad6617";ctx.lineWidth=4;ctx.beginPath();
            ctx.moveTo(this.stroke.start.x,this.stroke.start.y);ctx.lineTo(this.stroke.end.x,this.stroke.end.y);ctx.stroke();}
        }
      }
      if(this.note || this.detail){ctx.font="27px Arial";ctx.fillText(this.note || this.detail,32,449,960);}
      if(this.analysis)wrap(answer,475);
      button(32,540,310,this.analysis?"Lösung ausblenden":"Lösung anzeigen",()=>{this.analysis=!this.analysis;this.render();},this.analysis);
      if(extensions[this.step])button(356,540,310,"Weiter untersuchen",()=>{this.studyMenu=true;this.render();});
      else button(356,540,310,"Schritt neu zeigen",()=>this.show());
      if(this.practice){
        button(680,540,310,"Übung neu beginnen",()=>this.stepTo(this.step));
        button(32,620,960,"Übung beenden",()=>this.stopPractice());
      }else{
        button(680,540,310,"Aufgaben wählen",()=>{this.contents=true;this.render();});
        if(this.step>0)button(32,620,470,"‹ Zurück",()=>this.stepTo(this.step-1));
        if(this.step<steps.length-1)button(520,620,470,"Weiter ›",()=>this.stepTo(this.step+1));
      }
      this.texture.needsUpdate=true;
    },
    click(uv,input){
      if(!uv)return;
      const p=boardPoint(uv),{x,y}=p;
      const now=input?.now;
      if(now!==undefined && now<(this.nextClick || 0))return;
      const action=this.buttons.find(b=>x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+68);
      if(action){if(now!==undefined)this.nextClick=now+650;action.action();return;}
      if(this.contents || this.studyMenu || this.investigation || this.practice && this.el.fkcExercises.active!==this)return;
      if(this.step===2 && projections.some(([, ,a,b,w,h])=>x>=a-12 && x<=a+w+12 && y>=b-12 && y<=b+h+12)){
        if(this.stroke){if(!input?.xr){this.stroke.end=p;this.finishStroke();}}
        else {this.stroke={start:p,end:p,xr:!!input?.xr};this.render();}
      }else if(this.isCoordination() && this.projectionVisible){
        const hits=(this.projected || []).map(q=>({...q,d:Math.hypot(q.x-x,q.y-y)})).filter(q=>q.d<=12).sort((a,b)=>a.d-b.d);
        const labels=[...new Set(hits.map(q=>q.label))];
        if(labels.length)this.highlight(labels.length===1?labels[0]:labels[(labels.indexOf(this.selectedSite)+1)%labels.length]);
      }
    },
    clear(){
      this.clearHighlights();
      for(const root of this.roots){
        F.releaseModel(root);F.Draw?.clear(root);
        const scene=this.el.sceneEl;
        scene?.components["fkc-measurements"]?.reset(root);
        if(scene?.lastSelectedModel===root)scene.lastSelectedModel=null;
        if(scene?.lastSelectedTarget===root)scene.lastSelectedTarget=null;
        root.remove();
      }
      this.roots=[];
    },
    remove(){
      if(this.el.fkcExercises?.active===this)this.el.fkcExercises.active=null;
      this.clear();this.texture.dispose();this.geometry.dispose();this.material.dispose();
    }
  });
})(window.FKCVR);