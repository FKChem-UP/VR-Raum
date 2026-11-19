"use strict";

(function (F) {
  const T = AFRAME.THREE;

  function atomFromHit(hit) {
    if (!hit || hit.type !== "model" || !hit.el || !hit.el.isConnected ||
        !hit.el.modelReady || hit.el.fkcAtomLabels !== "hover") return null;
    const mesh = hit.mesh;
    const atom = mesh && mesh.userData && mesh.userData.fkcAtom;
    if (!atom || typeof atom.cifLabel !== "string" ||
        !Number.isInteger(atom.modelNumber)) return null;
    for (let object = mesh; object; object = object.parent) {
      if (!object.visible) return null;
      if (object === hit.el.object3D) return {mesh, atom};
    }
    return null; // Kein veralteter Treffer nach Varianten-/Raumwechsel.
  }

  F.AtomLabels = {
    atomFromHit,
    text: atom => atom.cifLabel,
    labelWidth: measuredWidth => Math.min(768, Math.max(72, Math.ceil(measuredWidth) + 48)),
    setMode(root, mode) {
      if (!root || !["off", "hover"].includes(mode)) return;
      root.fkcAtomLabels = mode;
      const scene = F.getScene();
      const component = scene && scene.components["fkc-atom-labels"];
      if (component) component.clear();
    }
  };

  AFRAME.registerComponent("fkc-atom-labels", {
    init: function () {
      this.active = null;
      this.mouse = new T.Vector2();
      this.mouseActive = false;
      this.raycaster = new T.Raycaster();
      this.position = new T.Vector3();
      this.cameraPosition = new T.Vector3();
      this.scale = new T.Vector3();
      this.quaternion = new T.Quaternion();
      this.labelCanvas = document.createElement("canvas");
      this.labelCanvas.width = 768;
      this.labelCanvas.height = 128;
      this.texture = new T.CanvasTexture(this.labelCanvas);
      this.material = new T.SpriteMaterial({
        map: this.texture, depthTest: false, depthWrite: false
      });
      this.label = new T.Sprite(this.material);
      this.label.visible = false;
      this.label.renderOrder = 1000;
      this.label.raycast = function () {}; // Keine Auswahl-/Zeichenblockade.
      this.el.object3D.add(this.label);

      this.move = event => {
        if (event.target !== this.el.canvas) {
          this.mouseActive = false;
          return;
        }
        const rect = this.el.canvas.getBoundingClientRect();
        this.mouse.set(
          (event.clientX - rect.left) / rect.width * 2 - 1,
          -(event.clientY - rect.top) / rect.height * 2 + 1
        );
        this.mouseActive = true;
      };
      this.leave = () => { this.mouseActive = false; this.clear(); };
      document.addEventListener("pointermove", this.move);
      document.addEventListener("pointerleave", this.leave);
      window.addEventListener("blur", this.leave);
      this.el.addEventListener("enter-vr", this.leave);
      this.el.addEventListener("exit-vr", this.leave);
    },

    clear: function () {
      if (this.active) {
        this.active.mesh.material = this.originalMaterial;
        this.highlightMaterial.dispose();
        this.active = null;
      }
      this.label.visible = false;
    },

    show: function (target) {
      if (!target) { this.clear(); return; }
      if (!this.active || this.active.mesh !== target.mesh) {
        this.clear();
        this.active = target;
        this.originalMaterial = target.mesh.material;
        this.highlightMaterial = this.originalMaterial.clone();
        this.highlightMaterial.color.set("#ffcc33");
        this.highlightMaterial.emissive.set("#624000");
        target.mesh.material = this.highlightMaterial;
        const ctx = this.labelCanvas.getContext("2d");
        ctx.font = "bold 56px Arial";
        const text = F.AtomLabels.text(target.atom);
        this.labelWidth = F.AtomLabels.labelWidth(ctx.measureText(text).width);
        // Feste Texturgröße, nur den belegten Bereich abbilden: keine
        // Textur-Neuanlage bei jedem Atomwechsel, konstante Schriftgröße.
        this.texture.repeat.set(this.labelWidth / 768, 1);
        ctx.clearRect(0, 0, 768, 128);
        ctx.fillStyle = "#172a22";
        ctx.fillRect(0, 0, this.labelWidth, 128);
        ctx.strokeStyle = "#ffcc33";
        ctx.lineWidth = 5;
        ctx.strokeRect(3, 3, this.labelWidth - 6, 122);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 56px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, this.labelWidth / 2, 64, this.labelWidth - 32);
        this.texture.needsUpdate = true;
      }
      this.label.visible = true;
    },

    tick: function () {
      const scene = this.el;
      const camera = scene.camera;
      if (!camera || (F.Menu && F.Menu.opened)) { this.clear(); return; }
      let target = null;
      const xr = scene.renderer && scene.renderer.xr;
      if (scene.is("vr-mode") || (xr && xr.getSession())) {
        // Bevorzugt rechts, maximal ein Label; keine Controllerüberschreibung.
        const hands = F.HandMenu ? [F.HandMenu.laserHand() + "Hand"] : ["rightHand", "leftHand"];
        for (const id of hands) {
          const hand = document.getElementById(id);
          const tools = hand && hand.components["fkc-controller"];
          if (tools && tools.source && tools.line && tools.line.visible) {
            target = atomFromHit(tools.hit);
            if (target) break;
          }
        }
      } else if (this.mouseActive && F.findHit) {
        camera.updateWorldMatrix(true, false);
        this.raycaster.setFromCamera(this.mouse, camera);
        this.raycaster.far = 30;
        target = atomFromHit(F.findHit(this.raycaster, true));
      }
      this.show(target);
      if (!target) return;
      target.mesh.updateWorldMatrix(true, false);
      target.mesh.getWorldPosition(this.position);
      target.mesh.getWorldScale(this.scale);
      camera.getWorldPosition(this.cameraPosition);
      camera.getWorldQuaternion(this.quaternion);
      const distance = this.position.distanceTo(this.cameraPosition);
      const height = T.MathUtils.clamp(distance * 0.25, 0.12, 0.65) / 6;
      const width = height * this.labelWidth / 128;
      const radius = Math.max(this.scale.x, this.scale.y, this.scale.z);
      this.position.add(new T.Vector3(0, radius + height, 0)
        .applyQuaternion(this.quaternion));
      scene.object3D.worldToLocal(this.position);
      this.label.position.copy(this.position);
      this.label.scale.set(width, height, 1);
    },

    remove: function () {
      this.clear();
      document.removeEventListener("pointermove", this.move);
      document.removeEventListener("pointerleave", this.leave);
      window.removeEventListener("blur", this.leave);
      this.el.removeEventListener("enter-vr", this.leave);
      this.el.removeEventListener("exit-vr", this.leave);
      this.el.object3D.remove(this.label);
      this.texture.dispose();
      this.material.dispose();
    }
  });
})(window.FKCVR);