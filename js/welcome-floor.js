"use strict";

/*
 * ============================================================
 * BEGRÜSSUNGSRAUM — WARMGRAUER FLIESENBODEN — VERSION 1
 * ============================================================
 *
 * Ergänzung zur room-builder.js — GALERIE-5.
 *
 * - Mittelgraue Fliesen mit leicht warmem Farbton.
 * - Dezente Fugen und zurückhaltende Steinstruktur.
 * - Matte Oberfläche ohne starken Glanz.
 * - Keine zusätzlichen Bilddateien erforderlich.
 * - Keine zusätzlichen Bodenobjekte oder Interaktionsziele.
 *
 * Unverändert bleiben:
 * - Sockel und Modelle
 * - Poster und Goldrahmen
 * - Wände und Decke
 * - Beleuchtung
 * - Vorlesungs- und Praktikumsräume
 * - Steuerung und Raumwechsel
 *
 * Einbindung:
 * Direkt NACH room-builder.js und VOR room-themes.js,
 * browser-xr.js und app.js.
 */

(function (F) {
  if (!F || !F.RoomBuilder ||
      typeof F.RoomBuilder.build !== "function") {
    console.error(
      "WELCOME-FLOOR-1: room-builder.js muss vorher geladen werden."
    );
    return;
  }

  if (F.RoomBuilder.build.fkcWelcomeFloorV1) return;

  /*
   * Vier Fliesen je Texturbreite.
   * Eine Wiederholung entspricht 3,2 Metern.
   * Damit ist eine Fliese ungefähr 80 × 80 cm groß.
   */
  const TEXTURE_SIZE = 1024;
  const TILES_PER_SIDE = 4;
  const TEXTURE_METERS = 3.2;

  let cachedTexture = null;

  function makeTileTexture() {
    if (cachedTexture) return cachedTexture;

    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas-Zeichenfläche nicht verfügbar.");
    }

    let seed = 16112026;

    function random() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    const size = TEXTURE_SIZE;
    const tileSize = size / TILES_PER_SIDE;

    /*
     * Drei Pixel Fugenbreite entsprechen ungefähr 9 mm.
     * Keine tiefschwarzen Linien, damit das Muster ruhig bleibt.
     */
    const joint = 3;

    ctx.fillStyle = "#625e57";
    ctx.fillRect(0, 0, size, size);

    for (let row = 0; row < TILES_PER_SIDE; row++) {
      for (let col = 0; col < TILES_PER_SIDE; col++) {
        const x = col * tileSize + joint / 2;
        const y = row * tileSize + joint / 2;
        const innerSize = tileSize - joint;

        /*
         * Warmes Mittelgrau mit geringer Variation.
         * Kein Schachbrettmuster und keine grellen Farbsprünge.
         */
        const variation = Math.round((random() - 0.5) * 12);

        const red = 139 + variation;
        const green = 135 + variation;
        const blue = 127 + variation;

        ctx.fillStyle =
          "rgb(" + red + "," + green + "," + blue + ")";

        ctx.fillRect(x, y, innerSize, innerSize);

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, innerSize, innerSize);
        ctx.clip();

        /*
         * Sehr zurückhaltende Helligkeitsvariation innerhalb
         * jeder Fliese: eher Feinsteinzeug als glänzender Marmor.
         */
        const gradient = ctx.createLinearGradient(
          x, y,
          x + innerSize, y + innerSize
        );

        gradient.addColorStop(0, "rgba(255,248,230,0.045)");
        gradient.addColorStop(0.5, "rgba(255,248,230,0)");
        gradient.addColorStop(1, "rgba(35,32,27,0.045)");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, innerSize, innerSize);

        /*
         * Feine Steinstruktur.
         * Nur in der Textur, keine zusätzlichen 3D-Objekte.
         */
        for (let i = 0; i < 1900; i++) {
          const px = x + random() * innerSize;
          const py = y + random() * innerSize;
          const dotSize = 0.4 + random() * 1.3;

          ctx.fillStyle = random() > 0.5
            ? "rgba(255,250,235,0.055)"
            : "rgba(38,35,30,0.045)";

          ctx.fillRect(px, py, dotSize, dotSize);
        }

        ctx.restore();

        /*
         * Minimale Kantenbetonung, ohne harten Glanzeffekt.
         */
        ctx.lineWidth = 1;

        ctx.strokeStyle = "rgba(230,222,205,0.12)";
        ctx.beginPath();
        ctx.moveTo(x, y + innerSize);
        ctx.lineTo(x, y);
        ctx.lineTo(x + innerSize, y);
        ctx.stroke();

        ctx.strokeStyle = "rgba(38,35,30,0.10)";
        ctx.beginPath();
        ctx.moveTo(x + innerSize, y);
        ctx.lineTo(x + innerSize, y + innerSize);
        ctx.lineTo(x, y + innerSize);
        ctx.stroke();
      }
    }

    cachedTexture = canvas.toDataURL("image/png");
    return cachedTexture;
  }

  function readPosition(el) {
    const position = el.getAttribute("position");

    if (position && typeof position === "object") {
      return {
        x: Number(position.x),
        y: Number(position.y),
        z: Number(position.z)
      };
    }

    const parts = String(position || "")
      .trim()
      .split(/\s+/)
      .map(Number);

    return {
      x: parts[0],
      y: parts[1],
      z: parts[2]
    };
  }

  function closeTo(value, expected) {
    return Number.isFinite(value) &&
      Math.abs(value - expected) < 0.0005;
  }

  function applyWelcomeFloor(parent, config) {
    /*
     * Die vorhandene GALERIE-5-Datei verwendet zwei a-box:
     *
     * Unterbau:
     * y = -0.08, Höhe = 0.16
     *
     * Sichtbare Marmorschicht:
     * y = 0.003, Höhe = 0.006
     *
     * Nur direkte Kinder des Raumcontainers betrachten.
     * So werden keine Sockel oder Rahmen verändert.
     */
    const boxes = Array.from(parent.children).filter(el => (
      el.tagName.toLowerCase() === "a-box"
    ));

    let surface = null;
    let foundation = null;

    boxes.forEach(el => {
      const position = readPosition(el);
      const width = Number(el.getAttribute("width"));
      const height = Number(el.getAttribute("height"));
      const depth = Number(el.getAttribute("depth"));

      if (
        !closeTo(position.x, 0) ||
        !closeTo(position.z, 0)
      ) return;

      if (
        closeTo(position.y, 0.003) &&
        closeTo(height, 0.006) &&
        closeTo(width, config.width - 0.30) &&
        closeTo(depth, config.depth - 0.30)
      ) {
        surface = el;
      }

      if (
        closeTo(position.y, -0.08) &&
        closeTo(height, 0.16) &&
        closeTo(width, config.width) &&
        closeTo(depth, config.depth)
      ) {
        foundation = el;
      }
    });

    if (!surface) {
      console.warn(
        "WELCOME-FLOOR-1: Bodenfläche nicht erkannt. " +
        "Der vorhandene Boden bleibt unverändert."
      );
      return;
    }

    const floorWidth = config.width - 0.30;
    const floorDepth = config.depth - 0.30;

    /*
     * Die Textur selbst enthält bereits die gewünschte Farbe.
     * Weiß als Materialfarbe verhindert eine zusätzliche
     * Farbmultiplikation beziehungsweise Verfälschung.
     */
    surface.setAttribute("material", "src", makeTileTexture());
    surface.setAttribute("material", "color", "#ffffff");

    surface.setAttribute(
      "material",
      "repeat",
      (floorWidth / TEXTURE_METERS).toFixed(4) + " " +
      (floorDepth / TEXTURE_METERS).toFixed(4)
    );

    surface.setAttribute("material", "roughness", 0.94);
    surface.setAttribute("material", "metalness", 0);

    /*
     * Auch der schmale Rand außerhalb der Textur wird dunkler.
     */
    if (foundation) {
      foundation.setAttribute("material", "color", "#77736b");
      foundation.setAttribute("material", "roughness", 0.94);
      foundation.setAttribute("material", "metalness", 0);
    }
  }

  const previousBuild = F.RoomBuilder.build;

  function buildWithWelcomeFloor(parent, config, rooms) {
    const result = previousBuild.call(
      this, parent, config, rooms
    );

    if (config && config.kind === "welcome") {
      try {
        applyWelcomeFloor(parent, config);
      } catch (error) {
        /*
         * Ein Texturproblem darf den Raumaufbau nicht abbrechen.
         */
        console.error(
          "WELCOME-FLOOR-1: Fliesenboden konnte nicht " +
          "angewendet werden:",
          error
        );
      }
    }

    return result;
  }

  buildWithWelcomeFloor.fkcWelcomeFloorV1 = true;
  F.RoomBuilder.build = buildWithWelcomeFloor;
})(window.FKCVR);
