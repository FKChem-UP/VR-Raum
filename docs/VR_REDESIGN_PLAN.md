# Umbauplanung der A-Frame/WebXR-Lehrumgebung

## Verbindlichkeit und Quellen
- Der aktuelle lokale Quellcode ist die Quelle für den tatsächlichen Implementierungsstand. Vor Änderungen die betroffenen aktuellen Dateien erneut vollständig lesen.
- Die bestätigte Planung beschreibt den gewünschten Zielzustand. Widersprüche und offene Entscheidungen vor der Umsetzung klären, nicht stillschweigend überschreiben.
- Dieses Dokument speichert die übergebene Planung und die anschließende lesende Bestandsaufnahme. Es ist kein Nachweis bestandener Anwendungstests.
- „Im Code vorhanden“ bedeutet nicht „erfolgreich getestet“. Übernommene Nutzerberichte, eigene Testergebnisse und offene Prüfungen getrennt dokumentieren.

## Zweck und Rahmen
Festkörperchemische Strukturen am PC sowie auf Pico 4 und Pico 4 Ultra mit Pico Browser räumlich untersuchen. Verschiedene Darstellungen desselben Modells sollen insbesondere Einzelmolekül und kristallographische Elementarzelle unterscheiden. Modelle bleiben auswählbar, drehbar, kippbar, skalierbar und zurücksetzbar.

Das Projekt verwendet HTML, CSS, JavaScript und A-Frame/WebXR ohne Buildsystem. In der lesenden Bestandsaufnahme war A-Frame 1.4.2 eingebunden; Begrüßung, acht Vorlesungsräume und zwei Teamräume sind vorgesehen. Der CIF-Importer ist ausdrücklich C60-spezifisch, kein zugesicherter allgemeiner CIF-Import.

## Bestätigter Zielzustand
| Kennung | Anforderung |
| --- | --- |
| VR-01 | Bestehendes C60-GLB erhalten und durch einen CIF-basierten Einzelkäfig ergänzen. |
| VR-02 | Darstellungen über „Menü & Einstellungen“ → „Ausgewähltes 3D-Modell“ → „Modelldarstellung wechseln“ anbieten. |
| VR-03 | Dritte Darstellung „C₆₀ – Elementarzelle aus CIF“ ergänzen. |
| VR-04 | Zelle mit 240 Atompositionen innerhalb der definierten Zelle, passenden Bindungsabschnitten und Zellrahmen darstellen. Moleküle dürfen angeschnitten sein. Periodische Bindungen dürfen keine langen Querstreben durch die Zelle bilden. |
| VR-05 | Eigene Zellnormalisierung mit bestehenden Bounds, Manipulation und Reset verbinden. Aus der CIF übernommene Zellparameter und Raumgruppe im Infotext zeigen. |
| VR-06 | Erst nach stabiler Elementarzelle Atomlabels im bestehenden Modellmenü ergänzen. Original-CIF-Label, Modellnummer und eindeutige ID getrennt halten. Labels dürfen Maus/Laser nicht blockieren; für GLB keine CIF-Labels erfinden. |
| VR-07 | Strukturkoordinaten in Å unabhängig von der visuellen Skalierung erhalten, als Grundlage späterer Messwerkzeuge. |

## Ergebnis der bisherigen lesenden Bestandsaufnahme
Diese Befunde beziehen sich auf die vorangegangene Quellcodeprüfung und sind vor einem Patch erneut zu prüfen.
Historischer Ausgangsstand: Der aktuelle Umsetzungsstand und neuere Entscheidungen stehen am Ende dieses Dokuments.

