"use strict";

window.FKCVR = window.FKCVR || {};

(function (F) {
  const V = THREE.Vector3;
  const Q = THREE.Quaternion;
  const M = THREE.Matrix4;

  F.getScene = () => document.getElementById("scene");
  F.getRig = () => document.getElementById("rig");

  F.setStatus = function (message) {
    const el = document.getElementById("status");
    if (el) el.textContent = message;
  };

  F.create = function (tag, attrs, parent) {
    const el = document.createElement(tag || "a-entity");

    Object.entries(attrs || {}).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });

    if (parent) parent.appendChild(el);
    return el;
  };

  F.getSource = function (scene, handedness) {
    const xr = scene.renderer && scene.renderer.xr;
    const session = xr && xr.getSession();

    if (!session) return null;

    return Array.from(session.inputSources).find(source =>
      source.handedness === handedness &&
      source.targetRayMode === "tracked-pointer"
    ) || null;
  };

  F.readStick = function (source) {
    const gp = source && source.gamepad;
    if (!gp || gp.axes.length < 2) return {x: 0, y: 0};

    const index = gp.mapping === "xr-standard" && gp.axes.length >= 4
      ? 2
      : gp.axes.length - 2;

    return {
      x: Number(gp.axes[index]) || 0,
      y: Number(gp.axes[index + 1]) || 0
    };
  };

  F.buttonPressed = function (gp, index) {
    const button = gp && gp.buttons[index];
    return !!button && (button.pressed || button.value > 0.65);
  };

  F.selectModel = function (root) {
    if (!root) return;

    const scene = F.getScene();
    scene.lastSelectedModel = root;
    scene.lastSelectedTarget = root;
  };

  F.releaseModel = function (root) {
    const scene = F.getScene();
    if (!scene) return;

    scene.querySelectorAll("[fkc-grabber]").forEach(hand => {
      const grabber = hand.components["fkc-grabber"];
      if (grabber && grabber.grabbed === root) grabber.end();
    });
  };

  F.releaseHands = function () {
    const scene = F.getScene();
    if (!scene) return;

    scene.querySelectorAll("[fkc-grabber]").forEach(hand => {
      const grabber = hand.components["fkc-grabber"];
      if (grabber) grabber.end();
    });
  };

  F.resetModel = function (root) {
    if (!root || !root.isConnected) return;

    F.releaseModel(root);

    if (root.homePosition) {
      root.object3D.position.copy(root.homePosition);
    }

    root.object3D.quaternion.identity();
    root.object3D.scale.setScalar(1);

    const body = root.querySelector(".manip-body");
    if (body) {
      body.object3D.position.set(0, 0, 0);
      body.object3D.quaternion.identity();
      body.object3D.scale.setScalar(1);
    }

    if (F.Draw) F.Draw.clear(root);

    root.querySelectorAll(".atom-marker").forEach(el => el.remove());
    root.object3D.updateWorldMatrix(true, true);
  };

  F.resetTarget = function (target) {
    if (!target || !target.isConnected) return;

    if (target.classList.contains("interactable")) {
      F.resetModel(target);
      F.setStatus("Modell zurückgesetzt: " + (target.dataset.title || ""));
    } else if (target.classList.contains("paintable")) {
      if (F.Draw) F.Draw.clear(target);
      F.setStatus("Zeichnungen auf dieser Fläche entfernt.");
    }
  };

  F.resetLast = function () {
    const scene = F.getScene();
    if (scene) F.resetTarget(scene.lastSelectedTarget);
  };

  F.clearMarkers = function () {
    if (F.Draw) F.Draw.clear();

    const scene = F.getScene();
    if (scene) {
      scene.querySelectorAll(".atom-marker").forEach(el => el.remove());
    }

    F.setStatus("Zeichnungen im Raum entfernt.");
  };

  /*
   * Diese Funktion wird nur nach einer Bestätigung im Menü aufgerufen.
   * Sie ist nicht an B/Y oder eine andere direkte Reset-Taste gebunden.
   */
  F.resetRoomNow = function () {
    F.releaseHands();
    const room = document.getElementById("room-root");

    if (room) {
      room.querySelectorAll(".interactable").forEach(F.resetModel);
    }

    F.clearMarkers();
    F.setStatus("Modelle und Zeichnungen im Raum zurückgesetzt.");
  };

  F.validFloor = function (x, z) {
    return !!(
      F.app && F.app.activeRoom &&
      F.app.activeRoom.isWalkable(x, z)
    );
  };

  F.getNavigation = function () {
    const rig = F.getRig();
    return rig && rig.components["fkc-navigation"];
  };

  F.resolveTarget = function (hand) {
    if (!hand) return null;

    const ownGrabber = hand.components["fkc-grabber"];
    if (ownGrabber && ownGrabber.grabbed) return ownGrabber.grabbed;

    const held = Array.from(
      F.getScene().querySelectorAll("[fkc-grabber]")
    ).map(el => el.components["fkc-grabber"])
      .find(grabber => grabber && grabber.grabbed);

    if (held) return held.grabbed;

    const tools = hand.components["fkc-controller"];
    if (!tools) return null;

    tools.updateRay();

    const hit = F.findHit(tools.raycaster, true);
    if (!hit || hit.type === "action") return null;

    return hit.el;
  };

  F.beforeRoomChange = function () {
    const scene = F.getScene();
    if (!scene) return;

    F.releaseHands();

    if (F.Menu) F.Menu.close();
    if (F.Draw) F.Draw.clear();

    scene.lastSelectedModel = null;
    scene.lastSelectedTarget = null;

    const navigation = F.getNavigation();
    if (navigation) navigation.cancel();

    scene.querySelectorAll("[fkc-controller]").forEach(hand => {
      const tools = hand.components["fkc-controller"];
      if (tools) tools.clearForRoomChange();
    });

    if (F.invalidateHits) F.invalidateHits();
  };

  /*
   * WebXR targetRaySpace bleibt der bevorzugte Ursprung der Laser.
   */
  AFRAME.registerComponent("fkc-xr-rays", {
    init: function () {
      this.entries = [];
      this.manager = null;
      this.setup = this.setup.bind(this);
      this.el.addEventListener("renderstart", this.setup);
      this.setup();
    },

    setup: function () {
      const renderer = this.el.renderer;
      if (!renderer || !renderer.xr || this.manager === renderer.xr) return;

      this.disposeEntries();
      this.manager = renderer.xr;

      for (let index = 0; index < 4; index++) {
        const group = this.manager.getController(index);
        const entry = {group, source: null};

        entry.connected = event => { entry.source = event.data; };
        entry.disconnected = () => { entry.source = null; };

        group.addEventListener("connected", entry.connected);
        group.addEventListener("disconnected", entry.disconnected);
        this.entries.push(entry);
      }
    },

    getPose: function (source, position, quaternion) {
      if (!source || !this.manager) return false;

      let frame = this.el.frame;

      if (!frame || typeof frame.getPose !== "function") {
        frame = typeof this.manager.getFrame === "function"
          ? this.manager.getFrame()
          : null;
      }

      const referenceSpace = this.manager.getReferenceSpace
        ? this.manager.getReferenceSpace()
        : null;

      if (frame && referenceSpace) {
        try {
          const pose = frame.getPose(source.targetRaySpace, referenceSpace);

          if (pose) {
            const p = pose.transform.position;
            const q = pose.transform.orientation;

            position.set(p.x, p.y, p.z);
            quaternion.set(q.x, q.y, q.z, q.w);
            return true;
          }
        } catch (error) {
          // Fallback auf die aktualisierte Three.js-Controllergruppe.
        }
      }

      const entry = this.entries.find(item => item.source === source);

      if (entry && entry.group.visible) {
        position.copy(entry.group.position);
        quaternion.copy(entry.group.quaternion);
        return true;
      }

      return false;
    },

    tick: function () {
      this.setup();
    },

    disposeEntries: function () {
      this.entries.forEach(entry => {
        entry.group.removeEventListener("connected", entry.connected);
        entry.group.removeEventListener("disconnected", entry.disconnected);
      });
      this.entries = [];
    },

    remove: function () {
      this.el.removeEventListener("renderstart", this.setup);
      this.disposeEntries();
    }
  });

  F.applyModelBounds = function (visualEl) {
    const component = visualEl.components["fkc-normalize"];
    if (!component || !component.result) return false;

    const root = visualEl.closest(".interactable");
    const hitbox = root.querySelector(".hitbox");

    hitbox.setAttribute("geometry", Object.assign(
      {primitive: "box"},
      component.result.hitbox
    ));

    root.modelReady = true;
    root.object3D.updateWorldMatrix(true, true);

    if (F.invalidateHits) F.invalidateHits();
    return true;
  };

  AFRAME.registerComponent("fkc-normalize", {
    schema: {
      targetSize: {default: 0.5},
      padding: {default: 0.06}
    },

    init: function () {
      this.loaded = this.normalize.bind(this);
      this.failed = this.fallback.bind(this);
      this.el.addEventListener("model-loaded", this.loaded);
      this.el.addEventListener("model-error", this.failed);
    },

    normalize: function () {
      if (!this.el.isConnected) return;

      const visual = this.el.object3D;
      const mesh = this.el.getObject3D("mesh");
      const root = this.el.closest(".interactable");

      if (!mesh || !root) return;

      visual.position.set(0, 0, 0);
      visual.scale.setScalar(1);
      visual.updateWorldMatrix(true, true);

      const inverse = new M().copy(visual.matrixWorld).invert();
      const bounds = new THREE.Box3().makeEmpty();
      const matrix = new M();

      mesh.traverse(object => {
        if (!object.isMesh || !object.geometry) return;

        if (!object.geometry.boundingBox) {
          object.geometry.computeBoundingBox();
        }

        if (!object.geometry.boundingBox) return;

        matrix.multiplyMatrices(inverse, object.matrixWorld);
        bounds.union(
          object.geometry.boundingBox.clone().applyMatrix4(matrix)
        );
      });

      if (bounds.isEmpty()) {
        this.fallback();
        return;
      }

      const size = bounds.getSize(new V());
      const center = bounds.getCenter(new V());
      const longest = Math.max(size.x, size.y, size.z);

      if (!Number.isFinite(longest) || longest <= 0) {
        this.fallback();
        return;
      }

      let factor = this.data.targetSize / longest;
      let commonCenter = center;

      /*
       * Bei Varianten ist "shared" der Standard:
       * erster Export legt einen gemeinsamen Koordinatenrahmen fest.
       * Alle Varianten sollten deshalb in denselben Einheiten,
       * mit demselben Ursprung und derselben Orientierung exportiert sein.
       */
      if (root.fkcVariants && root.fkcVariantAlignment !== "individual") {
        if (!root.fkcVariantFrame) {
          root.fkcVariantFrame = {
            factor,
            center: center.clone()
          };
        }

        factor = root.fkcVariantFrame.factor;
        commonCenter = root.fkcVariantFrame.center;
      }

      visual.scale.setScalar(factor);
      visual.position.copy(commonCenter).multiplyScalar(-factor);

      /*
       * Hitboxzentrum kann bei gemeinsamen Koordinatenrahmen
       * von null abweichen. Für den Griff wird es mit gespeichert.
       */
      const boxCenter = center.clone().sub(commonCenter).multiplyScalar(factor);

      this.result = {
        hitbox: {
          width: Math.max(0.08, size.x * factor + this.data.padding),
          height: Math.max(0.08, size.y * factor + this.data.padding),
          depth: Math.max(0.08, size.z * factor + this.data.padding)
        },
        center: boxCenter
      };

      if (this.el.dataset.pendingVariant !== "true") {
        F.applyModelBounds(this.el);

        const hitbox = root.querySelector(".hitbox");
        hitbox.object3D.position.copy(boxCenter);
      }
    },

    fallback: function () {
      if (!this.el.isConnected || this.hasFallback) return;
      this.hasFallback = true;

      const root = this.el.closest(".interactable");
      if (!root) return;

      /*
       * Beim Variantenwechsel bleibt bei einem Fehler die alte Variante.
       * Deshalb wird hier keine Ersatzkugel erzeugt.
       */
      if (this.el.dataset.pendingVariant === "true") return;

      this.el.object3D.visible = false;

      F.create("a-sphere", {
        class: "model-visual",
        radius: this.data.targetSize / 2,
        material: {
          shader: "flat",
          color: "#d6b76b",
          wireframe: true
        }
      }, root.querySelector(".manip-body"));

      root.modelReady = true;
      if (F.invalidateHits) F.invalidateHits();

      F.setStatus("Modell nicht geladen: " + root.dataset.title);
      console.warn("Modellfehler:", root.dataset.title);
    },

    remove: function () {
      this.el.removeEventListener("model-loaded", this.loaded);
      this.el.removeEventListener("model-error", this.failed);
    }
  });

  AFRAME.registerComponent("fkc-manipulable", {
    init: function () {
      this.body = this.el.querySelector(".manip-body").object3D;
      this.hands = [];

      this.handPosition = new V();
      this.handQuaternion = new Q();
      this.relativeQuaternion = new Q();
      this.localGrab = new V();
      this.parentQuaternion = new Q();
      this.desiredQuaternion = new Q();
      this.point = new V();
      this.rootPosition = new V();
      this.desiredPosition = new V();
      this.p1 = new V();
      this.p2 = new V();
      this.midpoint = new V();
      this.offset = new V();
    },

    start: function (hand) {
      if (!this.el.modelReady) return false;
      if (this.hands.includes(hand)) return true;
      if (this.hands.length >= 2) return false;

      this.hands.push(hand);
      F.selectModel(this.el);

      if (this.hands.length === 1) this.setupSingle();
      else this.setupDouble();

      return true;
    },

    end: function (hand) {
      const index = this.hands.indexOf(hand);
      if (index < 0) return;

      this.hands.splice(index, 1);
      if (this.hands.length === 1) this.setupSingle();
    },

    setupSingle: function () {
      const hand = this.hands[0].object3D;

      hand.updateWorldMatrix(true, false);
      this.body.updateWorldMatrix(true, true);

      hand.getWorldPosition(this.handPosition);
      hand.getWorldQuaternion(this.handQuaternion);
      this.body.getWorldQuaternion(this.desiredQuaternion);

      this.relativeQuaternion.copy(this.handQuaternion)
        .invert().multiply(this.desiredQuaternion);

      this.localGrab.copy(this.handPosition);
      this.body.worldToLocal(this.localGrab);
    },

    setupDouble: function () {
      this.hands[0].object3D.getWorldPosition(this.p1);
      this.hands[1].object3D.getWorldPosition(this.p2);

      this.midpoint.copy(this.p1).add(this.p2).multiplyScalar(0.5);
      this.startDistance = Math.max(0.02, this.p1.distanceTo(this.p2));
      this.startScale = this.body.scale.x;

      this.el.object3D.getWorldPosition(this.rootPosition);
      this.offset.copy(this.rootPosition).sub(this.midpoint);
    },

    setPosition: function (worldPosition) {
      const root = this.el.object3D;
      root.position.copy(worldPosition);

      if (root.parent) {
        root.parent.updateWorldMatrix(true, false);
        root.parent.worldToLocal(root.position);
      }

      root.updateWorldMatrix(true, true);
    },

    tick: function () {
      if (this.hands.length === 1) {
        const hand = this.hands[0].object3D;

        hand.getWorldPosition(this.handPosition);
        hand.getWorldQuaternion(this.handQuaternion);

        this.desiredQuaternion.copy(this.handQuaternion)
          .multiply(this.relativeQuaternion);

        this.body.parent.getWorldQuaternion(this.parentQuaternion);

        this.body.quaternion.copy(this.parentQuaternion)
          .invert().multiply(this.desiredQuaternion);

        this.body.updateWorldMatrix(true, true);

        this.point.copy(this.localGrab);
        this.body.localToWorld(this.point);

        this.el.object3D.getWorldPosition(this.rootPosition);

        this.desiredPosition.copy(this.rootPosition)
          .add(this.handPosition).sub(this.point);

        this.setPosition(this.desiredPosition);
      }

      if (this.hands.length === 2) {
        this.hands[0].object3D.getWorldPosition(this.p1);
        this.hands[1].object3D.getWorldPosition(this.p2);

        this.midpoint.copy(this.p1).add(this.p2).multiplyScalar(0.5);

        const scale = Math.max(
          0.02,
          this.startScale * this.p1.distanceTo(this.p2) / this.startDistance
        );

        this.body.scale.setScalar(scale);

        this.desiredPosition.copy(this.offset)
          .multiplyScalar(scale / this.startScale).add(this.midpoint);

        this.setPosition(this.desiredPosition);
      }
    }
  });

  AFRAME.registerComponent("fkc-grabber", {
    init: function () {
      this.grabbed = null;
      this.position = new V();
      this.closest = new V();
      this.bounds = new THREE.Box3();

      this.start = this.start.bind(this);
      this.end = this.end.bind(this);

      this.el.addEventListener("gripdown", this.start);
      this.el.addEventListener("gripup", this.end);
      this.el.addEventListener("controllerdisconnected", this.end);
    },

    start: function () {
      if (this.grabbed || (F.Menu && F.Menu.opened)) return;

      this.el.object3D.getWorldPosition(this.position);

      let best = null;
      let bestDistance = Infinity;

      this.el.sceneEl.querySelectorAll(".interactable").forEach(root => {
        const manip = root.components["fkc-manipulable"];
        if (!root.modelReady || !manip || manip.hands.length >= 2) return;

        const hitbox = root.querySelector(".hitbox");
        hitbox.object3D.updateWorldMatrix(true, true);
        this.bounds.setFromObject(hitbox.object3D);

        if (this.bounds.isEmpty()) return;

        this.bounds.clampPoint(this.position, this.closest);
        const distance = this.position.distanceTo(this.closest);

        if (distance < 0.12 && distance < bestDistance) {
          best = root;
          bestDistance = distance;
        }
      });

      if (best && best.components["fkc-manipulable"].start(this.el)) {
        this.grabbed = best;
      }
    },

    end: function () {
      if (!this.grabbed) return;

      const manip = this.grabbed.components["fkc-manipulable"];
      if (manip) manip.end(this.el);

      this.grabbed = null;
    },

    remove: function () {
      this.end();
      this.el.removeEventListener("gripdown", this.start);
      this.el.removeEventListener("gripup", this.end);
      this.el.removeEventListener("controllerdisconnected", this.end);
    }
  });

  AFRAME.registerComponent("fkc-controller", {
    schema: {
      hand: {default: "right"}
    },

    init: function () {
      this.source = null;
      this.hit = null;
      this.stroke = null;
      this.drawingAllowed = false;

      this.origin = new V();
      this.direction = new V();
      this.referencePosition = new V();
      this.referenceQuaternion = new Q();
      this.worldQuaternion = new Q();
      this.endpoint = new V();

      this.raycaster = new THREE.Raycaster();
      this.raycaster.far = 25;

      this.states = {
        trigger: false,
        grip: false,
        reset: false,
        menu: false
      };

      this.lineEntity = F.create("a-entity", {}, this.el.sceneEl);
      this.positions = new Float32Array(6);
      this.geometry = new THREE.BufferGeometry();
      this.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(this.positions, 3)
      );

      this.material = new THREE.LineBasicMaterial({
        color: this.data.hand === "left" ? "#32d8df" : "#ff9d38",
        transparent: true,
        opacity: 0.95
      });

      this.line = new THREE.Line(this.geometry, this.material);
      this.line.frustumCulled = false;
      this.line.visible = false;
      this.lineEntity.setObject3D("laser", this.line);

      this.pointer = F.create("a-sphere", {
        radius: 0.009,
        visible: false,
        material: {
          shader: "flat",
          color: "#ffffff"
        }
      }, this.el.sceneEl);

      this.triggerDown = () => {
        if (this.states.trigger) return;
        this.states.trigger = true;
        this.activate();
      };

      this.triggerUp = () => {
        this.states.trigger = false;
        this.drawingAllowed = false;
        this.stroke = null;
      };

      this.resetAction = () => {
        if (F.Menu && F.Menu.opened) return;

        const target = F.resolveTarget(this.el);
        if (target) {
          this.el.sceneEl.lastSelectedTarget = target;
          F.resetTarget(target);
        }
      };

      this.menuAction = () => {
        if (F.Menu) F.Menu.toggle(this.el);
      };

      this.resetEvent = () => {
        const source = F.getSource(this.el.sceneEl, this.data.hand);
        if (source && source.gamepad &&
            source.gamepad.mapping === "xr-standard") return;
        this.resetAction();
      };

      this.menuEvent = () => {
        const source = F.getSource(this.el.sceneEl, this.data.hand);
        if (source && source.gamepad &&
            source.gamepad.mapping === "xr-standard") return;
        this.menuAction();
      };

      this.disconnect = this.disconnect.bind(this);

      this.el.addEventListener("triggerdown", this.triggerDown);
      this.el.addEventListener("triggerup", this.triggerUp);
      this.el.addEventListener("abuttondown", this.resetEvent);
      this.el.addEventListener("xbuttondown", this.resetEvent);
      this.el.addEventListener("bbuttondown", this.menuEvent);
      this.el.addEventListener("ybuttondown", this.menuEvent);
      this.el.addEventListener("controllerdisconnected", this.disconnect);
    },

    updateRay: function () {
      const scene = this.el.sceneEl;
      const rig = F.getRig();
      const provider = scene.components["fkc-xr-rays"];

      this.source = F.getSource(scene, this.data.hand);

      const hasPose = provider && this.source &&
        provider.getPose(
          this.source,
          this.referencePosition,
          this.referenceQuaternion
        );

      if (hasPose) {
        rig.object3D.updateWorldMatrix(true, false);

        this.origin.copy(this.referencePosition)
          .applyMatrix4(rig.object3D.matrixWorld);

        this.direction.set(0, 0, -1)
          .applyQuaternion(this.referenceQuaternion)
          .transformDirection(rig.object3D.matrixWorld);
      } else {
        this.el.object3D.getWorldPosition(this.origin);
        this.el.object3D.getWorldQuaternion(this.worldQuaternion);

        this.direction.set(0, 0, -1)
          .applyQuaternion(this.worldQuaternion).normalize();
      }

      this.raycaster.set(this.origin, this.direction);
    },

    updateHit: function () {
      this.hit = F.findHit(this.raycaster, true);
      this.pointer.object3D.visible = !!this.hit;

      if (this.hit) {
        this.endpoint.copy(this.hit.point);
        this.pointer.object3D.position.copy(this.hit.point);

        this.pointer.setAttribute(
          "material", "color",
          this.hit.type === "action" ? "#70efac" : "#ffffff"
        );
      } else {
        this.endpoint.copy(this.direction)
          .multiplyScalar(25).add(this.origin);
      }
    },

    activate: function () {
      if (!this.el.sceneEl.is("vr-mode")) return;

      this.drawingAllowed = false;
      this.stroke = null;

      this.updateRay();
      this.updateHit();

      if (!this.hit) return;

      if (this.hit.type === "action") {
        if (this.hit.el.dataset.fkcMenu === "true") {
          F.Menu.click(this.hit);
        } else if (!(F.Menu && F.Menu.opened)) {
          const roomId = this.hit.el.dataset.roomId;
          if (roomId && F.app) F.app.changeRoom(roomId);
        }
        return;
      }

      if (F.Menu && F.Menu.opened) return;

      const grabber = this.el.components["fkc-grabber"];
      if (grabber && grabber.grabbed) return;

      this.drawingAllowed = true;
      this.el.sceneEl.lastSelectedTarget = this.hit.el;

      if (this.hit.type === "model") F.selectModel(this.hit.el);
      this.sampleDrawing();
    },

    sampleDrawing: function () {
      if (!this.drawingAllowed || !F.Draw) return;

      if (!this.hit || this.hit.type === "action") {
        this.stroke = null;
        return;
      }

      this.stroke = F.Draw.sample(this.stroke, this.hit);
    },

    pollButtons: function () {
      const gp = this.source && this.source.gamepad;
      if (!gp) return;

      const trigger = F.buttonPressed(gp, 0);
      const grip = F.buttonPressed(gp, 1);
      const grabber = this.el.components["fkc-grabber"];

      if (trigger && !this.states.trigger) this.triggerDown();
      if (!trigger && this.states.trigger) this.triggerUp();

      if (grip && !this.states.grip && grabber) grabber.start();
      if (!grip && this.states.grip && grabber) grabber.end();
      this.states.grip = grip;

      if (gp.mapping === "xr-standard") {
        const reset = F.buttonPressed(gp, 4);
        const menu = F.buttonPressed(gp, 5);

        if (reset && !this.states.reset) this.resetAction();
        if (menu && !this.states.menu) this.menuAction();

        this.states.reset = reset;
        this.states.menu = menu;
      }
    },

    hide: function () {
      this.line.visible = false;
      this.pointer.object3D.visible = false;
    },

    clearForRoomChange: function () {
      this.hit = null;
      this.stroke = null;
      this.drawingAllowed = false;
      this.hide();
      // Triggerzustand bleibt erhalten: kein Durchklicken in neue Räume.
    },

    disconnect: function () {
      this.clearForRoomChange();
      this.source = null;

      Object.keys(this.states).forEach(key => {
        this.states[key] = false;
      });

      const grabber = this.el.components["fkc-grabber"];
      if (grabber) grabber.end();
    },

    tick: function () {
      const scene = this.el.sceneEl;

      if (!scene.is("vr-mode")) {
        this.hide();
        return;
      }

      this.updateRay();

      if (!this.source) {
        this.disconnect();
        return;
      }

      this.pollButtons();

      // Eine Aktion kann den Raum oder das Menü verändert haben.
      this.updateRay();
      this.updateHit();

      const grabber = this.el.components["fkc-grabber"];

      if (grabber && grabber.grabbed) {
        this.stroke = null;
        this.drawingAllowed = false;
        this.hide();
        return;
      }

      if (this.states.trigger && !(F.Menu && F.Menu.opened)) {
        this.sampleDrawing();
      }

      const color = F.Settings
        ? F.Settings.lasers[this.data.hand]
        : (this.data.hand === "left" ? "#32d8df" : "#ff9d38");

      this.material.color.set(color);
      this.line.visible = true;

      this.positions.set([
        this.origin.x, this.origin.y, this.origin.z,
        this.endpoint.x, this.endpoint.y, this.endpoint.z
      ]);

      this.geometry.attributes.position.needsUpdate = true;
    },

    remove: function () {
      this.el.removeEventListener("triggerdown", this.triggerDown);
      this.el.removeEventListener("triggerup", this.triggerUp);
      this.el.removeEventListener("abuttondown", this.resetEvent);
      this.el.removeEventListener("xbuttondown", this.resetEvent);
      this.el.removeEventListener("bbuttondown", this.menuEvent);
      this.el.removeEventListener("ybuttondown", this.menuEvent);
      this.el.removeEventListener("controllerdisconnected", this.disconnect);

      this.geometry.dispose();
      this.material.dispose();
      this.lineEntity.remove();
      this.pointer.remove();
    }
  });

  AFRAME.registerComponent("fkc-navigation", {
    schema: {
      speed: {default: 3},
      desktopSpeed: {default: 4},
      turnSpeed: {default: 60},
      deadzone: {default: 0.18}
    },

    init: function () {
      this.keys = new Set();
      this.forward = new V();
      this.right = new V();
      this.movement = new V();
      this.cameraPosition = new V();
      this.pivot = new V();
      this.axis = new V(0, 1, 0);

      this.keyDown = event => {
        const target = event.target;

        if (target && (
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) ||
          target.isContentEditable
        )) return;

        if ([
          "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE",
          "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"
        ].includes(event.code)) {
          this.keys.add(event.code);
          event.preventDefault();
        }
      };

      this.keyUp = event => this.keys.delete(event.code);
      this.cancel = this.cancel.bind(this);

      window.addEventListener("keydown", this.keyDown);
      window.addEventListener("keyup", this.keyUp);
      window.addEventListener("blur", this.cancel);

      this.el.sceneEl.addEventListener("enter-vr", this.cancel);
      this.el.sceneEl.addEventListener("exit-vr", this.cancel);
    },

    cancel: function () {
      this.keys.clear();
    },

    applyDeadzone: function (value) {
      const absolute = Math.abs(value);
      if (absolute <= this.data.deadzone) return 0;

      return Math.sign(value) *
        (absolute - this.data.deadzone) / (1 - this.data.deadzone);
    },

    rotateAroundHead: function (angle) {
      const camera = this.el.sceneEl.camera;
      if (!camera) return;

      this.el.object3D.updateWorldMatrix(true, true);
      camera.getWorldPosition(this.pivot);

      this.el.object3D.position.sub(this.pivot)
        .applyAxisAngle(this.axis, angle).add(this.pivot);

      this.el.object3D.rotation.y += angle;
      this.el.object3D.updateWorldMatrix(true, true);
    },

    move: function (x, y, speed, delta) {
      const scene = this.el.sceneEl;
      if (!scene.camera || (x === 0 && y === 0)) return;

      scene.camera.getWorldDirection(this.forward);
      this.forward.y = 0;

      if (this.forward.lengthSq() < 0.0001) {
        this.forward.set(0, 0, -1);
      } else {
        this.forward.normalize();
      }

      this.right.set(-this.forward.z, 0, this.forward.x);

      this.movement.copy(this.forward)
        .multiplyScalar(-y).addScaledVector(this.right, x);

      if (this.movement.lengthSq() > 1) this.movement.normalize();

      const seconds = Math.min((delta || 0) / 1000, 0.05);
      this.movement.multiplyScalar(speed * seconds);

      scene.camera.getWorldPosition(this.cameraPosition);

      if (F.validFloor(
        this.cameraPosition.x + this.movement.x,
        this.cameraPosition.z
      )) {
        this.el.object3D.position.x += this.movement.x;
        this.cameraPosition.x += this.movement.x;
      }

      if (F.validFloor(
        this.cameraPosition.x,
        this.cameraPosition.z + this.movement.z
      )) {
        this.el.object3D.position.z += this.movement.z;
      }

      this.el.object3D.updateWorldMatrix(true, true);
    },

    tick: function (time, delta) {
      if (F.Menu && F.Menu.opened) return;

      const scene = this.el.sceneEl;
      const seconds = Math.min((delta || 0) / 1000, 0.05);

      if (!scene.is("vr-mode")) {
        let x = 0;
        let y = 0;

        if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x--;
        if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x++;
        if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y--;
        if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y++;

        const turn = (this.keys.has("KeyQ") ? 1 : 0) -
          (this.keys.has("KeyE") ? 1 : 0);

        if (turn) this.rotateAroundHead(turn * 1.5 * seconds);

        this.move(x, y, this.data.desktopSpeed, delta);
        return;
      }

      const left = F.readStick(F.getSource(scene, "left"));
      const right = F.readStick(F.getSource(scene, "right"));

      const turn = this.applyDeadzone(right.x);

      if (turn) {
        this.rotateAroundHead(
          -turn * THREE.MathUtils.degToRad(this.data.turnSpeed) * seconds
        );
      }

      this.move(
        this.applyDeadzone(left.x),
        this.applyDeadzone(left.y),
        this.data.speed,
        delta
      );
    },

    remove: function () {
      window.removeEventListener("keydown", this.keyDown);
      window.removeEventListener("keyup", this.keyUp);
      window.removeEventListener("blur", this.cancel);
      this.el.sceneEl.removeEventListener("enter-vr", this.cancel);
      this.el.sceneEl.removeEventListener("exit-vr", this.cancel);
    }
  });

  AFRAME.registerComponent("fkc-session", {
    init: function () {
      this.enter = () => {
        const panel = document.getElementById("panel");
        if (panel) panel.classList.add("in-vr");
        if (F.Menu) F.Menu.close();
      };

      this.exit = () => {
        F.releaseHands();
        if (F.Menu) F.Menu.close();

        this.el.querySelectorAll("[fkc-controller]").forEach(hand => {
          const tools = hand.components["fkc-controller"];
          if (tools) tools.disconnect();
        });

        const panel = document.getElementById("panel");
        if (panel) panel.classList.remove("in-vr");
      };

      this.el.addEventListener("enter-vr", this.enter);
      this.el.addEventListener("exit-vr", this.exit);
    },

    remove: function () {
      this.el.removeEventListener("enter-vr", this.enter);
      this.el.removeEventListener("exit-vr", this.exit);
    }
  });

  window.xrDiagnose = function () {
    const scene = F.getScene();
    const xr = scene && scene.renderer && scene.renderer.xr;
    const session = xr && xr.getSession();

    console.log("A-Frame:", AFRAME.version);
    console.log("Three.js:", THREE.REVISION);
    console.log("Sicherer Kontext:", window.isSecureContext);
    console.log("Raum:", F.app && F.app.currentId);
    console.log("XR-Sitzung:", session);
    console.log("Menü offen:", F.Menu && F.Menu.opened);
    console.log("Zeichenstriche:", F.Draw && F.Draw.strokes.length);

    if (!session) return;

    console.table(Array.from(session.inputSources).map(source => ({
      hand: source.handedness,
      profiles: Array.from(source.profiles).join(", "),
      mapping: source.gamepad ? source.gamepad.mapping : "",
      axes: source.gamepad
        ? Array.from(source.gamepad.axes).map(v => v.toFixed(3)).join(", ")
        : "",
      buttons: source.gamepad
        ? Array.from(source.gamepad.buttons)
          .map((b, i) => i + ":" + b.value.toFixed(2)).join(" ")
        : ""
    })));
  };
})(window.FKCVR);
