"use strict";

(function (F) {
  const T = AFRAME.THREE;
  const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
  F.Measure = {
    distance,
    enabled: false,
    setEnabled(value) {
      this.enabled = value;
      const component = F.getScene().components["fkc-measurements"];
      if (component) component.reset();
      F.Menu.blockDrawing();
    },
    click(hit) {
      if (!this.enabled || !hit || hit.type !== "model") return false;
      const component = F.getScene().components["fkc-measurements"];
      if (component) component.select(hit);
      return true;
    }
  };
  AFRAME.registerComponent("fkc-measurements", {
    init: function () {
      this.points = [];
      this.geometry = new T.BufferGeometry();
      this.geometry.setAttribute("position", new T.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      this.material = new T.LineBasicMaterial({color: "#ffcc33", depthTest: false});
      this.line = new T.Line(this.geometry, this.material);
      this.line.raycast = function () {};
      this.canvas = document.createElement("canvas");
      this.canvas.width = 512;
      this.canvas.height = 128;
      this.texture = new T.CanvasTexture(this.canvas);
      this.labelMaterial = new T.SpriteMaterial({map: this.texture, depthTest: false, depthWrite: false});
      this.label = new T.Sprite(this.labelMaterial);
      this.label.raycast = function () {};
      this.line.renderOrder = this.label.renderOrder = 1002;
      this.el.object3D.add(this.line, this.label);
      this.reset();
    },
    reset: function () {
      this.points = [];
      this.root = null;
      this.line.visible = this.label.visible = false;
    },
    select: function (hit) {
      const visual = hit.el.querySelector(".model-visual");
      const structure = visual && visual.fkcStructure;
      if (!structure || structure.mode !== "molecule") {
        F.setStatus("Distanzmessung zunächst nur am CIF-Einzelmolekül verfügbar.");
        return;
      }
      if (this.root !== hit.el || this.points.length === 2) this.reset();
      this.root = hit.el;
      this.visual = visual;
      const meshes = new Map();
      visual.object3D.traverse(mesh => {
        if (mesh.userData.fkcAtom) meshes.set(mesh.userData.fkcAtom.id, mesh);
      });
      const bond = hit.mesh.userData.fkcBond;
      if (bond && Number.isInteger(bond.a) && Number.isInteger(bond.b)) {
        this.points = [structure.atoms[bond.a], structure.atoms[bond.b]];
      } else if (hit.mesh.userData.fkcAtom) {
        const atom = hit.mesh.userData.fkcAtom;
        if (this.points[0] && this.points[0].id === atom.id) {
          this.points = [];
          F.setStatus("Atomauswahl zurückgenommen.");
          return;
        }
        this.points.push(atom);
      } else return;
      this.meshes = this.points.map(atom => meshes.get(atom.id));
      if (this.points.length !== 2) {
        F.setStatus("Erstes Atom: " + this.points[0].cifLabel + ". Zweites Atom wählen.");
        return;
      }
      const result = distance(this.points[0].positionAngstrom, this.points[1].positionAngstrom);
      const ctx = this.canvas.getContext("2d");
      ctx.fillStyle = "#173527";
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 52px Arial";
      ctx.textAlign = "center";
      ctx.fillText(result.toFixed(3) + " Å", 256, 82);
      this.texture.needsUpdate = true;
      F.setStatus("Distanz: " + result.toFixed(3) + " Å");
    },
    tick: function () {
      if (!this.root) return;
      if (!this.root.isConnected || this.root.querySelector(".model-visual") !== this.visual ||
          this.el.lastSelectedModel !== this.root) { this.reset(); return; }
      if (this.points.length !== 2 || !this.el.camera) return;
      const a = new T.Vector3();
      const b = new T.Vector3();
      this.meshes[0].getWorldPosition(a);
      this.meshes[1].getWorldPosition(b);
      this.el.object3D.worldToLocal(a);
      this.el.object3D.worldToLocal(b);
      const attribute = this.geometry.attributes.position;
      attribute.setXYZ(0, a.x, a.y, a.z);
      attribute.setXYZ(1, b.x, b.y, b.z);
      attribute.needsUpdate = true;
      this.geometry.computeBoundingSphere();
      this.label.position.copy(a).add(b).multiplyScalar(0.5);
      const head = new T.Vector3();
      this.el.camera.getWorldPosition(head);
      const width = T.MathUtils.clamp(this.meshes[0].getWorldPosition(new T.Vector3()).distanceTo(head) * 0.18, 0.10, 0.5);
      this.label.scale.set(width, width / 4, 1);
      this.line.visible = this.label.visible = !(F.Menu && F.Menu.opened);
    },
    remove: function () {
      this.el.object3D.remove(this.line, this.label);
      this.geometry.dispose();
      this.material.dispose();
      this.texture.dispose();
      this.labelMaterial.dispose();
    }
  });
})(window.FKCVR);