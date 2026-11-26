"use strict";

(function (F) {
  const T = AFRAME.THREE;
  const pack = (p, q) => [p.x, p.y, p.z, q.x, q.y, q.z, q.w];
  const fields = ["form", "color", "style"];
  function pointing(scene) {
    if (F.Menu?.opened || F.HandMenu?.opened || F.Tutorial?.active || F.Draw?.mode === "paint") return null;
    const hand = document.getElementById(F.HandMenu.laserHand() + "Hand");
    const tools = hand?.components["fkc-controller"];
    if (!tools?.source || !tools.line?.visible || tools.hit?.type !== "model" ||
        !tools.hit.el.modelReady || !scene.contains(tools.hit.el)) return null;
    const {origin, hit: {point}} = tools;
    return [origin.x, origin.y, origin.z, point.x, point.y, point.z];
  }

  AFRAME.registerComponent("fkc-multiplayer", {
    init() {
      this.avatars = new Map();
      this.inkDisplays = new Map();
      this.models = new Map();
      this.grips = new Map();
      this.variantRequests = new Map();
      this.appliedVariants = new WeakMap();
      this.position = new T.Vector3();
      this.quaternion = new T.Quaternion();
      this.rigRotation = new T.Quaternion();
      this.urlInput = document.getElementById("multiplayer-url");
      this.codeInput = document.getElementById("multiplayer-code");
      this.button = document.getElementById("multiplayer-toggle");
      this.status = document.getElementById("multiplayer-status");
      this.availability = document.getElementById("multiplayer-availability");
      this.turn = document.getElementById("multiplayer-preview-turn");
      this.dice = document.getElementById("multiplayer-randomize");
      this.inputs = Object.fromEntries(["name", ...fields].map(key => [key, document.getElementById("multiplayer-" + key)]));
      this.urlInput.value = new URLSearchParams(window.location.search).get("multiplayer") ||
        "https://fkc-vr-multiplayer.onrender.com";
      this.toggle = () => this.endpoint ? this.leave() : this.join();
      this.exit = () => { if (this.endpoint) this.leave(); };
      this.refresh = () => {
        this.dice.disabled = Boolean(this.endpoint || this.accessRequest);
        this.drawPreview();
      };
      this.changed = () => this.drawPreview();
      this.rotatePreview = () => { this.previewBack = !this.previewBack; this.drawPreview(); };
      this.roll = () => this.randomizeAvatar();
      this.codeKey = event => { if (event.key === "Enter" && !event.repeat && !this.endpoint) this.join(); };
      this.serverChanged = () => this.leave();
      this.turn.addEventListener("click", this.rotatePreview);
      this.dice.addEventListener("click", this.roll);
      this.urlInput.addEventListener("input", this.serverChanged);
      this.codeInput.addEventListener("keydown", this.codeKey);
      Object.values(this.inputs).forEach(input => input.addEventListener("input", this.changed));
      this.refresh();
      this.button.addEventListener("click", this.toggle);
      this.el.addEventListener("exit-vr", this.exit);
    },

    serverURL(path) {
      const url = new URL(this.urlInput.value.trim());
      const local = ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.username || url.password || !(url.protocol === "https:" || local && url.protocol === "http:")) throw new Error();
      return new URL(path, url).href;
    },

    async join() {
      if (this.accessRequest || this.endpoint || this.el.is("vr-mode")) return;
      const code = this.codeInput.value.trim();
      if (!code) { this.status.textContent = "Bitte den Zugangscode eingeben."; return; }
      let endpoint;
      try { endpoint = this.serverURL("/presence"); }
      catch { this.status.textContent = "Bitte eine gültige HTTPS-Serveradresse eingeben."; return; }
      const room = F.app?.currentId;
      if (!/^(welcome|vorlesung-[1-8]|team-[ab])$/.test(room || "")) {
        this.status.textContent = "Bitte zuerst einen gemeinsam nutzbaren Raum auswählen.";
        return;
      }
      const request = new AbortController();
      const timer = setTimeout(() => request.abort(), 70000); // Render Free kann beim ersten Zugriff aufwachen.
      this.accessRequest = request;
      this.button.disabled = this.dice.disabled = this.codeInput.disabled = true;
      this.status.textContent = "Zugang wird geprüft … Falls Render schläft, kann das etwa eine Minute dauern.";
      let feedback = "Einzelmodus", adjusted = false;
      try {
        const post = (path, data) => fetch(new URL(path, endpoint).href, {method: "POST", signal: request.signal,
          redirect: "error", headers: {"Content-Type": "application/json"}, body: JSON.stringify(data)});
        const response = await post("/access", {code});
        if (this.accessRequest !== request) return;
        if (response.status === 401 || response.status === 429) {
          feedback = response.status === 401 ? "Zugangscode falsch." :
            "Zu viele Codeversuche. Bitte eine Minute warten.";
          return;
        }
        if (!response.ok) throw new Error();
        const {accessToken} = await response.json();
        if (this.accessRequest !== request) return;
        if (typeof accessToken !== "string" || !accessToken) throw new Error();
        this.accessToken = accessToken;
        this.accessEndpoint = endpoint;
        this.codeInput.value = "";
        this.status.textContent = "Zugang bestätigt. Avatar-Auswahl wird geprüft …";
        const eligible = await post("/availability", {room, accessToken});
        if (!eligible.ok) throw new Error();
        const {available} = await eligible.json();
        if (this.accessRequest !== request) return;
        if (F.app?.currentId !== room || this.el.is("vr-mode")) {
          feedback = "Raum oder VR-Modus gewechselt. Bitte den Beitritt im Browser erneut starten.";
          return;
        }
        if (!fields.every(key => Array.isArray(available?.[key]))) throw new Error();
        if (fields.some(key => available[key].length === 0)) {
          feedback = "Der Raum ist voll. Bitte später erneut beitreten.";
          return;
        }
        for (const key of fields) {
          const input = this.inputs[key];
          if (!available[key].includes(input.value)) { input.value = available[key][0]; adjusted = true; }
        }
        this.profile = this.readProfile();
        Object.values(this.inputs).forEach(input => { input.disabled = true; });
        this.endpoint = endpoint;
        this.button.textContent = "Multiplayer ausschalten";
        this.availability.textContent = adjusted ? "Belegte Avatar-Merkmale wurden durch freie ersetzt." : "Dein Avatar ist für den VR-Beitritt ausgewählt.";
        this.status.textContent = "✓ Zugang bestätigt. Multiplayer aktiviert – jetzt VR starten.";
        this.drawPreview();
      } catch {
        feedback = "Multiplayer nicht erreichbar. Serveradresse und aktuellen Render-Deploy prüfen; dann erneut versuchen.";
      } finally {
        clearTimeout(timer);
        if (this.accessRequest === request) {
          this.accessRequest = null;
          this.button.disabled = false;
          if (!this.endpoint) {
            if (this.accessToken) this.leave();
            this.codeInput.disabled = this.dice.disabled = false;
            this.status.textContent = feedback;
          }
        }
      }
    },

    readProfile() {
      return F.AvatarProfile.normalize(Object.fromEntries(Object.entries(this.inputs).map(([key, input]) => [key, input.value])));
    },

    randomizeAvatar() {
      if (this.dice.disabled || this.endpoint) return;
      const options = fields.map(key => Array.from(this.inputs[key].options).filter(option => !option.disabled).map(option => option.value));
      if (options.some(values => !values.length)) return;
      const current = fields.map(key => this.inputs[key].value);
      const alternatives = [];
      for (const form of options[0]) for (const color of options[1]) for (const style of options[2]) {
        const candidate = [form, color, style];
        if (candidate.some((value, i) => value !== current[i])) alternatives.push(candidate);
      }
      if (!alternatives.length) return;
      const selected = alternatives[Math.floor(Math.random() * alternatives.length)];
      fields.forEach((key, i) => { this.inputs[key].value = selected[i]; });
      this.drawPreview();
    },

    drawPreview() {
      if (this.el.is("vr-mode")) return;
      const profile = this.readProfile();
      const key = JSON.stringify([profile, this.previewBack]);
      if (key === this.previewKey) return;
      try {
        if (!this.preview) {
          const canvas = document.getElementById("multiplayer-preview");
          const renderer = new T.WebGLRenderer({canvas, antialias: true});
          renderer.setSize(208, 176, false);
          const scene = new T.Scene();
          scene.background = new T.Color("#e6eee9");
          scene.add(new T.HemisphereLight("#ffffff", "#73877b", 1.5));
          const light = new T.DirectionalLight("#ffffff", 1.3);
          light.position.set(1, 2, -2);
          scene.add(light);
          const camera = new T.PerspectiveCamera(39, 208 / 176, 0.01, 10);
          this.preview = {renderer, scene, camera};
        }
        const {renderer, scene, camera} = this.preview;
        this.preview.avatar?.dispose();
        this.preview.avatar = F.AvatarModels.build("preview", profile);
        const avatar = this.preview.avatar;
        avatar.left.visible = avatar.right.visible = false;
        scene.add(avatar.group);
        camera.position.set(this.previewBack ? 0.35 : -0.35, 0.04, this.previewBack ? 1.52 : -1.52);
        camera.lookAt(0, -0.19, 0);
        renderer.render(scene, camera);
      } catch {
        this.turn.disabled = true;
        document.getElementById("multiplayer-preview-caption").textContent = "3D-Vorschau auf diesem Gerät nicht verfügbar.";
      }
      this.previewKey = key;
    },

    clearPresence(endSession = false) {
      this.clearModels();
      this.variantRequests.clear();
      this.appliedVariants = new WeakMap();
      this.request?.abort();
      this.request = null;
      if (this.accessEndpoint && this.accessToken && (endSession || this.token)) {
        fetch(this.accessEndpoint, {method: "POST", redirect: "error", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({accessToken: this.accessToken, token: this.token, leave: true, endSession}), keepalive: true}).catch(() => {});
      }
      this.token = null;
      this.room = null;
      this.showPeers([]);
    },

    sharesModel(root) {
      return !!(this.endpoint && this.self && this.el.is("vr-mode") && !F.Tutorial?.active &&
        F.app?.currentId !== F.StructureRoom?.config.id &&
        root.id.startsWith(F.app?.currentId + "-model-"));
    },

    requestVariant(root, variant) {
      if (!this.endpoint || !this.el.is("vr-mode") || F.Tutorial?.active ||
          F.app?.currentId === F.StructureRoom?.config.id ||
          !root.id.startsWith(F.app?.currentId + "-model-")) return false;
      if (this.room && this.room !== F.app.currentId) {
        F.Menu.notify("Bitte warten, bis der gemeinsame Raum verbunden ist.");
        return true;
      }
      const owner = this.models.get(root.id)?.owner;
      if (owner && owner !== this.self) {
        F.Menu.notify("Das Modell wird gerade von jemand anderem gehalten.");
        return true;
      }
      this.variantRequests.set(root.id, {model: root.id, variant});
      this.appliedVariants.delete(root);
      return true;
    },

    clearModels() {
      F.SharedInk?.sync(this.inkDisplays, [], this.room);
      this.remoteAnnotations = [];
      this.displayAnnotations();
      if (this.ownedRoot) F.releaseModel(this.ownedRoot);
      this.ownedRoot = null;
      this.self = null;
      this.models.clear();
      this.grips.clear();
    },

    displayAnnotations() {
      if (!this.remoteAnnotations?.length && !this.annotationsShown) return;
      const entries = this.endpoint && !F.Tutorial?.active && this.room === F.app?.currentId
        ? F.SharedAnnotations.resolve(this.remoteAnnotations || [], this.room, id => document.getElementById(id)) : new Map();
      const labels = this.el.components?.["fkc-atom-labels"];
      const measurements = this.el.components?.["fkc-measurements"];
      const pins = new Map();
      for (const [key, entry] of entries) if (entry.measurementMode === "pin") {
        pins.set(entry.meshes[0], entry.root);
        entries.delete(key);
      }
      if (labels) labels.sharedPins = pins;
      measurements?.updateShared(entries);
      this.annotationsShown = pins.size > 0 || entries.size > 0;
    },

    grab(root, grabber, pulling) {
      if (!this.sharesModel(root)) {
        if (!this.endpoint || !this.el.is("vr-mode") || F.Tutorial?.active ||
            F.app?.currentId === F.StructureRoom?.config.id ||
            !root.id.startsWith(F.app?.currentId + "-model-")) return false;
        F.setStatus("Gemeinsame Modelle noch nicht verbunden. Bitte erneut versuchen.");
        return true;
      }
      const owner = this.models.get(root.id)?.owner;
      if ((owner && owner !== this.self) || (this.ownedRoot && this.ownedRoot !== root) ||
          [...this.grips.values()].some(intent => intent.root !== root)) {
        F.setStatus("Modell wird bereits gehalten. Loslassen und erneut greifen.");
        return true;
      }
      this.grips.set(grabber, {root, pulling});
      this.startGrantedGrips();
      return true;
    },

    startGrantedGrips() {
      for (const [grabber, {root, pulling}] of this.grips) {
        if (!root.isConnected) { this.grips.delete(grabber); continue; }
        const owner = this.models.get(root.id)?.owner;
        if (!owner) continue;
        this.grips.delete(grabber);
        if (owner !== this.self) {
          F.setStatus("Modell wird bereits von jemand anderem gehalten.");
          continue;
        }
        this.ownedRoot = root;
        if (F.Menu?.opened) continue;
        if (pulling) { grabber.pulling = root; grabber.pullTime = 0; F.selectModel(root); }
        else if (root.components["fkc-manipulable"].start(grabber.el)) grabber.grabbed = root;
      }
    },

    modelCommand() {
      const pending = this.grips.values().next().value?.root;
      const root = this.ownedRoot || pending;
      if (!root?.isConnected) return undefined;
      const body = root.querySelector(".manip-body").object3D;
      const moving = this.ownedRoot && (pending || Array.from(this.el.querySelectorAll("[fkc-grabber]"))
        .some(hand => {
          const g = hand.components["fkc-grabber"];
          return g && (g.grabbed === root || g.pulling === root);
        }));
      return {model: root.id, action: this.ownedRoot ? (moving ? "move" : "release") : "grab",
        transform: [...root.object3D.position.toArray(), ...root.object3D.quaternion.toArray(),
          ...body.quaternion.toArray(), Math.min(10, body.scale.x)]};
    },

    receiveModels(result) {
      if (!Array.isArray(result.models) || !result.self) {
        this.clearModels();
        return;
      }
      this.self = result.self;
      this.models = new Map(result.models.map(model => [model.model, model]));
      if (this.ownedRoot && this.models.get(this.ownedRoot.id)?.owner !== this.self) {
        F.releaseModel(this.ownedRoot);
        this.ownedRoot = null;
      }
      for (const model of result.models) {
        const root = document.getElementById(model.model);
        if (!root?.modelReady || !this.sharesModel(root)) continue;
        if (model.variant && root.fkcVariants?.some(option => option.id === model.variant) &&
            !this.variantRequests.has(root.id) && this.appliedVariants.get(root) !== model.variant) {
          this.appliedVariants.set(root, model.variant);
          if (root.fkcVariantId !== model.variant && root.fkcPendingVisual?.dataset.variantId !== model.variant) {
            F.switchVariant(root, model.variant, true);
          } else if (root.fkcVariantId === model.variant && root.fkcPendingVisual &&
              root.fkcPendingVisual.dataset.variantId !== model.variant) {
            root.fkcPendingVisual.remove();
            root.fkcPendingVisual = null;
          }
        }
        if (!model.transform || (model.owner === this.self && root === this.ownedRoot)) continue;
        const body = root.querySelector(".manip-body").object3D;
        root.object3D.position.fromArray(model.transform);
        root.object3D.quaternion.fromArray(model.transform, 3);
        body.quaternion.fromArray(model.transform, 7);
        body.scale.setScalar(model.transform[11]);
        root.object3D.updateWorldMatrix(true, true);
      }
      this.startGrantedGrips();
    },

    leave() {
      this.accessRequest?.abort(); this.accessRequest = null;
      this.clearPresence(true);
      this.accessToken = this.accessEndpoint = null;
      this.codeInput.value = "";
      this.codeInput.disabled = this.button.disabled = false;
      Object.values(this.inputs).forEach(input => { input.disabled = false; });
      this.endpoint = null;
      this.button.textContent = "Gemeinsam beitreten";
      this.status.textContent = "Einzelmodus";
      this.availability.textContent = "Avatar wählen und mit dem Zugangscode beitreten.";
      this.refresh();
    },

    expiredAccess() {
      this.leave();
      this.status.textContent = "Multiplayer-Zugang abgelaufen. Bitte mit dem Code erneut beitreten.";
      this.availability.textContent = this.status.textContent;
    },

    showPeers(peers) {
      const visible = new Set();
      for (const peer of peers) {
        visible.add(peer.id);
        const profile = F.AvatarProfile.normalize(peer.profile);
        const profileKey = JSON.stringify(profile);
        if (this.avatars.get(peer.id)?.profileKey !== profileKey) {
          this.avatars.get(peer.id)?.dispose();
          const avatar = F.AvatarModels.build(peer.id, profile);
          const geometry = new T.BufferGeometry();
          geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(6), 3));
          const material = new T.LineBasicMaterial({color: profile.color || "#31749b"});
          const beam = new T.Line(geometry, material);
          beam.frustumCulled = false;
          beam.visible = false;
          beam.raycast = function () {};
          const dot = new T.Mesh(new T.SphereGeometry(0.013, 12, 8),
            new T.MeshBasicMaterial({color: profile.color || "#31749b"}));
          dot.visible = false;
          dot.raycast = function () {};
          avatar.group.add(beam, dot);
          const dispose = avatar.dispose;
          avatar.dispose = () => { dispose(); geometry.dispose(); material.dispose(); dot.geometry.dispose(); dot.material.dispose(); };
          avatar.beam = beam;
          avatar.dot = dot;
          avatar.profileKey = profileKey;
          this.el.object3D.add(avatar.group);
          this.avatars.set(peer.id, avatar);
        }
        const avatar = this.avatars.get(peer.id);
        for (const key of ["head", "left", "right"]) {
          const value = peer[key];
          const object = avatar[key];
          object.visible = !!value;
          if (!value) continue;
          object.position.set(value[0], value[1], value[2]);
          object.quaternion.set(value[3], value[4], value[5], value[6]);
        }
        avatar.body.position.copy(avatar.head.position);
        this.position.set(0, 0, -1).applyQuaternion(avatar.head.quaternion);
        if (Math.hypot(this.position.x, this.position.z) > 0.01) {
          avatar.body.rotation.y = Math.atan2(-this.position.x, -this.position.z);
        }
        avatar.setHands(peer.hands === true);
        const ray = peer.pointing;
        avatar.beam.visible = avatar.dot.visible = Array.isArray(ray) && ray.length === 6 && ray.every(Number.isFinite);
        if (avatar.beam.visible) {
          const position = avatar.beam.geometry.attributes.position;
          position.array.set(ray);
          position.needsUpdate = true;
          avatar.dot.position.set(ray[3], ray[4], ray[5]);
          // Minimal vor der Oberfläche, damit die Kugel nicht darin versinkt.
          this.position.set(ray[0] - ray[3], ray[1] - ray[4], ray[2] - ray[5]).normalize();
          avatar.dot.position.addScaledVector(this.position, 0.008);
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
          redirect: "error", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({...data, accessToken: this.accessToken, token: this.token, profile: this.profile})});
        if (response.status === 401 && this.request === request) return this.expiredAccess();
        if (response.status === 409 && this.request === request) {
          this.leave();
          this.status.textContent = "Avatarwahl dort nicht frei. VR verlassen und im Multiplayer-Menü neu wählen.";
          return;
        }
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (this.request !== request) return;
        this.token = result.token;
        if (data.variantCommand && this.variantRequests.get(data.variantCommand.model) === data.variantCommand) {
          this.variantRequests.delete(data.variantCommand.model);
          const actual = result.models?.find(model => model.model === data.variantCommand.model)?.variant;
          if (actual !== data.variantCommand.variant) F.Menu.notify("Gemeinsamer Ansichtswechsel nicht übernommen.");
        }
        if (result.profile) this.profile = F.AvatarProfile.normalize(result.profile);
        this.showPeers(result.peers);
        this.remoteAnnotations = result.peers.flatMap(peer => F.SharedAnnotations.normalize(peer.annotations, data.room));
        this.receiveModels(result);
        if (data.room === F.app.currentId && !F.Tutorial?.active) F.SharedInk?.sync(this.inkDisplays,result.peers,data.room);
        this.status.textContent = `✓ Multiplayer erfolgreich betreten · ${result.peers.length} weitere Personen im Raum.`;
      } catch {
        if (this.request !== request) return;
        this.clearModels();
        this.showPeers([]);
        this.status.textContent = "Multiplayer nicht erreichbar. Einzelspiel bleibt möglich.";
      } finally {
        clearTimeout(timeout);
        if (this.request === request) this.request = null;
      }
    },

    tick(time) {
      this.displayAnnotations();
      if (!this.endpoint || !this.el.is("vr-mode")) return;
      const room = F.app?.currentId;
      if (F.Tutorial?.active || !room || room === F.StructureRoom?.config.id || F.app.pendingSpawn) {
        if (this.room) this.clearPresence();
        return;
      }
      if (this.room && this.room !== room) {
        this.clearModels();
        this.variantRequests.clear();
        this.appliedVariants = new WeakMap();
        this.request?.abort();
        this.request = null;
        this.showPeers([]);
        this.room = room;
      }
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
      // Die Szenenkomponenten können vor dem Spawn-/Höhentick laufen.
      // Vor der Übertragung dieselbe Rig-Höhe wie für die VR-Kamera anwenden.
      F.app.updateVREyeHeight();
      rig.updateWorldMatrix(true, false);
      rig.getWorldQuaternion(this.rigRotation);
      const world = pose => pack(this.position.copy(pose.position).applyMatrix4(rig.matrixWorld),
        this.quaternion.copy(pose.orientation).premultiply(this.rigRotation));
      const data = {room, head: world(viewer.transform), left: null, right: null,
        hands: F.AvatarModels.showsHands(), pointing: pointing(this.el), modelCommand: this.modelCommand(),
        annotations: F.SharedAnnotations.collect(this.el, room),
        ink: F.SharedInk.collect(room),
        variantCommand: this.variantRequests.values().next().value};
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
      this.urlInput.removeEventListener("input", this.serverChanged);
      this.codeInput.removeEventListener("keydown", this.codeKey);
      this.turn.removeEventListener("click", this.rotatePreview);
      this.dice.removeEventListener("click", this.roll);
      Object.values(this.inputs).forEach(input => input.removeEventListener("input", this.changed));
      this.preview?.avatar?.dispose();
      this.preview?.renderer.dispose();
      this.button.removeEventListener("click", this.toggle);
      this.el.removeEventListener("exit-vr", this.exit);
    }
  });
})(window.FKCVR);