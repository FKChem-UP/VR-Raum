"use strict";

(function (F) {
  const T = AFRAME.THREE;
  const DURATION = 1000;

  function advance(state, target, pressed, time) {
    if (!state.target || !pressed || target !== state.target || !target.isConnected) {
      state.target = null;
      return {progress: 0, complete: false};
    }
    const progress = Math.max(0, Math.min(1, (time - state.started) / DURATION));
    if (progress === 1) state.target = null;
    return {progress, complete: progress === 1};
  }

  function poster(hit) {
    return hit && hit.type === "action" && hit.el && hit.el.dataset.roomId &&
      hit.el.isConnected ? hit.el : null;
  }

  F.RoomEntry = {
    advance,
    begin(hit, tools) {
      const scene = F.getScene();
      const component = scene && scene.components["fkc-room-entry"];
      if (component) component.begin(hit, tools);
    }
  };

  AFRAME.registerComponent("fkc-room-entry", {
    init: function () {
      this.state = {target: null, started: 0};
      this.mouse = new T.Vector2();
      this.raycaster = new T.Raycaster();
      this.mousePressed = false;
      this.pointerId = null;
      this.point = new T.Vector3();
      this.head = new T.Vector3();
      this.canvas = document.createElement("canvas");
      this.canvas.width = 512;
      this.canvas.height = 160;
      this.texture = new T.CanvasTexture(this.canvas);
      this.material = new T.SpriteMaterial({
        map: this.texture, depthTest: false, depthWrite: false
      });
      this.label = new T.Sprite(this.material);
      this.label.renderOrder = 1001;
      this.label.raycast = function () {};
      this.label.visible = false;
      this.el.object3D.add(this.label);
      this.move = event => {
        if (event.target !== this.el.canvas ||
            (this.pointerId !== null && event.pointerId !== this.pointerId)) {
          if (event.pointerId === this.pointerId) this.cancel();
          return;
        }
        const rect = this.el.canvas.getBoundingClientRect();
        this.mouse.set((event.clientX - rect.left) / rect.width * 2 - 1,
          -(event.clientY - rect.top) / rect.height * 2 + 1);
      };
      this.down = event => {
        if (event.button !== 0 || event.target !== this.el.canvas || this.inVR()) return;
        this.pointerId = event.pointerId;
        this.move(event);
        const hit = this.desktopHit();
        if (!poster(hit)) { this.pointerId = null; return; }
        this.mousePressed = true;
        this.begin(hit, null);
      };
      this.up = event => {
        if (event.pointerId === this.pointerId) this.cancel();
      };
      this.cancelEvent = () => this.cancel();
      document.addEventListener("pointermove", this.move);
      document.addEventListener("pointerdown", this.down);
      document.addEventListener("pointerup", this.up);
      document.addEventListener("pointercancel", this.up);
      document.addEventListener("pointerleave", this.cancelEvent);
      window.addEventListener("blur", this.cancelEvent);
      this.el.addEventListener("enter-vr", this.cancelEvent);
      this.el.addEventListener("exit-vr", this.cancelEvent);
    },

    inVR: function () {
      const xr = this.el.renderer && this.el.renderer.xr;
      return this.el.is("vr-mode") || !!(xr && xr.getSession());
    },

    desktopHit: function () {
      if (!this.el.camera || !F.findHit) return null;
      this.el.camera.updateWorldMatrix(true, false);
      this.raycaster.setFromCamera(this.mouse, this.el.camera);
      this.raycaster.far = 30;
      return F.findHit(this.raycaster, true);
    },

    begin: function (hit, tools) {
      const target = poster(hit);
      if (!target || (F.Menu && F.Menu.opened) || (F.HandMenu && F.HandMenu.opened)) return;
      this.state = {target, started: performance.now()};
      this.tools = tools;
      this.roomId = target.dataset.roomId;
      this.hit = hit;
      this.draw(0);
    },

    cancel: function () {
      this.state.target = null;
      this.mousePressed = false;
      this.pointerId = null;
      this.tools = null;
      this.label.visible = false;
    },

    draw: function (progress) {
      const ctx = this.canvas.getContext("2d");
      ctx.clearRect(0, 0, 512, 160);
      ctx.fillStyle = "#173527";
      ctx.fillRect(0, 0, 512, 160);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Betreten · " + Math.floor(progress * 100) + " %", 256, 48);
      ctx.font = "24px Arial";
      ctx.fillText("1 Sekunde halten · Loslassen bricht ab", 256, 84);
      ctx.fillStyle = "#52655a";
      ctx.fillRect(20, 108, 472, 30);
      ctx.fillStyle = "#ffcc33";
      ctx.fillRect(20, 108, 472 * progress, 30);
      this.texture.needsUpdate = true;
      this.label.visible = true;
    },

    tick: function () {
      if (!this.state.target) return;
      const tools = this.tools;
      let hit;
      let pressed;
      if (tools) {
        const grabber = tools.el.components["fkc-grabber"];
        pressed = this.inVR() && tools.source && tools.states.trigger &&
          (!tools.source.gamepad || F.buttonPressed(tools.source.gamepad, 0)) &&
          (!F.HandMenu || tools.data.hand === F.HandMenu.laserHand()) &&
          !(grabber && grabber.grabbed);
        // Nicht den möglicherweise noch vom letzten Frame stammenden Treffer nutzen.
        if (pressed) {
          tools.updateRay();
          tools.updateHit();
          hit = tools.hit;
        }
      } else {
        pressed = !this.inVR() && this.mousePressed;
        hit = this.desktopHit();
      }
      if ((F.Menu && F.Menu.opened) || (F.HandMenu && F.HandMenu.opened)) pressed = false;
      const result = advance(this.state, poster(hit), pressed, performance.now());
      if (result.complete) {
        const roomId = this.roomId;
        this.cancel();
        if (F.Menu) F.Menu.blockDrawing();
        F.app.changeRoom(roomId);
        return;
      }
      if (!this.state.target || !this.el.camera) { this.cancel(); return; }
      this.draw(result.progress);
      this.point.copy(hit.point);
      this.el.camera.getWorldPosition(this.head);
      // Unmittelbar vor dem Treffer, ohne Treffergeometrie zu verändern.
      this.point.lerp(this.head, 0.015);
      this.el.object3D.worldToLocal(this.point);
      this.label.position.copy(this.point);
      const width = T.MathUtils.clamp(hit.distance * 0.25, 0.25, 1);
      this.label.scale.set(width, width * 160 / 512, 1);
    },

    remove: function () {
      this.cancel();
      document.removeEventListener("pointermove", this.move);
      document.removeEventListener("pointerdown", this.down);
      document.removeEventListener("pointerup", this.up);
      document.removeEventListener("pointercancel", this.up);
      document.removeEventListener("pointerleave", this.cancelEvent);
      window.removeEventListener("blur", this.cancelEvent);
      this.el.removeEventListener("enter-vr", this.cancelEvent);
      this.el.removeEventListener("exit-vr", this.cancelEvent);
      this.el.object3D.remove(this.label);
      this.texture.dispose();
      this.material.dispose();
    }
  });
})(window.FKCVR);