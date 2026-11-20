"use strict";

(function (F) {
  const T = AFRAME.THREE;
  const pack = (p, q) => [p.x, p.y, p.z, q.x, q.y, q.z, q.w];

  AFRAME.registerComponent("fkc-multiplayer", {
    init() {
      this.avatars = new Map();
      this.position = new T.Vector3();
      this.quaternion = new T.Quaternion();
      this.rigRotation = new T.Quaternion();
      this.urlInput = document.getElementById("multiplayer-url");
      this.button = document.getElementById("multiplayer-toggle");
      this.status = document.getElementById("multiplayer-status");
      this.urlInput.value = new URLSearchParams(window.location.search).get("multiplayer") || "";
      this.toggle = () => {
        if (this.endpoint) return this.leave();
        try {
          const url = new URL(this.urlInput.value.trim());
          const local = ["localhost", "127.0.0.1"].includes(url.hostname);
          if (url.username || url.password || !(url.protocol === "https:" || local && url.protocol === "http:")) throw new Error();
          this.endpoint = new URL("/presence", url).href;
          this.button.textContent = "Multiplayer ausschalten";
          this.status.textContent = "Aktiviert. Positionsdaten werden erst im VR-Modus übertragen.";
        } catch { this.status.textContent = "Bitte eine gültige HTTPS-Serveradresse eingeben."; }
      };
      this.exit = () => this.leave();
      this.button.addEventListener("click", this.toggle);
      this.el.addEventListener("exit-vr", this.exit);
    },

    clearPresence() {
      this.request?.abort();
      this.request = null;
      if (this.endpoint && this.token) {
        fetch(this.endpoint, {method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({token: this.token, leave: true}), keepalive: true}).catch(() => {});
      }
      this.token = null;
      this.room = null;
      this.showPeers([]);
    },

    leave() {
      this.clearPresence();
      this.endpoint = null;
      this.button.textContent = "Gemeinsam beitreten";
      this.status.textContent = "Einzelmodus";
    },

    avatar() {
      const group = new T.Group();
      const geometry = new T.SphereGeometry(0.115, 16, 12);
      const material = new T.MeshStandardMaterial({color: "#2c83a8"});
      const head = new T.Mesh(geometry, material);
      const visor = new T.Mesh(geometry, material);
      visor.scale.set(0.75, 0.40, 0.35);
      visor.position.z = -0.105;
      head.add(visor);
      const left = F.PicoModels.build("left"), right = F.PicoModels.build("right");
      group.add(head, left.group, right.group);
      this.el.object3D.add(group);
      return {head, left: left.group, right: right.group, dispose() {
        group.removeFromParent();
        geometry.dispose(); material.dispose(); left.dispose(); right.dispose();
      }};
    },

    showPeers(peers) {
      const visible = new Set();
      for (const peer of peers) {
        visible.add(peer.id);
        if (!this.avatars.has(peer.id)) this.avatars.set(peer.id, this.avatar());
        const avatar = this.avatars.get(peer.id);
        for (const key of ["head", "left", "right"]) {
          const value = peer[key];
          const object = avatar[key];
          object.visible = !!value;
          if (!value) continue;
          object.position.set(value[0], value[1], value[2]);
          object.quaternion.set(value[3], value[4], value[5], value[6]);
        }
      }
      for (const [id, avatar] of this.avatars) if (!visible.has(id)) {
        avatar.dispose(); this.avatars.delete(id);
      }
    },

    async update(data, request) {
      const timeout = setTimeout(() => request.abort(), 3500);
      try {
        const response = await fetch(this.endpoint, {method: "POST", signal: request.signal,
          headers: {"Content-Type": "application/json"}, body: JSON.stringify({...data, token: this.token})});
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (this.request !== request) return;
        this.token = result.token;
        this.showPeers(result.peers);
        this.status.textContent = `Multiplayer verbunden · ${result.peers.length} weitere Personen im Raum.`;
      } catch {
        if (this.request !== request) return;
        this.showPeers([]);
        this.status.textContent = "Multiplayer nicht erreichbar. Einzelspiel bleibt möglich.";
      } finally {
        clearTimeout(timeout);
        if (this.request === request) this.request = null;
      }
    },

    tick(time) {
      if (!this.endpoint || !this.el.is("vr-mode")) return;
      const room = F.app?.currentId;
      if (F.Tutorial?.active || !room || F.app.pendingSpawn) {
        if (this.room) this.clearPresence();
        return;
      }
      if (this.room && this.room !== room) this.clearPresence();
      const xr = this.el.renderer?.xr;
      const frame = this.el.frame || xr?.getFrame?.();
      const reference = xr?.getReferenceSpace?.();
      const rig = F.getRig()?.object3D;
      if (!reference || !rig || !frame?.getViewerPose) {
        if (this.room) this.clearPresence();
        return;
      }
      if (this.request || time < (this.next || 0)) return;
      const viewer = frame.getViewerPose(reference);
      if (!viewer) { if (this.room) this.clearPresence(); return; }
      rig.updateWorldMatrix(true, false);
      rig.getWorldQuaternion(this.rigRotation);
      const world = pose => pack(this.position.copy(pose.position).applyMatrix4(rig.matrixWorld),
        this.quaternion.copy(pose.orientation).premultiply(this.rigRotation));
      const data = {room, head: world(viewer.transform), left: null, right: null};
      for (const hand of ["left", "right"]) {
        const space = F.getSource(this.el, hand)?.gripSpace;
        const pose = space && frame.getPose(space, reference);
        if (pose) data[hand] = world(pose.transform);
      }
      this.room = room;
      this.next = time + 125;
      this.request = new AbortController();
      this.update(data, this.request);
    },

    remove() {
      this.leave();
      this.button.removeEventListener("click", this.toggle);
      this.el.removeEventListener("exit-vr", this.exit);
    }
  });
})(window.FKCVR);