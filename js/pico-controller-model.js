"use strict";

// Eigenständige, angenäherte Pico-4-Ultra-Modelle nach Nutzerfotos.
// Maße/verdeckt liegende Konturen sind geschätzt, kein Hersteller-CAD.
(function (F) {
  const T = AFRAME.THREE;
  const buttons = hand => ["grip", "trigger", "joystick", ...(hand === "left" ? ["X", "Y"] : ["A", "B"])];
  const helpText = "Steuerhilfe";
  const hideHelpText = "Steuerhilfe ausblenden";

  // xr-standard: Slot 3 ist der Klick des Thumbsticks, nicht dessen Achsen.
  function helpPress(state, source) {
    const gp = source && source.gamepad;
    const available = !!(gp && gp.mapping === "xr-standard" && gp.buttons[3]);
    const down = available && F.buttonPressed(gp, 3);
    const toggle = available && state.source === source && down && !state.down;
    Object.assign(state, {source, available, down});
    return toggle;
  }

  function controlLabels(hand, help, helpAvailable, tutorialStep, laserHand, painting) {
    const labels = {};
    if (help) {
      labels.grip = "Greifen / Skalieren";
      labels.trigger = hand === laserHand ? (painting ? "Zeichnen / Auswählen" : "Auswählen / Messen") : "Trigger ohne Laser";
      labels.joystick = hand === "left" ? "Bewegen" : "Drehen";
      labels[hand === "left" ? "X" : "A"] = "Zurücksetzen";
      labels[hand === "left" ? "Y" : "B"] = "Hauptmenü";
    }
    if (tutorialStep === "question") {
      if (hand === laserHand) labels.trigger = "Trigger: Auswählen";
    } else if (tutorialStep === 0) {
      labels.joystick = hand === "left" ? "Bewegen" : "Drehen";
    } else if (tutorialStep === 1 || tutorialStep === 2) {
      labels.grip = tutorialStep === 1 ? "Grip: Greifen" : "Grip: Skalieren";
    }
    if (hand === "right" && helpAvailable) labels.help = help ? hideHelpText : helpText;
    return labels;
  }
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
    const white = material("#eeeef0");
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
    // Ein durchgehendes Gehäuse statt überlappender Ellipsoide. In Grip-Space
    // zeigt -Z nach vorn: vom Tastenfeld läuft der Griff überwiegend nach +Z.
    // Querschnitte in mm: Höhe, Z-Mitte, Halbachsen X/Z, seitlicher Versatz.
    const rings = [
      [-44, 79, 5, 7, 4], [-42, 77, 12, 13, 4], [-36, 69, 16, 20, 4],
      [-25, 48, 18, 27, 3], [-12, 23, 19, 29, 2], [0, 3, 21, 29, 0],
      [9, -12, 25, 30, -2], [15, -21, 32, 36, -3], [22, -25, 39, 42, -3],
      [28, -26, 40, 43, -3], [33, -26, 38, 41, -3], [35, -26, 34, 37, -3]
    ];
    const vertices = [], indices = [], sides = 40;
    rings.forEach(([y, z, rx, rz, x], ring) => {
      for (let i = 0; i < sides; i++) {
        const angle = 2 * Math.PI * i / sides;
        vertices.push((mirror * x + rx * Math.cos(angle)) / 1000, y / 1000, (z + rz * Math.sin(angle)) / 1000);
        if (ring) {
          const a = (ring - 1) * sides + i, b = (ring - 1) * sides + (i + 1) % sides;
          indices.push(a, a + sides, b, b, a + sides, b + sides);
        }
      }
    });
    for (const ring of [0, rings.length - 1]) {
      const [y, z, , , x] = rings[ring], center = vertices.length / 3;
      vertices.push(mirror * x / 1000, y / 1000, z / 1000);
      for (let i = 0; i < sides; i++) {
        const a = ring * sides + i, b = ring * sides + (i + 1) % sides;
        indices.push(center, ring ? b : a, ring ? a : b);
      }
    }
    const shell = new T.BufferGeometry();
    shell.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    shell.setIndex(indices);
    shell.computeVertexNormals();
    mesh("housing", shell, white, [0, 0, 0]);
    function control(name, geometry, position, scale, color = "#242629") {
      const mat = material(color);
      const object = mesh(name, geometry, mat, position, scale);
      object.userData.fkcControl = name;
      controls.set(name, {mesh: object, material: mat, color});
      return object;
    }
    const stickX = mirror * 0.013;
    mesh("joystick-socket", new T.CylinderGeometry(0.010, 0.011, 0.002, 28), material("#494b4f"), [stickX, 0.0356, -0.042]);
    mesh("joystick-stem", new T.CylinderGeometry(0.004, 0.005, 0.008, 20), material("#17191b"), [stickX, 0.040, -0.042]);
    control("joystick", new T.CylinderGeometry(0.009, 0.008, 0.004, 32), [stickX, 0.045, -0.042]);
    const names = hand === "left" ? ["X", "Y"] : ["A", "B"];
    names.forEach((name, i) => {
      const x = -mirror * (i ? 0.018 : 0.006), z = i ? -0.034 : -0.010;
      control(name, new T.CylinderGeometry(0.0065, 0.007, 0.004, 28), [x, 0.037, z]);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 64, 64);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 46px Arial";
      ctx.textAlign = "center"; ctx.fillText(name, 32, 49);
      const texture = new T.CanvasTexture(canvas); textures.add(texture);
      const textMaterial = new T.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, side: T.DoubleSide});
      materials.add(textMaterial);
      const text = mesh("label-" + name, new T.PlaneGeometry(0.009, 0.009), textMaterial, [x, 0.0393, z]);
      text.rotation.x = -Math.PI / 2;
    });
    control("trigger", new T.SphereGeometry(1, 24, 16), [0, 0.010, -0.044], [0.012, 0.014, 0.009], "#d2d4d7").rotation.x = -0.6;
    control("grip", new T.SphereGeometry(1, 24, 16), [-mirror * 0.019, -0.006, 0.013], [0.005, 0.008, 0.017], "#d2d4d7").rotation.x = 0.45;
    const labels = new Map();
    const anchors = {
      trigger: [mirror * 0.026, 0.025, -0.043],
      grip: [-mirror * 0.046, 0.031, 0.026],
      joystick: [mirror * 0.043, 0.048, -0.026],
      [names[0]]: [-mirror * 0.041, 0.057, 0.007],
      [names[1]]: [-mirror * 0.047, 0.057, -0.043],
      help: [0.044, 0.080, -0.050]
    };
    function showLabels(texts) {
      for (const [name, anchor] of Object.entries(anchors)) {
        const text = texts[name];
        let label = labels.get(name);
        if (!text) { if (label) label.sprite.visible = false; continue; }
        if (!label) {
          const canvas = document.createElement("canvas");
          canvas.width = 512;
          canvas.height = 96;
          const texture = new T.CanvasTexture(canvas);
          const mat = new T.SpriteMaterial({map: texture, depthTest: false, depthWrite: false, toneMapped: false});
          const sprite = new T.Sprite(mat);
          sprite.position.set(...anchor);
          sprite.renderOrder = 10020;
          sprite.raycast = function () {};
          group.add(sprite);
          textures.add(texture);
          materials.add(mat);
          label = {canvas, texture, sprite, text: null};
          labels.set(name, label);
        }
        label.sprite.visible = true;
        if (label.text === text) continue;
        label.text = text;
        const ctx = label.canvas.getContext("2d");
        ctx.clearRect(0, 0, 512, 96);
        ctx.font = "bold 38px Arial";
        const width = Math.min(512, Math.ceil(ctx.measureText(text).width) + 30);
        ctx.fillStyle = "#202a29";
        ctx.fillRect(0, 14, width, 68);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, 15, 62, width - 30);
        label.texture.repeat.set(width / 512, 1);
        label.texture.needsUpdate = true;
        label.sprite.scale.set(width * 0.00019, 96 * 0.00019, 1);
      }
    }
    return {
      group, controls, showLabels,
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
    build, buttons, helpPress, controlLabels,
    help: false,
    tutorialStep: -1,
    highlights: {left: [], right: []},
    setHighlights(hand, names) {
      if (!["left", "right"].includes(hand)) return false;
      if (!Array.isArray(names) || names.some(name => !buttons(hand).includes(name))) return false;
      this.highlights[hand] = names.slice();
      return true;
    },
    tutorial(step) {
      this.tutorialStep = step;
      const active = step === 0 ? ["joystick"] : step === 1 || step === 2 ? ["grip"] : [];
      for (const hand of ["left", "right"]) {
        this.setHighlights(hand, step === "question" && hand === F.HandMenu.laserHand() ? ["trigger"] : active);
      }
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
      this.helpButton = {};
      this.exit = () => {
        this.helpButton = {};
        F.PicoModels.help = false;
        this.restore();
      };
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
      const models = F.PicoModels;
      if (this.data.hand === "right") {
        if (helpPress(this.helpButton, source)) models.help = !models.help;
        if (!this.helpButton.available) models.help = false;
      }
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
      const active = models.highlights[this.data.hand];
      this.built.highlight(this.helpButton.available ? [...active, "joystick"] : active);
      this.built.showLabels(controlLabels(this.data.hand, models.help, this.helpButton.available,
        models.tutorialStep, F.HandMenu.laserHand(), F.Draw && F.Draw.mode === "paint"));
    },
    remove: function () {
      this.restore();
      this.el.sceneEl.removeEventListener("exit-vr", this.exit);
      this.el.removeObject3D("pico-controller");
      this.built.dispose();
    }
  });
})(window.FKCVR);