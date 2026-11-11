"use strict";

(function (F) {
  /*
   * ============================================================
   * ZENTRALE RAUMDATEN — GALERIE-3
   * ============================================================
   *
   * Neue Begrüßungsmodelle: assets/model/
   * Bestehende Vorlesungsmodelle: assets/models/
   *
   * Die unterschiedlichen Ordnernamen sind beabsichtigt.
   * Groß-/Kleinschreibung der Dateinamen beachten.
   */

  const museumColors = {
    wall: "#a7c1aa",
    cream: "#eee7d5",
    creamDark: "#d5ceba",
    gold: "#b38b39",
    goldLight: "#e2c777",
    goldDark: "#75531e"
  };

  const stationPositions = [
    {wall: "left", along: -8.1},
    {wall: "left", along: -2.7},
    {wall: "left", along: 2.7},
    {wall: "left", along: 8.1},

    {wall: "right", along: -8.1},
    {wall: "right", along: -2.7},
    {wall: "right", along: 2.7},
    {wall: "right", along: 8.1},

    {wall: "back", along: -11},
    {wall: "back", along: -3.7},
    {wall: "back", along: 3.7},
    {wall: "back", along: 11},

    {wall: "front", along: -11},
    {wall: "front", along: -5.4},
    {wall: "front", along: 5.4},
    {wall: "front", along: 11}
  ];

  function emptyStations() {
    return stationPositions.map((position, index) => ({
      wall: position.wall,
      along: position.along,
      title: "Station " + String(index + 1).padStart(2, "0"),
      slide: "",
      model: ""
    }));
  }

  function museumRoom(id, title, posterTitle) {
    return {
      id,
      title,
      posterTitle,
      kind: "museum",

      width: 32,
      depth: 22.67,
      height: 7,

      spawn: {x: 0, z: 6},

      posterWidth: 4.8,
      posterHeight: 2.7,
      posterY: 3.25,

      modelY: 1.35,
      modelDistance: 2.7,
      modelSize: 0.5,

      colors: Object.assign({}, museumColors),
      stations: emptyStations()
    };
  }

  /*
   * ============================================================
   * BEGRÜSSUNGSRAUM
   * ============================================================
   *
   * welcomePoster:
   *   Bild an der bisherigen Position der mittleren FKC-VR-Tafel.
   *
   * exhibits:
   *   roomId = Ziel der Raumtafel
   *   title = Beschriftung am Podest und Name im Modellmenü
   *   model = GLB-Pfad
   *   info = Beschreibung im vorhandenen Modellmenü
   */

  F.welcomeRoom = {
    id: "welcome",
    title: "Begrüßungsraum",
    kind: "welcome",

    width: 18,
    depth: 16,
    height: 5.2,

    spawn: {x: 0, z: 5},

    posterWidth: 3,
    posterHeight: 1.6875,
    posterY: 2.95,

    modelY: 1.48,
    modelSize: 0.65,
    modelDistance: 1.85,

    welcomePoster: "assets/Bilder/Ablauf.jpg",

    colors: {
      wall: "#fffdf8",
      cream: "#fffdf9",
      creamDark: "#eee9de",
      gold: "#c5a052",
      goldLight: "#e4ca83",
      goldDark: "#8d6c2e"
    },

    exhibits: [
      {
        roomId: "vorlesung-1",
        title: "C₆₀-Buckminsterfulleren",
        model: "assets/model/C60-Fulleren.glb",
        info:
          "Vorschau für Vorlesung 1.\n\n" +
          "C₆₀-Buckminsterfulleren: ein Molekül aus 60 " +
          "Kohlenstoffatomen."
      },
      {
        roomId: "vorlesung-2",
        title: "Wasserstoffbrücken in Eis",
        model: "assets/model/Eis2.glb",
        info:
          "Vorschau für Vorlesung 2.\n\n" +
          "Wasserstoffbrücken zwischen Wassermolekülen in Eis."
      },
      {
        roomId: "vorlesung-3",
        title: "YBa₂Cu₃O₇₋ₓ – Hochtemperatursupraleiter",
        model: "assets/model/YBa2Cu3O7-x.glb",
        info:
          "Vorschau für Vorlesung 3.\n\n" +
          "YBa₂Cu₃O₇₋ₓ – Hochtemperatursupraleiter. " +
          "Der Sauerstoffgehalt beeinflusst die Eigenschaften."
      },
      {
        roomId: "vorlesung-4",
        title: "Tetragonal innenzentriertes Bravaisgitter",
        model: "assets/model/Tetragonal-I.glb",
        info:
          "Vorschau für Vorlesung 4.\n\n" +
          "Tetragonal innenzentriertes Bravaisgitter, tI.\n" +
          "a = b ≠ c; α = β = γ = 90°.\n" +
          "Zwei Gitterpunkte pro konventioneller Elementarzelle."
      },
      {
        roomId: "vorlesung-5",
        title: "Beugung am Einkristall",
        model: "assets/model/Roentgenbeugung.glb",
        info:
          "Vorschau für Vorlesung 5.\n\n" +
          "Schematischer Röntgenbeugungsversuch mit Kristall, " +
          "Primärstrahl, gebeugten Strahlen und Detektor.\n\n" +
          "Die dargestellten Reflexpositionen sind illustrativ."
      },
      {
        roomId: "vorlesung-6",
        title: "Kupfer – kubisch dichteste Packung",
        model: "assets/model/Cu.glb",
        info:
          "Vorschau für Vorlesung 6.\n\n" +
          "Kupfer – kubisch dichteste Packung, " +
          "kubisch flächenzentrierte Struktur."
      },
      {
        roomId: "vorlesung-7",
        title: "Zinkblende",
        model: "assets/model/ZnS.glb",
        info:
          "Vorschau für Vorlesung 7.\n\n" +
          "Zinkblende: ZnS mit tetraedrischer Koordination " +
          "beider Ionensorten."
      },
      {
        roomId: "vorlesung-8",
        title: "S₈-Molekül in elementarem Schwefel",
        model: "assets/model/S8.glb",
        info:
          "Vorschau für Vorlesung 8.\n\n" +
          "S₈-Molekül in elementarem Schwefel."
      },
      {
        roomId: "team-a",
        title: "Metallorganische Gerüstverbindung HKUST-1",
        model: "assets/model/HKUST-1_Pores.glb",
        info:
          "Vorschau für Team A.\n\n" +
          "Metallorganische Gerüstverbindung HKUST-1 " +
          "mit einer porösen Gerüststruktur."
      },
      {
        roomId: "team-b",
        title: "Cobalt-Komplex aus einer Einkristall-Umwandlung",
        model: "assets/model/Co-Komplex.glb",
        info:
          "Vorschau für Team B.\n\n" +
          "Cobalt-Komplex aus einer Einkristall-Umwandlung."
      }
    ]
  };

  F.rooms = [
    museumRoom(
      "vorlesung-1",
      "Vorlesung 1",
      "1. Vorlesung - Allgemeines zur Festkörperchemie"
    ),
    museumRoom(
      "vorlesung-2",
      "Vorlesung 2",
      "2. Vorlesung - Bindungsarten im Festkörper"
    ),
    museumRoom(
      "vorlesung-3",
      "Vorlesung 3",
      "3. Vorlesung - Synthese von Festkörper-Verbindungen"
    ),
    museumRoom(
      "vorlesung-4",
      "Vorlesung 4",
      "4. Vorlesung - Kristallographie und Symmetrie in Kristallen"
    ),
    museumRoom(
      "vorlesung-5",
      "Vorlesung 5",
      "5. Vorlesung - Röntgenstrukturanalyse"
    ),
    museumRoom(
      "vorlesung-6",
      "Vorlesung 6",
      "6. Vorlesung - Metallstrukturen"
    ),
    museumRoom(
      "vorlesung-7",
      "Vorlesung 7",
      "7. Vorlesung - Ionengitter"
    ),
    museumRoom(
      "vorlesung-8",
      "Vorlesung 8",
      "8. Vorlesung - Molekülstrukturen"
    ),
    museumRoom(
      "team-a",
      "Team A",
      "Praktikumsraum Team A"
    ),
    museumRoom(
      "team-b",
      "Team B",
      "Praktikumsraum Team B"
    )
  ];

  const room = id => F.rooms.find(item => item.id === id);

  /*
   * ============================================================
   * VORLESUNG 1: BESTEHENDE MODELLE — UNVERÄNDERT
   * ============================================================
   */

  const v1 = room("vorlesung-1");

  Object.assign(v1.stations[0], {
    title: "Diamant",
    model: "assets/models/Diamant.glb",
    slide: ""
  });

  Object.assign(v1.stations[1], {
    title: "Graphit",
    model: "assets/models/Graphit.glb",
    slide: ""
  });

  Object.assign(v1.stations[4], {
    title: "Eis",
    model: "assets/models/Eis2.glb",
    slide: ""
  });

  Object.assign(v1.stations[5], {
    title: "MgCl2",
    model: "assets/models/MgCl2.glb",
    slide: ""
  });

  Object.assign(v1.stations[8], {
    title: "Imidazol",
    model: "assets/models/Imidazol.glb",
    slide: ""
  });

  Object.assign(v1.stations[11], {
    title: "BODIPY",
    model: "assets/models/BODIPY.glb",
    slide: ""
  });
})(window.FKCVR);
