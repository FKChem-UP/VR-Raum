"use strict";

(function (F) {
  const T = AFRAME.THREE;
  const source = "assets/structures/Co-Produkt1.cif";
  const modelPosition = [-0.65, 1.3, 3.5];
  const boardWidth = 1.4, boardHeight = 0.875;
  const tasksPerPage = 6;
  const tasks = ["Bewegen und drehen", "Greifen und bewegen", "Mit zwei Grips vergrößern",
    "Handmenü öffnen", "Koordinationsansicht wählen", "Eine Distanz messen", "Einen Winkel messen",
    "Zum Molekül wechseln", "H-Atome ausblenden", "Umgebung bei 3 Å anzeigen",
    "Ein transparentes Molekül anklicken", "Umgebung wieder ausblenden"];
  const hints = ["Links bewegen, rechts drehen. Geh zum Co-Modell.",
    "Halte einen Grip und verschiebe das Modell mindestens 15 cm.",
    "Halte beide Grips und zieh die Hände auseinander (140 %).",
    "Lass beide Grips los. Dreh die Hand ohne Laser zu dir.",
    "Wähle im Handmenü unter Ansicht: Koordination.",
    "Wähle Distanz und klicke zwei Atome oder eine Bindung an.",
    "Wähle Winkel und klicke drei Atome an: Das zweite ist der Scheitel.",
    "Wähle im Handmenü unter Ansicht: Molekül.",
    "Drücke im Handmenü auf H-Atome, um sie auszublenden.",
    "Wähle bei Umgebung den Button 3 (Ångström).",
    "Klicke mit dem Trigger auf ein transparentes Molekül, nicht auf ein einzelnes Ion.",
    "Wähle bei Umgebung Aus. Das übernommene Molekül soll sichtbar bleiben."];
  const palm = hand => hand === "left" ? "rechte Handfläche" : "linke Handfläche";
  const menuTargets = {4: "variant:tutorial-coordination", 5: "measure:distance", 6: "measure:angle",
    7: "variant:tutorial-complex", 8: "hide-hydrogen", 9: "environment:3", 11: "environment:off"};
  function hasSelectedMolecule(environment) {
    return !!environment && [...environment.selected].some(id =>
      environment.records.get(id)?.candidate?.atoms.length > 1);
  }
  function crossed(previous, current, width = 1.4, height = 0.8) {
    if (!previous || previous.z <= 0 || current.z > 0) return false;
    const t = previous.z / (previous.z - current.z);
    return Math.abs(previous.x + t * (current.x - previous.x)) <= width / 2 &&
      Math.abs(previous.y + t * (current.y - previous.y)) <= height / 2;
  }
  F.Tutorial = {
    active: false, crossed, hasSelectedMolecule, palm,
    allowsModel(root) { return !!root && ["tutorial-co-model", "tutorial-bf3-model"].includes(root.id) && this.active && root.object3D.visible; },
    measurementTarget(mesh, mode) {
      const data = mesh.userData;
      return !data.fkcEnvironmentId && (!!data.fkcAtom || (mode === "distance" &&
        Number.isInteger(data.fkcBond?.a) && Number.isInteger(data.fkcBond?.b)));
    },
    menuTarget(scene, root) {
      const chapter = scene.components["fkc-tutorial"];
      if (this.active && chapter?.phase === "bragg" && chapter.selectedAnimation === root && !F.Menu?.opened) {
        if(chapter.animationStep===7 && chapter.animation?.state.source!=="mo") return "source:mo";
        if(chapter.animationStep===7 && chapter.animation?.state.sweep) return null;
        return F.Bragg.cues[chapter.animationStep] || null;
      }
      if (!this.allowsModel(root) || F.Menu?.opened || root.fkcPendingVisual) return null;
      const tutorial = scene.components["fkc-tutorial"];
      if (!tutorial || tutorial.phase !== "training" || tutorial.target !== root) return null;
      const target = menuTargets[tutorial.step];
      // Nicht zum erneuten Klick auffordern: Er würde den Messmodus abschalten.
      if (F.Measure?.enabled && target === "measure:" + F.Measure.mode) return null;
      return target || null;
    },
    hasMeasurement(records, root, mode) {
      const visual = root.querySelector(".model-visual");
      return !!visual && (records || []).some(record => record.root === root && record.visual === visual && record.measurementMode === mode);
    },
    progress(step, near, moved, hands, scale, tools = {}) {
      if (step === 0 && near) return 1;
      if (step === 1 && hands >= 1 && moved >= 0.15) return 2;
      if (step === 2 && hands === 2 && scale >= 1.4) return 3;
      if (step === 3 && tools.handMenu) return 4;
      if (step === 4 && tools.coordination) return 5;
      if (step === 5 && tools.coordination && tools.distance) return 6;
      if (step === 6 && tools.coordination && tools.angle) return 7;
      if (step === 7 && tools.molecule) return 8;
      if (step === 8 && tools.molecule && tools.hydrogenHidden) return 9;
      if (step === 9 && tools.molecule && tools.hydrogenHidden && tools.environment3) return 10;
      if (step === 10 && tools.molecule && tools.environment3 && tools.selectedMolecule) return 11;
      if (step === 11 && tools.molecule && tools.environmentOff && tools.selectedMolecule) return 12;
      return step;
    },
    start() {
      const scene = F.getScene();
      if (!scene.is("vr-mode")) { F.setStatus("Tutorial bitte mit VR-Brille starten."); return; }
      const component = scene.components["fkc-tutorial"];
      if (component) { component.close(); F.app.changeRoom("welcome"); component.pending = "training"; }
    },
    close() { const component = F.getScene().components["fkc-tutorial"]; if (component) component.close(); },
    click(hit) { const component = F.getScene().components["fkc-tutorial"]; if (component) component.click(hit); }
  };
  AFRAME.registerComponent("fkc-tutorial", {
    init: function () {
      this.pending = null;
      this.previous = null;
      this.head = new T.Vector3();
      this.local = new T.Vector3();
      this.modelWorld = new T.Vector3();
      this.trainingBackground = new T.Color("#edf0f3");
      this.group = F.create("a-entity", {}, this.el);
      this.group.object3D.visible = false;
      this.canvas = document.createElement("canvas");
      this.canvas.width = 1024; this.canvas.height = 640;
      this.texture = new T.CanvasTexture(this.canvas);
      this.geometry = new T.PlaneGeometry(boardWidth, boardHeight);
      this.material = new T.MeshBasicMaterial({map: this.texture, side: T.DoubleSide,
        transparent: true, opacity: 1, fog: false, depthTest: false, depthWrite: false});
      this.board = F.create("a-entity", {class: "vr-action"}, this.group);
      this.board.dataset.fkcTutorial = "true";
      const mesh = new T.Mesh(this.geometry, this.material);
      mesh.renderOrder = 10000; // Deckende Canvasfläche zuletzt über Demo-Labels zeichnen.
      mesh.frustumCulled = false;
      this.board.setObject3D("mesh", mesh);
      this.cursorGeometry = new T.CircleGeometry(0.018, 24);
      this.cursorMaterial = new T.MeshBasicMaterial({color: "#a32b17", side: T.DoubleSide,
        transparent: true, depthTest: false, depthWrite: false, toneMapped: false});
      this.cursor = new T.Mesh(this.cursorGeometry, this.cursorMaterial);
      this.cursor.renderOrder = mesh.renderOrder + 1;
      this.cursor.frustumCulled = false;
      this.cursor.raycast = function () {};
      this.cursor.visible = false;
      this.board.object3D.add(this.cursor);
      this.floor = F.create("a-plane", {width: 18, height: 16, rotation: "-90 0 0",
        material: {shader: "flat", color: "#d5dce2"}}, this.group);
      this.grid = new T.GridHelper(16, 16, "#b3bec8", "#bfc9d2");
      this.grid.position.y = 0.002;
      this.group.object3D.add(this.grid);
      this.target = F.create("a-entity", {id: "tutorial-co-model", class: "interactable"}, this.group);
      this.target.dataset.title = "Tutorial: Co-Komplex";
      this.target.fkcModelSize = 0.7;
      this.target.fkcVariantAlignment = "individual";
      this.target.fkcVariants = [
        {id: "tutorial-complex", title: "Co-Komplex", model: source, cifMode: "molecule"},
        {id: "tutorial-coordination", title: "Co-Koordinationsansicht", model: source, cifMode: "coordination"}
      ];
      this.target.modelReady = false;
      this.body = F.create("a-entity", {class: "manip-body"}, this.target);
      F.create("a-box", {class: "hitbox", width: 0.76, height: 0.76, depth: 0.76, visible: false}, this.body);
      this.target.setAttribute("fkc-manipulable", "");
      F.create("a-entity", {light: {type: "ambient", intensity: 0.7}}, this.group);
      F.create("a-entity", {position: "-2 5 6", light: {type: "directional", intensity: 0.7}}, this.group);
      this.hiddenOverlays = new Map();
      this.enter = () => { this.close(); this.pending = "question"; };
      this.exit = () => { this.pending = null; this.close(); };
      this.el.addEventListener("enter-vr", this.enter);
      this.el.addEventListener("exit-vr", this.exit);
    },
    show: function (phase) {
      F.releaseHands();
      F.Menu.close();
      if (F.Draw) F.Draw.setMode("laser");
      const handMenu = this.el.components["fkc-hand-menu"];
      if (handMenu) handMenu.hide();
      this.phase = phase;
      if (F.PicoModels) F.PicoModels.tutorial(phase === "training" ? 0 : phase === "question" ? "question" : -1);
      if (phase === "training") {
        this.step = 0;
        this.target.object3D.position.set(...modelPosition);
        this.target.homePosition = this.target.object3D.position.clone();
        this.body.object3D.scale.setScalar(1);
        this.body.object3D.quaternion.identity();
        this.taskOrigin = this.target.object3D.position.clone();
        this.target.fkcVariantId = "tutorial-complex";
        this.target.fkcHideHydrogen = false;
        this.target.modelReady = false;
        const visual = F.create("a-entity", {class: "model-visual",
          "fkc-normalize": {targetSize: 0.7, padding: 0.06}}, this.body);
        F.loadModelVisual(visual, source, "molecule");
        if (F.Measure && F.Measure.enabled) F.Measure.setEnabled(false);
      }
      F.Tutorial.active = true;
      this.group.object3D.visible = true;
      // Nur die Zutrittsfrage liegt über der weißen Überblendung. Im Training
      // verdecken nähere Modelle sowohl die Tafel als auch deren Laserpunkt.
      const question = phase === "question";
      this.material.transparent = question;
      this.material.depthTest = this.material.depthWrite = !question;
      this.material.needsUpdate = true;
      this.board.getObject3D("mesh").renderOrder = question ? 10000 : 0;
      this.cursorMaterial.depthTest = !question;
      this.board.object3D.position.set(phase === "question" ? 0 : 0.8, this.head.y,
        phase === "question" ? 5.1 : 2.75);
      this.board.object3D.rotation.set(0, 0, 0);
      this.board.object3D.visible = true;
      this.cursor.visible = false;
      this.previous = null;
      this.target.object3D.visible = phase !== "question";
      if (this.questionFog) { this.el.object3D.fog = this.previousFog; this.questionFog = null; }
      if (question) {
        this.previousFog = this.el.object3D.fog;
        // Kein Overlay vor dem Betrachter: volle Kontraste im Nahbereich.
        this.questionFog = new T.Fog(0xf9fafb, 1.6, 5.6);
        this.el.object3D.fog = this.questionFog;
      }
      this.floor.object3D.visible = this.grid.visible = phase !== "question";
      this.room = document.getElementById("room-root");
      if (phase !== "question" && this.room) {
        if (this.roomVisible === undefined) this.roomVisible = this.room.object3D.visible;
        this.room.object3D.visible = false;
      }
      if (phase === "training") {
        this.previousBackground = this.el.object3D.background;
        this.el.object3D.background = this.trainingBackground;
      }
      this.render();
      F.invalidateHits();
    },
    render: function () {
      const ctx = this.canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 1024, 640);
      ctx.fillStyle = "#203f30"; ctx.font = "bold 64px Arial";
      const training = this.phase === "training";
      const mirror = this.phase === "mirror";
      const mirrorDone = mirror && this.mirror.step === F.MirrorTutorial.tasks.length;
      const first = training ? Math.floor(this.step / tasksPerPage) * tasksPerPage : mirror ? Math.floor(this.mirror.step/tasksPerPage)*tasksPerPage : 0;
      const animation = this.phase === "bragg";
      const structurePractice = this.phase === "structure-practice";
      const animationPractice = animation && this.animationStep === F.Bragg.tasks.length;
      ctx.fillText(this.phase === "question" ? "Tutorial?" : structurePractice ? "Strukturteil geschafft!" :
        mirror ? (mirrorDone ? "Zeichenteil geschafft!" : `Zeichnen · ${this.mirror.step+1} / ${F.MirrorTutorial.tasks.length}`) : animationPractice ? "Animationsteil geschafft!" :
        animation ? `Animation · ${this.animationStep + 1} / ${F.Bragg.tasks.length}` :
        `Tutorial · ${this.step + 1} / ${tasks.length}`, 50, 100);
      ctx.font = "36px Arial";
      const lines = this.phase === "question" ? ["Möchtest du die Bedienung kennenlernen?",
        "Mit dem Laser zeigen und mit dem Trigger auswählen.", "Nein oder durch das Schild gehen: überspringen."] :
        mirror ? (mirrorDone ? ["BF₃ hat vier Spiegelebenen.", "Greife es und vergleiche die drei senkrechten Ebenen mit der Molekülebene."] : F.MirrorTutorial.tasks.slice(first, first+tasksPerPage)) : structurePractice ? ["Du kannst hier weiter am Co-Komplex üben.", "Starte Teil 2, wenn du bereit bist."] :
        animationPractice ? ["Probiere weitere Winkel und Tempi aus.", "Oder starte Teil 3: Zeichne den Spiegel."] :
        animation ? F.Bragg.tasks :
          tasks.slice(first, first + tasksPerPage);
      const menuPalm = training ? palm(F.HandMenu.laserHand()) : "";
      this.renderedPalm = menuPalm;
      lines.forEach((line, i) => {
        const index = first + i;
        if (training && index === 3) line += ` (${menuPalm} drehen)`;
        const current = mirror ? this.mirror.step : animation ? this.animationStep : this.step;
        const numbered = training || (animation && !animationPractice) || (mirror && !mirrorDone);
        ctx.fillStyle = numbered ? (index < current ? "#397c40" : index === current ? "#b34a21" : "#65717b") : "#203f30";
        ctx.fillText((numbered ? (index < current ? "✓ " : `${index + 1} · `) : "") + line,
          50, numbered ? 148 + i * (animation ? 32 : 41) : 180 + i * 55, 924);
      });
      if (mirror && !mirrorDone) {
        ctx.font = "30px Arial"; ctx.fillStyle = "#203f30"; ctx.fillText(F.MirrorTutorial.hints[this.mirror.step],50,451,924);
      } else if (animation && !animationPractice) {
        ctx.font = "30px Arial"; ctx.fillStyle = "#203f30";
        ctx.fillText(F.Bragg.hints[this.animationStep], 50, 451, 924);
      } else if (training) {
        ctx.font = "30px Arial";
        ctx.fillStyle = "#203f30";
        ctx.fillText(this.step === 3 ? `Lass beide Grips los und dreh die ${menuPalm} zum Kopf.` : hints[this.step], 50, 451, 924);
      }
      this.buttons = this.phase === "question" ? [{x: 80, w: 380, title: "Ja", action: () => this.show("training")},
        {x: 560, w: 380, title: "Nein", action: () => this.close()}] :
        (training || structurePractice) ? [{x: 80, w: 490, title: training ? "Überspringen → Teil 2" : "Teil 2: Bragg-Animation", action: () => { this.beginAnimation(); this.render(); }},
          {x: 600, w: 340, title: "Tutorial beenden", action: () => this.close()}] :
        animation ? [{x: 80, w: 490, title: animationPractice ? "Teil 3: Zeichne den Spiegel" : "Überspringen → Teil 3", action: () => this.beginMirror()},
          {x: 600, w: 340, title: "Zum Begrüßungsraum", action: () => this.close()}] :
        [{x: 80, w: 860, title: "Tutorial beenden", action: () => this.close()}];
      for (const button of this.buttons) {
        ctx.fillStyle = "#b9dcc4"; ctx.fillRect(button.x, 480, button.w, 100);
        ctx.fillStyle = "#203f30"; ctx.fillText(button.title, button.x + 30, 547, button.w - 60);
      }
      this.texture.needsUpdate = true;
    },
    click: function (hit) {
      if (this.phase === "mirror" && hit.el !== this.board) {
        if(hit.el===this.mirror.board && !F.Menu.opened)this.mirror.click(hit.uv);
        return;
      }
      if (this.animation && hit.el === this.animation.el) {
        if (F.Tutorial.active && this.phase === "bragg") {
          this.selectedAnimation = hit.el;
          const infoId = hit.mesh?.userData.braggInfo;
          if (infoId && this.animation.toggleInfo(infoId) && infoId === "distance" && this.animationStep === 5 &&
              F.Bragg.progress(5, true, true, false, this.animation.state, true) === 6) this.distanceInfoOpened = true;
        }
        return;
      }
      if (!F.Tutorial.active || !hit.uv) return;
      const x = hit.uv.x * 1024, y = (1 - hit.uv.y) * 640;
      const button = this.buttons.find(button => x >= button.x && x <= button.x + button.w && y >= 480 && y <= 580);
      if (button) { F.Menu.blockDrawing(); button.action(); }
    },
    updateCursor: function (hit) {
      const uv = hit && hit.el === this.board && hit.uv;
      this.cursor.visible = !!uv;
      if (uv) this.cursor.position.set((uv.x - 0.5) * boardWidth, (uv.y - 0.5) * boardHeight,
        this.phase === "question" ? 0 : 0.002);
    },
    beginMirror: function () {
      this.el.components["fkc-hand-menu"]?.hide();
      this.selectedAnimation = null;
      this.animation.dispose(); this.animation = null;
      this.phase = "mirror";
      this.previousDrawMode = F.Draw?.mode;
      F.Draw?.setMode("laser");
      this.el.lastSelectedModel = this.el.lastSelectedTarget = null;
      this.mirror = F.MirrorTutorial.station(this.group);
      this.mirrorProgress = this.mirror.step;
      this.render();
      F.invalidateHits();
    },
    beginAnimation: function () {
      F.releaseModel(this.target);
      this.target.object3D.visible = false;
      this.target.modelReady = false;
      this.el.lastSelectedModel = this.el.lastSelectedTarget = null;
      this.el.components["fkc-hand-menu"]?.hide();
      this.el.components["fkc-measurements"]?.reset(this.target);
      for (const visual of this.body.querySelectorAll(".model-visual, .pending-visual")) visual.remove();
      if (F.Measure?.enabled) F.Measure.setEnabled(false);
      F.Draw?.setMode("laser");
      this.phase = "bragg";
      this.animationStep = 0;
      this.distanceInfoOpened = false;
      this.animation = F.Bragg.station(this.group);
      this.selectedAnimation = null;
      // Der sichtbare Tutorialboden (18 × 16 m) ersetzt hier die Kollisionen
      // des ausgeblendeten Begrüßungsraums, einschließlich des Demo-Tischs.
      const room = F.app?.activeRoom;
      if (room) {
        const previous = room.isWalkable;
        const walkable = (x, z) => Math.abs(x) <= 8.7 && Math.abs(z) <= 7.7;
        room.isWalkable = walkable;
        this.restoreWalkable = () => {
          if (room.isWalkable === walkable) room.isWalkable = previous;
        };
      }
      F.invalidateHits();
    },
    tick: function (time, delta) {
      if (!this.el.is("vr-mode")) return;
      if (!F.app || !F.app.activeRoom || F.app.pendingSpawn) return;
      if (!F.HandMenu.readViewerHead(this.el, F.getRig(), this.head)) {
        this.cursor.visible = false;
        return;
      }
      if (this.pending) {
        if (F.app.currentId !== "welcome") F.app.changeRoom("welcome");
        F.app.positionAtSpawn({x: 0, z: 6.5});
        const phase = this.pending; this.pending = null;
        this.show(phase);
        return;
      }
      if (!F.Tutorial.active) return;
      // Nur die Raum-Demo ausblenden, nicht die Messlabels des Tutorials.
      if (this.phase === "question" && this.room) this.room.object3D.traverse(object => {
        if (!object.isSprite || !object.material || object.material.depthTest !== false) return;
        if (!this.hiddenOverlays.has(object)) this.hiddenOverlays.set(object, object.visible);
        object.visible = false;
      });
      // Hauptmenü hat Vorrang, danach dieselbe Aufgabe fortsetzen.
      this.board.object3D.visible = !F.Menu.opened;
      if (F.Menu.opened) {
        this.mirror?.tick(null, false, false, false);
        this.cursor.visible = false;
        this.previous = null;
        return;
      }
      if (this.phase === "training" && this.renderedPalm !== palm(F.HandMenu.laserHand())) this.render();
      const menu = this.el.components["fkc-hand-menu"];
      if (menu && this.phase !== "bragg" && this.phase !== "mirror" && this.phase !== "structure-practice" &&
          (this.phase !== "training" || this.step < 3)) menu.hide();
      const laser = document.getElementById(F.HandMenu.laserHand() + "Hand");
      const tools = laser && laser.components["fkc-controller"];
      this.updateCursor(tools && tools.source && tools.line.visible ? tools.hit : null);
      if (this.phase === "mirror") {
        this.board.object3D.lookAt(this.head);
        const p = this.mirror.board.object3D.getWorldPosition(this.modelWorld);
        this.mirror.tick(tools?.source && tools.line.visible ? tools.hit : null, !!tools?.states.trigger,
          Math.hypot(this.head.x-p.x,this.head.z-p.z)<1.85, F.HandMenu.opened, this.el.lastSelectedModel === this.mirror.root,
          Math.min(delta || 0,100)/1000);
        if(this.mirrorProgress!==this.mirror.step){
          if(this.mirrorProgress===0)this.board.object3D.position.set(1.2,1.65,-3.1);
          this.mirrorProgress=this.mirror.step;this.render();
        }
        return;
      }
      if (this.phase === "question") {
        this.board.object3D.updateWorldMatrix(true, false);
        this.local.copy(this.head);
        this.board.object3D.worldToLocal(this.local);
        if (crossed(this.previous, this.local)) this.close();
        this.previous = this.local.clone();
      } else {
        // Der Weltpunkt bleibt rechts vom Modell, auch beim Blick zur Tafel.
        this.board.object3D.lookAt(this.head);
        if (this.phase === "bragg") {
          const {state, el} = this.animation;
          F.Bragg.advance(state, Math.min(delta || 0, 100) / 1000);
          this.animation.update(this.head, this.animationStep===5);
          const p = el.object3D.getWorldPosition(this.modelWorld);
          const next = F.Bragg.progress(this.animationStep, Math.hypot(this.head.x - p.x, this.head.z - p.z) < 1.8,
            this.selectedAnimation === el, F.HandMenu.opened && menu?.model === el, state, this.distanceInfoOpened);
          if (next !== this.animationStep) {
            if(this.animationStep===7 && next===8) F.Bragg.command(state,"sweep");
            this.animationStep = next;
            if (next === 1) this.board.object3D.position.set(p.x + 1.85, this.head.y, p.z - 0.25);
            this.render();
          }
          return;
        }
        if (this.phase === "training" && this.target.modelReady) {
          const manip = this.target.components["fkc-manipulable"];
          const position = this.target.object3D.getWorldPosition(this.modelWorld);
          const visual = this.target.querySelector(".model-visual");
          const structure = visual && visual.fkcStructure;
          const measurements = this.el.components["fkc-measurements"];
          const records = measurements && measurements.saved;
          if (this.step === 3 && this.el.lastSelectedModel !== this.target) F.selectModel(this.target);
          const menuOpen = !!(menu && F.HandMenu.opened && menu.model === this.target);
          const environment = this.step >= 9 && F.CIF.environmentState(this.target);
          const next = F.Tutorial.progress(this.step,
            Math.hypot(this.head.x - position.x, this.head.z - position.z) < 0.9,
            position.distanceTo(this.taskOrigin), manip ? manip.hands.length : 0, this.body.object3D.scale.x, {
              handMenu: menuOpen, coordination: !!structure && structure.mode === "coordination" && !this.target.fkcPendingVisual,
              distance: F.Tutorial.hasMeasurement(records, this.target, "distance"),
              angle: F.Tutorial.hasMeasurement(records, this.target, "angle"),
              molecule: structure?.mode === "molecule" && !this.target.fkcPendingVisual,
              hydrogenHidden: this.target.fkcHideHydrogen,
              environment3: environment?.enabled && environment.radius === 3,
              selectedMolecule: hasSelectedMolecule(environment),
              environmentOff: environment && !environment.enabled
            });
          if (next !== this.step) {
            this.step = next;
            if (F.PicoModels) F.PicoModels.tutorial(next);
            if (next === tasks.length) this.phase = "structure-practice";
            this.render();
          }
        }
      }
    },
    close: function () {
      const returnToSpawn = ["training", "structure-practice", "bragg", "mirror"].includes(this.phase);
      if (this.questionFog) { this.el.object3D.fog = this.previousFog; this.questionFog = null; }
      if (this.mirror) { this.mirror.dispose(); this.mirror = null; F.Draw?.setMode(this.previousDrawMode || "laser"); }
      this.restoreWalkable?.();
      this.restoreWalkable = null;
      this.selectedAnimation = null;
      if (this.animation) { this.animation.dispose(); this.animation = null; }
      if (this.hiddenOverlays) {
        for (const [object, visible] of this.hiddenOverlays) object.visible = visible;
        this.hiddenOverlays.clear();
      }
      if (this.target) {
        F.releaseModel(this.target);
        if (returnToSpawn) {
          const menu = this.el.components["fkc-hand-menu"];
          if (menu) menu.hide();
          if (F.Measure && F.Measure.enabled) F.Measure.setEnabled(false);
          for (const visual of this.body.querySelectorAll(".model-visual, .pending-visual")) visual.remove();
          this.target.fkcPendingVisual = null;
          this.target.modelReady = false;
          if (this.el.lastSelectedModel === this.target) this.el.lastSelectedModel = null;
          if (this.el.lastSelectedTarget === this.target) this.el.lastSelectedTarget = null;
        }
      }
      if (this.room && this.roomVisible !== undefined) this.room.object3D.visible = this.roomVisible;
      this.roomVisible = undefined;
      if (returnToSpawn) this.el.object3D.background = this.previousBackground;
      F.Tutorial.active = false;
      if (this.cursor) this.cursor.visible = false;
      if (F.PicoModels) F.PicoModels.tutorial(-1);
      this.group.object3D.visible = false;
      this.phase = null; this.previous = null;
      if (returnToSpawn && F.app && F.app.currentId === "welcome") F.app.positionAtSpawn({x: 0, z: 6.5});
      if (F.Menu) F.Menu.blockDrawing();
      F.invalidateHits();
    },
    remove: function () {
      this.exit();
      this.el.removeEventListener("enter-vr", this.enter);
      this.el.removeEventListener("exit-vr", this.exit);
      this.group.remove();
      [this.geometry, this.material, this.texture,
        this.grid.geometry, this.grid.material, this.cursorGeometry, this.cursorMaterial].forEach(resource => resource.dispose());
    }
  });
})(window.FKCVR);