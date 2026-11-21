"use strict";

(function (F) {
  const T = AFRAME.THREE;
  const colors = ["#31749b", "#ac406c", "#397d51", "#bd6030", "#7063a8", "#246f71", "#925333"];
  function appearance(id) {
    // Die zufällige Sitzungs-ID ergibt dasselbe Aussehen auf jedem Headset.
    let hash = 2166136261;
    for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    hash >>>= 0;
    return {color: colors[hash % colors.length], accessory: ["hat", "glasses", "hair"][Math.floor(hash / colors.length) % 3]};
  }

  function parts() {
    const geometries = [], materials = [];
    const material = color => {
      const value = new T.MeshStandardMaterial({color, roughness: 0.8});
      materials.push(value);
      return value;
    };
    const mesh = (parent, geometry, mat, position, scale) => {
      geometries.push(geometry);
      const object = new T.Mesh(geometry, mat);
      object.position.set(...position);
      if (scale) object.scale.set(...scale);
      object.raycast = function () {};
      parent.add(object);
      return object;
    };
    const oval = (parent, mat, position, scale) => mesh(parent, new T.SphereGeometry(1, 16, 12), mat, position, scale);
    return {material, mesh, oval, dispose() {
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
    }};
  }

  function hand(side, color = "#d6e5df") {
    const p = parts();
    const group = new T.Group();
    const mat = p.material(color);
    const mirror = side === "left" ? -1 : 1;
    p.oval(group, mat, [0, 0, 0.012], [0.032, 0.022, 0.043]);
    p.oval(group, mat, [-mirror * 0.029, 0.006, -0.005], [0.013, 0.015, 0.023]);
    p.oval(group, mat, [-mirror * 0.017, 0.003, -0.058], [0.010, 0.010, 0.041]);
    for (let i = 0; i < 3; i++) p.oval(group, mat, [mirror * (-0.001 + 0.012 * i), -0.008, -0.022], [0.009, 0.013, 0.020 - 0.002 * i]);
    return {group, dispose: p.dispose};
  }

  function build(id, profile = {}) {
    const p = parts();
    const random = appearance(id);
    const color = profile.color || random.color, accessory = profile.style || random.accessory;
    const group = new T.Group(), head = new T.Group(), body = new T.Group();
    const shirt = p.material(color), skin = p.material("#e7b694"), dark = p.material("#22303b");
    // XR meldet die Augenhöhe. Gesicht und Schädel darum modellieren,
    // statt eine Kugel mit ihrem Mittelpunkt an der Augenpose zu zeigen.
    const [faceWidth, faceHeight, shoulders] = ({slim: [0.084, 0.126, 0.18], broad: [0.102, 0.126, 0.23],
      round: [0.101, 0.111, 0.201], tall: [0.092, 0.143, 0.207], compact: [0.086, 0.109, 0.19],
      oval: [0.083, 0.136, 0.215]})[profile.form] || [0.094, 0.126, 0.205];
    p.oval(head, skin, [0, -0.023, 0.035], [faceWidth, faceHeight, 0.091]);
    for (const sign of [-1, 1]) {
      p.oval(head, skin, [sign * 0.093, -0.022, 0.026], [0.016, 0.027, 0.018]);
      p.oval(head, dark, [sign * 0.035, 0, -0.049], [0.011, 0.012, 0.008]);
    }
    p.oval(head, skin, [0, -0.029, -0.059], [0.018, 0.023, 0.021]);
    p.oval(head, dark, [0, -0.067, -0.047], [0.023, 0.006, 0.008]);
    p.oval(body, shirt, [0, -0.40, 0.065], [shoulders, 0.255, 0.108]);
    p.oval(body, skin, [0, -0.175, 0.04], [0.054, 0.075, 0.049]);
    if (accessory === "hat") {
      p.mesh(head, new T.CylinderGeometry(0.128, 0.128, 0.013, 24), shirt, [0, 0.078, 0.035]);
      p.mesh(head, new T.CylinderGeometry(0.082, 0.088, 0.071, 24), shirt, [0, 0.115, 0.035]);
    } else if (accessory === "glasses") {
      for (const sign of [-1, 1]) p.mesh(head, new T.TorusGeometry(0.025, 0.004, 8, 20), dark, [sign * 0.036, 0, -0.061]);
      p.mesh(head, new T.BoxGeometry(0.027, 0.006, 0.006), dark, [0, 0.005, -0.062]);
    } else if (accessory === "monocle") {
      const gold = p.material("#ddb756");
      p.mesh(head, new T.TorusGeometry(0.025, 0.004, 8, 20), gold, [0.036, 0, -0.061]);
      p.mesh(head, new T.CylinderGeometry(0.0015, 0.0015, 0.059, 8), gold, [0.059, -0.031, -0.058]);
    } else if (accessory === "cape") {
      const cape = p.mesh(body, new T.BoxGeometry(0.37, 0.46, 0.022), dark, [0, -0.43, 0.17]);
      cape.rotation.x = -0.16;
      p.oval(body, shirt, [0, -0.23, 0.087], [0.15, 0.04, 0.105]);
    } else if (accessory === "mohawk") {
      for (let i = 0; i < 5; i++) p.mesh(head, new T.CylinderGeometry(0, 0.018, 0.067 - i * 0.007, 5), shirt,
        [0, 0.116 - i * 0.003, -0.016 + i * 0.023]);
    } else if (accessory === "crown") {
      const gold = p.material("#dda941");
      p.mesh(head, new T.CylinderGeometry(0.074, 0.081, 0.023, 24), gold, [0, 0.091, 0.035]);
      for (let i = 0; i < 5; i++) {
        const a = i * 2 * Math.PI / 5;
        p.mesh(head, new T.CylinderGeometry(0, 0.018, 0.043, 4), gold, [0.066 * Math.cos(a), 0.115, 0.035 + 0.066 * Math.sin(a)]);
      }
    } else if (accessory === "antenna") {
      p.mesh(head, new T.CylinderGeometry(0.004, 0.006, 0.090, 12), dark, [0, 0.128, 0.035]);
      p.oval(head, shirt, [0, 0.176, 0.035], [0.018, 0.018, 0.018]);
    } else if (accessory === "headband") {
      p.mesh(head, new T.CylinderGeometry(0.096, 0.096, 0.019, 32), shirt, [0, 0.041, 0.035], [1, 1, 0.97]);
    } else if (accessory === "hair") {
      for (let i = -1; i <= 1; i++) p.oval(head, dark, [i * 0.049, 0.082 - i * 0.007, 0.030], [0.042, 0.038, 0.067]);
    }
    const controllers = {}, hands = {};
    for (const side of ["left", "right"]) {
      controllers[side] = F.PicoModels.build(side);
      hands[side] = hand(side, "#e7b694");
    }
    const left = new T.Group(), right = new T.Group();
    left.add(controllers.left.group, hands.left.group);
    right.add(controllers.right.group, hands.right.group);
    group.add(head, body, left, right);
    let badge;
    if (profile.name) {
      const canvas = document.createElement("canvas");
      canvas.width = 512; canvas.height = 96;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#233139"; ctx.fillRect(0, 0, 512, 96);
      ctx.font = "bold 44px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff"; ctx.fillText(profile.name, 256, 48, 480);
      const texture = new T.CanvasTexture(canvas);
      badge = new T.Sprite(new T.SpriteMaterial({map: texture, depthWrite: false}));
      badge.position.set(0, 0.227, 0.035);
      badge.scale.set(0.42, 0.07875, 1);
      badge.raycast = function () {};
      body.add(badge);
    }
    return {group, head, body, left, right, setHands(enabled) {
      for (const side of ["left", "right"]) {
        controllers[side].group.visible = !enabled;
        hands[side].group.visible = enabled;
      }
    }, dispose() {
      group.removeFromParent();
      if (badge) { badge.material.map.dispose(); badge.material.dispose(); }
      p.dispose();
      for (const side of ["left", "right"]) { controllers[side].dispose(); hands[side].dispose(); }
    }};
  }

  F.AvatarModels = {appearance, build, hand,
    showsHands() { return !!F.Settings?.showPointingHands && !F.Tutorial?.active; }};
})(window.FKCVR);