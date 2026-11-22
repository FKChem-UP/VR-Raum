"use strict";

(function (F) {
  const T = AFRAME.THREE;
  const WIDTH = 768;
  const HEIGHT = 900;

  function laserHand() {
    return F.Settings.laserHand === "left" ? "left" : "right";
  }

  // Zeitverzögerung und Hysterese vermeiden versehentliches Aufklappen.
  function gate(state, eligible, facing, time) {
    if (!eligible || facing < (state.open ? 0.45 : 0.75)) {
      state.open = false;
      state.since = null;
    } else if (!state.open) {
      if (state.since === null) state.since = time;
      if (time - state.since >= 300) state.open = true;
    }
    return state.open;
  }

  function selectedModel(scene) {
    const tutorial = scene.components?.["fkc-tutorial"];
    if (tutorial?.phase === "bragg") return tutorial.selectedAnimation;
    const model = scene.lastSelectedModel;
    return model && model.isConnected && model.modelReady &&
      model.classList.contains("interactable") ? model : null;
  }

  function readViewerHead(scene, rig, position, forward, orientation) {
    const xr = scene.renderer && scene.renderer.xr;
    const reference = xr && xr.getReferenceSpace && xr.getReferenceSpace();
    const frame = scene.frame && typeof scene.frame.getViewerPose === "function"
      ? scene.frame : xr && xr.getFrame && xr.getFrame();
    if (frame && reference && rig) {
      const pose = frame.getViewerPose(reference);
      if (!pose) return false; // Trackingverlust: keine alte Augenposition verwenden.
      rig.object3D.updateWorldMatrix(true, false);
      position.copy(pose.transform.position).applyMatrix4(rig.object3D.matrixWorld);
      if (forward) forward.set(0, 0, -1).applyQuaternion(orientation.copy(pose.transform.orientation))
        .transformDirection(rig.object3D.matrixWorld);
      return true;
    }
    if (!scene.camera) return false;
    scene.camera.updateWorldMatrix(true, false);
    scene.camera.getWorldPosition(position);
    if (forward) scene.camera.getWorldDirection(forward);
    return true;
  }

  F.HandMenu = {
    opened: false,
    laserHand,
    gate,
    readViewerHead,
    legendInk(color) {
      const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255);
      const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722 > 0.179 ? "#000000" : "#ffffff";
    },
    size: "standard",
    sizes: {small: 0.85, standard: 1, large: 1.15},
    setSize(size) {
      if (!Object.prototype.hasOwnProperty.call(this.sizes, size)) return;
      this.size = size;
      const scene = F.getScene();
      const menu = scene && scene.components["fkc-hand-menu"];
      if (menu) {
        menu.root.object3D.scale.setScalar(this.sizes[size]);
        menu.root.object3D.updateWorldMatrix(true, true);
        menu.signature = "";
      }
      F.invalidateHits();
    },
    setLaserHand(hand) {
      if (!["left", "right"].includes(hand)) return;
      F.Settings.laserHand = hand;
      const scene = F.getScene();
      const menu = scene && scene.components["fkc-hand-menu"];
      if (menu) menu.hide();
      if (F.Menu) F.Menu.blockDrawing();
      if (F.AtomLabels) {
        const labels = scene && scene.components["fkc-atom-labels"];
        if (labels) labels.clear();
      }
    },
    click(hit) {
      const scene = F.getScene();
      const menu = scene && scene.components["fkc-hand-menu"];
      if (menu) menu.click(hit);
    }
  };

  AFRAME.registerComponent("fkc-hand-menu", {
    init: function () {
      this.state = {open: false, since: null};
      this.page = "model";
      this.offset = 0;
      this.infoOffset = 0;
      this.lastClick = -Infinity;
      this.hoverIndex = -1;
      this.pressedIndex = -1;
      this.pressUntil = -Infinity;
      this.buttons = [];
      this.position = new T.Vector3();
      this.head = new T.Vector3();
      this.normal = new T.Vector3();
      this.toHead = new T.Vector3();
      this.quaternion = new T.Quaternion();
      this.rigQuaternion = new T.Quaternion();
      this.canvas = document.createElement("canvas");
      this.canvas.width = WIDTH;
      this.canvas.height = HEIGHT;
      this.ctx = this.canvas.getContext("2d");
      this.texture = new T.CanvasTexture(this.canvas);
      this.texture.minFilter = T.LinearFilter;
      this.texture.generateMipmaps = false;
      this.geometry = new T.PlaneGeometry(0.245, 0.288);
      this.material = new T.MeshBasicMaterial({
        map: this.texture, side: T.DoubleSide, depthTest: false, depthWrite: false
      });
      this.mesh = new T.Mesh(this.geometry, this.material);
      this.mesh.renderOrder = 100;
      this.mesh.frustumCulled = false;
      this.root = F.create("a-entity", {
        id: "fkc-hand-menu", class: "vr-action"
      }, this.el);
      this.root.dataset.fkcHandMenu = "true";
      this.root.setObject3D("mesh", this.mesh);
      this.cursorGeometry = new T.CircleGeometry(0.0018, 20);
      this.cursorMaterial = new T.MeshBasicMaterial({color: "#ff9d38", transparent: true,
        opacity: 0.55, depthTest: false, depthWrite: false, side: T.DoubleSide});
      this.cursor = new T.Mesh(this.cursorGeometry, this.cursorMaterial);
      this.cursor.renderOrder = 120;
      this.cursor.raycast = function () {};
      this.cursor.visible = false;
      this.root.object3D.add(this.cursor);
      this.root.object3D.visible = false;
      this.exit = () => this.hide();
      this.el.addEventListener("exit-vr", this.exit);
      F.invalidateHits();
    },

    hide: function () {
      const wasOpen = F.HandMenu.opened;
      this.state.open = false;
      this.state.since = null;
      F.HandMenu.opened = false;
      this.root.object3D.visible = false;
      if (wasOpen) {
        F.Menu.blockDrawing();
        F.invalidateHits();
      }
    },

    readPose: function (hand, source) {
      const scene = this.el;
      const xr = scene.renderer && scene.renderer.xr;
      const frame = scene.frame || (xr && xr.getFrame && xr.getFrame());
      const reference = xr && xr.getReferenceSpace && xr.getReferenceSpace();
      const rig = F.getRig();
      if (source.gripSpace && frame && reference && rig) {
        const pose = frame.getPose(source.gripSpace, reference);
        if (!pose) return false;
        this.position.copy(pose.transform.position);
        this.quaternion.copy(pose.transform.orientation);
        rig.object3D.updateWorldMatrix(true, false);
        this.position.applyMatrix4(rig.object3D.matrixWorld);
        rig.object3D.getWorldQuaternion(this.rigQuaternion);
        this.quaternion.premultiply(this.rigQuaternion);
      } else {
        hand.object3D.updateWorldMatrix(true, false);
        hand.object3D.getWorldPosition(this.position);
        hand.object3D.getWorldQuaternion(this.quaternion);
      }
      return true;
    },

    tick: function (time) {
      const scene = this.el;
      const xr = scene.renderer && scene.renderer.xr;
      const inVR = scene.is("vr-mode") || !!(xr && xr.getSession());
      const menuHand = laserHand() === "right" ? "left" : "right";
      const hand = document.getElementById(menuHand + "Hand");
      const source = inVR && F.getSource(scene, menuHand);
      const model = selectedModel(scene);
      const grabbing = Array.from(scene.querySelectorAll("[fkc-grabber]"))
        .some(el => el.components["fkc-grabber"] && el.components["fkc-grabber"].grabbed);
      if (!source || !hand || !model || !scene.camera || grabbing || F.Menu.opened) {
        this.hide();
        return;
      }
      if (!this.readPose(hand, source)) { this.hide(); return; }
      if (!readViewerHead(scene, F.getRig(), this.head)) { this.hide(); return; }
      this.toHead.copy(this.head).sub(this.position);
      const distance = this.toHead.length();
      // Näherung der Handinnenseite aus der Grip-Orientierung, kein Handtracking.
      this.normal.set(menuHand === "left" ? 1 : -1, 0, 0)
        .applyQuaternion(this.quaternion);
      const facing = this.normal.dot(this.toHead.normalize());
      const wasOpen = F.HandMenu.opened;
      const open = gate(this.state, distance > 0.20 && distance < 0.85, facing, time);
      if (!open) {
        if (wasOpen) this.hide();
        return;
      }
      F.HandMenu.opened = true;
      if (!wasOpen) {
        this.page = "model";
        this.offset = 0;
        this.infoOffset = 0;
        F.Menu.blockDrawing();
        F.invalidateHits();
      }
      if (this.model !== model) {
        this.model = model;
        this.page = "model";
        this.offset = 0;
        this.infoOffset = 0;
        this.signature = "";
      }
      // An der Hand verankert, zum Kopf ausgerichtet für lesbare Beschriftung.
      // Abstand von der Hand zum Betrachter statt mitrotierender Handflächenachse.
      // Im Tutorial oberhalb und etwas vor den Controller setzen. Die normale
      // Einstellung außerhalb des Tutorials bleibt weiter vom Kopf entfernt.
      const chapter = scene.components["fkc-tutorial"];
      const animation = chapter?.selectedAnimation === model ? chapter.animation : null;
      const tutorial = !!animation || !!(F.Tutorial && F.Tutorial.allowsModel(model));
      this.position.addScaledVector(this.toHead, tutorial ? Math.min(0.05, distance - 0.20) : -0.10);
      if (tutorial) this.position.y += 0.07;
      // Trotz deckender Textur in der Overlay-Gruppe nach der Tutorialtafel.
      this.material.transparent = tutorial;
      this.mesh.renderOrder = tutorial ? 10010 : 100;
      this.cursor.renderOrder = tutorial ? 10011 : 120;
      const object = this.root.object3D;
      object.scale.setScalar(F.HandMenu.sizes[F.HandMenu.size]);
      object.position.copy(this.position);
      scene.object3D.worldToLocal(object.position);
      // +Z der Menüfläche zeigt exakt zum Viewer-/Augenmittelpunkt.
      // Welt-Oben verhindert Rollbewegungen durch die Controllerorientierung.
      object.up.set(0, 1, 0);
      object.lookAt(this.head);
      object.visible = true;
      object.updateWorldMatrix(true, true);
      const laser = document.getElementById(laserHand() + "Hand");
      const tools = laser && laser.components["fkc-controller"];
      let hoverIndex = -1;
      this.cursor.visible = false;
      if (tools && tools.source) {
        // Aktuelle Pose verwenden, nicht den Treffer des vorigen Frames.
        tools.updateRay();
        const hit = F.findHit(tools.raycaster, true);
        if (hit && hit.el === this.root && hit.uv) {
          hoverIndex = this.buttonIndex(hit.uv);
          this.cursor.position.set((hit.uv.x - 0.5) * 0.245,
            (hit.uv.y - 0.5) * 0.288, 0.001);
          this.cursorMaterial.color.set(F.Settings.lasers[laserHand()]);
          this.cursor.visible = true;
        }
      }
      this.hoverIndex = hoverIndex;
      if (performance.now() >= this.pressUntil) this.pressedIndex = -1;
      const visual = model.querySelector(".model-visual");
      const structure = visual && visual.fkcStructure;
      const environment = F.CIF.environmentState && F.CIF.environmentState(model);
      const cue = this.page === "model" && F.Draw?.mode !== "paint" ? F.Tutorial?.menuTarget(scene, model) : null;
      // Neun Abstufungen pro langsamem Puls statt Canvas-Uploads pro XR-Frame.
      const pulse = cue ? Math.round(4 + 4 * Math.cos(time * 2 * Math.PI / 1600)) : 0;
      const signature = [model.fkcVariantId, !!model.fkcPendingVisual,
        cue, pulse, animation?.state.source, animation?.state.angle.toFixed(1), animation?.state.speed, animation?.state.running, animation?.state.sweep,
        model.fkcAtomLabels, model.fkcHideHydrogen, model.fkcShowHydrogenContacts, model.fkcAtomScale, this.page, this.offset, this.infoOffset,
        structure && structure.mode, structure?.contactDepth, model.fkcStyle, F.Measure && F.Measure.enabled,
        F.Measure && F.Measure.mode, this.hoverIndex, this.pressedIndex,
        F.HandMenu.size, model.fkcBondColorMode, model.fkcBondColor, model.fkcBondThickness,
        environment && environment.enabled, environment && environment.radius,
        environment && environment.selected.size].join("|");
      const modeSignature = signature + "|" + (F.Draw && [F.Draw.mode, F.Draw.color, F.Draw.opacity].join("|")) + "|" + F.Settings.strokeRadius;
      if (modeSignature !== this.signature) {
        this.signature = modeSignature;
        this.render(structure, cue, pulse);
      }
    },

    click: function (hit) {
      if (!F.HandMenu.opened || !hit.uv || selectedModel(this.el) !== this.model) return;
      const time = performance.now();
      if (time - this.lastClick < 250) return;
      const index = this.buttonIndex(hit.uv);
      const button = this.buttons[index];
      if (!button) return;
      this.lastClick = time;
      this.pressedIndex = index;
      this.pressUntil = time + 180;
      F.Menu.blockDrawing();
      button.action();
      this.signature = "";
    },

    buttonIndex: function (uv) {
      const x = uv.x * WIDTH;
      const y = (1 - uv.y) * HEIGHT;
      return this.buttons.findIndex(b => x >= b.x && x <= b.x + b.w &&
        y >= b.y && y <= b.y + b.h);
    },

    render: function (structure, cue, pulse = 0) {
      const ctx = this.ctx;
      const model = this.model;
      const painting = F.Draw && F.Draw.mode === "paint";
      this.buttons = [];
      ctx.fillStyle = painting ? "#fff5cd" : "#edf4ee";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#203f30";
      ctx.font = "bold 38px Arial";
      const chapter = this.el.components["fkc-tutorial"];
      const animation = chapter?.selectedAnimation === model ? chapter.animation : null;
      ctx.fillText(animation ? "Animationssteuerung" : this.page === "settings" ? (painting ? "Malstift-Einstellungen" : "Modelleinstellungen") :
        painting ? "Malstift" : "Modellwerkzeuge", 28, 48, 510);
      ctx.font = "28px Arial";
      ctx.fillText(model.dataset.title || "3D-Modell", 28, 88, 710);
      let y = 115;
      const text = value => {
        ctx.fillStyle = "#203f30";
        ctx.font = "28px Arial";
        ctx.fillText(value, 28, y + 30, 710);
        // Platz unter der Schriftgrundlinie für Unterlängen und Abstand zur
        // nächsten Button-/Legendenfläche, damit diese den Text nicht übermalt.
        y += 40;
      };
      const outlineCue = (id, x, y, width, height) => {
        if (!cue || id !== cue) return;
        ctx.strokeStyle = "#a66a00";
        ctx.lineWidth = 8;
        ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);
        ctx.strokeStyle = "#ffdf38";
        ctx.globalAlpha = 0.45 + pulse * 0.06875;
        ctx.lineWidth = 5;
        ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);
        ctx.globalAlpha = 1;
      };
      const button = (label, action, selected = false, cueId = null) => {
        const compact = this.page === "settings" || !!structure;
        const b = {x: 28, y, w: 712, h: compact ? 32 : 40, action};
        const index = this.buttons.length;
        const pressed = this.pressedIndex === index;
        const hovered = this.hoverIndex === index;
        const shift = pressed ? 4 : 0;
        ctx.fillStyle = "#8c9b92";
        ctx.fillRect(b.x, b.y + 4, b.w, b.h);
        ctx.fillStyle = pressed ? "#f3bcbc" : hovered ? "#fff0b8" : selected ? (painting ? "#ffd665" : "#b9dcc4") : (painting ? "#ffedac" : "#d5e2d9");
        ctx.fillRect(b.x, b.y + shift, b.w, b.h);
        ctx.strokeStyle = hovered ? "#b57c00" : "#82988a";
        ctx.lineWidth = hovered ? 4 : 2;
        ctx.strokeRect(b.x, b.y + shift, b.w, b.h);
        outlineCue(cueId, b.x, b.y + shift, b.w, b.h);
        ctx.fillStyle = "#173527";
        ctx.font = "29px Arial";
        ctx.fillText((selected ? "✓ " : "") + label, 43, y + (compact ? 25 : 29) + shift, 677);
        this.buttons.push(b);
        y += compact ? 38 : 46;
      };
      // Direkte Buttonreihen statt Untermenüs. Kurze Beschriftung ergänzt Symbole.
      const row = entries => {
        const compactRow = !!structure;
        const height = compactRow ? 72 : 87;
        const w = (712 - (entries.length - 1) * 12) / entries.length;
        entries.forEach((entry, index) => {
          const x = 28 + index * (w + 12);
          const selected = !!entry.selected;
          const buttonIndex = this.buttons.length;
          const pressed = this.pressedIndex === buttonIndex;
          const hovered = this.hoverIndex === buttonIndex;
          const shift = pressed ? 9 : selected ? 5 : 0;
          ctx.fillStyle = "#8c9b92";
          ctx.fillRect(x, y + 5, w, height + 5);
          ctx.fillStyle = pressed ? "#e99d9d" : selected ? "#f3bcbc" : hovered ? "#fff0b8" : painting ? "#ffedac" : "#d5e2d9";
          ctx.fillRect(x, y + shift, w, height);
          ctx.strokeStyle = hovered ? "#b57c00" : selected ? "#a34444" : "#82988a";
          ctx.lineWidth = hovered ? 4 : selected ? 3 : 2;
          ctx.strokeRect(x, y + shift, w, height);
          outlineCue(entry.cueId, x, y + shift, w, height);
          const plain = ["plain", "variant", "color", "opacity"].includes(entry.kind);
          const atomCount = entry.kind === "atom-size" ? 1 : entry.count || 2;
          const points = [];
          for (let i = 0; i < atomCount; i++) {
            points.push([entry.kind === "space-filling" ? x + w / 2 + (i === 0 ? -10 : 10) :
              atomCount === 1 ? x + w / 2 : x + w * (0.22 + i * 0.56 / (atomCount - 1)),
              y + shift + 22 + (atomCount > 2 && i % 2 ? 7 : 0)]);
          }
          if (!plain && entry.kind !== "space-filling" && entry.kind !== "environment") {
            ctx.strokeStyle = "#284635";
            ctx.lineWidth = entry.kind === "bond-size" ? 10 * entry.factor : entry.kind === "capped-sticks" ? 12 : entry.kind === "wires" ? 2 : 4;
            ctx.beginPath();
            points.forEach(([px, py], i) => { if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
            ctx.stroke();
          }
          if (!plain && entry.kind !== "environment") points.forEach(([px, py], i) => {
            ctx.fillStyle = entry.kind === "space-filling" && i === 1 ? "#78a486" : "#486e56";
            ctx.beginPath();
            ctx.arc(px, py, entry.kind === "atom-size" ? 14 * entry.factor : entry.kind === "space-filling" ? 15 : entry.kind === "wires" ? 3 : 7, 0, Math.PI * 2);
            ctx.fill();
          });
          if (entry.kind === "environment") {
            const cx = x + w / 2;
            ctx.fillStyle = "#486e56";
            ctx.beginPath(); ctx.arc(cx, y + shift + 22, 6, 0, Math.PI * 2); ctx.fill();
            const count = entry.radius ? Math.round(entry.radius * 2) : 0;
            for (let i = 0; i < count; i++) {
              const angle = i * Math.PI * 2 / count;
              ctx.globalAlpha = 0.35;
              ctx.beginPath();
              ctx.arc(cx + Math.cos(angle) * 19, y + shift + 22 + Math.sin(angle) * 14, 4, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
          if (entry.kind === "color") {
            ctx.fillStyle = entry.color;
            ctx.fillRect(x + w / 2 - 14, y + shift + 10, 28, 20);
          }
          if (entry.kind === "angle") {
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.arc(points[1][0], points[1][1], 14, Math.PI * 1.15, Math.PI * 1.85);
            ctx.stroke();
          }
          if (entry.kind === "polyhedral") {
            ctx.strokeStyle = "#486e56";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y + shift + 8);
            ctx.lineTo(x + w / 2 + 22, y + shift + 27);
            ctx.lineTo(x + w / 2, y + shift + 38);
            ctx.lineTo(x + w / 2 - 22, y + shift + 27);
            ctx.lineTo(x + w / 2, y + shift + 8);
            ctx.lineTo(x + w / 2, y + shift + 38);
            ctx.stroke();
          }
          ctx.fillStyle = "#173527";
          ctx.font = "23px Arial";
          ctx.textAlign = "center";
          ctx.fillText(entry.label, x + w / 2, y + shift + (compactRow ? 63 : 73), w - 12);
          ctx.textAlign = "left";
          this.buttons.push({x, y, w, h: height + 10, label: entry.label, kind: entry.kind, action: entry.action});
        });
        y += compactRow ? 85 : 100;
      };
      if (animation) {
        const state = animation.state;
        const control = (id, title, selected = false) => button(title, () => {
          F.Bragg.command(state, id);
          if (id === "reset" && chapter.animationStep >= 3 && chapter.animationStep < F.Bragg.tasks.length) {
            chapter.animationStep = 3; chapter.render();
          }
        }, selected, id);
        control("play", state.running ? "Pause" : "Start", state.running);
        text("Abspieltempo");
        for (const [id, speed] of [["slow", 0.5], ["normal", 1], ["fast", 2]]) control(id, `${speed}×`, state.speed === speed);
        row([["mo", "Mo Kα"], ["cu", "Cu Kα"]].map(([id, label]) => ({label, kind: "plain",
          selected: state.source === id, action: () => F.Bragg.command(state, id)})));
        text(`Detektorwinkel 2θ: ${state.angle.toFixed(1)}°`);
        control("bragg", "Bragg-Stellung", state.angle === F.Bragg.angleFor(1, state.source));
        control("compare", "Vergleich: halbe Welle versetzt", state.angle === F.Bragg.angleFor(1.5, state.source));
        row([["minus", "−1°"], ["plus", "+1°"]].map(([id, label]) => ({label, kind: "plain", action: () => F.Bragg.command(state, id)})));
        control("sweep", state.sweep ? "Winkellauf anhalten" : "Automatischer Winkellauf", !!state.sweep);
        control("reset", "Animation zurücksetzen");
        this.texture.needsUpdate = true;
        return;
      }
      if (this.page === "settings") {
        // Kompaktere Einstellungszeilen lassen Platz für Palette und Reichweite.
        button("Zurück zu Modellwerkzeugen", () => { this.page = "model"; });
        text("Handmenügröße · gilt für die Sitzung");
        for (const [size, title] of [["small", "Kleiner (85 %)"], ["standard", "Standard (100 %)"], ["large", "Größer (115 %)"]]) {
          button(title, () => F.HandMenu.setSize(size), F.HandMenu.size === size);
        }
        if (painting) {
          text("Malfarbe · unabhängig von der Laserfarbe");
          row([["#ffcc33", "Gelb"], ["#ee5151", "Rot"], ["#507dff", "Blau"], ["#45d77e", "Grün"]].map(([color, label]) => ({
            label, kind: "color", color, selected: F.Draw.color === color, action: () => { F.Draw.color = color; }
          })));
          text("Strichdicke");
          row([0.002, 0.004, 0.008, 0.016].map(radius => ({label: radius * 2000 + " mm", kind: "bond-size", factor: radius / 0.008,
            selected: F.Settings.strokeRadius === radius, action: () => { F.Settings.strokeRadius = radius; }})));
          text("Deckkraft · gilt für neue Striche");
          row([0.2, 0.35, 0.6, 1].map(opacity => ({label: Math.round(opacity * 100) + " %", kind: "opacity",
            selected: F.Draw.opacity === opacity, action: () => { F.Draw.opacity = opacity; }})));
        } else if (structure) {
          text("Bindungsfarben · nur Ball-and-Stick");
          for (const [mode, title] of [["auto", "Style-Standard"], ["element", "Endatomfarben"], ["uniform", "Einheitliche Farbe"]]) {
            button(title, () => F.CIF.setBondAppearance(model, mode), (model.fkcBondColorMode || "auto") === mode);
          }
          text("Farbwahl aktiviert einheitliche Bindungsfarbe");
          row([["#949494", "Grau"], ["#eeeeee", "Weiß"], ["#ff9d38", "Orange"], ["#000000", "Schwarz"]].map(([color, title]) => ({
            label: title, kind: "color", color, selected: model.fkcBondColorMode === "uniform" && (model.fkcBondColor || "#949494") === color,
            action: () => F.CIF.setBondAppearance(model, "uniform", color)
          })));
          text("Bindungsdicke · nur Ball-and-Stick");
          row([0.5, 0.75, 1].map(factor => ({label: Math.round(factor * 100) + " %", kind: "bond-size", factor,
            selected: (model.fkcBondThickness || 1) === factor,
            action: () => F.CIF.setBondThickness(model, factor)})));
          text("Atomgröße · nur Ball-and-Stick");
          row([0.5, 0.75, 1].map(factor => ({label: Math.round(factor * 100) + " %", kind: "atom-size", factor,
            selected: (model.fkcAtomScale || 1) === factor,
            action: () => F.CIF.setAtomOptions(model, undefined, factor)})));
        } else text("Bindungsfarben nur bei CIF-Modellen verfügbar.");
        this.texture.needsUpdate = true;
        return;
      }
      if (painting) {
        text("Trigger halten: Oberfläche markieren");
        text("Laser/Malstift oben wechselt zurück zur Atomauswahl.");
        text("Farbe, Dicke und Deckkraft im Zahnrad einstellen.");
        button("Letzten eigenen Strich zurücknehmen", () => {
          const stroke = F.Draw.strokes.at(-1);
          if (stroke) F.Draw.remove(stroke);
        });
        button("Zeichnungen am ausgewählten Modell entfernen", () => F.Draw.clear(model));
      } else {
        text("Ansicht" + (model.fkcPendingVisual ? " – wird geladen …" : ""));
        const variants = model.fkcVariants || [];
        row(variants.slice(this.offset, this.offset + 4).map(variant => ({
          label: ({"zns-closed-cell": "Elementarzelle", "zns-sites": "CIF-Positionen",
            "zns-zn": "Zn-Koordination", "zns-s": "S-Koordination", coordination: "Koordination", cell: "Zelle"})[variant.cifMode] ||
            (/\.glb$/i.test(variant.model || "") ? "GLB" : "Molekül"),
          kind: "variant", cueId: "variant:" + variant.id, selected: variant.id === model.fkcVariantId, action: () => {
            if (!model.fkcPendingVisual) F.switchVariant(model, variant.id);
          }
        })));
        if (!variants.length) text("Für dieses Modell nur eine Ansicht.");
        if (variants.length > 4) button("Weitere Ansichten", () => {
          this.offset = this.offset + 4 < variants.length ? this.offset + 4 : 0;
        });
        if (structure) {
          text("Styles");
          const available = F.CIF.availableStyles(structure);
          const activeStyle = available.some(style => style.id === model.fkcStyle) ? model.fkcStyle : "ball-stick";
          row(available.map(style => ({
            label: {"ball-stick": "Kugel–Stab", "space-filling": "Raumfüllend",
              wires: "Wires", "capped-sticks": "Sticks", polyhedral: "Polyeder"}[style.id],
            kind: style.id,
            selected: activeStyle === style.id,
            action: () => F.CIF.setStyle(model, style.id)
          })));
        }
        const mode = model.fkcAtomLabels || "hover";
        button("Labels: " + ({hover: "Beim Anvisieren", all: "Alle", off: "Aus"}[mode]), () => {
          F.AtomLabels.setMode(model, {hover: "all", all: "off", off: "hover"}[mode]);
        });
        if (structure && !structure.contactExpansion) button("H-Atome: " + (model.fkcHideHydrogen ? "Ausgeblendet" : "Sichtbar"),
          () => F.CIF.setAtomOptions(model, !model.fkcHideHydrogen), false, "hide-hydrogen");
        if (structure && ["cell", "cell-complete"].includes(structure.mode) && structure.name && structure.name.startsWith("Co-Produkt1")) {
          button("Moleküle vervollständigen: " + (structure.mode === "cell-complete" ? "An" : "Aus"),
            () => F.CIF.setCompleteCell(model, structure.mode !== "cell-complete"), structure.mode === "cell-complete");
        }
        if (structure && structure.hydrogenContacts && structure.hydrogenContacts.length) {
          const enabled = !!model.fkcShowHydrogenContacts;
          button("H-Brücken: " + (enabled ? (model.fkcHideHydrogen ? "An (H-Atome ausgeblendet)" : "An") : "Aus"),
            () => F.CIF.setHydrogenContacts(model, !enabled), enabled);
        }
        if (structure && ["molecule", "coordination"].includes(structure.mode)) {
          text("Messen · aktiven Knopf erneut drücken: Aus");
          row(["distance", "angle", "torsion"].map(mode => ({
            label: F.Measure.titles[mode], kind: mode, count: F.Measure.counts[mode], cueId: "measure:" + mode,
            selected: F.Measure.enabled && F.Measure.mode === mode,
            action: () => F.Measure.toggleMode(mode)
          })));
          button("Alle Messungen zurücksetzen", () => this.el.components["fkc-measurements"].reset());
        }
        button("Modell zurücksetzen", () => F.resetTarget(model));
        if (structure?.contactExpansion) {
          const depth = structure.contactDepth;
          text(`Kontaktschalen · ${depth} von ${F.CIF.maxContactDepth} zusätzlich`);
          row([{label: "− Weniger", change: -1}, {label: "+ Mehr", change: 1}].map(({label, change}) => ({
            label, kind: "plain", action: () => F.CIF.setContactDepth(model, depth + change)
          })));
        }
        if (structure && structure.environmentCell) {
          const state = F.CIF.environmentState(model);
          text("Umgebung (Å) · " + state.selected.size + " übernommen");
          row([null, 1.5, 2, 2.5, 3, 4, 5].map(radius => ({label: radius === null ? "Aus" : String(radius).replace(".", ","), kind: "environment", radius,
            cueId: "environment:" + (radius ?? "off"),
            selected: radius === null ? !state.enabled : state.enabled && state.radius === radius,
            action: () => F.CIF.setEnvironment(model, radius !== null, radius === null ? undefined : radius)})));
          button("Ergänzungen zurücksetzen", () => F.CIF.resetEnvironment(model));
        }
        text("Legende: Atomsorten");
        if (structure) {
          const colors = new Map();
          const visual = model.querySelector(".model-visual");
          visual.object3D.traverse(mesh => {
            const atom = mesh.userData && mesh.userData.fkcAtom;
            if (atom && !colors.has(atom.element)) {
              const labels = this.el.components["fkc-atom-labels"];
              const material = labels && labels.active && labels.active.mesh === mesh
                ? labels.originalMaterial : mesh.material;
              colors.set(atom.element, "#" + material.color.getHexString());
            }
          });
          // Kompakte Legende; für viele Elemente wird eine eigene Seite nötig.
          let x = 28;
          for (const [element, color] of colors) {
            if (x > 680) { x = 28; y += 48; }
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x + 22, y + 22, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = F.HandMenu.legendInk(color);
            ctx.font = "bold 24px Arial";
            ctx.textAlign = "center";
            ctx.fillText(element, x + 22, y + 30, 38);
            ctx.textAlign = "left";
            x += 58;
          }
        } else text("GLB: keine verlässliche Elementzuordnung.");
        y += 48;
        // Nur Kurzinfo auf derselben Fläche; ausführlicher bestehender Modelltext
        // bleibt im bisherigen Haupt-/Browsermenü verfügbar.
        if (structure) text(structure.atoms[0]?.cellWeight !== undefined
          ? `${structure.atoms.length} sichtbar · ${structure.cellAtomCount} pro Zelle`
          : structure.spaceGroup.name + " · " + structure.atoms.length + " Atome");
      }
      const modeIndex = this.buttons.length;
      const modePressed = this.pressedIndex === modeIndex;
      ctx.fillStyle = painting ? "#ffe083" : "#b9dcc4";
      if (this.hoverIndex === modeIndex) ctx.fillStyle = "#fff0b8";
      ctx.fillRect(546, 14 + (modePressed ? 4 : 0), 106, 54);
      ctx.fillStyle = "#173527";
      ctx.font = "24px Arial";
      ctx.fillText(painting ? "✎ Malen" : "↗ Laser", 551, 49 + (modePressed ? 4 : 0), 96);
      this.buttons.push({x: 546, y: 14, w: 106, h: 58, label: "tool-mode", action: () => {
        F.Draw.setMode(painting ? "laser" : "paint");
        this.page = "model";
      }});
      // Eigenständiger Headerbutton, kein zusätzlicher Platz in Werkzeugzeilen.
      const gearIndex = this.buttons.length;
      const gearPressed = this.pressedIndex === gearIndex;
      ctx.fillStyle = gearPressed ? "#f3bcbc" : this.hoverIndex === gearIndex ? "#fff0b8" : "#d5e2d9";
      ctx.fillRect(664, 14 + (gearPressed ? 4 : 0), 76, 54);
      ctx.fillStyle = "#173527";
      ctx.font = "38px Arial";
      ctx.fillText("⚙", 681, 55 + (gearPressed ? 4 : 0));
      this.buttons.push({x: 664, y: 14, w: 76, h: 58, action: () => { this.page = "settings"; }});
      this.texture.needsUpdate = true;
    },

    remove: function () {
      this.hide();
      this.el.removeEventListener("exit-vr", this.exit);
      this.root.remove();
      this.geometry.dispose();
      this.material.dispose();
      this.texture.dispose();
      this.cursorGeometry.dispose();
      this.cursorMaterial.dispose();
      F.invalidateHits();
    }
  });
})(window.FKCVR);