- Vorlesung 1, Station 3 enthält GLB und CIF-Einzelkäfig; `variantAlignment: "individual"` ist gesetzt.
- CIF-Pfad: `assets/structures/C60_fullerene.cif`. GLB, Eis-Modell und ältere CIF unter `assets/models` existieren weiterhin.
- Variantenmenü, gemeinsamer Modelllader und Normalisierung sind im Code vorhanden. Der Variantenwechsel endet mit `F.loadModelVisual(pending, variant.model)`.
- `index.html` bindet `rooms.js?v=2` und `vr-tools.js?v=5` ein. Cachewerte nicht blind aus älteren Übergaben übernehmen.
- Der Importer erzeugt intern Zellpositionen und enthält Prüfungen auf 240 Atome, vier Käfige sowie 60 Atome/90 Bindungen je Käfig. Sichtbar aufgebaut wird nur ein Einzelkäfig.
- CIF-Labels, Modellnummern und IDs sind getrennte Metadaten. Å-Koordinaten des Käfigs bleiben unabhängig von der Darstellungsskalierung erhalten; sie sind um sein Zentrum verschoben.
- Zellvariante, Zellrahmen, begrenzte periodische Bindungsdarstellung und Atomlabel-Bedienung fehlen.
- Der Lader unterscheidet bisher CIF/GLB anhand der Dateiendung. Ein Zellmodus muss ausdrücklich eingeführt und durch die Variantenpipeline weitergereicht werden; eine zusätzliche Varianten-ID allein reicht nicht.
- Vollständige Zellkoordinaten und Raumgruppenmetadaten müssen für die Zellvariante zugänglich bleiben. Die vorliegende CIF nennt Pa-3 (205), a = b = c = 14,29570032 Å und Winkel von 90°.
- `app.js` überschreibt Controller-`activate` und `tick`. Spätere Treffer-/Labeländerungen müssen die tatsächliche Ladefolge berücksichtigen.
- `drawing.js` und Theme-Datei sind vorhanden; die Theme-Datei ist nicht in `index.html` eingebunden.
- `PROJEKT-UEBERGABE.md` wurde nicht gefunden. Eine überlieferte Version 12 einschließlich Importnachtrag ist daher nicht als lokal gespeichert belegt.
- Bei der Bestandsaufnahme waren `PROJECT_CONTEXT.md` und `.clinerules/` unversioniert; Änderungen an versioniertem Anwendungscode wurden nicht angezeigt. Ein Abgleich mit dem entfernten Repository wurde nicht durchgeführt.

## Was unverändert bleiben soll
- Nur die Arbeitskopie bearbeiten, kein Backup verändern.
- Kein Buildsystem und keine neuen Abhängigkeiten ohne Zustimmung; allgemeine Modularisierung bleibt pausiert.
- `drawing.js` behalten; keine `hit-test.js` erstellen.
- C60-GLB, Eis und Begrüßungs-Fulleren erhalten. CIF-Projektpfad beibehalten; ältere CIF nicht ohne Zustimmung löschen. Projektdatei bleibt `.cif`, nicht `.txt`.
- Theme-Dateien und gespeicherte Theme-Werte vorerst nicht löschen.
- Bedienung, Zeichnen und Raumwechsel nicht durch einen allgemeinen Umbau ersetzen.
- Kleine, überprüfbare Etappen mit getrennten PC- und Pico-Ergebnissen. Keine Löschaktionen, Commits oder Pushes ohne ausdrückliche Zustimmung.
- Fachliche Grenzen: CsCl statt CsF für den besprochenen Strukturtyp; S8/P4 keine Wasserstoffbrücken zuschreiben; Röntgendemo illustrativ, keine realistischen Intensitäts-/Strukturfaktorberechnungen behaupten. C60-Prüfwerte nicht auf andere Strukturen übertragen.

## Vereinbartes nächstes Arbeitspaket: CIF-Basis reproduzierbar absichern
Ziel: belastbare Grundlage für die Elementarzelle schaffen, zunächst ohne Darstellungsumbau.
Dies war die ursprüngliche Etappe. Der Nutzer hat anschließend die Zellumsetzung ausdrücklich freigegeben; offene manuelle Basisprüfungen bleiben Teil der folgenden Validierung.

