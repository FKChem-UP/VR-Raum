"use strict";

(function (F) {
  /*
   * DRAWING-1
   *
   * Aus vr-tools.js ausgelagerte Zeichenfunktionen.
   * Schnittstelle und Zeichenverhalten bleiben unverändert.
   *
   * Voraussetzung:
   * vr-controls.js stellt window.FKCVR bereit.
   *
   * F.Settings wird erst beim Zeichnen benötigt und
   * weiterhin von vr-tools.js bereitgestellt.
   */

  const T = AFRAME.THREE;
  const V = T.Vector3;

  const SIDES = 6;
  const CAPACITY = 128;
  const MAX_STROKES = 300;

  F.Draw = {
    mode: "laser",
    color: "#ffcc33",
    opacity: 0.35,
    setMode(mode) {
      if (!["laser", "paint"].includes(mode)) return;
      this.mode = mode;
      if (mode === "paint" && F.Measure && F.Measure.enabled) F.Measure.setEnabled(false);
      if (F.Menu) F.Menu.blockDrawing();
    },
    strokes: [],

    remove: function (stroke) {
      if (!stroke || stroke.removed) return;

      stroke.removed = true;
      stroke.group.removeFromParent();

      stroke.geometry.dispose();
      stroke.dotGeometry.dispose();
      stroke.material.dispose();

      const index = this.strokes.indexOf(stroke);

      if (index >= 0) {
        this.strokes.splice(index, 1);
      }
    },

    clear: function (target) {
      this.strokes.slice().forEach(stroke => {
        if (
          !target ||
          stroke.owner === target ||
          target.contains(stroke.owner)
        ) {
          this.remove(stroke);
        }
      });
    },

    createStroke: function (
      hit, parent, point, radius, color, worldRadius
    ) {
      while (this.strokes.length >= MAX_STROKES) {
        this.remove(this.strokes[0]);
      }

      const group = new T.Group();
      group.userData.fkcDrawing = true;
      parent.add(group);

      const material = new T.MeshBasicMaterial({
        color,
        transparent: this.opacity < 1,
        opacity: this.opacity,
        depthWrite: false,
        side: T.DoubleSide
      });

      // Einzelpunkte bleiben größer als die Linie.
      const dotGeometry = new T.SphereGeometry(
        radius * 2, 8, 6
      );

      const dot = new T.Mesh(dotGeometry, material);
      dot.position.copy(point);
      group.add(dot);

      const positions = new Float32Array(
        CAPACITY * SIDES * 3
      );

      const indices = new Uint16Array(
        (CAPACITY - 1) * SIDES * 6
      );

      let index = 0;

      for (let ring = 1; ring < CAPACITY; ring++) {
        for (let side = 0; side < SIDES; side++) {
          const next = (side + 1) % SIDES;

          const a = (ring - 1) * SIDES + side;
          const b = (ring - 1) * SIDES + next;
          const c = ring * SIDES + side;
          const d = ring * SIDES + next;

          indices[index++] = a;
          indices[index++] = c;
          indices[index++] = b;

          indices[index++] = b;
          indices[index++] = c;
          indices[index++] = d;
        }
      }

      const geometry = new T.BufferGeometry();

      geometry.setAttribute(
        "position",
        new T.BufferAttribute(positions, 3)
      );

      geometry.setIndex(
        new T.BufferAttribute(indices, 1)
      );

      geometry.setDrawRange(0, 0);

      const tube = new T.Mesh(geometry, material);
      tube.frustumCulled = false;
      group.add(tube);

      const stroke = {
        owner: hit.el,
        surfaceMesh: hit.mesh,
        parent,
        group,
        material,
        geometry,
        dotGeometry,
        positions,
        radius,
        worldRadius,
        color,
        opacity: this.opacity,
        count: 0,
        lastLocal: point.clone(),
        lastNormal: hit.normal.clone(),
        removed: false
      };

      this.strokes.push(stroke);
      this.addRing(stroke, point, new V(0, 1, 0));

      return stroke;
    },

    addRing: function (stroke, point, direction) {
      const axis = direction.clone().normalize();

      const helper = Math.abs(axis.y) < 0.9
        ? new V(0, 1, 0)
        : new V(1, 0, 0);

      const u = new V().crossVectors(axis, helper).normalize();
      const v = new V().crossVectors(axis, u).normalize();

      for (let side = 0; side < SIDES; side++) {
        const angle = side / SIDES * Math.PI * 2;

        const vertex = point.clone()
          .addScaledVector(
            u, Math.cos(angle) * stroke.radius
          )
          .addScaledVector(
            v, Math.sin(angle) * stroke.radius
          );

        const offset = (stroke.count * SIDES + side) * 3;

        stroke.positions[offset] = vertex.x;
        stroke.positions[offset + 1] = vertex.y;
        stroke.positions[offset + 2] = vertex.z;
      }

      stroke.count++;
      stroke.geometry.attributes.position.needsUpdate = true;

      stroke.geometry.setDrawRange(
        0,
        Math.max(0, stroke.count - 1) * SIDES * 6
      );
    },

    sample: function (stroke, hit, hand) {
      if (this.mode !== "paint" || !hit.normal) return null;
      const body = hit.type === "model"
        ? hit.el.querySelector(".manip-body")
        : hit.el;

      if (!body) return null;

      const color = this.color;

      const worldRadius = F.Settings.strokeRadius;
      const parent = body.object3D;

      parent.updateWorldMatrix(true, true);

      const scale = parent.getWorldScale(new V());
      const factor = Math.max(0.0001, Math.abs(scale.x));
      const surfaceOffset = Math.max(0.004, worldRadius);

      const worldPoint = hit.point.clone()
        .addScaledVector(hit.normal, surfaceOffset);

      const localPoint = parent.worldToLocal(
        worldPoint.clone()
      );

      let sameStroke = !!(
        stroke &&
        !stroke.removed &&
        stroke.owner === hit.el &&
        stroke.surfaceMesh === hit.mesh &&
        stroke.parent === parent &&
        stroke.color === color &&
        stroke.opacity === this.opacity &&
        stroke.worldRadius === worldRadius &&
        stroke.count < CAPACITY
      );

      if (sameStroke) {
        const previousWorld = parent.localToWorld(
          stroke.lastLocal.clone()
        );

        const distance = previousWorld.distanceTo(worldPoint);

        if (distance < 0.006) return stroke;

        if (
          distance > 0.18 ||
          stroke.lastNormal.dot(hit.normal) < 0.4
        ) {
          sameStroke = false;
        }
      }

      if (!sameStroke) {
        return this.createStroke(
          hit,
          parent,
          localPoint,
          worldRadius / factor,
          color,
          worldRadius
        );
      }

      const direction = localPoint.clone()
        .sub(stroke.lastLocal);

      this.addRing(stroke, localPoint, direction);

      stroke.lastLocal.copy(localPoint);
      stroke.lastNormal.copy(hit.normal);

      return stroke;
    }
  };

  console.info(
    "FKC-VR DRAWING-1 geladen: Zeichenfunktionen als eigenes Modul."
  );
})(window.FKCVR);
