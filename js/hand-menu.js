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
    const model = scene.lastSelectedModel;
    return model && model.isConnected && model.modelReady &&
      model.classList.contains("interactable") ? model : null;
  }

  function readViewerHead(scene, rig, position) {
    const xr = scene.renderer && scene.renderer.xr;
    const reference = xr && xr.getReferenceSpace && xr.getReferenceSpace();
    const frame = scene.frame && typeof scene.frame.getViewerPose === "function"
      ? scene.frame : xr && xr.getFrame && xr.getFrame();
    if (frame && reference && rig) {
      const pose = frame.getViewerPose(reference);
      if (!pose) return false; // Trackingverlust: keine alte Augenposition verwenden.
      rig.object3D.updateWorldMatrix(true, false);
      position.copy(pose.transform.position).applyMatrix4(rig.object3D.matrixWorld);
      return true;
    }
    if (!scene.camera) return false;
    scene.camera.updateWorldMatrix(true, false);
    scene.camera.getWorldPosition(position);
    return true;
  }

  F.HandMenu = {
    opened: false,
    laserHand,
    gate,
    readViewerHead,
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
      this.geometry = new T.PlaneGeometry(0.34, 0.40);
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
        const navigation = F.getNavigation();
        if (navigation) navigation.cancel();
        if (F.Comfort) F.Comfort.reset();
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
      this.position.addScaledVector(this.toHead, 0.07);
      const object = this.root.object3D;
      object.position.copy(this.position);
      scene.object3D.worldToLocal(object.position);
      // +Z der Menüfläche zeigt exakt zum Viewer-/Augenmittelpunkt.
      // Welt-Oben verhindert Rollbewegungen durch die Controllerorientierung.
      object.up.set(0, 1, 0);
      object.lookAt(this.head);
      object.visible = true;
      object.updateWorldMatrix(true, true);
      const visual = model.querySelector(".model-visual");
      const structure = visual && visual.fkcStructure;
      const signature = [model.fkcVariantId, !!model.fkcPendingVisual,
        model.fkcAtomLabels, this.page, this.offset, this.infoOffset,
        structure && structure.mode, model.fkcStyle].join("|");
      if (signature !== this.signature) {
        this.signature = signature;
        this.render(structure);
      }
    },

    click: function (hit) {
      if (!F.HandMenu.opened || !hit.uv || selectedModel(this.el) !== this.model) return;
      const time = performance.now();
      if (time - this.lastClick < 250) return;
      const x = hit.uv.x * WIDTH;
      const y = (1 - hit.uv.y) * HEIGHT;
      const button = this.buttons.find(b => x >= b.x && x <= b.x + b.w &&
        y >= b.y && y <= b.y + b.h);
      if (!button) return;
      this.lastClick = time;
      F.Menu.blockDrawing();
      button.action();
      this.signature = "";
    },

    render: function (structure) {
      const ctx = this.ctx;
      const model = this.model;
      this.buttons = [];
      ctx.fillStyle = "#edf4ee";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#203f30";
      ctx.font = "bold 38px Arial";
      ctx.fillText("Modellwerkzeuge", 28, 48, 710);
      ctx.font = "28px Arial";
      ctx.fillText(model.dataset.title || "3D-Modell", 28, 88, 710);
      let y = 115;
      const text = value => {
        ctx.fillStyle = "#203f30";
        ctx.font = "28px Arial";
        ctx.fillText(value, 28, y + 30, 710);
        y += 45;
      };
      const button = (label, action, selected = false) => {
        const b = {x: 28, y, w: 712, h: 62, action};
        ctx.fillStyle = selected ? "#b9dcc4" : "#d5e2d9";
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = "#173527";
        ctx.font = "29px Arial";
        ctx.fillText((selected ? "✓ " : "") + label, 43, y + 41, 677);
        this.buttons.push(b);
        y += 72;
      };
      if (this.page === "styles") {
        text("Styles – unabhängig von der Ansicht");
        F.CIF.styles.forEach(style => button(style.title, () => {
          F.CIF.setStyle(model, style.id);
        }, (model.fkcStyle || "ball-stick") === style.id));
        text("Space-Filling: C-Radius 1,70 Å.");
        text("Ellipsoid: keine ADPs in C60-CIF.");
        text("Polyhedral: kein Metallzentrum in C60.");
        button("Zurück zu Modellwerkzeugen", () => { this.page = "model"; });
      } else if (this.page === "info") {
        const info = (structure ?
          "Zelle (Å): " + structure.cellLengthsAngstrom.join(" / ") +
          "\nWinkel (°): " + structure.cellAnglesDegrees.join(" / ") +
          "\nRaumgruppe: " + structure.spaceGroup.name + " (" + structure.spaceGroup.number + ")\n" : "") +
          (model.fkcInfo || "Keine weiteren Modellinformationen.");
        F.Menu.ctx.font = "29px Arial";
        const lines = F.Menu.wrap(info, 660);
        lines.slice(this.infoOffset, this.infoOffset + 11).forEach(text);
        if (this.infoOffset > 0) button("Text zurück", () => { this.infoOffset = Math.max(0, this.infoOffset - 8); });
        if (this.infoOffset + 11 < lines.length) button("Text weiter", () => { this.infoOffset += 8; });
        button("Zurück zu Modellwerkzeugen", () => { this.page = "model"; });
      } else {
        text("Ansicht" + (model.fkcPendingVisual ? " – wird geladen …" : ""));
        const variants = model.fkcVariants || [];
        variants.slice(this.offset, this.offset + 3).forEach(variant => {
          button(variant.title, () => {
            if (!model.fkcPendingVisual) F.switchVariant(model, variant.id);
          }, variant.id === model.fkcVariantId);
        });
        if (!variants.length) text("Für dieses Modell nur eine Ansicht.");
        if (variants.length > 3) button("Weitere Ansichten", () => {
          this.offset = this.offset + 3 < variants.length ? this.offset + 3 : 0;
        });
        if (structure) button("Styles: " +
          (F.CIF.styles.find(style => style.id === (model.fkcStyle || "ball-stick"))).title,
          () => { this.page = "styles"; });
        button("Labels: " + (model.fkcAtomLabels === "hover" ? "Beim Anvisieren" : "Aus"), () => {
          F.AtomLabels.setMode(model, model.fkcAtomLabels === "hover" ? "off" : "hover");
        });
        button("Modell zurücksetzen", () => F.resetTarget(model));
        button("Modellinformationen", () => { this.page = "info"; this.infoOffset = 0; });
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
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 25, 25);
            ctx.fillStyle = "#203f30";
            ctx.font = "27px Arial";
            ctx.fillText(element, x + 34, y + 24);
            x += 125;
          }
        } else text("GLB: keine verlässliche Elementzuordnung.");
      }
      this.texture.needsUpdate = true;
    },

    remove: function () {
      this.hide();
      this.el.removeEventListener("exit-vr", this.exit);
      this.root.remove();
      this.geometry.dispose();
      this.material.dispose();
      this.texture.dispose();
      F.invalidateHits();
    }
  });
})(window.FKCVR);