1. Aktuellen Git-Status aufnehmen und vorhandene Nutzeränderungen schützen.
2. Relevante aktuelle Dateien lesen: `index.html`, `js/rooms.js`, `js/room-builder.js`, `js/vr-tools.js`, `js/cif-model.js`, `js/vr-controls.js`, `js/app.js`, `js/browser-xr.js` und `assets/structures/C60_fullerene.cif`.
3. Vorhandene lokale Startumgebung feststellen, ohne Pakete zu installieren. Modellstation, CIF-Pfad, Variantenwechsel, Normalisierung, Bounds, Metadaten und Controllerüberschreibungen prüfen.
4. Am PC GLB → CIF → GLB → CIF, CIF-Drehen, Kippen, Skalieren und Reset testen; Konsole kontrollieren.
5. Atomzahlen, Molekülzentren und Bindungslängen durch tatsächlich ausgeführte numerische Prüfungen belegen.
6. Befunde, reproduzierte Probleme und ausgeführte Tests dokumentieren. Anschließend das kleinste Zell-Patchpaket abgrenzen.

Nicht enthalten: Elementarzellenumbau, Atomlabels, Messwerkzeuge, allgemeine Modularisierung, Änderungen anderer Modelle, Installation, Commit oder Push. Die aktuelle Arbeit speichert lediglich Planung und Kontextverweis; dieses Arbeitspaket ist noch nicht ausgeführt.

## Anschließende Reihenfolge
1. Elementarzelle: Darstellungsmodus, vollständige Zellmetadaten, periodische Bindungsabschnitte, Zellrahmen, individuelle Normalisierung, Bounds und Infotext.
2. PC-Regression und Dokumentation der Etappe.
3. Atomlabels unter Berücksichtigung von Metadaten und Trefferverarbeitung.
4. Pico-Tests der jeweiligen Etappen; insbesondere Variantenwechsel, Greifen, Drehen, Zweihandskalierung, Reset und Raumwechsel.
5. Später gegebenenfalls Einfärbung und Messwerkzeuge, nach eigener Entscheidung.

## Offene Entscheidungen und technisch ungeprüfte Punkte
- Varianten-ID und technische Schnittstelle für Käfig/Zelle; Konstruktion und Begrenzung periodischer Bindungsabschnitte; Zellrahmengestaltung und exakter Infotext.
- Atomkugeln an Zellflächen: nur Mittelpunkte innerhalb der Zelle oder geometrisch abgeschnittene Kugeln? Die Zellwahl und Randkonvention müssen eindeutig definiert werden.
- Die Hypothese „ein Molekül mittig und sechs halbe auf Flächen“ ist nicht bestätigt.
- Labelmodus: „Beim Anvisieren“ ist bevorzugte Idee, aber genaue Bedienung nicht festgelegt. „Alle anzeigen“ ist optional; Anzeigeformat wie „C0 · Atom 17“ nur ein Beispiel.
- Dokumentation: Die Übergabe verlangt Etappenupdates in `PROJEKT-UEBERGABE.md`; die Entscheidung über ein separates Etappenprotokoll neben Projektübersicht und diesem Plan bleibt offen. Die Speicherung dieses Plans entscheidet darüber nicht.
- Lokaler Server und Startbefehl sind nicht verifiziert. HTTPS oder localhost ist durch die WebXR-Prüfung im Code vorgesehen; gewöhnliches HTTP über die PC-LAN-Adresse ist auf Pico kein localhost.
- Übernommene PC-Erfolge und Importzahlen wurden hier nicht reproduziert. Aktuelle Konsolenwarnungen, Ladefehler, Fehlerbehandlung und Pico-Verhalten bleiben zu testen.
- Multiplayer wartet laut Übergabe auf Rückmeldung der Uni-IT; lokaler Implementierungsstand dazu ungeprüft.
- Einfärbung, Abstands-/Winkel-/Torsionsmessung und Unterstützung weiterer Strukturen sind spätere Vorschläge, kein aktuelles Arbeitspaket. Modellwechsel des Coding-Agenten sind keine technische Projektanforderung.

