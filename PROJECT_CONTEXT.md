# PROJECT_CONTEXT.md

## Zweck des VR-Raums
Der VR-Raum wurde speziell für die Veranstaltung zur Festkörperchemie (FKC) entwickelt. Ziel ist es, interaktive und immersive Erfahrungen zu schaffen, durch die Studierende Modelle von Festkörperstrukturen und chemischen Prozessen räumlich erkunden können.

## Wichtige Projektdateien und ihre Aufgaben
- **`index.html`**: Einstiegspunkt der Anwendung. Hier werden die A-Frame-Bibliothek und alle zentralen Skripte eingebunden.
- **`styles.css`**: Definiert das Erscheinungsbild der Benutzeroberfläche.
- **`js/vr-controls.js`**: Steuert VR-Interaktionen und Benutzeraktionen.
- **`js/app.js`**: Enthält die Hauptlogik der Anwendung.
- **`.nojekyll`**: Stellt sicher, dass GitHub Pages reine HTML- und JavaScript-Dateien ausliefert.

## Start- und Testmöglichkeiten
- Python 3.9.10 und Node.js sind lokal verfügbar. Der Nutzer hat Serverstart und PC-Zugriff bestätigt; dies ist kein vom Agenten ausgeführter Browser-Funktionstest.
- Lokaler PC-Start: `py -m http.server 8000 --bind 127.0.0.1 --directory 'c:\Users\Eric Sperlich\Documents\GitHub\VR-Raum'`, danach `http://localhost:8000/` öffnen.
- Reproduzierbarer Strukturtest ohne zusätzliche Pakete: `node 'c:\Users\Eric Sperlich\Documents\GitHub\VR-Raum\tests\cif-model.test.cjs'`.
- Atomlabel-Logiktest ohne zusätzliche Pakete: `node 'c:\Users\Eric Sperlich\Documents\GitHub\VR-Raum\tests\atom-labels.test.cjs'` (vereinfachte Testobjekte, kein Renderingtest).
- Pico-Tests der veröffentlichten Version benötigen Push und erfolgreiches GitHub-Pages-Deployment. Lokales Headset-HTTPS ist noch nicht eingerichtet. A-Frame wird extern geladen.

## Bekannte Probleme und offene Fragen
- CIF-Import ist C60-spezifisch; andere Elemente und Zellformen sind noch nicht unterstützt.
- Neue Zellansicht, Variantenwechsel, Manipulation, Reset und Regression müssen am PC und Pico manuell getestet werden.
- Ansichten werden auf dieselbe größte Ausdehnung normalisiert, nicht auf exakt gleiches geometrisches Volumen oder einen gemeinsamen Å-Maßstab.
- Nutzer bestätigt VR-Labels und Variantenwechsel; PC-Labels funktionieren laut Rückmeldung nicht. PC-Fehlerbehebung nachrangig.
- Handmenü-Prototyp: Controller-Grip-Achse als Handflächen-Näherung; Ausrichtung, Größe und Bedienung auf Pico noch ungeprüft.

## Aktueller Arbeitsstand
C60 in Vorlesung 1 bietet nun GLB, CIF-Einzelmolekül und CIF-Elementarzelle im bestehenden Variantenmenü. Zellrahmen und periodische Bindungsabschnitte sind implementiert; Originalkoordinaten bleiben als Metadaten erhalten. Anwendungscode für Begrüßungsraum, Steuerung und Zeichnen wurde nicht geändert.

Agententests: JavaScript-Syntaxprüfung und numerischer CIF-Test bestanden: Molekül 60 Atome/90 Bindungen; Zelle 240 Atome/360 Bindungen, 444 sichtbare Bindungsabschnitte. Der Nutzer meldet den C60-Umbau als funktionierend; Umfang und Gerät dieser Prüfung wurden nicht separat angegeben.

Neu: `js/atom-labels.js` ergänzt „Atomlabels: Aus / Beim Anvisieren“ pro Modell. CIF-Atome werden beim Anvisieren gelb hervorgehoben und mit Original-CIF-Label und separater Modellnummer beschriftet. Am PC Maus, in VR aktuelle Controller-Treffer; keine Triggeränderung, keine dauerhafte Auswahl, keine GLB-Labels. Einstellung bleibt beim Variantenwechsel, nicht bei neuem Raumaufbau erhalten. Atomlabel-Logiktest und Syntaxprüfung bestanden; PC-/Pico-Rendering und Bedienung noch ungeprüft.

## Umbauplanung und nächstes Arbeitspaket
Die bestätigten Anforderungen, die lesende Bestandsaufnahme und offene Entscheidungen sind in [docs/VR_REDESIGN_PLAN.md](docs/VR_REDESIGN_PLAN.md) dokumentiert.

Neu: `js/hand-menu.js` bietet modellbezogene Aktionen an der gegenüberliegenden Hand zur gewählten Laserhand. Öffnen durch zum Kopf gedrehte Handinnenseite (Grip-Orientierungsnäherung, 300 ms Verzögerung), Ausblenden beim Wegdrehen/Greifen. Hauptmenü behält allgemeine Einstellungen und Laserhandwahl; PC-Modellmenü bleibt als bisheriger Zugang. Nur gewählte Laserhand zeichnet, beide Hände greifen/skalierten weiterhin. Handmenü enthält Varianten, Labelumschaltung, Reset, Modellinformationen und CIF-Legende. Handmenü-, Label- und CIF-Logiktests sowie Syntaxprüfungen bestanden; keine Agenten-Gerätetests.

Nutzer bestätigt Handmenü mit beiden Händen. Neu: Handmenü parallel zur Kamera-/Augenebene ausgerichtet; Atomlabels auch bei geöffnetem Handmenü erlaubt. Vier CIF-Styles am C60: Ball-and-Stick, Space-Filling (C-VdW-Radius 1,70 Å), Wires (dünne Stäbe) und Capped Sticks (runde Atomkappen). Style bleibt beim Variantenwechsel erhalten; Auswahl im Handmenü unter Styles. Syntax-/Logik-/Struktur-/Styletests bestanden; sichtbarer Pico-Nachtest offen.

Neue CIFs im Strukturordner bleiben unverändert und noch nicht angebunden. Co-Produkt1 enthält trikline Zelle und anisotrope ADPs; bisheriger Importer unterstützt beides noch nicht. Ellipsoid und Polyhedral nicht implementiert. YBa-CIF benötigt wegen Teilbesetzungen und Bezug auf dotierte Studie fachliche Prüfung.

Nächstes Arbeitspaket: **Menüausrichtung, Labels bei offenem Menü und Styles validieren**, danach begrenzten Co-Produkt1-Import planen. Vorlesungszuordnung der neuen Modelle anhand aktueller Raumdaten klären.

Zukunftsideen werden in der Umbauplanung gesammelt: unabhängige Darstellungsstile (Ball-and-Stick, Space-filling, Wires), weitere Strukturansichten und Verbindungen sowie mögliche spätere GLB-Ablösung. Aktuell keine Asset-Löschung. Nach überprüften Etappen den Nutzer ausdrücklich auf den nötigen GitHub-Desktop-Commit hinweisen; Commit/Push nur mit ausdrücklicher Zustimmung ausführen.