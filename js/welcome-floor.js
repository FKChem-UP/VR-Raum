"use strict";

/*
 * BEGRÜSSUNGSRAUM — WARMGRAUER FLIESENBODEN — VERSION 2
 *
 * Für den Raumaufbau GALERIE-5.
 *
 * Erkennt den vorhandenen Boden anhand seiner Geometrie.
 * Wartet bei Bedarf auf die Initialisierung durch A-Frame.
 *
 * Keine zusätzlichen Bodenflächen.
 * Sockel, Poster, Modelle und andere Räume bleiben unverändert.
 *
 * Nach room-builder.js und vor room-themes.js einbinden.
 */

(function (F) {
  if (!F || !F.RoomBuilder ||
      typeof F.RoomBuilder.build !== "function") {
    console.error(
      "WELCOME-FLOOR-2: room-builder.js muss vorher geladen werden."
    );
    return;
  }

  if (F.RoomBuilder.build.fkcWelcomeFloorV2) return;

  const TEXTURE_METERS = 3.2;
  let textureSource = null;

  function makeTexture() {
    if (textureSource) return textureSource;

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas nicht verfügbar.");

    let seed = 16112026;

    function random() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    const tileSize = 256;
    const joint = 3;

    ctx.fillStyle = "#625e57";
    ctx.fillRect(0, 0, 1024, 1024);

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = col * tileSize + joint / 2;
        const y = row * tileSize + joint / 2;
        const size = tileSize - joint;
        const variation = Math.round((random() - 0.5) * 12);

        ctx.fillStyle =
          "rgb(" + (139 + variation) + "," +
          (135 + variation) + "," +
          (127 + variation) + ")";

        ctx.fillRect(x, y, size, size);

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, size, size);
        ctx.clip();

        const gradient = ctx.createLinearGradient(
          x, y, x + size, y + size
        );

        gradient.addColorStop(
          0, "rgba(255,248,230,0.045)"
        );
        gradient.addColorStop(
          0.5, "rgba(255,248,230,0)"
        );
        gradient.addColorStop(
          1, "rgba(35,32,27,0.045)"
        );

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, size, size);

        for (let i = 0; i < 1900; i++) {
          ctx.fillStyle = random() > 0.5
            ? "rgba(255,250,235,0.055)"
            : "rgba(38,35,30,0.045)";

          const dotSize = 0.4 + random() * 1.3;

          ctx.fillRect(
            x + random() * size,
            y + random() * size,
            dotSize,
            dotSize
          );
        }

        ctx.restore();

        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(230,222,205,0.12)";
        ctx.beginPath();
        ctx.moveTo(x, y + size);
        ctx.lineTo(x, y);
        ctx.lineTo(x + size, y);
        ctx.stroke();
      }
    }

    textureSource = canvas.toDataURL("image/png");
    return textureSource;
  }

  function near(value, expected) {
    return Number.isFinite(Number(value)) &&
      Math.abs(Number(value) - expected) < 0.002;
  }

  /*
   * A-Frame bildet die Maße der a-box auf geometry ab.
   * Deshalb nicht ausschließlich getAttribute("width") lesen.
   */
  function dimensions(el) {
    const component = el.components &&
      el.components.geometry;

    const geometry = component
      ? component.data
      : el.getAttribute("geometry");

    const mesh = el.getObject3D("mesh");
    const parameters = mesh && mesh.geometry
      ? mesh.geometry.parameters
      : null;

    function read(name) {
      if (geometry && geometry[name] != null) {
        return Number(geometry[name]);
      }

      if (parameters && parameters[name] != null) {
        return Number(parameters[name]);
      }

      const attribute = el.getAttribute(name);

      return attribute == null ? NaN : Number(attribute);
    }

    return {
      width: read("width"),
      height: read("height"),
      depth: read("depth")
    };
  }

  if (!AFRAME.components["fkc-welcome-tile-floor-v2"]) {
    AFRAME.registerComponent("fkc-welcome-tile-floor-v2", {
      schema: {
        width: {type: "number"},
        depth: {type: "number"}
      },

      init: function () {
        this.finished = false;
        this.started = null;
      },

      update: function () {
        this.finished = false;
        this.started = null;
      },

      tick: function (time) {
        if (this.finished) return;

        if (this.started === null) {
          this.started = time;
        }

        /*
         * Nur direkte Kinder des Raumcontainers prüfen.
         * Keine Boxen innerhalb von Sockeln oder Postern.
         */
        const boxes = Array.from(this.el.children).filter(
          el => el.tagName.toLowerCase() === "a-box"
        );

        let surface = null;
        let foundation = null;

        for (const el of boxes) {
          const position = el.object3D.position;
          const size = dimensions(el);

          if (
            !near(position.x, 0) ||
            !near(position.z, 0)
          ) continue;

          if (
            near(position.y, 0.003) &&
            near(size.height, 0.006) &&
            near(size.width, this.data.width - 0.30) &&
            near(size.depth, this.data.depth - 0.30)
          ) {
            surface = el;
          }

          if (
            near(position.y, -0.08) &&
            near(size.height, 0.16) &&
            near(size.width, this.data.width) &&
            near(size.depth, this.data.depth)
          ) {
            foundation = el;
          }
        }

        if (!surface) {
          if (time - this.started > 5000) {
            console.warn(
              "WELCOME-FLOOR-2: Boden nicht erkannt. " +
              "Bitte aktuellen room-builder.js prüfen."
            );
            this.finished = true;
          }
          return;
        }

        try {
          /*
           * Standardmaterial ausdrücklich setzen.
           * Die gewünschte Farbe steckt bereits in der Textur.
           */
          surface.setAttribute("material", {
            shader: "standard",
            src: makeTexture(),
            color: "#ffffff",
            repeat:
              ((this.data.width - 0.30) /
                TEXTURE_METERS).toFixed(4) + " " +
              ((this.data.depth - 0.30) /
                TEXTURE_METERS).toFixed(4),
            roughness: 0.94,
            metalness: 0
          });

          if (foundation) {
            foundation.setAttribute("material", {
              shader: "standard",
              color: "#77736b",
              roughness: 0.94,
              metalness: 0
            });
          }

          console.info(
            "WELCOME-FLOOR-2: Warmgrauer Fliesenboden angewendet."
          );
        } catch (error) {
          console.error(
            "WELCOME-FLOOR-2: Textur konnte nicht angewendet werden:",
            error
          );
        }

        this.finished = true;
      }
    });
  }

  const previousBuild = F.RoomBuilder.build;

  function buildWithTileFloor(parent, config, rooms) {
    /*
     * Bei jedem Raumwechsel eine alte Komponenteninstanz
     * entfernen, damit sie nicht auf den nächsten Raum wirkt.
     */
    parent.removeAttribute("fkc-welcome-tile-floor-v2");

    const result = previousBuild.call(
      this, parent, config, rooms
    );

    if (config && config.kind === "welcome") {
      parent.setAttribute("fkc-welcome-tile-floor-v2", {
        width: config.width,
        depth: config.depth
      });
    }

    return result;
  }

  buildWithTileFloor.fkcWelcomeFloorV2 = true;
  F.RoomBuilder.build = buildWithTileFloor;

  console.info("WELCOME-FLOOR-2: Bodenanpassung geladen.");
})(window.FKCVR);