## Prüfkriterien für spätere Umsetzung
- Wiederholter Variantenwechsel: nur gewünschte Darstellung sichtbar; Ladefehler erhält die vorherige funktionierende Darstellung; Auswahl, Bounds und Griffbereich passen; keine neuen relevanten Konsolenfehler.
- Zelle: dritte Menüoption, vollständige Belegung mit 240 Positionen, Zellrahmen passend zur CIF, korrekte Bindungsabschnitte ohne Querstreben; Einzelkäfigprüfung mit 60 Atomen/90 Bindungen bleibt erhalten.
- Manipulation und Reset funktionieren; Zellparameter und Raumgruppe sind nachvollziehbar aus der CIF übernommen.
- Labels stammen aus Metadaten, unterscheiden Label/Nummer/ID und blockieren weder Auswahl, Zeichnen noch Menü. Kein erfundenes CIF-Label beim GLB.
- Eis, Begrüßungs-Fulleren, Raumwechsel und Zeichnen bleiben funktionsfähig. PC- und Pico-Tests getrennt dokumentieren; numerische Aussagen nur mit ausgeführtem Nachweis.

## Neu bestätigte Entscheidungen und Zukunftsideen
- Variante A: GLB bleibt aktuell als Vergleichsoption neben CIF-Molekül und CIF-Zelle erhalten. Erst wenn CIF die benötigten Darstellungen zuverlässig ersetzt, kann die GLB-Option entfallen. Asset-Löschungen sind nicht Bestandteil dieser Freigabe; insbesondere wird das C60-GLB auch im Begrüßungsraum verwendet. Vor späterem Aufräumen sämtliche Referenzen prüfen und konkrete Löschfreigabe einholen.
- Beim Wechsel sollen Modelle ungefähr gleich groß erscheinen. Beide CIF-Ansichten verwenden dieselbe größte normalisierte Ausdehnung; bestehende manuelle Skalierung bleibt erhalten. Dies ist keine exakte Volumengleichheit. Die Zelle kann anschließend bewusst vergrößert werden.
- Strukturansicht (Molekül, Zelle, später beispielsweise Koordinationsansicht) und Darstellungsstil sollen langfristig unabhängig wählbar sein. Stile: Ball-and-Stick, Space-filling und Wires; jeder Stil soll für alle geeigneten Strukturansichten nutzbar sein. Noch nicht umgesetzt.
- Langfristig dieselbe Bedienung für weitere Verbindungen/CIFs. Der jetzige C60-Importer ist dafür nicht ausreichend; andere Bindungsregeln, Zellformen und Netzwerke benötigen eigene Erweiterungen.
- Künftige Nutzerideen in diesem Dokument notieren und als Wunsch, bestätigte Entscheidung oder offene Frage kennzeichnen, statt sie stillschweigend vorwegzunehmen.
- Den Nutzer nach abgeschlossenen überprüften Änderungen ausdrücklich auffordern, GitHub Desktop für den lokalen Commit zu öffnen. Push für externe Sicherung und veröffentlichte Pico-Tests; niemals ohne Zustimmung selbst committen/pushen.

