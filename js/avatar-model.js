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

  function build(id) {
    const p = parts();
    const {color, accessory} = appearance(id);
    const group = new T.Group(), head = new T.Group(), body = new T.Group();
    const shirt = p.material(color), skin = p.material("#e7b694"), dark = p.material("#22303b");
    // XR meldet die Augenhöhe. Gesicht und Schädel darum modellieren,
    // statt eine Kugel mit ihrem Mittelpunkt an der Augenpose zu zeigen.
    p.oval(head, skin, [0, -0.023, 0.035], [0.094, 0.126, 0.091]);
    for (const sign of [-1, 1]) {
      p.oval(head, skin, [sign * 0.093, -0.022, 0.026], [0.016, 0.027, 0.018]);
      p.oval(head, dark, [sign * 0.035, 0, -0.049], [0.011, 0.012, 0.008]);
    }
    p.oval(head, skin, [0, -0.029, -0.059], [0.018, 0.023, 0.021]);
    p.oval(head, dark, [0, -0.067, -0.047], [0.023, 0.006, 0.008]);
    p.oval(body, shirt, [0, -0.40, 0.065], [0.205, 0.255, 0.108]);
    p.oval(body, skin, [0, -0.175, 0.04], [0.054, 0.075, 0.049]);
    if (accessory === "hat") {
      p.mesh(head, new T.CylinderGeometry(0.128, 0.128, 0.013, 24), shirt, [0, 0.078, 0.035]);
      p.mesh(head, new T.CylinderGeometry(0.082, 0.088, 0.071, 24), shirt, [0, 0.115, 0.035]);
    } else if (accessory === "glasses") {
      for (const sign of [-1, 1]) p.mesh(head, new T.TorusGeometry(0.025, 0.004, 8, 20), dark, [sign * 0.036, 0, -0.061]);
      p.mesh(head, new T.BoxGeometry(0.027, 0.006, 0.006), dark, [0, 0.005, -0.062]);
    } else {
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
    return {group, head, body, left, right, setHands(enabled) {
      for (const side of ["left", "right"]) {
        controllers[side].group.visible = !enabled;
        hands[side].group.visible = enabled;
      }
    }, dispose() {
      group.removeFromParent();
      p.dispose();
      for (const side of ["left", "right"]) { controllers[side].dispose(); hands[side].dispose(); }
    }};
  }

  F.AvatarModels = {appearance, build, hand,
    showsHands() { return !!F.Settings?.showPointingHands && !F.Tutorial?.active; }};
})(window.FKCVR);