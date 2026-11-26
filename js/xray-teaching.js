"use strict";

// Lehrtafeln und Reflexinspektion nutzen dieselbe Geometrie wie der Detektor.
(function (F) {
  const T = AFRAME.THREE;
  const gold = 0xffd350;
  const assetDir = "./assets/xray/";

  function canvasMap(demo, w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const texture = new T.CanvasTexture(canvas);
    texture.encoding = T.sRGBEncoding;
    texture.minFilter = T.LinearFilter; texture.generateMipmaps = false;
    demo.textures.add(texture);
    return {ctx: canvas.getContext("2d"), texture, w, h};
  }

  function board(demo, w, h, width, position) {
    const panel = canvasMap(demo, w, h);
    const mesh = new T.Mesh(demo.trackGeometry(new T.PlaneGeometry(width, width*h/w)),
      demo.trackMaterial(new T.MeshBasicMaterial({map: panel.texture, toneMapped: false})));
    mesh.position.set(...position); demo.model.add(mesh);
    return panel;
  }

  function text(ctx, value, x, y, size, color = "#eaf5fa", max = 960) {
    ctx.fillStyle = color; ctx.font = `${size}px Arial, sans-serif`;
    ctx.fillText(value, x, y, max);
  }

  function spectra(demo) {
    const {ctx, texture} = board(demo, 1024, 560, 4.4, [-2.6, 2.6, 2.65]);
    ctx.fillStyle = "#102738"; ctx.fillRect(0, 0, 1024, 560);
    text(ctx, "Was wählt der Graphit-Monochromator aus?", 22, 52, 42);
    for (const after of [false, true]) {
      const x = after ? 574 : 65, w = 390, base = 339;
      text(ctx, after ? "An der Probe" : "Vor der Optik", x, 105, 34);
      text(ctx, "relative Intensität", x, 143, 23);
      const pass = e => Math.exp(-0.5*((e-17.44)/0.36)**2);
      const background = e => 0.49*(1-Math.exp(-e/4))*(1-e/50);
      const X = e => x+w*e/50, Y = v => base-172*v;
      ctx.strokeStyle = "#b7ccd8"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, 158); ctx.lineTo(x,base); ctx.lineTo(x+w,base); ctx.stroke();
      ctx.strokeStyle = "#ffba74"; ctx.lineWidth = 4; ctx.beginPath();
      for (let i=0;i<=500;i++) {
        const e = i/10, y=Y(background(e)*(after ? pass(e) : 1));
        if (!i) ctx.moveTo(x,y); else ctx.lineTo(X(e),y);
      }
      ctx.stroke();
      // Same energy and intensity axes. The α doublet is unresolved at this scale.
      for (const [e, strength] of [[17.37,0.30],[17.48,0.62],[19.61,0.18]]) {
        const transmission = after ? pass(e) : 1;
        ctx.strokeStyle = e < 18 ? "#73ffa3" : "#dc7aff";
        ctx.beginPath(); ctx.moveTo(X(e),Y(background(e)*transmission));
        ctx.lineTo(X(e),Y((background(e)+strength)*transmission)); ctx.stroke();
      }
      text(ctx,"Kα₁/₂",X(17.4)-37,174,22,"#73ffa3");
      if (!after) text(ctx,"Kβ",X(19.6)+6,245,22,"#dc7aff");
      for (const e of [0, 10, 20, 30, 40, 50]) text(ctx, String(e), X(e)-9, 368, 22);
      text(ctx, "Photonenenergie / keV", x+64, 401, 24);
    }
    text(ctx,"Die Optik wählt einen Energiebereich – nicht den Entstehungsprozess.",22,461,29);
    text(ctx,"Auch Bremsstrahlung im Durchlassbereich kann die Probe erreichen.",22,499,28);
    text(ctx,"Qualitatives Modell · keine gemessene Transmissionskurve eures Geräts.",22,539,25,"#b8d4df");
    texture.needsUpdate = true;
  }

  function frameBoard(demo) {
    const {ctx, texture} = board(demo, 1024, 760, 4.4, [-3.6, 1.0, 9.4]);
    const image = new Image();
    let metadata = {}, loaded = false;
    function draw() {
      if (demo.removed) return;
      ctx.fillStyle = "#102738"; ctx.fillRect(0,0,1024,760);
      text(ctx,"Vergleich: ein einzelner Messframe",24,54,42);
      ctx.fillStyle="#07111c"; ctx.fillRect(24,76,976,485);
      if (loaded) {
        const scale=Math.min(976/image.naturalWidth,485/image.naturalHeight);
        const w=image.naturalWidth*scale,h=image.naturalHeight*scale,x=512-w/2,y=318.5-h/2;
        ctx.drawImage(image,x,y,w,h);
        for (const [key,label] of [["reflection","Reflex"],["background","Untergrund"],["beamstop","Beamstop-Schatten"]]) {
          const p=metadata.markers?.[key];
          if (!Array.isArray(p)||p.length!==2||!p.every(v=>Number.isFinite(v)&&v>=0&&v<=1)) continue;
          const px=x+p[0]*w, py=y+p[1]*h;
          ctx.strokeStyle="#ffe16a";ctx.lineWidth=3;ctx.beginPath();ctx.arc(px,py,9,0,2*Math.PI);ctx.stroke();
          const tx=Math.min(780,px+15), ty=Math.max(101,py-12);
          ctx.font="23px Arial, sans-serif";
          ctx.fillStyle="#142936";ctx.fillRect(tx-2,ty-23,ctx.measureText(label).width+8,29);
          text(ctx,label,tx,ty,23,"#ffe16a");
        }
      } else {
        text(ctx,"Platzhalter – noch kein Messbild hinterlegt",100,286,37);
        text(ctx,"Hier erscheint später der PNG-Export eures Detektors.",100,345,30,"#b8d4df");
      }
      const value=(key,unit)=>Number.isFinite(metadata[key]) ? String(metadata[key]).replace(".",",")+" "+unit : "nicht angegeben";
      text(ctx,`Abstand: ${value("distanceMm","mm")}   ·   Belichtung: ${value("exposureS","s")}`,24,612,29);
      text(ctx,`λ: ${value("wavelengthA","Å")}   ·   Δω: ${value("deltaOmegaDeg","°")}`,24,657,29);
      text(ctx,"Messdaten unabhängig von der Simulation · kein berechnetes Winkelraster im Foto",24,722,25,"#b8d4df");
      texture.needsUpdate=true;
    }
    draw();
    image.onload=()=>{loaded=true;draw();};
    image.src=assetDir+"messframe.png";
    fetch(assetDir+"messframe.json").then(r=>r.ok?r.json():null).then(m=>{
      if (m && !demo.removed) {metadata=m;draw();}
    }).catch(()=>{}); // Das Bild funktioniert auch ohne Metadaten.
  }

  function selection(demo) {
    const group = new T.Group(); group.visible=false; demo.scattering.add(group);
    const planes = new T.Group(); group.add(planes);
    const planeMaterial=demo.trackMaterial(new T.MeshBasicMaterial({color:gold,side:T.DoubleSide,transparent:true,opacity:0.42,depthWrite:false}));
    const geom=demo.trackGeometry(new T.PlaneGeometry(0.38,0.38));
    for (let i=-1;i<=1;i++) {const p=new T.Mesh(geom,planeMaterial);p.position.z=i*0.07;planes.add(p);}
    function line(color,n) {
      const geometry=demo.trackGeometry(new T.BufferGeometry());
      const attr=new T.Float32BufferAttribute(new Float32Array(3*n),3);geometry.setAttribute("position",attr);
      const object=new T.Line(geometry,demo.trackMaterial(new T.LineBasicMaterial({color,depthTest:false})));
      object.renderOrder=2;object.frustumCulled=false;group.add(object);
      return fn=>{for(let i=0;i<n;i++){const v=fn(i/(n-1));attr.setXYZ(i,v.x,v.y,v.z);}attr.needsUpdate=true;};
    }
    const ray=line(gold,2), forward=line(0x73ffa3,2), tangent=line(0xffbc7a,2), arc1=line(0xffbc7a,33), arc2=line(gold,33);
    function label(w,h,width) {
      const {ctx,texture}=canvasMap(demo,w,h);
      const sprite=new T.Sprite(demo.trackMaterial(new T.SpriteMaterial({map:texture,depthWrite:false,depthTest:false,toneMapped:false})));
      sprite.renderOrder=3;sprite.scale.set(width,width*h/w,1);sprite.raycast=()=>{};group.add(sprite);
      return (value,pos)=>{ctx.fillStyle="#122837";ctx.fillRect(0,0,w,h);text(ctx,value,8,h*.74,h*.65,"#ffe190",w-16);texture.needsUpdate=true;sprite.position.copy(pos);};
    }
    const thetaLabel=label(144,64,.32),twoLabel=label(160,64,.36),spotLabel=label(620,70,1.55);
    const z=new T.Vector3(0,0,1),fmt=r=>(r*180/Math.PI).toFixed(1).replace(".",",");
    return {hide(){group.visible=false;},show(point){
      const normal=point.g.clone().applyQuaternion(demo.rotationQ).normalize();
      const along=z.clone().addScaledVector(normal,-normal.z).normalize();
      const twoTheta=z.angleTo(point.direction), theta=z.angleTo(along);
      planes.quaternion.setFromUnitVectors(z,normal);
      const end=point.direction.clone().multiplyScalar(point.distance);
      ray(t=>end.clone().multiplyScalar(t));
      forward(t=>z.clone().multiplyScalar(1.8*t));
      tangent(t=>along.clone().multiplyScalar(1.35*t));
      function arc(to,angle,r,t) {
        const lateral=to.clone().addScaledVector(z,-to.z).normalize();
        return z.clone().multiplyScalar(r*Math.cos(angle*t)).addScaledVector(lateral,r*Math.sin(angle*t));
      }
      arc1(t=>arc(along,theta,0.98,t)); arc2(t=>arc(point.direction,twoTheta,1.62,t));
      thetaLabel("θ",arc(along,theta,1.08,0.5)); twoLabel("2θ",arc(point.direction,twoTheta,1.72,0.5));
      spotLabel(`(${point.key.replaceAll(","," ")})  θ ≈ ${fmt(theta)}°  ·  2θ = ${fmt(twoTheta)}°`,end.clone().add(new T.Vector3(0,0.23,-0.06)));
      group.visible=true;
    }};
  }
  F.XrayTeaching = {spectra, frameBoard, selection};
})(window.FKCVR);