## Aktueller Umsetzungsstand: C60-Molekül und Elementarzelle
- `cifMode` trennt Quelle und Strukturansicht: `molecule` (Standard) oder `cell`. Vorlesung 1 behält `c60-glb` und `c60-cif`; hinzu kommt `c60-cif-cell`.
- Der Importer prüft weiterhin alle vier Einzelkäfige und erhält vollständige Zellatome, periodische Bindungen und Raumgruppe als Metadaten. Die Zellansicht baut 240 Atomkugeln, geteilte Bindungen und zwölf blaue Rahmenkanten.
- Zellkonvention: Atommittelpunkte in [0, 1) je Achse; Atomkugeln nicht geometrisch beschnitten. Bindungen werden an Zellflächen geteilt und die Abschnitte periodisch zurückverschoben. Diese erste Ausführung folgt dem vorgeschlagenen einfachen Kugelansatz; visuelle Rückmeldung ist noch erforderlich.
- Individuelle bestehende Normalisierung bleibt erhalten. Zellparameter/Raumgruppe im Modellinfomenü stammen aus geladenen Strukturmetadaten.
- Geändert: `js/cif-model.js`, `js/rooms.js`, `js/vr-tools.js`, `js/room-builder.js`, Cache-Versionen in `index.html` und die beiden Kontext-/Planungsdokumente. Neu: `tests/cif-model.test.cjs`, ohne zusätzliche Abhängigkeiten und ohne Buildsystem.
- Tatsächlich ausgeführt: Syntaxprüfung der vier geänderten JS-Dateien mit `node --check`; numerischer Test mit `node tests/cif-model.test.cjs` bestanden. Molekül: 60 Atome/90 Bindungen; Zelle: 240 Atome/360 Bindungen; 444 Bindungsabschnitte. Alle Abschnitte innerhalb der Zellgrenzen, maximal 1,85 Å und ihre summierte Länge je Bindung entspricht der ursprünglichen Bindungslänge. C–C-Abstände: ungefähr 1,400029 bis 1,455767 Å. ID-Eindeutigkeit, originale CIF-Labels, Grad 3 und Modusübergabe ebenfalls geprüft.
- Molekülzentren modulo Zelle, bis auf numerische Rundung: (0, 0, 0), (0, 1/2, 1/2), (1/2, 0, 1/2), (1/2, 1/2, 0). Die Hypothese eines mittigen Moleküls wird für diesen Ursprung nicht bestätigt.
- Nutzer bestätigt lokalen Serverstart und PC-Zugriff auf den bisherigen Raum. Keine vom Agenten ausgeführten Browser- oder Pico-Tests der neuen Darstellung; keine Aussagen über bestandene Geräte-Regression.

## Nächstes Arbeitspaket: manuelle PC-/Pico-Validierung
1. Lokal ohne Cache neu laden, Vorlesung 1 betreten und das C60-Modell auswählen.
2. Im bestehenden Modellmenü mehrfach GLB → CIF-Molekül → CIF-Zelle → CIF-Molekül → GLB wechseln; nur eine Ansicht sichtbar, kein unerwarteter Größensprung.
3. Beide CIF-Ansichten drehen, kippen, skalieren und zurücksetzen. Zelle vergrößern; Rahmen und Randbindungen kontrollieren; Modellinformation und Konsole prüfen.
4. Eis, Begrüßungs-Fulleren, Raumwechsel und Zeichnen gegenprüfen. Nach erfolgreichem PC-Test lokal committen; für Pico-Test pushen und Pages-Deployment abwarten.
5. Auf Pico Variantenwechsel, Greifen, Drehen, Zweihandskalierung, Reset und Raumwechsel prüfen. Ergebnisse getrennt dokumentieren; zunächst gezielte Fehler beheben, dann Atomlabels planen.

## Neue Nutzerideen: Untersuchung und Bearbeitung von Strukturausschnitten
- Wunsch: Atome und Bindungen per Laser farbig markieren, später dauerhaft auswählen. Dauerhafte Auswahl und Bindungsmarkierung sind noch nicht umgesetzt.
- Wunsch: Bindungsdistanzen und Winkel aus echten Å-Koordinaten messen; zunächst zwei/ drei Atome am Einzelkäfig. Periodische Zellmessungen benötigen ausdrücklich definierte Atomabbilder. Noch nicht umgesetzt.
- Wunsch: bestimmte Atome, Bindungen und Moleküle entfernen. Empfohlene, noch abzustimmende erste Lösung: reversibles Ausblenden mit Wiederherstellen, keine Änderung der CIF. Bei Zellansichten Molekülzugehörigkeit ergänzen; bei Netzwerken wie NaCl nicht von Molekülen sprechen.
- Wunsch: NaCl-Zelle und Koordinationsumgebungen von Na+ beziehungsweise Cl- (je sechs Gegenionen), später Koordinationspolyeder. Dafür Importer erweitern, konkrete CIF prüfen und Nachbarschafts-/Ladungs-/Radiuskonventionen festlegen; der C60-Importer ist noch nicht allgemein.
- Vorschläge des Agenten, noch nicht zur Umsetzung freigegeben: explizite Werkzeugmodi zur Vermeidung von Zeichen-/Auswahlkonflikten, Auswahl zurücknehmen, Zellrahmen umschalten, Nachbarn hervorheben, Legende und Schnittansicht.

