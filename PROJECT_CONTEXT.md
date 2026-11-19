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

Aktuelle Nutzerbestätigung: vier Styles und Atomlabels bei geöffnetem Handmenü funktionieren auf dem VR-Headset. Menübewegung wurde weiterhin als störend gemeldet. Neue Korrektur: Menüfront auf WebXR-Viewerposition (Augenmittelpunkt) ausgerichtet, Welt-Oben verhindert Controllerrollbewegung; Abstand zur Hand entlang der Richtung zum Kopf statt entlang mitrotierender Handflächenachse. Nachtest noch offen.

Nutzer bestätigt gute Handmenüausrichtung. Neu: Labels zeigen nur Original-CIF-Label; Modellnummer/ID intern erhalten. `js/room-entry.js` ergänzt 1-Sekunden-Haltebestätigung für Poster am PC/VR mit Betreten-Prozent/Balken, Abbruch bei Loslassen/Wegzeigen. Andere Raumwahlwege unverändert. Gerätetest offen. Nutzer kürzte Co-Produkt1.cif auf 476 Zeilen/19304 Bytes; Struktur/ADPs vorhanden, Datei vom Agenten nicht verändert.

Nächstes Arbeitspaket: **Poster-Haltebestätigung nachtesten**, anschließend **Distanzmessung am CIF-C60-Einzelkäfig** planen/umsetzen: zwei Atome per Trigger wählen, Distanz in Å, auch nicht gebundene Atome, Rücknahme/Neustart/Beenden, keine gleichzeitige Zeichenaktion. Noch kein Messcode umgesetzt. Winkel und periodische Zellmessungen danach; Co-Produkt1-Import als separate spätere Etappe. Vorlesungszuordnung neuer Modelle vor Anbindung klären.

Aktuelle Priorität: zunächst Pico fertigstellen, PC-/weitere Geräteparität später; bestehende PC-Funktionen erhalten. Nutzer meldet separaten Posterfortschrittsbalken auf Pico unsichtbar. Neue Anzeige integriert in bestehenden Tür-/Betreten-Hinweis: Weiß wird beim Halten von unten nach oben schwarz, Abbruch setzt zurück. Atomlabel-Hintergrund jetzt an gemessene Textbreite angepasst, statt breitem Festformat. Nachtest auf Pico offen; Logiktests ersetzen kein Rendering.

Fortsetzung nach Kontextkomprimierung oder neuem Chat: zuerst diese Übersicht, `.clinerules/01-project.md`, `Ideen.txt` und `docs/VR_REDESIGN_PLAN.md` lesen, Git-Status prüfen und betroffene aktuelle Quelldateien vollständig lesen. Frühere Chat-/Dateiinhalte nicht als vollständig verfügbar voraussetzen. Keine Commits/Pushes oder Asset-Löschungen ohne Zustimmung.

Neuester Stand: Nutzer bestätigt Pico-Füllanzeige und kompakte Labels. Labels standardmäßig beim Anvisieren; Optionen Alle/Aus; Trigger heftet Labels an/entfernt sie außerhalb Messmodus. Handmenü 20 % kleiner, kompaktere Zeilen. Neues `js/measurements.js`: Distanzmodus für CIF-Einzelmolekül, zwei Atome oder eine Bindung klicken, Linie und Å-Wert; keine Zellmessung. Echte Koordinaten statt VR-Skalierung. Messung bei Modell-/Geometriewechsel verwerfen; Reset/Beenden im Handmenü. Tests: fünf Node-Tests und Syntax/Diffkontrolle bestanden, Pico-Test dieser Etappe noch offen. PC-Parität weiterhin nachrangig. Nächster Schritt: diese Etappe auf Pico validieren, dann Winkelmessung oder begrenzten Co-Import planen.

Zukunftsideen werden in der Umbauplanung gesammelt: unabhängige Darstellungsstile (Ball-and-Stick, Space-filling, Wires), weitere Strukturansichten und Verbindungen sowie mögliche spätere GLB-Ablösung. Aktuell keine Asset-Löschung. Nach überprüften Etappen den Nutzer ausdrücklich auf den nötigen GitHub-Desktop-Commit hinweisen; Commit/Push nur mit ausdrücklicher Zustimmung ausführen.

Aktuellste Etappe: Nutzer bestätigt bisherigen Mess-/Labelprototyp. Jetzt Distanz/Winkel/Torsion über eigene Messseite im Handmenü (CIF-Einzelmolekül). Messatome erhalten transparente gelbe Auren und dauerhafte Messlabels, Messverbindungen gelbe Überlagerungen. Messreset/Beenden entfernt nur messungsbezogene Anzeigen. Atom-/Ergebnisflächen Hintergrundalpha 0,65, Schrift deckend; Ergebnisbreite dynamisch. Menü nochmals 10 % kleiner (0,245×0,288 m). Winkel: zweites Atom Scheitel; Torsion -180 bis +180° in Klickreihenfolge; entartete Geometrien nicht definiert. Keine periodischen Zellmessungen. Nächstes Paket: Pico-Nachtest der Messauswahl/Auren/Labels/Winkel/Torsion und Menügröße; dann Co-Import oder gezielte Korrekturen. Automatisierte Tests ersetzen keinen Gerätetest.