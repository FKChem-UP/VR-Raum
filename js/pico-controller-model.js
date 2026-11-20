"use strict";

// Eigenständige, angenäherte Pico-4-Ultra-Modelle nach Nutzerfotos.
// Maße/verdeckt liegende Konturen sind geschätzt, kein Hersteller-CAD.
(function (F) {
  const T = AFRAME.THREE;
  const buttons = hand => ["grip", "trigger", "joystick", ...(hand === "left" ? ["X", "Y"] : ["A", "B"])];
  function build(hand) {
    if (!["left", "right"].includes(hand)) throw new Error("Unbekannte Controllerhand.");
    const mirror = hand === "left" ? -1 : 1;
    const group = new T.Group();
    group.name = "Pico-4-Ultra-approximation-" + hand;
    const geometries = new Set(), materials = new Set(), textures = new Set();
    const controls = new Map();
    function material(color) {
      const result = new T.MeshStandardMaterial({color, roughness: 0.65, metalness: 0});
      materials.add(result);
      return result;
    }
    const white = material("#eeeef0"), seam = material("#bfc2c6");
    function mesh(name, geometry, mat, position, scale) {
      geometries.add(geometry);
      const object = new T.Mesh(geometry, mat);
      object.name = name;
      object.position.set(...position);
      if (scale) object.scale.set(...scale);
      object.raycast = function () {}; // Nur Darstellung, keine Welt-/Menütreffer.
      group.add(object);
      return object;
    }
    // Glatter, länglicher Griff mit rundem Abschluss; ringlose ovale Oberseite.
    const grip = mesh("housing-handle", new T.SphereGeometry(1, 24, 20), white,
      [mirror * 0.004, -0.041, 0.012], [0.024, 0.077, 0.023]);
    grip.rotation.z = mirror * -0.08;
    const head = mesh("housing-head", new T.SphereGeometry(1, 32, 20), white,
      [0, 0.025, -0.006], [0.041, 0.025, 0.047]);
    head.rotation.x = -0.18;
    const face = mesh("housing-top-seam", new T.SphereGeometry(1, 32, 16), seam,
      [0, 0.041, -0.009], [0.0375, 0.003, 0.041]);
    face.rotation.x = -0.18;
    mesh("housing-top", new T.SphereGeometry(1, 32, 16), white,
      [0, 0.043, -0.009], [0.037, 0.003, 0.040]).rotation.x = -0.18;
    function control(name, geometry, position, scale, color = "#242629") {
      const mat = material(color);
      const object = mesh(name, geometry, mat, position, scale);
      object.userData.fkcControl = name;
      controls.set(name, {mesh: object, material: mat, color});
      return object;
    }
    const stick = control("joystick", new T.CylinderGeometry(0.009, 0.009, 0.005, 24),
      [-mirror * 0.017, 0.053, -0.022]);
    stick.rotation.x = -0.18;
    mesh("joystick-stem", new T.CylinderGeometry(0.004, 0.005, 0.009, 16), material("#17191b"),
      [-mirror * 0.017, 0.047, -0.022]);
    const names = hand === "left" ? ["X", "Y"] : ["A", "B"];
    names.forEach((name, i) => {
      const x = mirror * (i ? 0.009 : 0.010), z = i ? -0.019 : 0.003;
      control(name, new T.CylinderGeometry(0.0062, 0.0067, 0.0035, 20), [x, 0.048, z]).rotation.x = -0.18;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 64, 64);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 46px Arial";
      ctx.textAlign = "center"; ctx.fillText(name, 32, 49);
      const texture = new T.CanvasTexture(canvas); textures.add(texture);
      const textMaterial = new T.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, side: T.DoubleSide});
      materials.add(textMaterial);
      const text = mesh("label-" + name, new T.PlaneGeometry(0.009, 0.009), textMaterial, [x, 0.0502, z]);
      text.rotation.x = -Math.PI / 2 - 0.18;
    });
    control("trigger", new T.SphereGeometry(1, 20, 16), [0, 0.022, -0.049], [0.013, 0.012, 0.008], "#d2d4d7");
    control("grip", new T.SphereGeometry(1, 20, 16), [-mirror * 0.024, -0.013, 0.003], [0.006, 0.017, 0.010], "#d2d4d7");
    mesh("system-button", new T.CylinderGeometry(0.0045, 0.0045, 0.002, 16), white,
      [mirror * 0.025, 0.046, 0.008]).rotation.x = -0.18;
    mesh("menu-button", new T.CylinderGeometry(0.0045, 0.0045, 0.002, 16), white,
      [mirror * 0.027, 0.046, -0.008]).rotation.x = -0.18;
    return {
      group, controls,
      highlight(names) {
        const active = new Set(names);
        for (const [name, entry] of controls) {
          entry.material.color.set(active.has(name) ? "#ff2020" : entry.color);
          entry.material.emissive.set(active.has(name) ? "#ff0000" : "#000000");
          entry.material.emissiveIntensity = active.has(name) ? 0.85 : 0;
        }
      },
      dispose() {
        geometries.forEach(resource => resource.dispose());
        materials.forEach(resource => resource.dispose());
        textures.forEach(resource => resource.dispose());
      }
    };
  }
  F.PicoModels = {
    build, buttons,
    highlights: {left: [], right: []},
    setHighlights(hand, names) {
      if (!["left", "right"].includes(hand)) return false;
      if (!Array.isArray(names) || names.some(name => !buttons(hand).includes(name))) return false;
      this.highlights[hand] = names.slice();
      return true;
    },
    tutorial(step) {
      const active = step === 0 ? ["joystick"] : step === 1 || step === 2 ? ["grip"] : [];
      this.setHighlights("left", active); this.setHighlights("right", active);
    }
  };
  AFRAME.registerComponent("fkc-pico-model", {
    schema: {hand: {default: "right"}},
    init: function () {
      this.built = build(this.data.hand);
      // Eigener Object3D-Schlüssel: hand-controls darf seinen Tracking-/Meshslot
      // weiterhin verwalten. Die Grip-Pose setzt nur diese Visual-Untergruppe.
      this.el.setObject3D("pico-controller", this.built.group);
      this.built.group.visible = false;
      this.position = new T.Vector3();
      this.quaternion = new T.Quaternion();
      this.parentQuaternion = new T.Quaternion();
      this.hidden = new Map();
      this.exit = () => this.restore();
      this.el.sceneEl.addEventListener("exit-vr", this.exit);
    },
    restore: function () {
      this.built.group.visible = false;
      for (const [object, visible] of this.hidden) object.visible = visible;
      this.hidden.clear();
    },
    tick: function () {
      const scene = this.el.sceneEl;
      const source = F.getSource(scene, this.data.hand);
      const xr = scene.renderer && scene.renderer.xr;
      const frame = scene.frame && typeof scene.frame.getPose === "function" ? scene.frame : xr && xr.getFrame && xr.getFrame();
      const reference = xr && xr.getReferenceSpace && xr.getReferenceSpace();
      const rig = F.getRig();
      if (!source || !source.gripSpace || !frame || !reference || !rig) { this.restore(); return; }
      const pose = frame.getPose(source.gripSpace, reference);
      if (!pose) { this.built.group.visible = false; return; }
      // Das frühere Handmesh verstecken, ohne Laser/Grabber/Tracking zu ändern.
      const handMesh = this.el.getObject3D("mesh");
      if (handMesh) {
        if (!this.hidden.has(handMesh)) this.hidden.set(handMesh, handMesh.visible);
        handMesh.visible = false;
      }
      rig.object3D.updateWorldMatrix(true, false);
      this.position.copy(pose.transform.position).applyMatrix4(rig.object3D.matrixWorld);
      this.quaternion.copy(pose.transform.orientation);
      rig.object3D.getWorldQuaternion(this.parentQuaternion);
      this.quaternion.premultiply(this.parentQuaternion);
      this.el.object3D.updateWorldMatrix(true, false);
      this.el.object3D.worldToLocal(this.position);
      this.el.object3D.getWorldQuaternion(this.parentQuaternion);
      this.quaternion.premultiply(this.parentQuaternion.invert());
      this.built.group.position.copy(this.position);
      this.built.group.quaternion.copy(this.quaternion);
      this.built.group.visible = true;
      this.built.highlight(F.PicoModels.highlights[this.data.hand]);
    },
    remove: function () {
      this.restore();
      this.el.sceneEl.removeEventListener("exit-vr", this.exit);
      this.el.removeObject3D("pico-controller");
      this.built.dispose();
    }
  });
})(window.FKCVR);