## Etappe: Atomlabels und vorübergehende Anvisierhervorhebung
- Vom Nutzer zur Umsetzung freigegeben. Der vorherige C60-Umbau wurde als funktionierend zurückgemeldet; kein separat bestätigter Pico-/Regressionstest.
- Neues kleines Modul `js/atom-labels.js`; Einbindung und Szenenkomponente in `index.html`; Menüanbindung in `js/vr-tools.js`. Keine allgemeine Modularisierung und keine Änderungen an Controllerfunktionen oder Zeichencode.
- Menü: ausgewähltes Modell → Atomlabels → Aus / Beim Anvisieren. Standard Aus. Einstellung pro Modellroot, bei Variantenwechsel erhalten; nach Raumneuaufbau wieder Aus.
- Bei Maus-/VR-Anvisieren maximal ein CIF-Atomlabel mit Original-CIF-Label und separater Modellnummer, beispielsweise „C0 · Atom 17“. Gelbe Hervorhebung über temporär geklontes Material, Rücksetzung bei Wegzeigen/Deaktivierung. Bei zwei VR-Lasern wird rechts bevorzugt, sofern rechts ein geeignetes Atom trifft.
- Beschriftung als kamerazugewandtes Sprite außerhalb der Modellgeometrie, ohne Raycast. Kein Einfluss auf Modellnormalisierung. Menü, Bindungs-/GLB-Treffer, unsichtbare und veraltete Treffer zeigen keine Labels. Labels bewusst ohne Tiefentest für Lesbarkeit; Überlagerung der Szene am Gerät noch prüfen.
- Keine dauerhafte Auswahl, keine Bindungshervorhebung, keine erfundenen GLB-Labels und kein Modus „Alle anzeigen“ in dieser Etappe.
- Tatsächlich ausgeführt: `node tests/atom-labels.test.cjs` bestanden (vereinfachte Testobjekte: Metadaten/Format, Moduswechsel, GLB-Ausschluss, Sichtbarkeit, veraltete Treffer, Materialwechsel und Originalmaterial-Rücksetzung). `node tests/cif-model.test.cjs` weiterhin bestanden. Syntaxprüfung von `js/atom-labels.js` und `js/vr-tools.js`, Diff-Whitespaceprüfung bestanden. Keine Browser-/Pico-Tests des Agenten.
- Nächste Validierung: am PC und Pico einschalten, Menü schließen, verschiedene Atome anvisieren; Label/Farbe wechseln und verschwinden beim Wegzeigen. Bindungen/GLB liefern keine Labels. Variantenwechsel, Vergrößern/Reset, Raumwechsel, Menü, Zeichnen und Modellwahl gegenprüfen; Konsole kontrollieren. Nach erfolgreichem PC-Test ausdrücklich GitHub Desktop für Commit öffnen, für Pico-Test pushen und Deployment abwarten.

