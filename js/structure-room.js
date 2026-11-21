"use strict";

(function (F) {
  const T = AFRAME.THREE;
  // GitHub Pages bietet keine Verzeichnisliste. Der Test vergleicht diesen
  // Katalog mit dem Ordner, damit neue CIFs nicht unbemerkt fehlen.
  const catalog = [
    ["C60_fullerene.cif", "C₆₀ · Fulleren", [["molecule", "Molekül"], ["cell", "Zelle"]]],
    ["Co-Produkt1.cif", "Co-Komplex", [["molecule", "Molekül"], ["cell", "Zelle"], ["coordination", "Koordination"]]],
    ["Cu.cif", "Kupfer"], ["H2O.cif", "Eis"],
    ["NaCl.cif", "Natriumchlorid", [["cell", "Zelle"], ["coordination", "Na⁺-Umgebung"]]],
    ["S8.cif", "S₈ · Schwefel"], ["YBa2Cu3O7-x_tetragonal.cif", "YBa₂Cu₃O₇₋ₓ · CIF"],
    ["ZnS.cif", "ZnS · Zinkblende", [["cell", "Zelle"], ["coordination", "Zn-Umgebung"]]]
  ];
  const config = {id: "structure-room", kind: "structure-room", title: "Strukturraum · CIF-Bibliothek",
    spawn: {x: 0, z: 3.8}, modelSize: 0.85};

  function variants(entry) {
    const path = "assets/structures/" + entry[0];
    return (entry[2] || [["library-cell", "Zellpositionen"]]).map(([cifMode, title]) => ({id: cifMode, cifMode, title, model: path}));
  }

  function build(parent, makeModel) {
    F.create("a-plane", {rotation: "-90 0 0", width: 108, height: 108,
      material: {color: "#e2e9ec", shader: "flat"}}, parent);
    const grid = F.create("a-entity", {position: "0 0.003 0"}, parent);
    const lines = new T.GridHelper(108, 54, "#bdccd2", "#ccd9de");
    grid.setObject3D("grid", lines);
    F.create("a-entity", {light: {type: "ambient", intensity: 0.9}}, parent);
    F.create("a-entity", {position: "-4 10 6", light: {type: "directional", intensity: 0.8}}, parent);
    F.create("a-box", {position: "-1.2 0.55 1.9", width: 0.14, height: 1.10, depth: 0.14,
      color: "#607b8b"}, parent);
    const tablet = F.create("a-entity", {class: "vr-action", position: "-1.2 1.36 1.95", rotation: "-14 0 0"}, parent);
    tablet.fkcDisposeGrid = () => { lines.geometry.dispose(); lines.material.dispose(); };
    tablet.setAttribute("fkc-structure-tablet", "");
    tablet.fkcMakeModel = (entry, choices) => {
      const first = choices[0];
      const model = makeModel(parent, {title: entry[1], model: first.model, cifMode: first.cifMode,
        info: entry[2] ? "CIF-Ansichten aus dem Projekt. Die Größe im Raum ist ein Anzeigemaßstab." :
          "Atompositionen und Symmetrie aus der hinterlegten CIF. Keine automatisch ergänzten Bindungen. " +
          "Transparente Kugeln markieren Teilbesetzung. Keine Aussage über eine ideale oder reine Phase."},
      0, config, {x: 1.25, y: 1.45, z: -1.8});
      model.fkcVariants = choices.length > 1 ? choices : [];
      model.fkcVariantId = first.id;
      model.fkcVariantAlignment = "individual";
      return model;
    };
    return {spawn: config.spawn, isWalkable: (x, z) => Math.abs(x) < 50 && Math.abs(z) < 50 &&
      Math.hypot(x + 1.2, z - 1.9) > 0.35};
  }

  F.StructureRoom = {config, catalog, variants, build, click(hit) { hit.el.components["fkc-structure-tablet"]?.click(hit.uv); }};
  AFRAME.registerComponent("fkc-structure-tablet", {
    init() {
      this.el.dataset.fkcStructureTablet = "true";
      this.canvas = document.createElement("canvas");
      this.canvas.width = 896;
      this.canvas.height = 730;
      this.texture = new T.CanvasTexture(this.canvas);
      this.material = new T.MeshBasicMaterial({map: this.texture, side: T.DoubleSide});
      this.geometry = new T.PlaneGeometry(1.34, 1.09);
      this.el.setObject3D("mesh", new T.Mesh(this.geometry, this.material));
      this.message = "Wähle eine CIF. Der Raum startet ohne Modell.";
      this.render();
    },
    render() {
      const ctx = this.canvas.getContext("2d");
      ctx.fillStyle = "#203848";
      ctx.fillRect(0, 0, 896, 730);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 46px Arial";
      ctx.fillText("Strukturbibliothek", 36, 62);
      this.buttons = [];
      const button = (x, y, w, label, action, active = false) => {
        ctx.fillStyle = active ? "#ffd67c" : "#c8e3ef";
        ctx.fillRect(x, y, w, 76);
        ctx.fillStyle = "#172f3e";
        ctx.font = "bold 31px Arial";
        ctx.fillText(label, x + 13, y + 48, w - 26);
        this.buttons.push({x, y, w, action});
      };
      catalog.forEach((entry, i) => button(36 + i % 2 * 420, 105 + Math.floor(i / 2) * 90,
        402, entry[1], () => this.load(entry), this.entry === entry));
      button(36, 480, 255, "− Kleiner", () => this.resize(0.5));
      button(320, 480, 255, "+ Größer", () => this.resize(2));
      button(604, 480, 254, "Modell entfernen", () => this.clear());
      button(36, 574, 420, "Zum Begrüßungsraum", () => F.app.changeRoom("welcome"));
      button(475, 574, 383, "Modell zurücksetzen", () => {
        if (this.model?.modelReady) { F.resetModel(this.model); this.message = "Modell zurückgesetzt."; this.render(); }
      });
      ctx.fillStyle = "#ffffff";
      ctx.font = "28px Arial";
      ctx.fillText(this.message, 36, 696, 822);
      this.texture.needsUpdate = true;
    },
    click(uv) {
      if (!uv) return;
      const x = uv.x * 896, y = (1 - uv.y) * 730;
      this.buttons.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + 76)?.action();
    },
    load(entry) {
      this.clear(false);
      this.entry = entry;
      this.message = "Lade " + entry[0] + " …";
      const model = this.model = this.el.fkcMakeModel(entry, variants(entry));
      const visual = model.querySelector(".model-visual");
      visual.addEventListener("model-loaded", () => {
        if (this.model !== model) return;
        this.message = entry[2] ? "Bereit · Laser auswählen → Handmenü öffnen" : "Bereit · Zellpositionen ohne Bindungen";
        this.render();
      }, {once: true});
      visual.addEventListener("model-error", () => {
        if (this.model !== model) return;
        this.clear(false);
        this.message = "CIF konnte nicht geladen werden: " + entry[0];
        this.render();
      }, {once: true});
      this.render();
    },
    resize(factor) {
      const model = this.model;
      if (!model?.modelReady) return;
      F.releaseModel(model);
      const body = model.querySelector(".manip-body").object3D;
      const scale = T.MathUtils.clamp(body.scale.x * factor, 0.05, 16);
      body.scale.setScalar(scale);
      model.object3D.position.y = Math.max(model.homePosition.y, scale * config.modelSize / 2 + 0.15);
      model.object3D.updateWorldMatrix(true, true);
      this.message = `Anzeigegröße: ${Math.round(scale * 100)} %`;
      this.render();
    },
    clear(redraw = true) {
      if (this.model) {
        F.releaseModel(this.model);
        F.Draw?.clear(this.model);
        const scene = this.el.sceneEl;
        if (scene?.lastSelectedModel === this.model) scene.lastSelectedModel = null;
        if (scene?.lastSelectedTarget === this.model) scene.lastSelectedTarget = null;
        this.model.remove();
        this.model = null;
        F.invalidateHits();
      }
      this.entry = null;
      this.message = "Wähle eine CIF.";
      if (redraw) this.render();
    },
    remove() {
      this.clear(false);
      this.el.fkcDisposeGrid?.();
      this.texture.dispose(); this.geometry.dispose(); this.material.dispose();
    }
  });
})(window.FKCVR);