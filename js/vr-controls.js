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

    for (const source of session.inputSources) {
      if (
        source.handedness === handedness &&
        source.targetRayMode === "tracked-pointer"
      ) {
        return source;
      }
    }

    return null;
  };

  F.readStick = function (source) {
    const gp = source && source.gamepad;

    if (!gp || gp.axes.length < 2) {
      return {x: 0, y: 0};
    }

    const index =
      gp.mapping === "xr-standard" && gp.axes.length >= 4
        ? 2
        : gp.axes.length - 2;

    return {
      x: Number(gp.axes[index]) || 0,
      y: Number(gp.axes[index + 1]) || 0
    };
  };

  F.buttonPressed = function (gamepad, index) {
    const button = gamepad && gamepad.buttons[index];

    return !!button &&
      (button.pressed || button.value > 0.65);
  };

  F.selectModel = function (root) {
    if (root) root.sceneEl.lastSelectedModel = root;
  };

  F.releaseHands = function () {
    const scene = F.getScene();
    if (!scene) return;

    scene.querySelectorAll("[fkc-grabber]").forEach(hand => {
      const grabber = hand.components["fkc-grabber"];
      if (grabber) grabber.end();
    });
  };

  F.anyGrabbing = function () {
    const scene = F.getScene();
    if (!scene) return false;

    return Array.from(
      scene.querySelectorAll("[fkc-grabber]")
    ).some(hand => {
      const grabber = hand.components["fkc-grabber"];
      return grabber && !!grabber.grabbed;
    });
  };

  F.resetModel = function (root) {
    if (!root || !root.isConnected) return;

    const manip = root.components["fkc-manipulable"];

    if (manip && manip.hands.length) {
      F.releaseHands();
    }

    if (root.homePosition) {
      root.object3D.position.copy(root.homePosition);
    }

    const body = root.querySelector(".manip-body");

    if (body) {
      body.object3D.position.set(0, 0, 0);
      body.object3D.quaternion.identity();
      body.object3D.scale.setScalar(1);
    }

    root.querySelectorAll(".atom-marker").forEach(el => el.remove());
    root.object3D.updateWorldMatrix(true, true);
  };

  F.resetLast = function () {
    const scene = F.getScene();
    if (scene) F.resetModel(scene.lastSelectedModel);
  };

  F.resetAll = function () {
    const scene = F.getScene();
    if (!scene) return;

    F.releaseHands();

    scene.querySelectorAll(".interactable").forEach(F.resetModel);
  };

  F.clearMarkers = function () {
    const scene = F.getScene();

    if (scene) {
      scene.querySelectorAll(".atom-marker").forEach(el => el.remove());
    }
  };

  /*
   * Der Raum liefert diese Prüfung.
   * Die Steuerung kennt weder Wandfarben noch Podestkonstruktionen.
   */
  F.validFloor = function (x, z) {
    return !!(
      F.app &&
      F.app.activeRoom &&
      F.app.activeRoom.isWalkable(x, z)
    );
  };

  F.getNavigation = function () {
    const rig = F.getRig();
    return rig && rig.components["fkc-navigation"];
  };

  /*
   * Gemeinsame Trefferprüfung für:
   * - Raumtafeln / Rückkehrtafeln
   * - Modelloberflächen
   */
  F.findHit = function (raycaster, includeModels) {
    const scene = F.getScene();
    if (!scene) return null;

    const targets = [];

    scene.querySelectorAll(".vr-action").forEach(el => {
      if (!el.object3D.visible) return;

      el.object3D.updateWorldMatrix(true, true);

      el.object3D.traverse(object => {
        if (object.isMesh && object.visible) {
          targets.push({mesh: object, type: "action", el});
        }
      });
    });

    if (includeModels) {
      scene.querySelectorAll(".model-visual").forEach(el => {
        const root = el.closest(".interactable");

        if (!root || !root.modelReady || !el.object3D.visible) return;

        el.object3D.updateWorldMatrix(true, true);

        el.object3D.traverse(object => {
          if (object.isMesh && object.visible) {
            targets.push({mesh: object, type: "model", el: root});
          }
        });
      });
    }

    const lookup = new Map(
      targets.map(target => [target.mesh, target])
    );

    const hits = raycaster.intersectObjects(
      targets.map(target => target.mesh),
      false
    );

    if (!hits.length) return null;

    const hit = hits[0];
    const target = lookup.get(hit.object);

    return {
      type: target.type,
      el: target.el,
      point: hit.point.clone()
    };
  };

  F.beforeRoomChange = function () {
    const scene = F.getScene();
    if (!scene) return;

    F.releaseHands();
    scene.lastSelectedModel = null;

    const navigation = F.getNavigation();
    if (navigation) navigation.cancel();

    scene.querySelectorAll("[fkc-controller]").forEach(hand => {
      const tools = hand.components["fkc-controller"];
      if (tools) tools.clearForRoomChange();
    });
  };

  /*
   * ============================================================
   * WEBXR-ZIELSTRAHLPOSE
   * ============================================================
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

      if (!renderer || !renderer.xr) return;
      if (this.manager === renderer.xr) return;

      this.disposeEntries();
      this.manager = renderer.xr;

      for (let index = 0; index < 4; index++) {
        const group = this.manager.getController(index);
        const entry = {group, source: null};

        entry.connected = event => {
          entry.source = event.data;
        };

        entry.disconnected = () => {
          entry.source = null;
        };

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

      const referenceSpace =
        typeof this.manager.getReferenceSpace === "function"
          ? this.manager.getReferenceSpace()
          : null;

      if (frame && referenceSpace) {
        try {
          const pose = frame.getPose(
            source.targetRaySpace,
            referenceSpace
          );

          if (pose) {
            const p = pose.transform.position;
            const q = pose.transform.orientation;

            position.set(p.x, p.y, p.z);
            quaternion.set(q.x, q.y, q.z, q.w);

            return true;
          }
        } catch (error) {
          // Fallback auf die aktualisierte Three.js-Gruppe.
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

  /*
   * ============================================================
   * AUTOMATISCHE MODELLGRÖSSE UND HITBOX
   * ============================================================
   */

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
      if (!mesh) return;

      const body = this.el.parentElement;
      const root = body.parentElement;

      visual.position.set(0, 0, 0);
      visual.scale.setScalar(1);
      visual.updateWorldMatrix(true, true);

      const inverse = new M().copy(visual.matrixWorld).invert();
      const bounds = new THREE.Box3().makeEmpty();
      const matrix = new M();

      mesh.traverse(object => {
        if (!object.isMesh || !object.geometry) return;

        const geometry = object.geometry;

        if (!geometry.boundingBox) geometry.computeBoundingBox();
        if (!geometry.boundingBox) return;

        matrix.multiplyMatrices(inverse, object.matrixWorld);

        bounds.union(
          geometry.boundingBox.clone().applyMatrix4(matrix)
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

      const factor = this.data.targetSize / longest;

      visual.scale.setScalar(factor);
      visual.position.copy(center).multiplyScalar(-factor);

      const hitbox = body.querySelector(".hitbox");

      hitbox.setAttribute("geometry", {
        primitive: "box",
        width: Math.max(0.08, size.x * factor + this.data.padding),
        height: Math.max(0.08, size.y * factor + this.data.padding),
        depth: Math.max(0.08, size.z * factor + this.data.padding)
      });

      root.modelReady = true;
      root.object3D.updateWorldMatrix(true, true);
    },

    fallback: function () {
      if (!this.el.isConnected || this.hasFallback) return;
      this.hasFallback = true;

      const body = this.el.parentElement;
      const root = body.parentElement;

      this.el.object3D.visible = false;

      F.create("a-sphere", {
        class: "model-visual",
        radius: this.data.targetSize / 2,
        material: {
          shader: "flat",
          color: "#d6b76b",
          wireframe: true
        }
      }, body);

      root.modelReady = true;

      F.setStatus(
        "Modell nicht geladen: " + root.dataset.title +
        ". Dateipfad prüfen."
      );

      console.warn("Modellfehler:", root.dataset.title);
    },

    remove: function () {
      this.el.removeEventListener("model-loaded", this.loaded);
      this.el.removeEventListener("model-error", this.failed);
    }
  });

  /*
   * ============================================================
   * EINHAND-MANIPULATION / ZWEIHAND-SKALIERUNG
   * ============================================================
   */

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

      this.relativeQuaternion
        .copy(this.handQuaternion)
        .invert()
        .multiply(this.desiredQuaternion);

      this.localGrab.copy(this.handPosition);
      this.body.worldToLocal(this.localGrab);
    },

    setupDouble: function () {
      this.hands[0].object3D.getWorldPosition(this.p1);
      this.hands[1].object3D.getWorldPosition(this.p2);

      this.midpoint.copy(this.p1).add(this.p2).multiplyScalar(0.5);

      this.startDistance = Math.max(
        0.02,
        this.p1.distanceTo(this.p2)
      );

      this.startScale = this.body.scale.x;

      this.el.object3D.getWorldPosition(this.rootPosition);
      this.offset.copy(this.rootPosition).sub(this.midpoint);
    },

    setPosition: function (worldPosition) {
      const root = this.el.object3D;
      const parent = root.parent;

      root.position.copy(worldPosition);

      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.worldToLocal(root.position);
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
          this.startScale *
          this.p1.distanceTo(this.p2) / this.startDistance
        );

        this.body.scale.setScalar(scale);

        this.desiredPosition.copy(this.offset)
          .multiplyScalar(scale / this.startScale)
          .add(this.midpoint);

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
      if (this.grabbed) return;

      const navigation = F.getNavigation();
      if (navigation && navigation.teleporting) return;

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

  /*
   * ============================================================
   * CONTROLLER, LASER, TELEPORTZIEL UND MARKIERUNGEN
   * ============================================================
   */

  AFRAME.registerComponent("fkc-controller", {
    schema: {
      hand: {default: "right"}
    },

    init: function () {
      this.source = null;
      this.hit = null;
      this.teleportValid = false;

      this.origin = new V();
      this.direction = new V();

      this.referencePosition = new V();
      this.referenceQuaternion = new Q();
      this.worldQuaternion = new Q();

      this.endpoint = new V();
      this.target = new V();
      this.localPoint = new V();
      this.worldScale = new V();

      this.raycaster = new THREE.Raycaster();
      this.raycaster.far = 25;

      this.states = {
        trigger: false,
        grip: false,
        last: false,
        all: false
      };

      this.lineEntity = F.create("a-entity", {}, this.el.sceneEl);
      this.positions = new Float32Array(6);

      this.geometry = new THREE.BufferGeometry();

      this.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(this.positions, 3)
      );

      this.material = new THREE.LineBasicMaterial({
        color: "#78d9ef",
        transparent: true,
        opacity: 0.95,
        depthTest: true
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
          color: "#ffe6a0",
          depthTest: false
        }
      }, this.el.sceneEl);

      this.ring = F.create("a-ring", {
        "radius-inner": 0.22,
        "radius-outer": 0.30,
        rotation: "-90 0 0",
        visible: false,
        material: {
          shader: "flat",
          color: "#65e3a1",
          side: "double"
        }
      }, this.el.sceneEl);

      this.triggerDown = () => {
        if (this.states.trigger) return;

        this.states.trigger = true;
        this.activate();
      };

      this.triggerUp = () => {
        this.states.trigger = false;
      };

      this.resetLastEvent = () => {
        const source = F.getSource(this.el.sceneEl, this.data.hand);

        if (
          source && source.gamepad &&
          source.gamepad.mapping === "xr-standard"
        ) return;

        F.resetLast();
      };

      this.resetAllEvent = () => {
        const source = F.getSource(this.el.sceneEl, this.data.hand);

        if (
          source && source.gamepad &&
          source.gamepad.mapping === "xr-standard"
        ) return;

        F.resetAll();
      };

      this.disconnect = this.disconnect.bind(this);

      this.el.addEventListener("triggerdown", this.triggerDown);
      this.el.addEventListener("triggerup", this.triggerUp);

      this.el.addEventListener("abuttondown", this.resetLastEvent);
      this.el.addEventListener("xbuttondown", this.resetLastEvent);

      this.el.addEventListener("bbuttondown", this.resetAllEvent);
      this.el.addEventListener("ybuttondown", this.resetAllEvent);

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
        this.pointer.object3D.position.copy(this.hit.point);
        this.endpoint.copy(this.hit.point);

        this.pointer.setAttribute(
          "material", "color",
          this.hit.type === "action" ? "#7af2b1" : "#ffe6a0"
        );
      } else {
        this.endpoint.copy(this.direction)
          .multiplyScalar(25).add(this.origin);
      }
    },

    activate: function () {
      if (!this.el.sceneEl.is("vr-mode")) return;

      const navigation = F.getNavigation();
      const grabber = this.el.components["fkc-grabber"];

      if (navigation && navigation.teleporting) return;
      if (grabber && grabber.grabbed) return;

      this.updateRay();
      this.updateHit();

      if (!this.hit) return;

      if (this.hit.type === "action") {
        const roomId = this.hit.el.dataset.roomId;

        if (roomId && F.app) {
          F.app.changeRoom(roomId);
        }

        return;
      }

      const root = this.hit.el;
      const body = root.querySelector(".manip-body");

      F.selectModel(root);

      body.object3D.updateWorldMatrix(true, true);

      this.localPoint.copy(this.hit.point);
      body.object3D.worldToLocal(this.localPoint);
      body.object3D.getWorldScale(this.worldScale);

      F.create("a-sphere", {
        class: "atom-marker",
        position: {
          x: this.localPoint.x,
          y: this.localPoint.y,
          z: this.localPoint.z
        },
        radius: 0.012 /
          Math.max(0.0001, Math.abs(this.worldScale.x)),
        material: {
          shader: "flat",
          color: "#ff3f92",
          depthTest: false
        }
      }, body);
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
        const last = F.buttonPressed(gp, 4);
        const all = F.buttonPressed(gp, 5);

        if (last && !this.states.last) F.resetLast();
        if (all && !this.states.all) F.resetAll();

        this.states.last = last;
        this.states.all = all;
      }
    },

    updateTeleport: function () {
      this.teleportValid = false;
      this.pointer.object3D.visible = false;
      this.ring.object3D.visible = false;

      this.endpoint.copy(this.direction)
        .multiplyScalar(25).add(this.origin);

      if (this.direction.y >= -0.03) return;

      const distance = -this.origin.y / this.direction.y;

      if (distance <= 0 || distance > 25) return;

      this.target.copy(this.direction)
        .multiplyScalar(distance).add(this.origin);

      this.target.y = 0;
      this.endpoint.copy(this.target);

      this.teleportValid = F.validFloor(
        this.target.x,
        this.target.z
      );

      this.ring.object3D.position.set(
        this.target.x, 0.025, this.target.z
      );

      this.ring.object3D.visible = true;

      this.ring.setAttribute(
        "material", "color",
        this.teleportValid ? "#65e3a1" : "#ff6767"
      );
    },

    teleport: function () {
      if (!this.teleportValid) return;

      const scene = this.el.sceneEl;
      const rig = F.getRig();
      const position = new V();

      F.releaseHands();
      scene.camera.getWorldPosition(position);

      rig.object3D.position.x += this.target.x - position.x;
      rig.object3D.position.z += this.target.z - position.z;

      rig.object3D.updateWorldMatrix(true, true);
    },

    hide: function () {
      this.line.visible = false;
      this.pointer.object3D.visible = false;
      this.ring.object3D.visible = false;
    },

    clearForRoomChange: function () {
      /*
       * Buttonzustände bleiben erhalten.
       * Ein noch gehaltener Trigger darf im neuen Raum nicht
       * sofort eine zweite Aktion auslösen.
       */
      this.hit = null;
      this.teleportValid = false;
      this.hide();
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

      // Eine Triggeraktion kann gerade den Raum gewechselt haben.
      this.updateRay();

      const grabber = this.el.components["fkc-grabber"];

      if (grabber && grabber.grabbed) {
        this.hide();
        return;
      }

      const navigation = F.getNavigation();

      const teleporting =
        this.data.hand === "right" &&
        navigation && navigation.teleporting;

      this.line.visible = true;

      if (teleporting) {
        this.updateTeleport();
      } else {
        this.ring.object3D.visible = false;
        this.updateHit();
      }

      this.material.color.set(
        teleporting
          ? (this.teleportValid ? "#65e3a1" : "#ff6767")
          : "#78d9ef"
      );

      this.positions.set([
        this.origin.x, this.origin.y, this.origin.z,
        this.endpoint.x, this.endpoint.y, this.endpoint.z
      ]);

      this.geometry.attributes.position.needsUpdate = true;
    },

    remove: function () {
      this.el.removeEventListener("triggerdown", this.triggerDown);
      this.el.removeEventListener("triggerup", this.triggerUp);

      this.el.removeEventListener("abuttondown", this.resetLastEvent);
      this.el.removeEventListener("xbuttondown", this.resetLastEvent);

      this.el.removeEventListener("bbuttondown", this.resetAllEvent);
      this.el.removeEventListener("ybuttondown", this.resetAllEvent);

      this.el.removeEventListener("controllerdisconnected", this.disconnect);

      this.geometry.dispose();
      this.material.dispose();

      this.lineEntity.remove();
      this.pointer.remove();
      this.ring.remove();
    }
  });

  /*
   * ============================================================
   * NAVIGATION
   * ============================================================
   */

  AFRAME.registerComponent("fkc-navigation", {
    schema: {
      speed: {default: 3},
      desktopSpeed: {default: 4},
      snapAngle: {default: 45},
      deadzone: {default: 0.18}
    },

    init: function () {
      this.keys = new Set();
      this.teleporting = false;
      this.rightReady = false;

      this.forward = new V();
      this.right = new V();
      this.movement = new V();

      this.cameraPosition = new V();
      this.pivot = new V();
      this.axis = new V(0, 1, 0);

      this.keyDown = event => {
        const target = event.target;

        if (target && (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
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

    rightTools: function () {
      const hand = document.getElementById("rightHand");
      return hand && hand.components["fkc-controller"];
    },

    cancel: function () {
      this.keys.clear();
      this.teleporting = false;
      this.rightReady = false;

      const tools = this.rightTools();

      if (tools) {
        tools.teleportValid = false;
        tools.ring.object3D.visible = false;
      }
    },

    applyDeadzone: function (value) {
      const absolute = Math.abs(value);

      if (absolute <= this.data.deadzone) return 0;

      return Math.sign(value) *
        (absolute - this.data.deadzone) /
        (1 - this.data.deadzone);
    },

    rotateAroundHead: function (angle) {
      const camera = this.el.sceneEl.camera;
      if (!camera) return;

      camera.getWorldPosition(this.pivot);

      this.el.object3D.position.sub(this.pivot)
        .applyAxisAngle(this.axis, angle)
        .add(this.pivot);

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
        .multiplyScalar(-y)
        .addScaledVector(this.right, x);

      if (this.movement.lengthSq() > 1) {
        this.movement.normalize();
      }

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
      const scene = this.el.sceneEl;

      if (!scene.is("vr-mode")) {
        let x = 0;
        let y = 0;

        if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x--;
        if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x++;
        if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y--;
        if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y++;

        const turn =
          (this.keys.has("KeyQ") ? 1 : 0) -
          (this.keys.has("KeyE") ? 1 : 0);

        if (turn) {
          this.rotateAroundHead(
            turn * 1.5 * Math.min((delta || 0) / 1000, 0.05)
          );
        }

        this.move(x, y, this.data.desktopSpeed, delta);
        return;
      }

      const leftSource = F.getSource(scene, "left");
      const rightSource = F.getSource(scene, "right");

      const left = F.readStick(leftSource);
      const right = F.readStick(rightSource);
      const tools = this.rightTools();

      const neutral =
        Math.abs(right.x) < 0.2 &&
        Math.abs(right.y) < 0.2;

      if (!rightSource) {
        this.teleporting = false;
        this.rightReady = false;
      } else if (this.teleporting) {
        if (F.anyGrabbing()) {
          this.teleporting = false;
          this.rightReady = false;
        } else if (tools) {
          tools.updateRay();
          tools.updateTeleport();

          if (neutral) {
            tools.teleport();
            this.teleporting = false;
            this.rightReady = true;
          }
        }
      } else if (neutral) {
        this.rightReady = true;
      } else if (this.rightReady) {
        if (
          Math.abs(right.x) > 0.65 &&
          Math.abs(right.x) > Math.abs(right.y)
        ) {
          F.releaseHands();

          this.rotateAroundHead(
            -Math.sign(right.x) *
            THREE.MathUtils.degToRad(this.data.snapAngle)
          );

          this.rightReady = false;
        } else if (right.y < -0.65 && !F.anyGrabbing()) {
          this.teleporting = true;
          this.rightReady = false;

          if (tools) {
            tools.updateRay();
            tools.updateTeleport();
          }
        }
      }

      if (!this.teleporting) {
        this.move(
          this.applyDeadzone(left.x),
          this.applyDeadzone(left.y),
          this.data.speed,
          delta
        );
      }
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
      };

      this.exit = () => {
        F.releaseHands();

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
    console.log("Aktueller Raum:", F.app && F.app.currentId);
    console.log("XR-Sitzung:", session);

    if (!session) return;

    console.table(
      Array.from(session.inputSources).map(source => ({
        hand: source.handedness,
        profiles: Array.from(source.profiles).join(", "),
        mapping: source.gamepad ? source.gamepad.mapping : "",
        axes: source.gamepad
          ? Array.from(source.gamepad.axes)
            .map(value => value.toFixed(3)).join(", ")
          : "",
        buttons: source.gamepad
          ? Array.from(source.gamepad.buttons)
            .map((button, index) =>
              index + ":" + button.value.toFixed(2)
            ).join(" ")
          : ""
      }))
    );
  };
})(window.FKCVR);
