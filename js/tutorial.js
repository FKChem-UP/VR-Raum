"use strict";

(function (F) {
  const T = AFRAME.THREE;
  function crossed(previous, current, width = 1.4, height = 0.8) {
    if (!previous || previous.z <= 0 || current.z > 0) return false;
    const t = previous.z / (previous.z - current.z);
    return Math.abs(previous.x + t * (current.x - previous.x)) <= width / 2 &&
      Math.abs(previous.y + t * (current.y - previous.y)) <= height / 2;
  }
  F.Tutorial = {
    active: false, crossed,
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
      this.group = F.create("a-entity", {}, this.el);
      this.group.object3D.visible = false;
      this.canvas = document.createElement("canvas");
      this.canvas.width = 1024; this.canvas.height = 640;
      this.texture = new T.CanvasTexture(this.canvas);
      this.geometry = new T.PlaneGeometry(1.4, 0.875);
      this.material = new T.MeshBasicMaterial({map: this.texture, side: T.DoubleSide, depthTest: false});
      this.board = F.create("a-entity", {class: "vr-action"}, this.group);
      this.board.dataset.fkcTutorial = "true";
      const mesh = new T.Mesh(this.geometry, this.material);
      mesh.renderOrder = 200;
      this.board.setObject3D("mesh", mesh);
      this.shellGeometry = new T.SphereGeometry(60, 24, 16);
      this.shellMaterial = new T.MeshBasicMaterial({color: "#ffffff", side: T.BackSide,
        transparent: true, opacity: 0.82, depthWrite: false});
      this.shell = new T.Mesh(this.shellGeometry, this.shellMaterial);
      this.shell.raycast = function () {};
      this.shell.renderOrder = 80;
      this.group.object3D.add(this.shell);
      this.target = F.create("a-sphere", {radius: 0.3, color: "#4a85b8", position: "0 1.2 2"}, this.group);
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
      F.Tutorial.active = true;
      this.group.object3D.visible = true;
      this.board.object3D.position.set(phase === "question" ? 0 : -0.9, this.head.y, 5.1);
      this.board.object3D.rotation.set(0, 0, 0);
      this.previous = null;
      this.target.object3D.visible = phase !== "question";
      this.shellMaterial.opacity = phase === "question" ? 0.82 : 1;
      this.shell.renderOrder = phase === "question" ? 80 : -100;
      this.room = document.getElementById("room-root");
      if (phase !== "question" && this.room) {
        if (this.roomVisible === undefined) this.roomVisible = this.room.object3D.visible;
        this.room.object3D.visible = false;
      }
      this.render();
      F.invalidateHits();
    },
    render: function () {
      const ctx = this.canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 1024, 640);
      ctx.fillStyle = "#203f30"; ctx.font = "bold 64px Arial";
      ctx.fillText(this.phase === "question" ? "Tutorial?" : this.phase === "done" ? "Gut gemacht!" : "1 · Bewegen und drehen", 50, 100);
      ctx.font = "36px Arial";
      const lines = this.phase === "question" ? ["Möchtest du die Bedienung kennenlernen?", "Nein oder durch das Schild gehen: überspringen."] :
        this.phase === "done" ? ["Du hast das Ziel erreicht.", "Weitere Tutorialschritte folgen später."] :
          ["Linker Joystick: bewegen", "Rechter Joystick: drehen", "Gehe bis auf 80 cm an die blaue Kugel.", "Bei Unwohlsein: Tutorial beenden."];
      lines.forEach((line, i) => ctx.fillText(line, 50, 180 + i * 55, 924));
      this.buttons = this.phase === "question" ? [{x: 80, w: 380, title: "Ja", action: () => this.show("training")},
        {x: 560, w: 380, title: "Nein", action: () => this.close()}] :
        [{x: 80, w: 860, title: this.phase === "done" ? "Zum Begrüßungsraum" : "Tutorial beenden", action: () => this.close()}];
      for (const button of this.buttons) {
        ctx.fillStyle = "#b9dcc4"; ctx.fillRect(button.x, 480, button.w, 100);
        ctx.fillStyle = "#203f30"; ctx.fillText(button.title, button.x + 30, 547, button.w - 60);
      }
      this.texture.needsUpdate = true;
    },
    click: function (hit) {
      if (!F.Tutorial.active || !hit.uv) return;
      const x = hit.uv.x * 1024, y = (1 - hit.uv.y) * 640;
      const button = this.buttons.find(button => x >= button.x && x <= button.x + button.w && y >= 480 && y <= 580);
      if (button) { F.Menu.blockDrawing(); button.action(); }
    },
    tick: function () {
      if (!this.el.is("vr-mode")) return;
      if (!F.app || !F.app.activeRoom || F.app.pendingSpawn) return;
      if (!F.HandMenu.readViewerHead(this.el, F.getRig(), this.head)) return;
      if (this.pending) {
        if (F.app.currentId !== "welcome") F.app.changeRoom("welcome");
        F.app.positionAtSpawn({x: 0, z: 6.5});
        const phase = this.pending; this.pending = null;
        this.show(phase);
        return;
      }
      if (!F.Tutorial.active) return;
      if (F.Menu.opened) F.Menu.close();
      const menu = this.el.components["fkc-hand-menu"];
      if (menu) menu.hide();
      if (this.phase === "question") {
        this.board.object3D.updateWorldMatrix(true, false);
        this.local.copy(this.head);
        this.board.object3D.worldToLocal(this.local);
        if (crossed(this.previous, this.local)) this.close();
        this.previous = this.local.clone();
      } else if (this.phase === "training" && Math.hypot(this.head.x, this.head.z - 2) < 0.8) {
        this.phase = "done"; this.render();
      }
    },
    close: function () {
      const returnToSpawn = this.phase === "training" || this.phase === "done";
      if (this.room && this.roomVisible !== undefined) this.room.object3D.visible = this.roomVisible;
      this.roomVisible = undefined;
      F.Tutorial.active = false;
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
      [this.geometry, this.material, this.texture, this.shellGeometry, this.shellMaterial].forEach(resource => resource.dispose());
    }
  });
})(window.FKCVR);