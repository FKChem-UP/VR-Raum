"use strict";

(function(F){
  const T=AFRAME.THREE;
  const ortho="YBa2Cu3O7_2026.cif", tetra="YBa2Cu3O6_tetragonal_HT.cif", perov="CaTiO3.cif";
  const steps=[
    ["Kristallsysteme vergleichen","Welche Zellparameter verraten das Kristallsystem?","O₆: a = b ≠ c → tetragonal (P4/mmm). O₆.₉₁: a ≠ b ≠ c → orthorhombisch (Pmmm).",["Phasenvergleich"]],
    ["P-, I- und F-Zentrierung","Wohin müsste das Eck-Cu bei I- oder F-Zentrierung abgebildet werden?","P ist primitiv. Y in der Mitte ersetzt kein übersetztes Eck-Cu. Aus den CIF-Plätzen entstehen trotzdem Symmetrieabbilder, z. B. durch Spiegelung.",["P · vollständige Zelle","I · Körpermitte","F · Flächenmitten","Nur CIF-Ausgangsplätze"]],
    ["Spiegelebenen von Pmmm","Schalte die drei Ebenen nacheinander ein. Welche Positionen werden aufeinander abgebildet?","Die drei m stehen für Spiegelebenen senkrecht zu a, b und c. Gezeigt sind repräsentative Ebenen bei ½.",["Ohne Ebenen","⊥ a","⊥ b","⊥ c","Alle drei"]],
    ["Summenformel herleiten","Zähle jede Sorte: Ecke ⅛, Kante ¼, Fläche ½ und innen 1. Berücksichtige dann die Besetzung.","Y₁Ba₂Cu₃O₆.₉₁: O1 liegt auf vier Randabbildern mit Gewicht ¼ und Besetzung 0,91.",["Y","Ba","Cu","O","Alle"]],
    ["Defektes Perowskitmotiv","Vergleiche die Kationenlagen mit drei kubischen CaTiO₃-Zellen entlang c. Was ändert sich im O-Gerüst?","Die idealisierte Referenz hat A₃B₃O₉. YBCO zeigt A/B-Schichtung und weniger O; der Vergleich ist keine Umwandlung.",["Kationen","Mit Sauerstoff"]],
    ["Y-Koordination","Wie viele O-Nachbarn umgeben Y? Betrachte die Gruppen nach Abstand.","Y hat acht O-Nachbarpositionen. Die orthorhombische Verzerrung spaltet die Abstände auf.",["Nächste Abstandsgruppe","Alle acht","Polyeder"]],
    ["Ba-Koordination","Ergänze die O-Nachbarn nach Abstand. Liegt Ba wirklich in der Ebene der zuerst gezeigten vier O?","4 + 2 + 2 + 2 Positionen. Die zwei O1-Abbilder sind nur zu 91 % besetzt; das ist eine mittlere Struktur.",["Nächste Abstandsgruppe","Alle zehn","Polyeder"]],
    ["Cu1 · Kettenplatz","Vergleiche den Cu1-Platz in O₆.₉₁ und O₆. Welche Nachbarn fehlen?","Cu1 hat in O₆.₉₁ zwei apikale und zwei teilbesetzte Ketten-O-Nachbarplätze; in O₆ bleiben die beiden apikalen O.",["O₆.₉₁","O₆"]],
    ["Cu2 · Ebenenplatz","Zähle die O-Nachbarn und beschreibe die Geometrie des zweiten Cu-Platzes.","Cu2 ist näherungsweise quadratisch-pyramidal koordiniert. Cu1 und Cu2 sind Platznamen, keine Oxidationszahlen.",["Nachbarn","Polyeder"]],
    ["Vier O-Plätze vergleichen","Wähle O1 bis O4. Welche Cu-, Y- oder Ba-Plätze umgeben das gewählte O?","O1 gehört zur Kette, O2 und O3 liegen in der CuO₂-Ebene. O4 verbindet als apikales O die Cu-Umgebungen.",["O1","O2","O3","O4"]],
    ["Cu–O-Ketten und CuO₂-Ebenen","Vergleiche die Ausbreitungsrichtung der Cu–O-Kette und der CuO₂-Ebene.","Die Kette läuft entlang b, die Ebene parallel zu ab. Gezeigt wird das Strukturmotiv, keine Simulation der Supraleitung.",["Kette entlang b","Ebene parallel ab","Beide Motive"]]
  ];
  const rules=[["Cu","O",2.4,"Cu1"],["Cu","O",2.6,"Cu2"],["Y","O",2.65],["Ba","O",3.15]];
  const chemicalRules=[["Cu","O",2.4,"Cu1"],["Cu","O",2.6,"Cu2"]];
  const S=()=>F.StructureCell;
  const cart=(p,c)=>F.CIFStructure.cartesian(p,c.cellMatrix);

  function closed(cell, filter=()=>true){
    const atoms=S().closedImages(cell).filter(filter);
    return {...cell,atoms,measurePositions:true};
  }

  function shell(source,label,group=Infinity,poly=false){
    const cell=S().network(S().read(source),rules);
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
      measurePositions:true,defaultStyle:polyhedra.length?"polyhedral":"ball-stick",
      distanceGroups:groups.map(g=>({count:g.length,distance:g[0].distanceAngstrom})),visibleGroups:Math.min(group,groups.length)};
  }

  function motif(source,mode){
    const cell=S().network(S().read(source),chemicalRules);
    const seeds=[];
    const include=(a,f)=>mode!=="plane" && ["Cu1","O1"].includes(a.cifLabel) && Math.abs(f[2])<1e-6 && f[0]===0 ||
      mode!=="chain" && ["Cu2","O2","O3"].includes(a.cifLabel) && f[2]>0.3 && f[2]<0.5;
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)cell.atoms.forEach((atom,siteIndex)=>{
      const cellShift=[x,y,0],fractional=atom.fractional.map((v,i)=>v+cellShift[i]);
      if(include(atom,fractional))seeds.push({...atom,siteIndex,cellShift,fractional,id:S().imageId(atom,cellShift),positionAngstrom:cart(fractional,cell)});
    });
    return {...cell,...S().expandContacts(cell,cell.bonds,seeds,0),mode:"sites",measurePositions:true};
  }

  function structure(source,mode){
    const [view,arg,amount]=mode.split(":");
    if(view==="shell")return shell(source,arg,amount==="poly"?Infinity:Number(amount || Infinity),amount==="poly");
    if(view==="motif")return motif(source,arg);
    let cell=S().read(source);
    if(view==="centering" && arg==="explicit")cell=S().read(source,{explicit:true});
    if(view==="perov"){
      cell=S().supercell({...cell,hydrogenContacts:[]},[1,1,3]);
      return closed({...cell,mode:"cell"},a=>arg!=="cations" || a.element!=="O");
    }
    if(!["compare","centering","mirror","count","cations"].includes(view))throw new Error("Unbekannte YBCO-Lehransicht: "+view);
    const model=closed(cell,a=>view!=="count" || arg==="all" || a.element===arg);
    if(view==="centering" || view==="mirror" || view==="compare")model.lessonOverlay={cell,view,arg};
    if(view==="cations")model.atoms=model.atoms.filter(a=>a.element!=="O");
    return model;
  }

  function overlay(group,{cell,view,arg},resources){
    const add=(geometry,material,position)=>{
      const mesh=new T.Mesh(geometry,material);mesh.position.fromArray(position);mesh.raycast=()=>{};
      mesh.userData.fkcDrawing=true;group.add(mesh);resources.push(geometry,material);return mesh;
    };
    if(view==="centering"){
      const edge=cell.atoms.find(a=>a.cifLabel==="Cu1");
      if(edge)add(new T.SphereGeometry(0.47,16,12),new T.MeshBasicMaterial({wireframe:true,color:"#ed882b"}),edge.positionAngstrom);
      const copies=arg==="I"?[[.5,.5,.5]]:arg==="F"?[[.5,.5,0],[.5,0,.5],[0,.5,.5]]:[];
      for(const p of copies)add(new T.SphereGeometry(.39,16,12),new T.MeshBasicMaterial({wireframe:true,color:"#642dc9"}),cart(p,cell));
    }
    if(view==="mirror"){
      for(const axis of arg==="all"?[0,1,2]:arg==="none"?[]:[Number(arg)]){
        const other=[0,1,2].filter(i=>i!==axis), coords=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];
        const positions=coords.flatMap(([u,v])=>{const p=[.5,.5,.5];p[other[0]]=u;p[other[1]]=v;return cart(p,cell);});
        const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));
        add(geometry,new T.MeshBasicMaterial({color:["#eb4335","#279456","#426add"][axis],transparent:true,opacity:.32,depthWrite:false,side:T.DoubleSide}),[0,0,0]);
      }
    }
  }

  // Eine Zustandsbeschreibung pro Lehrschritt, keine dauerhaft geladenen Podeste.
  function models(step,option,group){
    const model=(file,mode,title,center)=>({model:"assets/praktikum/"+file,cifMode:"ybco-lesson:"+mode,title,center});
    const o=[1.91137,1.94648,5.844465], t=[1.9297,1.9297,5.907], p=[1.8975,1.8975,5.6925];
    const main=(mode,title)=>model(ortho,mode,title,mode.startsWith("shell:")?[0,0,0]:o);
    if(step===0)return [main("compare","Phase A"),model(tetra,"compare","Phase B",t)];
    if(step===1)return [main("centering:"+["P","I","F","explicit"][option],"Pmmm · Zentrierung")];
    if(step===2)return [main("mirror:"+["none",0,1,2,"all"][option],"Pmmm · Spiegelebenen")];
    if(step===3)return [main("count:"+["Y","Ba","Cu","O","all"][option],"Summenformel · Randanteile")];
    if(step===4)return [main(option?"compare":"cations","YBa₂Cu₃O₆.₉₁"),model(perov,"perov:"+(option?"all":"cations"),"CaTiO₃ · 1 × 1 × 3",p)];
    if(step===5 || step===6){const label=step===5?"Y":"Ba";return [main(`shell:${label}1:${option===2?"poly":option===1?"Infinity":group}`,label+"–O · Abstandsgruppen")];}
    if(step===7)return [model(option?tetra:ortho,"shell:Cu1",option?"Cu1 · O₆":"Cu1 · O₆.₉₁",[0,0,0])];
    if(step===8)return [main("shell:Cu2:"+(option?"poly":"Infinity"),"Cu2 · Ebenenplatz")];
    if(step===9)return [main("shell:O"+(option+1),"O"+(option+1)+" · Cu-Nachbarn")];
    return [main("motif:"+["chain","plane","both"][option],"Cu–O · Strukturmotive")];
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
      station({step,x:rear?(step-9)*4.55:left?-7.8:7.8,y:1.94,
        z:rear?-17.8:-6.3-(step%4)*2.85,angle:rear?0:left?90:-90});
    });
    return {spawn:{x:0,z:3.3},isWalkable:(x,z)=>Math.abs(x)<8.55 && z>-18.5 && z<6.55 &&
      !(Math.abs(x)<4.35 && Math.abs(z+3.65)<.20) &&
      !obstacles.some(p=>Math.abs(x-p.x)<p.w/2+.14 && Math.abs(z-p.z)<p.depth/2+.14)};
  }

  F.YbcoLesson={steps,structure,models,overlay,build};
  AFRAME.registerComponent("fkc-ybco-lesson",{
    init(){
      this.el.dataset.fkcStructureTablet="true";
      this.practice=Number.isInteger(this.el.fkcExerciseStep);
      this.step=this.practice?this.el.fkcExerciseStep:0;
      this.option=0;this.group=1;this.roots=[];this.analysis=false;this.contents=false;
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
      const records=models(this.step,this.option,this.group);
      this.detail="";this.projection=null;
      this.roots=records.map((record,i)=>{
        const root=this.el.fkcLessonModel(record,i,records.length);
        const visual=root.querySelector(".model-visual");
        visual.addEventListener("model-loaded",()=>{
          if(!this.roots.includes(root))return;
          const s=visual.fkcStructure;
          if(this.step===2)this.projection=s;
          if(s?.distanceGroups){
            this.groups=s.distanceGroups.length;
            this.detail=s.distanceGroups.slice(0,s.visibleGroups).map(g=>`${g.count} × ${g.distance.toFixed(3)} Å`).join("   ·   ");
          }
          this.render();
        },{once:true});
        visual.addEventListener("model-error",()=>{
          if(this.roots.includes(root)){this.detail="Modell konnte nicht geladen werden: "+record.title;this.render();}
        },{once:true});
        return root;
      });
      this.render();F.invalidateHits?.();
    },
    stepTo(step){this.step=step;this.option=0;this.group=1;this.groups=0;this.analysis=false;this.contents=false;this.show();},
    render(){
      const ctx=this.canvas.getContext("2d"),[title,question,answer,options]=steps[this.step];
      const color=this.practice?"#355669":"#234a37";
      ctx.fillStyle=this.practice?"#eaf2f7":"#eff5f0";ctx.fillRect(0,0,1024,700);
      ctx.fillStyle=color;ctx.fillRect(0,0,1024,88);
      ctx.fillStyle="#ffffff";ctx.font="bold 23px Arial";ctx.fillText(this.practice?"SELBSTSTÄNDIG ÜBEN":"GEFÜHRTE LEHRSTATION",32,29);
      ctx.font="bold 43px Arial";ctx.fillText(`${this.step+1}/11 · ${title}`,32,72,960);
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
      if(this.contents){
        ctx.fillStyle="#eff5f0";ctx.fillRect(0,0,1024,700);ctx.fillStyle="#203f30";
        ctx.font="bold 45px Arial";ctx.fillText("YBCO · Aufgabe wählen",32,64);
        steps.forEach(([name],i)=>button(32+(i%2)*488,96+Math.floor(i/2)*83,470,`${i+1} · ${name}`,()=>this.stepTo(i),i===this.step));
        button(520,620,470,"Zur aktuellen Aufgabe",()=>{this.contents=false;this.render();});
        this.texture.needsUpdate=true;return;
      }
      if(this.step===0){
        ctx.font="26px Arial";
        ctx.fillText("A:  a 3,82274   b 3,89296   c 11,68893 Å  ·  links",32,220);
        ctx.fillText("B:  a 3,8594     b 3,8594     c 11,814 Å       ·  rechts",32,258);
        ctx.fillText("Alle Winkel: 90°. Beide Modelle verwenden denselben Maßstab.",32,296,950);
      }else{
        const mirror=this.step===2;
        options.forEach((label,i)=>button(32+(i%2)*(mirror?238:488),199+Math.floor(i/2)*78,mirror?221:470,label,()=>{
          if((this.step===5 || this.step===6) && i===0)this.group=Math.min(this.group+1,this.groups || 1);
          this.option=i;this.show();
        },i===this.option));
        if(mirror && this.projection){
          const colors=["#eb4335","#279456","#426add"], shown=this.option===4?[0,1,2]:this.option?[this.option-1]:[];
          [[0,1,"ab"],[0,2,"ac"]].forEach(([h,v,name],i)=>{
            const x=524+i*228, y=240, w=146, ht=148;
            ctx.fillStyle="#203f30";ctx.font="24px Arial";ctx.fillText(`${name}-Projektion`,x,y-12);
            ctx.strokeStyle="#48675a";ctx.lineWidth=2;ctx.strokeRect(x,y,w,ht);
            for(const atom of this.projection.atoms){
              ctx.fillStyle=F.CIF.elements[atom.element].color;ctx.beginPath();
              ctx.arc(x+w*atom.fractional[h],y+ht*(1-atom.fractional[v]),4,0,2*Math.PI);ctx.fill();
            }
            for(const axis of shown){
              ctx.fillStyle=colors[axis];
              if(axis===h)ctx.fillRect(x+w/2-2,y,4,ht);
              if(axis===v)ctx.fillRect(x,y+ht/2-2,w,4);
            }
          });
          ctx.fillStyle="#203f30";ctx.font="22px Arial";ctx.fillText("Schematisch · nur Ebenen in Kantenansicht",524,420,470);
        }
      }
      if(this.detail){ctx.font="27px Arial";ctx.fillText(this.detail,32,449,960);}
      if(this.analysis)wrap(answer,475);
      button(32,540,310,this.analysis?"Lösung ausblenden":"Lösung anzeigen",()=>{this.analysis=!this.analysis;this.render();},this.analysis);
      button(356,540,310,"Schritt neu zeigen",()=>this.show());
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
    click(uv){if(uv){const x=uv.x*1024,y=(1-uv.y)*700;this.buttons.find(b=>x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+68)?.action();}},
    clear(){
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