"use strict";

(function (F) {
  /*
   * ============================================================
   * ZENTRALE RAUMDATEN — GALERIE-4
   * ============================================================
   *
   * Alle Modelle liegen unter assets/models/.
   * Pfade beziehen sich auf index.html.
   * Groß-/Kleinschreibung beachten.
   *
   * title:
   *   Vollständiger Name ohne Trennzeichen.
   *
   * plaqueText:
   *   Für die Podestbeschriftung vorbereiteter Text.
   *   \u00AD bezeichnet einen bedingten Trennstrich.
   *   Der Raum-Builder muss diesen ausdrücklich auswerten.
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
   */

  F.welcomeRoom = {
    id: "welcome",
    title: "Begrüßungsraum",
    kind: "welcome",

    width: 18,
    depth: 16,
    height: 5.2,

    spawn: {x: 0, z: 6.5},

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
        plaqueText: "C₆₀-Buckminster\u00ADfulleren",
        model: "assets/models/C60-Fulleren.glb",
        info:
          "Vorschau für Vorlesung 1.\n\n" +
          "C₆₀-Buckminsterfulleren: ein Molekül aus " +
          "60 Kohlenstoffatomen."
      },
      {
        roomId: "vorlesung-2",
        title: "Wasserstoffbrücken in Eis",
        plaqueText: "Wasserstoff\u00ADbrücken in Eis",
        model: "assets/models/Eis2.glb",
        info:
          "Vorschau für Vorlesung 2.\n\n" +
          "Wasserstoffbrücken zwischen Wassermolekülen in Eis."
      },
      {
        roomId: "vorlesung-3",
        title: "YBa₂Cu₃O₇₋ₓ – Hochtemperatursupraleiter",
        plaqueText:
          "YBa₂Cu₃O₇₋ₓ – Hoch\u00ADtemperatur\u00ADsupraleiter",
        model: "assets/models/YBa2Cu3O7-x.glb",
        info:
          "Vorschau für Vorlesung 3.\n\n" +
          "YBa₂Cu₃O₇₋ₓ – Hochtemperatursupraleiter. " +
          "Der Sauerstoffgehalt beeinflusst die Eigenschaften."
      },
      {
        roomId: "vorlesung-4",
        title: "Tetragonal innenzentriertes Bravaisgitter",
        plaqueText:
          "Tetragonal innen\u00ADzentriertes Bravais\u00ADgitter",
        model: "assets/models/Tetragonal-I.glb",
        info:
          "Vorschau für Vorlesung 4.\n\n" +
          "Tetragonal innenzentriertes Bravaisgitter, tI.\n" +
          "a = b ≠ c; α = β = γ = 90°.\n" +
          "Zwei Gitterpunkte pro konventioneller Elementarzelle."
      },
      {
        roomId: "vorlesung-5",
        title: "Beugung am Einkristall",
        plaqueText: "Beugung am Ein\u00ADkristall",
        model: "assets/models/Roentgenbeugung.glb",
        info:
          "Vorschau für Vorlesung 5.\n\n" +
          "Schematischer Röntgenbeugungsversuch mit " +
          "Einkristall, Primärstrahl, gebeugten Strahlen " +
          "und Detektor.\n\n" +
          "Beugung entsteht durch die Interferenz der " +
          "am periodischen Kristall gestreuten Wellen.\n" +
          "Die dargestellten Reflexpositionen sind illustrativ."
      },
      {
        roomId: "vorlesung-6",
        title: "Kupfer – kubisch dichteste Packung",
        plaqueText: "Kupfer – kubisch dichteste Packung",
        model: "assets/models/Cu.glb",
        info:
          "Vorschau für Vorlesung 6.\n\n" +
          "Kupfer – kubisch dichteste Packung, " +
          "kubisch flächenzentrierte Struktur."
      },
      {
        roomId: "vorlesung-7",
        title: "Zinkblende",
        plaqueText: "Zink\u00ADblende",
        model: "assets/structures/ZnS.cif",
        cifMode: "zns-closed-cell",
        variantAlignment: "individual",
        variants: [
          {id: "zns-cell", title: "ZnS – Elementarzelle", model: "assets/structures/ZnS.cif", cifMode: "zns-closed-cell"},
          {id: "zns-sites", title: "ZnS – CIF-Ausgangspositionen", model: "assets/structures/ZnS.cif", cifMode: "zns-sites"},
          {id: "zns-coordination", title: "ZnS – Zn-Koordination", model: "assets/structures/ZnS.cif", cifMode: "zns-zn"},
          {id: "zns-anion", title: "ZnS – S-Koordination", model: "assets/structures/ZnS.cif", cifMode: "zns-s"}
        ],
        info:
          "Vorschau für Vorlesung 7.\n\n" +
          "Zinkblende: Zn und S haben je vier nächste Gegenionen. " +
          "Die Stäbe zeigen diese Zn–S-Kontakte, kein einzelnes Molekül.\n\n" +
          "Elementarzelle: 18 sichtbare Kugeln, davon Zn an Ecken und auf Flächen. " +
          "Gewichtet gehören vier Zn und vier S zur Zelle.\n\n" +
          "CIF-Ausgangspositionen: acht explizite Plätze aus P 1, ohne Randabbilder.\n\n" +
          "Zn- und S-Koordination: je vier Gegenionen, auch aus Nachbarzellen. " +
          "Der Style Polyhedral zeigt das jeweilige Tetraeder."
      },
      {
        roomId: "vorlesung-8",
        title: "S₈-Molekül in elementarem Schwefel",
        plaqueText: "S₈-Molekül in elementarem Schwefel",
        model: "assets/models/S8.glb",
        info:
          "Vorschau für Vorlesung 8.\n\n" +
          "S₈-Molekül in elementarem Schwefel."
      },
      {
        roomId: "team-a",
        title: "Metallorganische Gerüstverbindung HKUST-1",
        plaqueText:
          "Metall\u00ADorganische Gerüst\u00ADverbindung HKUST-1",
        model: "assets/models/HKUST-1_Pores.glb",
        info:
          "Vorschau für Team A.\n\n" +
          "Metallorganische Gerüstverbindung HKUST-1 " +
          "mit einer porösen Gerüststruktur."
      },
      {
        roomId: "team-b",
        title: "Cobalt-Komplex aus einer Einkristall-Umwandlung",
        plaqueText:
          "Cobalt-Komplex aus einer " +
          "Ein\u00ADkristall-Umwandlung",
        model: "" // Die CIF-Konfiguration wird unten mit Team B geteilt.
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
  const v1 = room("vorlesung-1");
  const nacl = "assets/structures/NaCl.cif";
  Object.assign(room("vorlesung-6").stations[0], {
    title: "Natriumchlorid – Steinsalzstruktur",
    model: nacl,
    cifMode: "cell",
    variantAlignment: "individual",
    info: "Die kubische Elementarzelle enthält vier Na⁺- und vier Cl⁻-Positionen (a = 5,6917 Å).\n" +
      "Die CIF führt die acht Positionen explizit in P 1 auf; der ideale Steinsalztyp hat die Symmetrie Fm-3m.\n\n" +
      "Na⁺ ist von sechs Cl⁻-Ionen oktaedrisch umgeben; auch Cl⁻ hat sechs Gegenionen als nächste Nachbarn. " +
      "Die Na⁺-Ansicht zeigt den ersten Nachbarschaftsausschnitt über Zellgrenzen hinweg (Na–Cl: ca. 2,846 Å). " +
      "Der Style Polyeder zeigt das Koordinationsoktaeder, keine kovalenten Bindungen. " +
      "Ionenkugeln sind schematisch; insbesondere sind die Raumfüllungsradien keine Ionenradien.",
    variants: [
      {id: "nacl-cell", title: "NaCl – Elementarzelle", model: nacl, cifMode: "cell"},
      {id: "nacl-na", title: "Na⁺ – Koordinationsumgebung", model: nacl, cifMode: "coordination"}
    ]
  });
  const coModel = {
    model: "assets/structures/Co-Produkt1.cif",
    cifMode: "molecule",
    variantAlignment: "individual",
    info: "CIF-Test: zusammenhängende zweikernige Co-Einheit und vollständige trikline Zelle.\n" +
      "Verbindungsansicht: koordinierte Einheit ohne freies Chlorid und Kristallwasser.\n" +
      "Zellansicht enthält alle CIF-Positionen einschließlich dieser Bestandteile.\n" +
      "Nicht-H-Bindungen aus CIF; Bindungen zu H werden über eindeutige C/N/O-Nachbarn " +
      "zwischen 0,6 und 1,25 Å ergänzt. Wasserstoffbrücken aus der CIF lassen sich in den Zellansichten einblenden.\n" +
      "Space-Filling-Radien (Å): H 1,20; C 1,70; N 1,55; O 1,52; Cl 1,75; Co 2,00 " +
      "(gewählte Radiuskonvention, für Co keine Ableitung aus der CIF).\n" +
      "Koordinationsumgebung: ein Co mit zwei N-, zwei O- und zwei Cl-Nachbarn.\n" +
      "Polyhedral zeigt transparente konvexe Hüllen der echten Nachbarpositionen " +
      "in Komplex- und Koordinationsansicht; Zellpolyeder noch nicht verfügbar.\n" +
      "ADPs gespeichert; Ellipsoid noch nicht umgesetzt.",
    variants: [
      {id: "co-complex", title: "Co – Verbindung (Komplex)",
        model: "assets/structures/Co-Produkt1.cif", cifMode: "molecule"},
      {id: "co-cell", title: "Co – Elementarzelle", model: "assets/structures/Co-Produkt1.cif", cifMode: "cell"},
      {id: "co-coordination", title: "Co – Koordinationsumgebung", model: "assets/structures/Co-Produkt1.cif", cifMode: "coordination"}
    ]
  };
  function practicalStations(roomId, experiments) {
    const team = room(roomId);
    const back = experiments.length === 5 ? 7 : team.depth / 2;
    const front = -team.depth / 2;
    const split = (front + back) / 2;
    team.zones = experiments.map(([name, accent, tint, models], index) => {
      const rear = index === 4;
      const left = index < 2;
      const first = index % 2 === 0;
      const title = `${team.title.at(-1)}${index + 1} · ${name}`;
      const z0 = rear ? back : first ? front : split;
      const z1 = rear ? team.depth / 2 : first ? split : back;
      return {title, accent, tint, models, wall: rear ? "back" : left ? "left" : "right",
        along: rear ? 0 : (z0 + z1) / 2,
        x0: rear || left ? -team.width / 2 : 0, x1: rear || !left ? team.width / 2 : 0, z0, z1};
    });
    team.stations = team.zones.flatMap(zone => zone.models.map((model, index) => ({...model,
      wall: zone.wall, along: zone.along + (index - (zone.models.length - 1) / 2) * 1.75, zone
    })));
  }

  const practicalCif = (title, file, source, cifMode = "practical-cell", note = "") => ({
    title, model: "assets/praktikum/" + file, cifMode,
    info: `Quelle: ${source}.\n${note || "CIF-Zellpositionen mit Zellrahmen; keine automatisch ergänzten Bindungen. Messungen beziehen sich auf die ausgewählten angezeigten Positionen."}`
  });
  const coPrecursor = practicalCif("Verbindung 1 · Edukt", "Verbindung1_cis-Co-Edukt.cif", "Praktikumsdatensatz P3_15",
    "co-precursor-molecule", "Die Komplexansicht zeigt das einkernige Kation. Am Co koordinieren zwei N- und zwei O-Atome der Pyridinmethanol-Liganden sowie zwei O-Atome aus gebundenem Wasser. Die Chlorid-Gegenionen und die CIF-Wasserstoffbrücken sind in der Elementarzelle sichtbar.");
  coPrecursor.variantAlignment = "individual";
  coPrecursor.variants = [["molecule", "Komplexkation"], ["cell", "Elementarzelle"], ["coordination", "Co-Koordination"]]
    .map(([mode, title]) => ({id:"co-precursor-"+mode, title, model:coPrecursor.model, cifMode:"co-precursor-"+mode}));

  practicalStations("team-a", [
    ["Benzil", "#41628f", "#c3d9f8", [
      practicalCif("Benzil · monoklin", "BENZIL03_monoklin.cif", "CSD BENZIL03"),
      practicalCif("Benzil · trigonal", "BENZIL04_trigonal.cif", "CSD BENZIL04")]],
    ["HKUST-1", "#15766f", "#a8e3d3", [
      practicalCif("HKUST-1 · mit Wasser (Ausschnitt)", "HKUST-1_mitH.cif", "CSD KAZWER", "practical-sites", "Explizit exportierte Positionen, keine weitere Symmetrieexpansion; keine vollständige Pore oder Zelle zugesichert."),
      practicalCif("HKUST-1 · Referenzausschnitt", "HKUST-1_ohneH.cif", "CSD FIQCEN", "practical-sites", "Explizit exportierte Positionen, keine weitere Symmetrieexpansion; keine vollständige Pore oder Zelle zugesichert."),
      practicalCif("Nebenprodukt VUXBUL", "Nebenprodukt_VUXBUL.cif", "CSD VUXBUL")]],
    ["Supraleiter YBa₂Cu₃O₇₋ₓ", "#9d493b", "#f6c7b9", [
      practicalCif("YBa₂Cu₃O₇", "YBa2Cu3O7_2016.cif", "ICSD 196264"),
      practicalCif("YBa₂Cu₃O₆.₉₁", "YBa2Cu3O7_2026.cif", "ICSD 229409"),
      practicalCif("YBa₂Cu₃O₆ · tetragonal", "YBa2Cu3O6_tetragonal_HT.cif", "ICSD 63269")]],
    ["Tribolumineszenz · Eu-Komplex", "#75519b", "#e2cdf5", [
      practicalCif("Eu-Komplex · Referenz", "Eu-Komplex2017.cif", "CCDC 1430893")]]
  ]);
  practicalStations("team-b", [
    ["Co-Einkristalltransformation", "#654c99", "#d9c8f3", [
      coPrecursor,
      {...coModel, title: "Verbindung 2 · Produkt", info: "Quelle: Praktikumsdatensatz P3_14.\n" + coModel.info},
      {title: "Verbindung 3 · reserviert"}, {title: "Verbindung 4 · reserviert"}]],
    ["Cobaltferrit", "#974339", "#efbbb0", [practicalCif("Cobaltferrit", "CoFe2O4.cif", "ICSD 33181", undefined,
      "CIF-Zellpositionen. Co und Fe teilen sich teilweise dieselben mittleren Gitterplätze; überlagerte Positionen sind keine zwei gleichzeitig vorhandenen Ionen.")]],
    ["Nicotinamid", "#206c80", "#b7dfec", [practicalCif("Nicotinamid", "Nikotinsaeureamid_NICOAM05.cif", "CSD NICOAM05")]],
    ["Thermochromie · Ag₂[HgI₄]", "#a65913", "#ffdbad", [
      practicalCif("Ag₂[HgI₄] · Tieftemperaturform", "AgHgI4-Tieftemperaturform.cif", "ICSD 30264"),
      practicalCif("Ag₂[HgI₄] · Hochtemperaturform", "AgHgI4-Hochtemperaturform.cif", "ICSD 38178", undefined,
        "CIF-Zellpositionen. Ag und Hg teilen sich mittlere Gitterplätze; Teilbesetzungen sind statistisch zu verstehen.")]],
    ["Vanillin", "#48763e", "#cceab8", [practicalCif("Vanillin", "Vanillin_YUHTEA.cif", "CSD YUHTEA")]]
  ]);
  Object.assign(F.welcomeRoom.exhibits.find(exhibit => exhibit.roomId === "team-b"), coModel,
    {info: "Vorschau für Team B.\n\n" + coModel.info});

  /*
   * ============================================================
   * VORLESUNG 1: BESTEHENDE MODELLE — UNVERÄNDERT
   * ============================================================
   */

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
  
  Object.assign(v1.stations[2], {
    title: "C₆₀-Buckminsterfulleren",
    model: "assets/models/C60-Fulleren.glb",
    slide: "",

    variantAlignment: "individual",

    info:
      "C₆₀-Buckminsterfulleren besteht aus 60 Kohlenstoffatomen.\n\n" +
      "Darstellungen: bisheriges GLB, CIF-Einzelmolekül und " +
      "CIF-Elementarzelle mit 240 Atompositionen.\n\n" +
      "Der blaue Rahmen zeigt die Zelle. Bindungen werden an " +
      "Zellflächen geteilt; Atomkugeln sind nicht beschnitten.\n" +
      "Die Ansichten werden auf eine ähnliche Anzeigegröße " +
      "normalisiert, nicht auf einen gemeinsamen Å-Maßstab.\n\n" +
      "Der CIF-Import erzeugt durch Anwendung der " +
      "Symmetrieoperationen die Atompositionen der Elementarzelle " +
      "und rekonstruiert daraus einen vollständigen C₆₀-Käfig.\n" +
      "Bindungen werden anhand der C–C-Abstände ermittelt; " +
      "sie sind nicht als Bindungsliste in dieser CIF hinterlegt.\n\n" +
      "Die Original-CIF-Labels C0 bis C9 bleiben als Metadaten " +
      "erhalten. Die Modellnummern sind eine neue, " +
      "separate Nummerierung.\n\n" +
      "Dies ist ein erster C₆₀-Test, kein allgemeiner CIF-Import.",

    variants: [
      {
        id: "c60-glb",
        title: "C₆₀ – bisheriges GLB-Modell",
        model: "assets/models/C60-Fulleren.glb"
      },
      {
        id: "c60-cif",
        title: "C₆₀ – Molekül aus CIF",
        model: "assets/structures/C60_fullerene.cif",
        cifMode: "molecule"
      },
      {
        id: "c60-cif-cell",
        title: "C₆₀ – Elementarzelle aus CIF",
        model: "assets/structures/C60_fullerene.cif",
        cifMode: "cell"
      }
    ]
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
})(typeof module === "object" ? module.exports : window.FKCVR);