## Etappe: Modell-Handmenü und Laserhandwahl
- Nutzer bestätigt Variantenwechsel und Atomlabels auf der VR-Brille. PC-Labels funktionieren laut Nutzer nicht; Korrektur ausdrücklich auf später verschoben. Keine Behauptung vollständiger Geräte-Regression.
- Freigegeben: Nur Modelloptionen im Handmenü; allgemeine Einstellungen bleiben im Hauptmenü. Laserhand dort wählbar, Menü an der anderen Hand. Einblenden nur durch aktives Drehen der Handinnenseite zum Kopf, keine dauerhafte Anzeige.
- Neuer Prototyp `js/hand-menu.js`: Fläche 0,34 × 0,40 m, nahe der Grip-Pose verankert und zum Kopf ausgerichtet. Handinnenseite angenähert durch lokale +X-Achse links/-X rechts. Öffnen bei Ausrichtungskosinus ≥ 0,75 für 300 ms, offen halten bis unter 0,45; Abstand zum Kopf 0,20–0,85 m. Diese Parameter und insbesondere die Grip-Achsen sind auf Pico noch zu validieren, kein verifiziertes echtes Handtracking.
- Ohne ausgewähltes geladenes Modell, bei fehlendem Tracking, Greifen, Hauptmenü oder VR-Ende ausgeblendet. Navigation/Zeichnen während Handmenü gesperrt; nur dessen Fläche erhält Treffer. Keine Raumaktionen hinter dem Menü.
- Direkt verfügbare Modellaktionen: Varianten (bis drei je Seite), Labels Aus/Beim Anvisieren, Reset, paginierte Modellinformation, Legende der CIF-Elementfarben. GLB-Farben nicht als Elementsorten ausgeben. Keine scheinbaren Buttons für unimplementierte Mess-/Filter-/Darstellungswerkzeuge.
- Standard Laser rechts, Handmenü links; im Hauptmenü unter Allgemeine Einstellungen → Laser und Zeichnen umschaltbar. Nicht gewählte Hand zeigt keinen Laser/zeichnet nicht, bleibt aber für Greifen, Reset und B/Y aktiv. Farbe, Breite und Komfort bleiben im Hauptmenü. PC-Modellzugang bleibt erhalten; VR-Hauptmenü-Modellknopf verweist auf Handmenü.
- Geändert: `js/vr-tools.js`, `js/app.js`, `js/atom-labels.js`, `index.html` und Dokumentation. Neu: `js/hand-menu.js`, `tests/hand-menu.test.cjs`. Bestehende GLBs/CIFs nicht verändert. Nutzer sammelt CIFs für spätere Begrüßungsmodelle.
- Ausgeführt: Handmenü-Logiktest (Handwahl, Verzögerung, Hysterese, Rücksetzung), Atomlabel-Logiktest und numerischer CIF-Test bestanden. Syntaxprüfungen aller vier geänderten/neuen JS-Dateien und Diff-Whitespaceprüfung bestanden. Tests ohne zusätzliche Abhängigkeiten; keine tatsächlichen Browser-/Pico-Renderingtests.
- Nächster manueller Test: PC-Regressionscheck für Hauptmenü/Varianten; Commit und Push für Pico-Test, Deployment abwarten. Auf Pico Modell auswählen, Menühand bewusst zum Kopf drehen/wegdrehen; beide Laserhand-Einstellungen, direkte Varianten/Labels/Reset/Info, Greifen/Zweihandskalierung, Zeichnen, B/Y und Raumwechsel prüfen. Bei falscher Einblendrichtung Controllerhaltung genau beschreiben; Achsen gezielt anpassen.

