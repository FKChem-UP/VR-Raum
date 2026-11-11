"use strict";

(function (F) {
  /*
   * ============================================================
   * RAUMAUFBAU — GALERIE-5
   * ============================================================
   *
   * - Ablaufplan mit doppelter Bildfläche.
   * - Kleinere Nachbarposter und angepasste Goldrahmen.
   * - Vorlesungsposter mit Erklärungstexten.
   * - Eintrittshinweis nur beim Anvisieren mit dem VR-Laser.
   * - Textumbruch nur an Leerzeichen, echten Bindestrichen
   *   und ausdrücklich vorbereiteten Trennstellen.
   * - Podesttexte verwenden plaqueText.
   *
   * Bestehende Modelle, Museumsgestaltung und Schnittstellen
   * bleiben erhalten.
   */

  const THREE = AFRAME.THREE;
  const create = F.create;
  const V = THREE.Vector3;

  const WELCOME_PEDESTAL_TOP = 0.9625;
  const WELCOME_MODEL_GAP = 0.015;

  /*
   * "Doppelt so groß" bedeutet hier doppelte Fläche.
   * Breite und Höhe wachsen jeweils um sqrt(2).
   */
  const WELCOME_REAR = {
    y: 2.78,
    planWidth: 3.72 * Math.SQRT2,
    planHeight: 2.55 * Math.SQRT2,
    sideWidth: 2.55,
    sideHeight: 2.55 * 9 / 16,
    sideX: 5
  };

  /*
   * Fachlich und sprachlich überarbeitete Kurzbeschreibungen.
   *
   * Diese lokalen Standardtexte werden nur auf den Raumtafeln
   * verwendet. Die zentralen Raumdaten und Modelle bleiben
   * unverändert.
   *
   * Ein optionales room.posterDescription hat Vorrang.
   */
  const lectureDescriptions = {
    "vorlesung-1":
      "Vermittelt grundlegende Begriffe und Einteilungen der " +
      "Festkörperchemie sowie die Unterschiede zwischen " +
      "kristallinen und amorphen Festkörpern.",

    "vorlesung-2":
      "Behandelt die Bindungsarten in Festkörpern: ionische, " +
      "kovalente und metallische Bindungen sowie " +
      "intermolekulare Wechselwirkungen.",

    "vorlesung-3":
      "Gibt einen Überblick über Syntheseverfahren – von " +
      "klassischen Festkörperreaktionen über Reaktionen in " +
      "Schmelzen bis zu Solvothermalsynthesen – zur Herstellung " +
      "von Einkristallen, Keramiken, amorphen Pulvern, dünnen " +
      "Schichten und Fasern.",

    "vorlesung-4":
      "Führt von den sieben Kristallsystemen über die 14 " +
      "Bravaisgitter zu den 230 Raumgruppen und erklärt, " +
      "wie sich die Symmetrie von Kristallstrukturen " +
      "beschreiben lässt.",

    "vorlesung-5":
      "Erläutert die Erzeugung von Röntgenstrahlung, den Aufbau " +
      "eines Einkristalldiffraktometers und die Bestimmung von " +
      "Kristallstrukturen durch Röntgenbeugung am Einkristall.",

    "vorlesung-6":
      "Erklärt Metallstrukturen anhand von Kugelpackungen und " +
      "ihren Hohlräumen und behandelt physikalische " +
      "Eigenschaften, Polymorphie, Legierungen und " +
      "intermetallische Phasen.",

    "vorlesung-7":
      "Erklärt den Aufbau von Ionenkristallen, die Bedeutung " +
      "von Radienverhältnissen und Koordinationspolyedern " +
      "sowie wichtige Strukturtypen: NaCl, ZnS, CsCl, " +
      "CaF₂ und Perowskit.",

    "vorlesung-8":
      "Behandelt molekulare Kristalle, etwa aus S₈- und " +
      "P₄-Molekülen, intermolekulare Wechselwirkungen wie " +
      "van-der-Waals-Kräfte und Wasserstoffbrücken sowie den " +
      "Übergang zwischen ionischer und kovalenter Bindung " +
      "in Festkörpern."
  };

  /*
   * Bewusst ausgewählte Trennstellen.
   *
   * Keine automatische Zerlegung nach Zeichen.
   * Nicht aufgeführte Wörter werden ausschließlich an
   * Leerzeichen oder vorhandenen echten Bindestrichen
   * umgebrochen.
   *
   * Chemische Formeln bleiben ungeteilt.
   */
  const textBreaks = {
    "Festkörperchemie": "Fest\u00ADkörper\u00ADchemie",
    "Festkörpern": "Fest\u00ADkörpern",
    "Festkörper": "Fest\u00ADkörper",
    "Festkörperreaktionen": "Fest\u00ADkörper\u00ADreaktionen",
    "Festkörper-Verbindungen":
      "Fest\u00ADkörper-Ver\u00ADbindungen",

    "Bindungsarten": "Bindungs\u00ADarten",
    "intermolekulare": "inter\u00ADmolekulare",
    "intermolekularen": "inter\u00ADmolekularen",
    "Wechselwirkungen": "Wechsel\u00ADwirkungen",

    "Syntheseverfahren": "Synthese\u00ADverfahren",
    "Solvothermalsynthesen": "Solvothermal\u00ADsynthesen",

    "Einkristallen": "Ein\u00ADkristallen",
    "Einkristall": "Ein\u00ADkristall",
    "Einkristall-Umwandlung":
      "Ein\u00ADkristall-Um\u00ADwandlung",
    "Einkristalldiffraktometers":
      "Ein\u00ADkristall\u00ADdiffraktometers",

    "Kristallsystemen": "Kristall\u00ADsystemen",
    "Kristallstrukturen": "Kristall\u00ADstrukturen",
    "Kristallographie": "Kristallo\u00ADgraphie",
    "Bravaisgitter": "Bravais\u00ADgitter",
    "Raumgruppen": "Raum\u00ADgruppen",

    "Röntgenstrahlung": "Röntgen\u00ADstrahlung",
    "Röntgenbeugung": "Röntgen\u00ADbeugung",
    "Röntgenstrukturanalyse":
      "Röntgen\u00ADstruktur\u00ADanalyse",

    "Metallstrukturen": "Metall\u00ADstrukturen",
    "Kugelpackungen": "Kugel\u00ADpackungen",
    "intermetallische": "inter\u00ADmetallische",

    "Ionenkristallen": "Ionen\u00ADkristallen",
    "Ionengitter": "Ionen\u00ADgitter",
    "Radienverhältnissen": "Radien\u00ADverhältnissen",
    "Koordinationspolyedern":
      "Koordinations\u00ADpolyedern",
    "Strukturtypen": "Struktur\u00ADtypen",

    "Molekülstrukturen": "Molekül\u00ADstrukturen",
    "Wasserstoffbrücken": "Wasserstoff\u00ADbrücken",

    "Buckminsterfulleren": "Buckminster\u00ADfulleren",
    "Hochtemperatursupraleiter":
      "Hoch\u00ADtemperatur\u00ADsupraleiter",
    "innenzentriertes": "innen\u00ADzentriertes",
    "Zinkblende": "Zink\u00ADblende",
    "Metallorganische": "Metall\u00ADorganische",
    "Gerüstverbindung": "Gerüst\u00ADverbindung",

    "Praktikumsraum": "Praktikums\u00ADraum",
    "Begrüßungsraum": "Begrüßungs\u00ADraum",
    "Universität": "Uni\u00ADversität"
  };

  /*
   * ============================================================
   * GRUNDGEOMETRIE
   * ============================================================
   */

  function box(parent, x, y, z, width, height, depth, color, extra) {
    return create("a-box", {
      position: {x, y, z},
      width,
      height,
      depth,
      material: Object.assign({
        color,
        roughness: 0.8,
        metalness: 0
      }, extra || {})
    }, parent);
  }

  function gold(parent, x, y, z, w, h, d, color) {
    return box(parent, x, y, z, w, h, d, color || "#b38b39", {
      metalness: 0.55,
      roughness: 0.36
    });
  }

  function image(draw, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width || 1024;
    canvas.height = height || 576;

    draw(canvas.getContext("2d"), canvas.width, canvas.height);

    return canvas.toDataURL("image/png");
  }

  /*
   * ============================================================
   * TEXTUMBRUCH
   * ============================================================
   */

  function plainText(value) {
    return String(value || "").replace(/\u00AD/g, "");
  }

  function prepareText(value) {
    return String(value || "").replace(
      /[A-Za-zÄÖÜäöüß]+/g,
      word => textBreaks[word] || word
    );
  }

  /*
   * Eine ausdrücklich vorbereitete Stelle finden, an der ein
   * Wort innerhalb der verfügbaren Breite getrennt werden darf.
   *
   * Bedingter Trennstrich:
   *   Ein sichtbarer Bindestrich entsteht nur beim Umbruch.
   *
   * Echter Bindestrich:
   *   Bleibt erhalten, kein zusätzlicher Bindestrich.
   */
  function splitWord(ctx, word, availableWidth) {
    let best = null;

    for (let index = 0; index < word.length; index++) {
      const character = word[index];

      if (character !== "\u00AD" && character !== "-") continue;

      let left;
      let right;

      if (character === "\u00AD") {
        left = plainText(word.slice(0, index)) + "-";
        right = word.slice(index + 1);
      } else {
        left = plainText(word.slice(0, index + 1));
        right = word.slice(index + 1);
      }

      /*
       * Keine leeren Wortteile oder alleinstehenden
       * Bindestriche als künstliche Trennung.
       */
      if (!plainText(right) || left.length <= 1) continue;

      if (ctx.measureText(left).width <= availableWidth) {
        best = {left, right};
      }
    }

    return best;
  }

  /*
   * Keine beliebige Zeichenzerlegung.
   *
   * Ist ein untrennbares Wort zu breit, bleibt es zunächst
   * vollständig in einer Zeile. fittedText erkennt dies und
   * reduziert die Schriftgröße.
   */
  function wrapCanvasText(ctx, value, maxWidth) {
    const result = [];
    const paragraphs = String(value || "").split("\n");

    paragraphs.forEach(paragraph => {
      const words = paragraph.split(/\s+/).filter(Boolean);

      if (!words.length) {
        result.push("");
        return;
      }

      let line = "";

      words.forEach(originalWord => {
        let word = originalWord;

        while (word) {
          const visibleWord = plainText(word);
          const prefix = line ? line + " " : "";
          const candidate = prefix + visibleWord;

          if (ctx.measureText(candidate).width <= maxWidth) {
            line = candidate;
            word = "";
            continue;
          }

          const availableWidth =
            maxWidth - ctx.measureText(prefix).width;

          const split = splitWord(ctx, word, availableWidth);

          if (split) {
            result.push(prefix + split.left);
            line = "";
            word = split.right;
            continue;
          }

          if (line) {
            result.push(line);
            line = "";
            continue;
          }

          /*
           * Wort passt selbst in eine leere Zeile nicht
           * und besitzt keine passende zulässige Trennstelle.
           * Nicht abschneiden oder nach Zeichen zerlegen.
           */
          line = visibleWord;
          word = "";
        }
      });

      if (line) result.push(line);
    });

    return result;
  }

  /*
   * Text in einen festen Innenbereich einpassen.
   *
   * Die Schriftgröße wird anhand der tatsächlichen gemessenen
   * Zeilenbreiten und der gesamten Texthöhe ausgewählt.
   * Keine horizontale Stauchung.
   */
  function fittedText(ctx, value, x, y, width, height, options) {
    const o = Object.assign({
      maxSize: 80,
      minSize: 10,
      weight: "bold",
      family: "Arial, sans-serif",
      lineHeight: 1.15,
      color: "#222222",
      align: "center",
      vertical: "middle"
    }, options || {});

    const prepared = prepareText(value);

    let size = o.maxSize;
    let lines = [];
    let fits = false;

    function measure() {
      ctx.font = o.weight + " " + size + "px " + o.family;
      lines = wrapCanvasText(ctx, prepared, width);

      fits =
        lines.every(line => ctx.measureText(line).width <= width) &&
        lines.length * size * o.lineHeight <= height;
    }

    for (; size >= o.minSize; size--) {
      measure();
      if (fits) break;
    }

    /*
     * Sicherheitsreserve für ungewöhnlich lange spätere Texte.
     * Bei den mitgelieferten Texten sollte sie nicht nötig sein.
     */
    if (!fits) {
      size = Math.max(1, o.minSize - 1);

      for (; size >= 1; size--) {
        measure();
        if (fits) break;
      }
    }

    size = Math.max(1, size);
    ctx.font = o.weight + " " + size + "px " + o.family;
    lines = wrapCanvasText(ctx, prepared, width);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    ctx.fillStyle = o.color;
    ctx.textAlign = o.align;
    ctx.textBaseline = "middle";

    const lineHeight = size * o.lineHeight;
    const textHeight = lines.length * lineHeight;

    const startY = o.vertical === "top"
      ? y + lineHeight / 2
      : y + (height - textHeight) / 2 + lineHeight / 2;

    const textX = o.align === "left"
      ? x
      : o.align === "right"
        ? x + width
        : x + width / 2;

    lines.forEach((line, index) => {
      ctx.fillText(line, textX, startY + index * lineHeight);
    });

    ctx.restore();

    return {
      size,
      lines: lines.length,
      height: textHeight
    };
  }

  /*
   * ============================================================
   * ALLGEMEINE TAFELN UND PODESTBESCHRIFTUNGEN
   * ============================================================
   */

  function textBoard(lines, background, color) {
    return image((ctx, w, h) => {
      ctx.fillStyle = background || "#f8faf8";
      ctx.fillRect(0, 0, w, h);

      if (!lines.length) return;

      const ink = color || "#304c3d";

      if (lines.length === 1) {
        fittedText(
          ctx, lines[0],
          54, 44, w - 108, h - 88,
          {maxSize: 100, color: ink}
        );
        return;
      }

      fittedText(
        ctx, lines[0],
        54, 30, w - 108, 128,
        {maxSize: 60, color: ink}
      );

      const bodyTop = 178;
      const bodyBottom = h - 38;
      const rowHeight = (bodyBottom - bodyTop) / (lines.length - 1);

      lines.slice(1).forEach((line, index) => {
        fittedText(
          ctx, line,
          58,
          bodyTop + index * rowHeight + 3,
          w - 116,
          rowHeight - 6,
          {
            maxSize: 36,
            weight: "normal",
            color: ink
          }
        );
      });
    });
  }

  const nameImages = new Map();

  function nameImage(title) {
    const key = "galerie-5-plaque:" + title;

    if (nameImages.has(key)) return nameImages.get(key);

    const src = image((ctx, w, h) => {
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "#e4ca83";
      ctx.lineWidth = 4;
      ctx.strokeRect(14, 14, w - 28, h - 28);

      fittedText(
        ctx, title,
        56, 42, w - 112, h - 84,
        {
          maxSize: 120,
          minSize: 18,
          lineHeight: 1.12,
          color: "#000000"
        }
      );
    }, 1024, 480);

    nameImages.set(key, src);
    return src;
  }

  /*
   * ============================================================
   * GERAHMTE FLÄCHEN
   * ============================================================
   */

  function panel(parent, position, rotation, width, height, src, roomId) {
    const group = create("a-entity", {position, rotation}, parent);

    box(
      group, 0, 0, -0.025,
      width + 0.12, height + 0.12, 0.08, "#c8d2cb"
    );

    const screen = create("a-plane", {
      position: "0 0 0.025",
      width,
      height,
      material: {
        shader: "flat",
        src,
        color: "#ffffff"
      }
    }, group);

    if (roomId) {
      screen.classList.add("vr-action");
      screen.dataset.roomId = roomId;
    }

    return group;
  }

  function frameLayer(parent, c, offset, thickness, depth, z, color) {
    const w = c.posterWidth;
    const h = c.posterHeight;

    gold(
      parent, 0, -(h / 2 + offset), z,
      w + 2 * offset + thickness, thickness, depth, color
    );

    gold(
      parent, 0, h / 2 + offset, z,
      w + 2 * offset + thickness, thickness, depth, color
    );

    gold(
      parent, -(w / 2 + offset), 0, z,
      thickness, h + 2 * offset, depth, color
    );

    gold(
      parent, w / 2 + offset, 0, z,
      thickness, h + 2 * offset, depth, color
    );
  }

  function framedPanel(
    parent, position, rotation, width, height, src, roomId, colors
  ) {
    const group = panel(
      parent, position, rotation, width, height, src, roomId
    );

    const c = {
      posterWidth: width,
      posterHeight: height
    };

    frameLayer(
      group, c, 0.045, 0.055, 0.08, 0.055, colors.gold
    );

    frameLayer(
      group, c, 0.105, 0.035, 0.06, 0.04, colors.goldLight
    );

    return group;
  }

  /*
   * ============================================================
   * EINTRITTSHINWEIS BEIM ANVISIEREN
   * ============================================================
   *
   * Verwendet die bereits berechneten Treffer der vorhandenen
   * fkc-controller-Komponenten.
   *
   * Kein zusätzlicher Raycaster, keine Änderung am Trigger.
   * Der Hinweis ist kein Interaktionsziel und keine a-plane.
   * Dadurch bleibt die Erkennung der Bedienungstafel durch
   * vorhandene Menüwrapper unbeeinflusst.
   */

  if (!AFRAME.components["fkc-gallery-entry-hint"]) {
    AFRAME.registerComponent("fkc-gallery-entry-hint", {
      init: function () {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 192;

        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#fffdf8";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "#c5a052";
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

        ctx.fillStyle = "#222222";
        ctx.font = "bold 68px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          "Mit Trigger betreten",
          canvas.width / 2,
          canvas.height / 2
        );

        this.texture = new THREE.CanvasTexture(canvas);

        if (
          "colorSpace" in this.texture &&
          THREE.SRGBColorSpace
        ) {
          this.texture.colorSpace = THREE.SRGBColorSpace;
        } else if (THREE.sRGBEncoding) {
          this.texture.encoding = THREE.sRGBEncoding;
        }

        this.geometry = new THREE.PlaneGeometry(1.05, 0.197);
        this.material = new THREE.MeshBasicMaterial({
          map: this.texture,
          side: THREE.DoubleSide,
          depthTest: true,
          depthWrite: false,
          toneMapped: false
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        this.mesh.visible = false;

        this.el.setObject3D("entry-hint", this.mesh);

        this.worldPosition = new V();
        this.cameraPosition = new V();
        this.towardCamera = new V();
        this.cameraQuaternion = new THREE.Quaternion();
        this.parentQuaternion = new THREE.Quaternion();
      },

      tick: function () {
        const scene = this.el.sceneEl;
        const camera = scene && scene.camera;

        this.mesh.visible = false;

        if (
          !scene ||
          !camera ||
          !scene.is("vr-mode") ||
          (F.Menu && F.Menu.opened)
        ) return;

        /*
         * Bei zwei gleichzeitig zielenden Händen hat rechts
         * Vorrang, damit nicht zwei Hinweise übereinander liegen.
         */
        const hands = Array.from(
          scene.querySelectorAll("[fkc-controller]")
        );

        hands.sort((a, b) => {
          const ca = a.components["fkc-controller"];
          const cb = b.components["fkc-controller"];

          const pa = ca && ca.data.hand === "right" ? 0 : 1;
          const pb = cb && cb.data.hand === "right" ? 0 : 1;

          return pa - pb;
        });

        let selectedHit = null;

        for (const hand of hands) {
          const tools = hand.components["fkc-controller"];
          const grabber = hand.components["fkc-grabber"];

          if (
            !tools ||
            !tools.source ||
            !tools.line ||
            !tools.line.visible ||
            (grabber && grabber.grabbed)
          ) continue;

          const hit = tools.hit;

          if (
            hit &&
            hit.type === "action" &&
            hit.el &&
            hit.el.isConnected &&
            hit.el.dataset.roomId &&
            hit.el.dataset.fkcMenu !== "true" &&
            hit.point
          ) {
            selectedHit = hit;
            break;
          }
        }

        if (!selectedHit) return;

        camera.getWorldPosition(this.cameraPosition);
        camera.getWorldQuaternion(this.cameraQuaternion);

        this.worldPosition.copy(selectedHit.point);

        this.towardCamera
          .copy(this.cameraPosition)
          .sub(this.worldPosition);

        const distance = this.towardCamera.length();

        if (distance < 0.05) return;

        this.towardCamera.multiplyScalar(1 / distance);

        /*
         * Etwas vor der Posteroberfläche und oberhalb des
         * Laserpunktes, ohne Z-Fighting mit dem Poster.
         */
        this.worldPosition.addScaledVector(
          this.towardCamera,
          Math.min(0.18, distance * 0.2)
        );

        this.worldPosition.y += 0.18;

        const parent = this.el.object3D.parent;

        if (!parent) return;

        parent.updateWorldMatrix(true, false);

        this.el.object3D.position.copy(this.worldPosition);
        parent.worldToLocal(this.el.object3D.position);

        parent.getWorldQuaternion(this.parentQuaternion);

        this.el.object3D.quaternion
          .copy(this.parentQuaternion)
          .invert()
          .multiply(this.cameraQuaternion);

        this.mesh.visible = true;
      },

      remove: function () {
        this.el.removeObject3D("entry-hint");

        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();
        if (this.texture) this.texture.dispose();
      }
    });
  }

  function addEntryHint(parent) {
    create("a-entity", {
      "fkc-gallery-entry-hint": ""
    }, parent);
  }

  /*
   * ============================================================
   * BILD VOLLSTÄNDIG UND UNVERZERRT EINPASSEN
   * ============================================================
   */

  if (!AFRAME.components["fkc-gallery-contained-image"]) {
    AFRAME.registerComponent("fkc-gallery-contained-image", {
      schema: {
        src: {type: "string", default: ""},
        width: {type: "number", default: 3.72},
        height: {type: "number", default: 2.55},
        background: {type: "color", default: "#fffdf8"}
      },

      init: function () {
        this.requestId = 0;
        this.imageElement = null;
      },

      update: function () {
        const data = this.data;
        const requestId = ++this.requestId;

        if (this.imageElement) {
          this.imageElement.onload = null;
          this.imageElement.onerror = null;
        }

        if (!data.src) return;

        const img = new Image();
        this.imageElement = img;
        img.crossOrigin = "anonymous";

        img.onload = () => {
          if (requestId !== this.requestId) return;

          try {
            const width = 2048;
            const height = Math.round(
              width * data.height / data.width
            );

            const src = image((ctx, w, h) => {
              ctx.fillStyle = data.background;
              ctx.fillRect(0, 0, w, h);

              const margin = 32;
              const availableW = w - margin * 2;
              const availableH = h - margin * 2;

              const scale = Math.min(
                availableW / img.naturalWidth,
                availableH / img.naturalHeight
              );

              const drawW = img.naturalWidth * scale;
              const drawH = img.naturalHeight * scale;

              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = "high";

              ctx.drawImage(
                img,
                (w - drawW) / 2,
                (h - drawH) / 2,
                drawW,
                drawH
              );
            }, width, height);

            this.el.setAttribute("material", "src", src);

            this.el.emit("fkc-gallery-image-ready", {
              src: data.src
            });
          } catch (error) {
            this.showError(data.src, error);
          }
        };

        img.onerror = () => {
          if (requestId !== this.requestId) return;

          this.showError(
            data.src,
            new Error("Bild konnte nicht geladen werden.")
          );
        };

        img.src = data.src;
      },

      showError: function (src, error) {
        console.error(
          "GALERIE-5: Poster konnte nicht geladen werden:",
          src,
          error
        );

        this.el.setAttribute("material", "src", textBoard([
          "Poster nicht geladen",
          "Bitte Dateipfad und Schreibweise prüfen:",
          src
        ], "#fffdf8", "#222222"));
      },

      remove: function () {
        this.requestId++;

        if (this.imageElement) {
          this.imageElement.onload = null;
          this.imageElement.onerror = null;
          this.imageElement = null;
        }
      }
    });
  }

  /*
   * ============================================================
   * BEGRÜSSUNGSMODELLE AUF DAS PODEST SETZEN
   * ============================================================
   */

  if (!AFRAME.components["fkc-gallery-seat-model"]) {
    AFRAME.registerComponent("fkc-gallery-seat-model", {
      schema: {
        top: {type: "number", default: WELCOME_PEDESTAL_TOP},
        gap: {type: "number", default: WELCOME_MODEL_GAP}
      },

      init: function () {
        this.finished = false;
        this.readyFrames = 0;
        this.bounds = new THREE.Box3();
        this.inverseParent = new THREE.Matrix4();
      },

      tick: function () {
        if (this.finished || !this.el.modelReady) return;

        this.readyFrames++;
        if (this.readyFrames < 3) return;

        const visual = this.el.querySelector(".model-visual");
        const parent = this.el.object3D.parent;

        if (!visual || !parent) return;
        if (!visual.getObject3D("mesh")) return;

        parent.updateWorldMatrix(true, true);

        this.bounds.setFromObject(visual.object3D);
        if (this.bounds.isEmpty()) return;

        this.inverseParent.copy(parent.matrixWorld).invert();
        this.bounds.applyMatrix4(this.inverseParent);

        const adjustment =
          this.data.top + this.data.gap - this.bounds.min.y;

        if (!Number.isFinite(adjustment)) return;

        const position = this.el.object3D.position.clone();
        position.y += adjustment;

        this.el.setAttribute("position", {
          x: position.x,
          y: position.y,
          z: position.z
        });

        if (this.el.homePosition) {
          this.el.homePosition.copy(position);
        }

        this.finished = true;
        this.el.emit("fkc-gallery-model-seated");
      }
    });
  }

  /*
   * ============================================================
   * NAVIGATION UND LICHT
   * ============================================================
   */

  function makeWalkable(config, obstacles) {
    return function (x, z) {
      if (
        Math.abs(x) > config.width / 2 - 0.45 ||
        Math.abs(z) > config.depth / 2 - 0.45
      ) return false;

      return !obstacles.some(obstacle => (
        Math.abs(x - obstacle.x) < obstacle.width / 2 + 0.28 &&
        Math.abs(z - obstacle.z) < obstacle.depth / 2 + 0.28
      ));
    };
  }

  function lighting(parent, museum) {
    create("a-entity", {
      light: {
        type: "ambient",
        color: museum ? "#fff7e6" : "#fffaf0",
        intensity: museum ? 0.7 : 0.8
      }
    }, parent);

    create("a-entity", {
      position: "-7 11 4",
      light: {
        type: "directional",
        color: "#fff4de",
        intensity: museum ? 0.65 : 0.7
      }
    }, parent);

    create("a-entity", {
      position: "8 10 -6",
      light: {
        type: "directional",
        color: museum ? "#e5f2f4" : "#ffffff",
        intensity: museum ? 0.4 : 0.35
      }
    }, parent);
  }

  /*
   * ============================================================
   * MODELLE
   * ============================================================
   */

  function makeModel(parent, s, index, c, position, placeholderColor) {
    const root = create("a-entity", {
      id: c.id + "-model-" + (index + 1),
      class: "interactable",
      position
    }, parent);

    root.dataset.title = s.title;
    root.homePosition = new V(position.x, position.y, position.z);
    root.modelReady = false;
    root.fkcInfo = s.info || "";
    root.fkcModelSize = c.modelSize;

    if (c.kind === "welcome" && s.presentationRotation) {
      root.setAttribute("rotation", s.presentationRotation);
    }

    const body = create("a-entity", {
      class: "manip-body"
    }, root);

    create("a-box", {
      class: "hitbox",
      width: c.modelSize + 0.06,
      height: c.modelSize + 0.06,
      depth: c.modelSize + 0.06,
      visible: false
    }, body);

    if (s.model) {
      const visual = create("a-entity", {
        class: "model-visual",
        "fkc-normalize": {
          targetSize: c.modelSize,
          padding: 0.06
        }
      }, body);

      visual.addEventListener("model-error", event => {
        console.error(
          "GALERIE-5: Modell konnte nicht geladen werden:",
          s.model,
          event.detail
        );
      });

      visual.setAttribute("gltf-model", "url(" + s.model + ")");
    } else {
      create("a-sphere", {
        class: "model-visual",
        radius: c.modelSize / 2,
        "segments-width": 20,
        "segments-height": 12,
        material: {
          color: placeholderColor || "#79aa98",
          roughness: 0.4,
          metalness: 0.12
        }
      }, body);

      root.modelReady = true;
    }

    root.setAttribute("fkc-manipulable", "");

    if (c.kind === "welcome") {
      root.setAttribute("fkc-gallery-seat-model", {
        top: WELCOME_PEDESTAL_TOP,
        gap: WELCOME_MODEL_GAP
      });
    }

    return root;
  }

  /*
   * ============================================================
   * BODENTEXTUREN
   * ============================================================
   */

  let parquetImage = null;
  let marbleImage = null;

  function parquet() {
    if (parquetImage) return parquetImage;

    parquetImage = image((ctx, w, h) => {
      let seed = 1234567;

      function random() {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      }

      const cell = 128;
      const plank = cell / 4;

      ctx.fillStyle = "#725037";
      ctx.fillRect(0, 0, w, h);

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const vertical = (row + col) % 2 === 0;

          for (let p = 0; p < 4; p++) {
            ctx.save();
            ctx.translate(col * cell, row * cell);

            if (vertical) {
              ctx.translate(cell, 0);
              ctx.rotate(Math.PI / 2);
            }

            const y = p * plank;
            const v = Math.floor(random() * 26);

            const gradient = ctx.createLinearGradient(
              0, y, 0, y + plank
            );

            gradient.addColorStop(
              0, `rgb(${169 + v},${115 + v},${65 + v})`
            );

            gradient.addColorStop(
              0.5, `rgb(${189 + v},${134 + v},${79 + v})`
            );

            gradient.addColorStop(
              1, `rgb(${153 + v},${101 + v},${55 + v})`
            );

            ctx.fillStyle = gradient;
            ctx.fillRect(1, y + 1, cell - 2, plank - 2);

            for (let g = 0; g < 16; g++) {
              const gy = y + 3 + random() * (plank - 6);

              ctx.strokeStyle = random() > 0.5
                ? "rgba(65,35,12,0.13)"
                : "rgba(255,222,165,0.16)";

              ctx.lineWidth = 0.5 + random();
              ctx.beginPath();
              ctx.moveTo(2, gy);

              ctx.bezierCurveTo(
                35, gy + random() * 3 - 1.5,
                85, gy + random() * 3 - 1.5,
                cell - 2, gy
              );

              ctx.stroke();
            }

            ctx.restore();
          }
        }
      }
    }, 1024, 1024);

    return parquetImage;
  }

  function marble() {
    if (marbleImage) return marbleImage;

    marbleImage = image((ctx, w, h) => {
      ctx.fillStyle = "#f4f1e9";
      ctx.fillRect(0, 0, w, h);

      let seed = 85271;

      function random() {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      }

      for (let i = 0; i < 45; i++) {
        const y = random() * h;

        ctx.strokeStyle = i % 4 === 0
          ? "rgba(177,158,115,0.13)"
          : "rgba(151,151,146,0.10)";

        ctx.lineWidth = 0.8 + random() * 2;
        ctx.beginPath();
        ctx.moveTo(-20, y);

        ctx.bezierCurveTo(
          w * 0.30, y + random() * 180 - 90,
          w * 0.65, y + random() * 180 - 90,
          w + 20, y + random() * 80 - 40
        );

        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(177,169,153,0.18)";
      ctx.lineWidth = 2;

      for (let i = 0; i <= 4; i++) {
        const p = i * w / 4;

        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, h);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(w, p);
        ctx.stroke();
      }
    }, 1024, 1024);

    return marbleImage;
  }

  /*
   * ============================================================
   * GOLDENES BODENDEKOR
   * ============================================================
   */

  function floorGoldLine(parent, x1, z1, x2, z2, width, color) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);

    const stripe = gold(
      parent,
      (x1 + x2) / 2,
      0.009,
      (z1 + z2) / 2,
      length,
      0.004,
      width,
      color
    );

    stripe.setAttribute("rotation", {
      x: 0,
      y: -Math.atan2(dz, dx) * 180 / Math.PI,
      z: 0
    });

    return stripe;
  }

  function floorDiamond(parent, c) {
    const group = create("a-entity", {
      id: "welcome-floor-diamond"
    }, parent);

    function outline(rx, rz, width, color) {
      const points = [
        {x: 0, z: -rz},
        {x: rx, z: 0},
        {x: 0, z: rz},
        {x: -rx, z: 0}
      ];

      points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];

        floorGoldLine(
          group,
          point.x, point.z,
          next.x, next.z,
          width, color
        );
      });
    }

    outline(2.6, 3.0, 0.065, c.colors.gold);
    outline(2.35, 2.71, 0.025, c.colors.goldLight);
    outline(1.02, 1.18, 0.035, c.colors.gold);

    const outer = [
      {x: 0, z: -2.71},
      {x: 2.35, z: 0},
      {x: 0, z: 2.71},
      {x: -2.35, z: 0}
    ];

    const inner = [
      {x: 0, z: -1.18},
      {x: 1.02, z: 0},
      {x: 0, z: 1.18},
      {x: -1.02, z: 0}
    ];

    outer.forEach((point, index) => {
      const target = inner[index];

      floorGoldLine(
        group,
        point.x, point.z,
        target.x, target.z,
        0.03, c.colors.gold
      );
    });
  }

  /*
   * ============================================================
   * BEGRÜSSUNGSRAUM: VORLESUNGSPOSTER
   * ============================================================
   */

  const welcomeCardImages = new Map();

  function welcomeCard(room) {
    const fullTitle = room.posterTitle || room.title;

    const description = room.posterDescription !== undefined
      ? room.posterDescription
      : lectureDescriptions[room.id] || "";

    const key = JSON.stringify([
      "galerie-5",
      fullTitle,
      description
    ]);

    if (welcomeCardImages.has(key)) {
      return welcomeCardImages.get(key);
    }

    const src = image((ctx, w, h) => {
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "#c5a052";
      ctx.lineWidth = 8;
      ctx.strokeRect(30, 30, w - 60, h - 60);

      ctx.strokeStyle = "#e3ce99";
      ctx.lineWidth = 3;
      ctx.strokeRect(46, 46, w - 92, h - 92);

      const match = fullTitle.match(
        /^(\d+\.\s*Vorlesung)\s*[-–]\s*(.+)$/i
      );

      if (match && description) {
        /*
         * Getrennte Bereiche:
         *
         * 1. Vorlesungsnummer
         * 2. Vorlesungsthema
         * 3. Kleinere Inhaltsbeschreibung
         *
         * Alle Texte bleiben innerhalb des Innenrahmens.
         */
        fittedText(
          ctx,
          match[1],
          105, 76, w - 210, 102,
          {
            maxSize: 76,
            minSize: 48,
            lineHeight: 1.12,
            color: "#222222"
          }
        );

        fittedText(
          ctx,
          match[2],
          105, 190, w - 210, 184,
          {
            maxSize: 68,
            minSize: 40,
            lineHeight: 1.13,
            color: "#222222"
          }
        );

        ctx.strokeStyle = "#c5a052";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(310, 398);
        ctx.lineTo(w - 310, 398);
        ctx.stroke();

        fittedText(
          ctx,
          description,
          110, 432, w - 220, h - 512,
          {
            maxSize: 46,
            minSize: 28,
            weight: "normal",
            lineHeight: 1.2,
            color: "#454035"
          }
        );
      } else if (description) {
        /*
         * Reserve für zusätzliche Räume mit Beschreibung,
         * aber ohne das Vorlesungsnummer-Muster.
         */
        fittedText(
          ctx,
          fullTitle,
          105, 90, w - 210, 260,
          {
            maxSize: 76,
            minSize: 40,
            lineHeight: 1.14,
            color: "#222222"
          }
        );

        ctx.strokeStyle = "#c5a052";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(310, 398);
        ctx.lineTo(w - 310, 398);
        ctx.stroke();

        fittedText(
          ctx,
          description,
          110, 432, w - 220, h - 512,
          {
            maxSize: 46,
            minSize: 28,
            weight: "normal",
            lineHeight: 1.2,
            color: "#454035"
          }
        );
      } else {
        /*
         * Teamräume: Titel ohne dauerhafte Triggeranweisung.
         */
        fittedText(
          ctx,
          fullTitle,
          105, 140, w - 210, h - 280,
          {
            maxSize: 92,
            minSize: 40,
            lineHeight: 1.16,
            color: "#222222"
          }
        );
      }
    }, 1536, 864);

    welcomeCardImages.set(key, src);
    return src;
  }

  /*
   * ============================================================
   * BEGRÜSSUNGSRAUM: WÄNDE UND DEKORATIVE RAHMEN
   * ============================================================
   */

  function decorativeWall(
    parent, c, position, rotation, length, centers, fieldWidth
  ) {
    const group = create("a-entity", {position, rotation}, parent);

    box(
      group, 0, c.height / 2, 0,
      length, c.height, 0.30, c.colors.wall
    );

    box(
      group, 0, 0.12, 0.20,
      length - 0.25, 0.24, 0.10, c.colors.creamDark
    );

    gold(
      group, 0, 0.26, 0.255,
      length - 0.25, 0.028, 0.025, c.colors.gold
    );

    box(
      group, 0, 0.70, 0.18,
      length - 0.25, 0.82, 0.055, c.colors.cream
    );

    gold(
      group, 0, 1.14, 0.23,
      length - 0.25, 0.025, 0.035, c.colors.gold
    );

    box(
      group, 0, c.height - 0.25, 0.23,
      length, 0.18, 0.22, c.colors.creamDark
    );

    box(
      group, 0, c.height - 0.10, 0.28,
      length, 0.12, 0.32, c.colors.cream
    );

    gold(
      group, 0, c.height - 0.38, 0.245,
      length - 0.10, 0.035, 0.055, c.colors.gold
    );

    /*
     * Zahlen erhalten die bisherige Standardgestaltung.
     * Objektangaben erlauben individuelle Rahmenmaße
     * für den Ablaufplan und seine Nachbarposter.
     */
    centers.forEach(item => {
      const field = typeof item === "number"
        ? {
          x: item,
          y: 2.95,
          width: fieldWidth,
          height: 3.35
        }
        : Object.assign({
          x: 0,
          y: 2.95,
          width: fieldWidth,
          height: 3.35
        }, item);

      const frame = create("a-entity", {
        position: {
          x: field.x,
          y: field.y,
          z: 0.19
        }
      }, group);

      const fc = {
        posterWidth: field.width,
        posterHeight: field.height
      };

      frameLayer(
        frame, fc, 0, 0.022, 0.025, 0.025, c.colors.gold
      );

      frameLayer(
        frame, fc, 0.055, 0.012, 0.018, 0.019,
        c.colors.goldLight
      );

      [-1, 1].forEach(sign => {
        create("a-sphere", {
          position: {
            x: 0,
            y: sign * (field.height / 2 + 0.015),
            z: 0.03
          },
          radius: 0.052,
          "segments-width": 8,
          "segments-height": 6,
          material: {
            color: c.colors.gold,
            metalness: 0.55,
            roughness: 0.36
          }
        }, frame);
      });
    });
  }

  function welcomeWalls(parent, c) {
    decorativeWall(
      parent, c,
      {x: -c.width / 2, y: 0, z: 0},
      "0 90 0",
      c.depth,
      [-4, 0, 4],
      3.45
    );

    decorativeWall(
      parent, c,
      {x: c.width / 2, y: 0, z: 0},
      "0 -90 0",
      c.depth,
      [-4, 0, 4],
      3.45
    );

    decorativeWall(
      parent, c,
      {x: 0, y: 0, z: -c.depth / 2},
      "0 0 0",
      c.width,
      [-6, -2, 2, 6],
      3.45
    );

    /*
     * Rückwand:
     *
     * Kleineres Wandfeld links und rechts.
     * Breites und höheres Wandfeld für den Ablaufplan.
     */
    decorativeWall(
      parent, c,
      {x: 0, y: 0, z: c.depth / 2},
      "0 180 0",
      c.width,
      [
        {
          x: -WELCOME_REAR.sideX,
          y: WELCOME_REAR.y,
          width: 2.95,
          height: 2.55
        },
        {
          x: 0,
          y: WELCOME_REAR.y,
          width: 5.7,
          height: 4.02
        },
        {
          x: WELCOME_REAR.sideX,
          y: WELCOME_REAR.y,
          width: 2.95,
          height: 2.55
        }
      ],
      4.1
    );
  }

  /*
   * ============================================================
   * BEGRÜSSUNGSRAUM: LEUCHTEN
   * ============================================================
   */

  function ring(parent, radius, tube, color, extra) {
    return create("a-torus", {
      radius,
      "radius-tubular": tube,
      "segments-radial": 8,
      "segments-tubular": 32,
      rotation: "90 0 0",
      material: Object.assign({
        color,
        metalness: 0.55,
        roughness: 0.36
      }, extra || {})
    }, parent);
  }

  function ceilingPendant(parent, c, z) {
    const group = create("a-entity", {
      position: {x: 0, y: c.height - 0.85, z}
    }, parent);

    gold(
      group, 0, 0.40, 0,
      0.045, 0.80, 0.045, c.colors.gold
    );

    const crown = create("a-entity", {
      position: "0 0.78 0"
    }, group);

    ring(crown, 0.25, 0.035, c.colors.gold);
    ring(group, 0.87, 0.045, c.colors.gold);

    const glow = create("a-entity", {
      position: "0 -0.035 0"
    }, group);

    ring(glow, 0.87, 0.025, "#fff4cf", {
      shader: "flat",
      metalness: 0
    });

    ring(group, 0.38, 0.025, c.colors.goldLight);

    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;

      const arm = create("a-entity", {
        rotation: {x: 0, y: i * 60, z: 0}
      }, group);

      gold(
        arm, 0, 0, 0.43,
        0.024, 0.025, 0.86, c.colors.gold
      );

      create("a-cylinder", {
        position: {
          x: Math.sin(angle) * 0.87,
          y: 0.11,
          z: Math.cos(angle) * 0.87
        },
        radius: 0.09,
        height: 0.20,
        "segments-radial": 12,
        material: {
          color: "#fffdf8",
          roughness: 0.45,
          emissive: "#fff0ce",
          emissiveIntensity: 0.25
        }
      }, group);
    }
  }

  function welcomeSconce(parent, position, rotation, c) {
    const group = create("a-entity", {position, rotation}, parent);

    gold(
      group, 0, 0, 0,
      0.18, 0.32, 0.045, c.colors.gold
    );

    gold(
      group, 0, -0.03, 0.13,
      0.035, 0.035, 0.26, c.colors.gold
    );

    create("a-cylinder", {
      position: "0 0.14 0.25",
      radius: 0.115,
      height: 0.25,
      "segments-radial": 12,
      material: {
        color: "#fffdf8",
        roughness: 0.5,
        emissive: "#fff1cc",
        emissiveIntensity: 0.35
      }
    }, group);

    gold(
      group, 0, 0.275, 0.25,
      0.24, 0.022, 0.24, c.colors.goldLight
    );
  }

  /*
   * ============================================================
   * BEGRÜSSUNGSPODESTE
   * ============================================================
   */

  function welcomePedestal(parent, exhibit, p, c) {
    const group = create("a-entity", {
      position: {x: p.model.x, y: 0, z: p.model.z},
      rotation: p.rotation
    }, parent);

    gold(
      group, 0, 0.065, 0,
      1.0, 0.13, 1.0, c.colors.goldDark
    );

    gold(
      group, 0, 0.145, 0,
      0.96, 0.035, 0.96, c.colors.goldLight
    );

    box(
      group, 0, 0.52, 0,
      0.84, 0.72, 0.84, c.colors.cream,
      {roughness: 0.36}
    );

    [0, 90, 180, 270].forEach(angle => {
      const side = create("a-entity", {
        rotation: {x: 0, y: angle, z: 0}
      }, group);

      gold(
        side, -0.35, 0.52, 0.425,
        0.015, 0.61, 0.018, c.colors.gold
      );

      gold(
        side, 0.35, 0.52, 0.425,
        0.015, 0.61, 0.018, c.colors.gold
      );

      gold(
        side, 0, 0.215, 0.425,
        0.71, 0.015, 0.018, c.colors.gold
      );

      gold(
        side, 0, 0.825, 0.425,
        0.71, 0.015, 0.018, c.colors.gold
      );
    });

    gold(
      group, 0, 0.895, 0,
      0.94, 0.045, 0.94, c.colors.gold
    );

    box(
      group, 0, 0.94, 0,
      1.0, 0.045, 1.0, "#fffdf8",
      {roughness: 0.3}
    );

    /*
     * Die Tafel bleibt innerhalb des goldenen Podestrahmens.
     * plaqueText enthält die vorbereiteten Trennstellen.
     */
    create("a-plane", {
      position: "0 0.52 0.445",
      width: 0.64,
      height: 0.30,
      material: {
        shader: "flat",
        color: "#ffffff",
        src: nameImage(exhibit.plaqueText || exhibit.title)
      }
    }, group);
  }

  function welcomePlacements(c) {
    const result = [];

    [4, 0, -4].forEach(z => {
      result.push({
        poster: {
          x: -c.width / 2 + 0.28,
          y: c.posterY,
          z
        },
        model: {
          x: -c.width / 2 + c.modelDistance,
          y: c.modelY,
          z
        },
        rotation: "0 90 0"
      });
    });

    [-6, -2, 2, 6].forEach(x => {
      result.push({
        poster: {
          x,
          y: c.posterY,
          z: -c.depth / 2 + 0.28
        },
        model: {
          x,
          y: c.modelY,
          z: -c.depth / 2 + c.modelDistance
        },
        rotation: "0 0 0"
      });
    });

    [-4, 0, 4].forEach(z => {
      result.push({
        poster: {
          x: c.width / 2 - 0.28,
          y: c.posterY,
          z
        },
        model: {
          x: c.width / 2 - c.modelDistance,
          y: c.modelY,
          z
        },
        rotation: "0 -90 0"
      });
    });

    return result;
  }

  function buildWelcome(parent, c, rooms) {
    const obstacles = [];

    /*
     * Wichtig für bestehende Menüwrapper:
     * Die erste nicht bedienbare a-plane bleibt die
     * Bedienungstafel.
     */
    framedPanel(
      parent,
      {
        x: WELCOME_REAR.sideX,
        y: WELCOME_REAR.y,
        z: c.depth / 2 - 0.28
      },
      "0 180 0",
      WELCOME_REAR.sideWidth,
      WELCOME_REAR.sideHeight,
      textBoard([
        "Bedienung",
        "Links: laufen · Rechts: drehen",
        "Grip: greifen · 2 Hände: skalieren",
        "Trigger: Oberflächen bemalen",
        "Laserfarbe = Malfarbe",
        "B/Y: Menü · Größen & Komfort"
      ], "#fffdf8", "#222222"),
      null,
      c.colors
    );

    framedPanel(
      parent,
      {
        x: -WELCOME_REAR.sideX,
        y: WELCOME_REAR.y,
        z: c.depth / 2 - 0.28
      },
      "0 180 0",
      WELCOME_REAR.sideWidth,
      WELCOME_REAR.sideHeight,
      textBoard([
        "Willkommen",
        "Festkörperchemie · Universität Potsdam",
        "8 Räume für die Vorlesung",
        "2 Räume für die Teamarbeit",
        "Raumtafeln mit Trigger auswählen",
        "Mehrspielerbetrieb folgt später"
      ], "#fffdf8", "#222222"),
      null,
      c.colors
    );

    /*
     * Ablaufplan:
     *
     * Bildfläche ungefähr 5.26 × 3.61 m.
     * Doppelte Fläche gegenüber der bisherigen Version.
     * Das Seitenverhältnis bleibt unverändert.
     */
    const posterWidth = WELCOME_REAR.planWidth;
    const posterHeight = WELCOME_REAR.planHeight;

    const poster = framedPanel(
      parent,
      {
        x: 0,
        y: WELCOME_REAR.y,
        z: c.depth / 2 - 0.28
      },
      "0 180 0",
      posterWidth,
      posterHeight,
      image((ctx, w, h) => {
        ctx.fillStyle = "#fffdf8";
        ctx.fillRect(0, 0, w, h);
      }),
      null,
      c.colors
    );

    poster.id = "welcome-ablauf-poster";

    const posterScreen = poster.querySelector("a-plane");

    posterScreen.setAttribute("fkc-gallery-contained-image", {
      src: c.welcomePoster || "assets/Bilder/Ablauf.jpg",
      width: posterWidth,
      height: posterHeight,
      background: "#fffdf8"
    });

    box(
      parent, 0, -0.08, 0,
      c.width, 0.16, c.depth, "#eee9de"
    );

    box(
      parent, 0, 0.003, 0,
      c.width - 0.30, 0.006, c.depth - 0.30, "#ffffff",
      {
        src: marble(),
        repeat: "2 2",
        roughness: 0.46,
        metalness: 0.03
      }
    );

    [-1, 1].forEach(sign => {
      gold(
        parent, 0, 0.008, sign * (c.depth / 2 - 0.53),
        c.width - 0.9, 0.008, 0.025, c.colors.gold
      );

      gold(
        parent, sign * (c.width / 2 - 0.53), 0.008, 0,
        0.025, 0.008, c.depth - 0.9, c.colors.gold
      );
    });

    floorDiamond(parent, c);
    welcomeWalls(parent, c);

    box(
      parent, 0, c.height + 0.08, 0,
      c.width, 0.16, c.depth, c.colors.cream
    );

    trim(
      parent, c.width - 1.5, c.depth - 1.5,
      c.height - 0.035, 0.06, 0.045, c.colors.goldLight
    );

    trim(
      parent, c.width - 1.8, c.depth - 1.8,
      c.height - 0.04, 0.025, 0.045, c.colors.gold
    );

    ceilingPendant(parent, c, -3);
    ceilingPendant(parent, c, 3);

    lighting(parent, false);

    const placements = welcomePlacements(c);

    rooms.slice(0, placements.length).forEach((room, index) => {
      const configured = (c.exhibits || []).find(
        exhibit => exhibit.roomId === room.id
      );

      const exhibit = configured || {
        roomId: room.id,
        title: room.title,
        model: ""
      };

      const p = placements[index];

      framedPanel(
        parent,
        p.poster,
        p.rotation,
        c.posterWidth,
        c.posterHeight,
        welcomeCard(room),
        room.id,
        c.colors
      );

      welcomePedestal(parent, exhibit, p, c);

      obstacles.push({
        x: p.model.x,
        z: p.model.z,
        width: 1.0,
        depth: 1.0
      });

      const modelData = Object.assign({}, exhibit, {
        presentationRotation:
          exhibit.presentationRotation || p.rotation,

        info: exhibit.info || (
          exhibit.model
            ? "Vorschau für " + room.title + ": " + exhibit.title
            : exhibit.title + "\n\n" +
              "Vorschau für " + room.title + ".\n" +
              "Die Kugel ist ein neutraler Platzhalter."
        )
      });

      makeModel(
        parent, modelData, index, c, p.model, "#ded7c3"
      );

      welcomeSconce(
        parent,
        {
          x: p.poster.x,
          y: 4.22,
          z: p.poster.z
        },
        p.rotation,
        c
      );
    });

    return {
      spawn: c.spawn,
      isWalkable: makeWalkable(c, obstacles)
    };
  }

  /*
   * ============================================================
   * MUSEUMSRÄUME — BESTEHENDE GESTALTUNG
   * ============================================================
   */

  function trim(parent, width, depth, y, thickness, height, color) {
    box(
      parent, 0, y, -depth / 2,
      width + thickness, height, thickness, color
    );

    box(
      parent, 0, y, depth / 2,
      width + thickness, height, thickness, color
    );

    box(
      parent, -width / 2, y, 0,
      thickness, height, depth, color
    );

    box(
      parent, width / 2, y, 0,
      thickness, height, depth, color
    );
  }

  function museumWalls(parent, c) {
    const walls = [
      {
        position: {x: -c.width / 2, y: 0, z: 0},
        rotation: "0 90 0",
        length: c.depth
      },
      {
        position: {x: c.width / 2, y: 0, z: 0},
        rotation: "0 -90 0",
        length: c.depth
      },
      {
        position: {x: 0, y: 0, z: -c.depth / 2},
        rotation: "0 0 0",
        length: c.width
      },
      {
        position: {x: 0, y: 0, z: c.depth / 2},
        rotation: "0 180 0",
        length: c.width
      }
    ];

    walls.forEach(wall => {
      const group = create("a-entity", {
        position: wall.position,
        rotation: wall.rotation
      }, parent);

      box(
        group, 0, c.height / 2, 0,
        wall.length, c.height, 0.3, c.colors.wall
      );

      box(
        group, 0, 0.36, 0.17,
        wall.length - 0.3, 0.72, 0.07, c.colors.creamDark
      );

      box(
        group, 0, 0.075, 0.22,
        wall.length - 0.3, 0.15, 0.11, c.colors.cream
      );

      box(
        group, 0, 0.74, 0.23,
        wall.length - 0.3, 0.065, 0.13, c.colors.cream
      );

      gold(
        group, 0, 0.795, 0.205,
        wall.length - 0.3, 0.025, 0.055, c.colors.goldDark
      );

      box(
        group, 0, c.height - 0.52, 0.20,
        wall.length, 0.12, 0.14, c.colors.creamDark
      );

      box(
        group, 0, c.height - 0.37, 0.25,
        wall.length, 0.16, 0.24, c.colors.cream
      );

      box(
        group, 0, c.height - 0.20, 0.31,
        wall.length, 0.12, 0.36, c.colors.cream
      );

      gold(
        group, 0, c.height - 0.59, 0.20,
        wall.length - 0.1, 0.023, 0.045, c.colors.goldLight
      );
    });
  }

  function lamp(parent, x, y, z, tiltX, tiltZ) {
    const group = create("a-entity", {
      position: {x, y, z}
    }, parent);

    box(
      group, 0, 0.08, 0,
      0.035, 0.2, 0.035, "#343d38"
    );

    const head = create("a-entity", {
      rotation: {x: tiltX, y: 0, z: tiltZ}
    }, group);

    create("a-cylinder", {
      radius: 0.095,
      height: 0.22,
      "segments-radial": 12,
      material: {
        color: "#343d38",
        metalness: 0.35,
        roughness: 0.5
      }
    }, head);

    create("a-cylinder", {
      position: "0 -0.115 0",
      radius: 0.077,
      height: 0.012,
      "segments-radial": 12,
      material: {
        shader: "flat",
        color: "#fff0bf"
      }
    }, head);
  }

  function museumCeiling(parent, c) {
    box(
      parent, 0, c.height + 0.08, 0,
      c.width + 0.3, 0.16, c.depth + 0.3, c.colors.cream
    );

    trim(
      parent, c.width - 2.4, c.depth - 2.4,
      c.height - 0.10, 0.12, 0.10, c.colors.creamDark
    );

    trim(
      parent, c.width - 2.8, c.depth - 2.8,
      c.height - 0.12, 0.055, 0.065, c.colors.cream
    );

    box(
      parent, 0, c.height - 0.045, 0,
      9.2, 0.035, 6.2, "#d3e8ec",
      {shader: "flat"}
    );

    trim(
      parent, 9.5, 6.5,
      c.height - 0.11, 0.20, 0.18, c.colors.creamDark
    );

    trim(
      parent, 9.85, 6.85,
      c.height - 0.17, 0.14, 0.12, c.colors.cream
    );

    trim(
      parent, 10.1, 7.1,
      c.height - 0.21, 0.055, 0.06, c.colors.goldLight
    );

    [-3, -1.5, 0, 1.5, 3].forEach(x => {
      box(
        parent, x, c.height - 0.08, 0,
        0.055, 0.06, 6.2, c.colors.cream
      );
    });

    [-1.55, 0, 1.55].forEach(z => {
      box(
        parent, 0, c.height - 0.08, z,
        9.2, 0.06, 0.055, c.colors.cream
      );
    });

    [-10.3, 10.3].forEach(x => {
      box(
        parent, x, c.height - 0.65, 0,
        0.07, 0.065, c.depth - 3, "#343d38"
      );

      [-8.1, -2.7, 2.7, 8.1].forEach(z => {
        lamp(
          parent, x, c.height - 0.83, z,
          0, x < 0 ? -55 : 55
        );
      });
    });

    [-6.6, 6.6].forEach(z => {
      box(
        parent, 0, c.height - 0.65, z,
        c.width - 5, 0.065, 0.07, "#343d38"
      );

      [-11, -3.7, 3.7, 11].forEach(x => {
        lamp(
          parent, x, c.height - 0.83, z,
          z < 0 ? 55 : -55, 0
        );
      });
    });
  }

  function museumDoor(parent, c) {
    const door = create("a-entity", {
      position: {
        x: 0,
        y: 0,
        z: -c.depth / 2 + 0.24
      }
    }, parent);

    box(
      door, 0, 1.45, 0,
      2.35, 2.9, 0.12, "#795238"
    );

    [-0.58, 0.58].forEach(x => {
      [0.73, 2.08].forEach(y => {
        box(
          door, x, y, 0.073,
          0.91, 1.06, 0.035, "#684530"
        );

        gold(
          door, x, y - 0.54, 0.098,
          0.96, 0.025, 0.018
        );

        gold(
          door, x, y + 0.54, 0.098,
          0.96, 0.025, 0.018
        );

        gold(
          door, x - 0.47, y, 0.098,
          0.025, 1.08, 0.018
        );

        gold(
          door, x + 0.47, y, 0.098,
          0.025, 1.08, 0.018
        );
      });
    });

    [-1.27, 1.27].forEach(x => {
      box(
        door, x, 1.5, 0.04,
        0.17, 3, 0.20, c.colors.cream
      );

      gold(
        door, x, 1.5, 0.15,
        0.032, 2.98, 0.025
      );
    });

    box(
      door, 0, 3.03, 0.04,
      2.72, 0.18, 0.2, c.colors.cream
    );

    box(
      door, 0, 3.17, 0.04,
      2.9, 0.1, 0.27, c.colors.creamDark
    );

    /*
     * Auch am Rückweg kein dauerhaft aufgedruckter
     * Laser-/Triggerhinweis mehr.
     */
    panel(
      door,
      {x: 0, y: 1.75, z: 0.17},
      "0 0 0",
      1.8,
      1.8 * 9 / 16,
      textBoard([
        "Zurück",
        "zum Begrüßungsraum"
      ], "#eee7d5"),
      "welcome"
    );

    panel(
      door,
      {x: 0, y: 3.65, z: 0.10},
      "0 0 0",
      2.8,
      2.8 * 9 / 16,
      textBoard([c.title, "FKC-VR"], "#eee7d5"),
      null
    );
  }

  function placement(s, c) {
    const inset = 0.205;

    if (s.wall === "left") {
      return {
        poster: {
          x: -c.width / 2 + inset,
          y: c.posterY,
          z: s.along
        },
        model: {
          x: -c.width / 2 + c.modelDistance,
          y: c.modelY,
          z: s.along
        },
        rotation: "0 90 0"
      };
    }

    if (s.wall === "right") {
      return {
        poster: {
          x: c.width / 2 - inset,
          y: c.posterY,
          z: s.along
        },
        model: {
          x: c.width / 2 - c.modelDistance,
          y: c.modelY,
          z: s.along
        },
        rotation: "0 -90 0"
      };
    }

    if (s.wall === "front") {
      return {
        poster: {
          x: s.along,
          y: c.posterY,
          z: -c.depth / 2 + inset
        },
        model: {
          x: s.along,
          y: c.modelY,
          z: -c.depth / 2 + c.modelDistance
        },
        rotation: "0 0 0"
      };
    }

    return {
      poster: {
        x: s.along,
        y: c.posterY,
        z: c.depth / 2 - inset
      },
      model: {
        x: s.along,
        y: c.modelY,
        z: c.depth / 2 - c.modelDistance
      },
      rotation: "0 180 0"
    };
  }

  function pedestal(parent, s, p, c) {
    const group = create("a-entity", {
      position: {x: p.model.x, y: 0, z: p.model.z},
      rotation: p.rotation
    }, parent);

    gold(
      group, 0, 0.065, 0,
      0.9, 0.13, 0.9, c.colors.goldDark
    );

    gold(
      group, 0, 0.145, 0,
      0.85, 0.04, 0.85, c.colors.goldLight
    );

    box(
      group, 0, 0.50, 0,
      0.76, 0.68, 0.76, c.colors.cream
    );

    [0, 90, 180, 270].forEach(angle => {
      const side = create("a-entity", {
        rotation: {x: 0, y: angle, z: 0}
      }, group);

      box(
        side, 0, 0.50, 0.385,
        0.58, 0.47, 0.012, "#e4dcc8"
      );

      gold(
        side, -0.3, 0.50, 0.398,
        0.015, 0.49, 0.015
      );

      gold(
        side, 0.3, 0.50, 0.398,
        0.015, 0.49, 0.015
      );

      gold(
        side, 0, 0.255, 0.398,
        0.61, 0.015, 0.015
      );

      gold(
        side, 0, 0.745, 0.398,
        0.61, 0.015, 0.015
      );
    });

    gold(
      group, 0, 0.855, 0,
      0.84, 0.055, 0.84, c.colors.gold
    );

    box(
      group, 0, 0.9, 0,
      0.9, 0.04, 0.9, "#33463e",
      {roughness: 0.4}
    );

    create("a-plane", {
      position: "0 0.63 0.414",
      width: 0.54,
      height: 0.17,
      material: {
        shader: "flat",
        src: textBoard([s.title], "#75531e", "#f5e6bc")
      }
    }, group);
  }

  function station(parent, s, index, c, obstacles) {
    const p = placement(s, c);

    const frame = create("a-entity", {
      position: p.poster,
      rotation: p.rotation
    }, parent);

    box(
      frame, 0, 0, 0,
      c.posterWidth + 0.36,
      c.posterHeight + 0.36,
      0.055,
      c.colors.goldDark
    );

    create("a-plane", {
      position: "0 0 0.04",
      width: c.posterWidth,
      height: c.posterHeight,
      material: {
        shader: "flat",
        color: "#ffffff",
        src: s.slide || textBoard([
          s.title,
          "Vorlesungsfolie 16:9",
          "Hier kann eine eigene Folie erscheinen"
        ], "#fbf8ee")
      }
    }, frame);

    frameLayer(
      frame, c, 0.025, 0.045, 0.075, 0.065,
      c.colors.goldLight
    );

    frameLayer(
      frame, c, 0.075, 0.07, 0.095, 0.063,
      c.colors.gold
    );

    frameLayer(
      frame, c, 0.13, 0.04, 0.065, 0.04,
      c.colors.goldDark
    );

    frameLayer(
      frame, c, 0.165, 0.045, 0.075, 0.06,
      c.colors.goldLight
    );

    pedestal(parent, s, p, c);

    obstacles.push({
      x: p.model.x,
      z: p.model.z,
      width: 0.9,
      depth: 0.9
    });

    makeModel(
      parent, s, index, c, p.model, "#79aa98"
    );
  }

  function buildMuseum(parent, c) {
    const obstacles = [];

    box(
      parent, 0, -0.08, 0,
      c.width, 0.16, c.depth, "#84603c"
    );

    create("a-plane", {
      position: "0 0.004 0",
      rotation: "-90 0 0",
      width: c.width,
      height: c.depth,
      material: {
        src: parquet(),
        repeat: "8 5.6675",
        color: "#ffffff",
        roughness: 0.65,
        metalness: 0.02
      }
    }, parent);

    [-1, 1].forEach(sign => {
      box(
        parent, 0, 0.009, sign * (c.depth / 2 - 0.29),
        c.width - 0.3, 0.009, 0.35, "#775137"
      );

      box(
        parent, sign * (c.width / 2 - 0.29), 0.009, 0,
        0.35, 0.009, c.depth - 0.3, "#775137"
      );
    });

    museumWalls(parent, c);
    museumCeiling(parent, c);
    museumDoor(parent, c);
    lighting(parent, true);

    c.stations.forEach((s, index) => {
      station(parent, s, index, c, obstacles);
    });

    return {
      spawn: c.spawn,
      isWalkable: makeWalkable(c, obstacles)
    };
  }

  /*
   * ============================================================
   * ÖFFENTLICHE BUILDER-SCHNITTSTELLE
   * ============================================================
   */

  F.RoomBuilder = {
    build: function (parent, config, rooms) {
      const result = config.kind === "welcome"
        ? buildWelcome(parent, config, rooms)
        : buildMuseum(parent, config);

      /*
       * Der Hinweis wird zuletzt ergänzt und beim Raumwechsel
       * gemeinsam mit den übrigen Rauminhalten entfernt.
       */
      addEntryHint(parent);

      return result;
    }
  };
})(window.FKCVR);