## Etappe: Ergonomiekorrektur und erste Styles
- Nutzer bestätigt Handmenü mit beiden Händen, meldet zusätzliche Aufwärts-/Linksneigung. Menüquaternion jetzt aus Kamera-Weltquaternion relativ zur Szene: parallel zur Augenebene statt auf seitliche Hand-Kopf-Verbindung ausgerichtet. Geräte-Nachprüfung erforderlich.
- Atomlabels bei offenem Handmenü ermöglicht. Trefferfilter lässt Handmenü und ausgewähltes Modell zu; Raumaktionen/Zeichnen bleiben gesperrt. Bei Treffer auf Menü keine Atomlabels durch das Menü hindurch.
- Vier C60-Styles unabhängig von Molekül/Zelle: Ball-and-Stick (Atom 0,32 Å, Stab 0,10 Å), Space-Filling (C 1,70 Å, Bindungen ausgeblendet), Wires (Stäbe/Atomknoten 0,025 Å) und Capped Sticks (Stäbe/runde Atomkappen 0,14 Å). Außer Space-Filling rein visuelle Radien; Wires/Capped Sticks als VR-Approximation, nicht behauptete Mercury-Identität. Auswahl über eigene Styles-Seite im Handmenü, Modellroot speichert Style beim Variantenwechsel. Normalisierung/Bounds nach Stylewechsel aktualisiert; echte Koordinaten unverändert.
- Ellipsoid und Polyhedral noch nicht implementiert: C60-CIF enthält keine ADPs und kein Metallzentrum. Keine erfundenen Ellipsoide oder Polyeder.
- Sechs neue CIFs lesend geprüft, nicht verändert/angebunden. Co-Produkt1: triklin P -1, C/H/N/O/Cl/Co, anisotrope Uij für Nicht-H-Atome, mehrzeilige CIF-Felder und umfangreicher Reflexionsdatenblock. Nur relevante Strukturabschnitte gelesen, nicht die gesamte 26596-zeilige Datei. Geeignetes nächstes separates Testpaket, aber keine einfache Fortsetzung des kubischen C60-Importers. Ellipsoid erfordert korrekte Tensortransformation und festzulegende Wahrscheinlichkeitsfläche; Polyhedral benötigt bestätigte Koordinationsnachbarn.
- Cu/H2O/S8/ZnS enthalten keine anisotropen ADPs in den gelesenen Dateien. H2O hat nichtorthogonale Zelle. YBa-Datei enthält Teilbesetzungen (u.a. O1 0,50) und Publikation zu Fe-dotiertem Material; nicht ungeprüft als ideales YBa2Cu3O7 darstellen. Nutzerzuordnungen Metalle/Ionengitter/Molekülstrukturen widersprechen teilweise aktuellen Raumdaten (Vorlesungen 6/7/8); vor Anbindung klären.
- Ausgeführt: Handmenü-/Atomlabel-Logiktests und CIF-Strukturtest bestanden, CIF-Test um vier Styles/Rückwechsel/unveränderte Koordinaten ergänzt und ausgeführt. Syntaxprüfungen von hand-menu.js, atom-labels.js, cif-model.js und vr-tools.js sowie Diffprüfung bestanden. Keine Rendering-/Pico-Tests des Agenten.
- Nächste Prüfung: beide Hände, neue Augenebenenausrichtung, Labels bei offenem Menü, alle vier Styles in Molekül/Zelle, Wechsel GLB/CIF, Griffbereich/Reset/Zeichnen. Danach begrenzten Co-Produkt1-Import planen statt alle Begrüßungsmodelle auf einmal umzustellen.

## Etappe: Augenmittelpunkt-Ausrichtung und gesicherte Fortsetzung
- Nutzer bestätigt Styles und Labels bei geöffnetem Handmenü mit VR-Headset. Menü dreht sich weiterhin störend; Ziel präzisiert: Menüfront stets zum Punkt zwischen den Augen, Handrotation steuert nur Sichtbarkeit.
- `js/hand-menu.js` liest bevorzugt WebXR-Viewerpose und transformiert diese über das Rig in Weltkoordinaten. Bei fehlender Pose ausblenden; Kameraposition nur als Rückfall, wenn Viewerpose-API nicht verfügbar. Menü mit `lookAt` zum Augenmittelpunkt und Welt-Oben ausrichten. 7-cm-Versatz entlang Hand→Kopf statt entlang rotierender Handflächenachse; Position folgt weiterhin der Hand.
- `index.html`: Handmenü-Cacheversion 3. `tests/hand-menu.test.cjs`: Testfälle für Viewerpose-Vorrang, Rig-Transformation, Trackingverlust und Kamera-Rückfall ergänzt. Dies prüft Logik mit Testobjekten, nicht echte stereoskopische Darstellung oder Ergonomie.
- Nur dieses Korrekturpaket freigegeben/umgesetzt. Noch keine Messwerkzeuge oder neuen CIF-Modelle. Nach Pico-Nachtest nächste kleine Etappe: dauerhafte Auswahl und Distanzmessung am C60-Einzelkäfig; zwei Atome, echte Å-Distanz auch ohne Bindung, Trigger exklusiv für Messmodus, Rücknahme/Neue Messung/Beenden, Aufräumen bei Varianten-/Raumwechsel. Winkel, periodische Zellmessungen und Co-Produkt1 separat danach.
- Fortsetzungsregel bei Kontextgrenze: gespeicherte Übersicht/Regeln/Ideen/Planung zuerst lesen, Git-Status aufnehmen, aktuellen Quellcode vor Patch erneut lesen. Zusammenfassungen können Details verlieren; niemals vollständige Erinnerung oder ausgeführte Tests voraussetzen.