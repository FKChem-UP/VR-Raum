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

## Etappe: kurze Atomlabels und bewusster Poster-Raumeintritt
- Nutzer bestätigt Handmenüausrichtung. Labels jetzt nur Original-CIF-Label, ohne Modellnummer; getrennte Metadaten bleiben vollständig erhalten.
- Neues `js/room-entry.js`, Szene-Komponente und Anbindung in app.js: Poster in PC/VR erst nach 1000 ms Drücken bei gleichem Ziel betreten. Balken/Prozent und Abbruchhinweis am Trefferpunkt. Loslassen, Zielwechsel, Trackingverlust, Greifen, Menü oder VR-Wechsel brechen ab. Nur gewählte Laserhand startet VR-Bestätigung. Hauptmenü/Browser-Raumauswahl unverändert; ursprüngliche sofortige Poster-Aktionen in den zur Laufzeit verwendeten app.js-Pfaden entfernt.
- Neuer Test `tests/room-entry.test.cjs`: Dauer, Fortschritt, Loslassen, Zielwechsel, entferntes Ziel und einmaliger Abschluss. Atomlabel-Test an verkürzte Anzeige angepasst. Echte PC-/Pico-Ereignis-/Renderingtests noch offen.
- Co-Produkt1.cif: Nutzeränderung unangetastet. Aktuelle Datei vollständig in zwei Abschnitten gelesen (476 Zeilen, 19304 Bytes). Reflexionszeilen entfernt; Atom-/Bindungs-/ADP-Tabellen und eingebetteter SHELX-Text vorhanden. Trikline Zelltransformation und mehrzeilige Felder weiterhin nötig; nicht automatisch mit C60-Importer kompatibel.
- Nachtest: kurzer Klick kein Eintritt, Halten füllt Balken, Loslassen/Wegzeigen setzt zurück, 1 Sekunde betritt genau einmal. PC und beide VR-Laserhände getrennt prüfen, andere Raumwahlwege und Zeichnen gegenprüfen. Danach Distanzmessung planen.

## Etappe: Pico-Fortschrittsanzeige und kompakte Atomlabels
- Nutzerpriorität: zunächst Pico-Ansicht/-Bedienung zufriedenstellend fertigstellen; PC-/weitere Geräteparität später. Bestehenden PC-Pfad nicht entfernen.
- Separater Ladebalken war laut Nutzer auf Pico nicht sichtbar. Fortschritt nun direkt in bestehender transparenter Betreten-/Türsymboltextur in browser-xr.js: weiße Striche/Schrift durch Clipping von unten nach oben schwarz überzeichnen, weißes Ausgangsbild bei Abbruch wiederherstellen. room-entry.js verteilt Fortschritt an die Hinweis-Komponenten, separater Sprite in VR ausgeblendet; PC-Balken erhalten. Haltezeit weiterhin 1000 ms.
- Atomlabel-Canvas bleibt technisch 768×128; sichtbare Texturregion und Sprite-Breite folgen gemessener Textbreite plus 48 Pixel Polsterung. Texthöhe unverändert, Maximalbreite begrenzt; C1 kleiner als Cl12. Keine Änderung von Struktur-/ID-Daten.
- Tests ergänzt für Textbreitenberechnung und Übergabe/Rücksetzung des Fortschritts an Hinweise. Sichtbare schwarze Füllung und UV-Zuschnitt müssen auf Pico praktisch geprüft werden; keine Agenten-Renderingtests.
- Geändert: js/browser-xr.js, js/room-entry.js, js/atom-labels.js, beide zugehörigen Tests, index.html und drei Dokumentationsdateien. Kein Commit/Push, keine neuen Abhängigkeiten oder Assetänderungen.

## Etappe: Standard-/angeheftete Labels und Distanzprototyp
- Nutzer bestätigt vorige Pico-Anzeigeänderungen. Neue Freigabe: Standard Anvisieren, zusätzlich Alle/Aus, Labels per Trigger anheften/entfernen, Distanz per Atom-/Bindungsauswahl und kleineres Handmenü.
- Labelmodus ohne explizite Root-Einstellung nun hover. Pins per Mesh-Identität, bei Entfernung/Variantenwechsel bereinigt; Alle zeigt CIF-Atomlabels der sichtbaren geladenen Modelle. Aus blendet Pins aus, erneutes Aktivieren zeigt sie wieder. Keine erfundenen GLB-Labels. Hover hebt weiterhin nur aktuellen Treffer hervor; angeheftete Labels bleiben ohne permanente Atomumfärbung. Zusätzliche Sprites nicht treffbar und nicht Teil der Modellnormalisierung.
- Neues measurements.js: expliziter Distanzmodus, zunächst ausschließlich CIF-Einzelmolekül. Zwei unterschiedliche Atomklicks (auch ohne Bindung) oder eine Bindung wählt deren Endatome. Å-Distanz aus Strukturmetadaten, Linie folgt Atom-Mesh-Weltpositionen. Erneuter Klick nach Ergebnis beginnt neue Messung; zweiter Klick auf erstes Atom nimmt Auswahl zurück. Menü Reset/An-Aus; Varianten-/Modell-/Raumwechsel räumt Ergebnis auf. Noch keine periodischen Zellmessungen/Winkel. Während Messmodus Trigger exklusiv für Messung, sonst CIF-Atomtrigger für Pin; kein gleichzeitiger Zeichenbeginn.
- Handmenüfläche 0,272×0,32 m, Textzeilen 36 statt 45 Pixel, Buttons 52 Pixel hoch/60 Pixel Abstand. Praktische Zielgröße und Alle-Label-Leistung bei 240 Atomen auf Pico ungeprüft.
- Tests ausgeführt: measurements.test.cjs (numerische Distanz/Weiterleitung), atom-labels.test.cjs um Standard/Alle/Pin-Toggle ergänzt; room-entry-, hand-menu- und cif-model-Tests weiterhin bestanden. Syntaxprüfung von measurements.js, atom-labels.js, app.js, hand-menu.js, vr-tools.js und Diffkontrolle bestanden. Vereinfachte Testobjekte, kein echtes VR-Rendering/Controller-/Integrationsnachweis.
- Geändert: atom-labels.js, app.js, hand-menu.js, vr-tools.js, index.html, Atomlabel-Test und Dokumentation. Neu: measurements.js, tests/measurements.test.cjs. Keine Assetänderungen/Abhängigkeiten/Commits/Pushes.
- Nachtest Pico: Labelstandard/Alle/Aus und Pin-Toggle, keine Doppelbeschriftung, Modell-/Variantenwechsel, kleineres Menü vollständig lesbar; Distanzmodus, zwei Atome/eine Bindung, 1,400–1,456 Å bei C60-Bindungen, Skalierung unveränderter Wert, Neustart/Beenden und Zeichnen nach Beenden. Space-Filling bietet keine Bindungsstäbe zum Anklicken. PC-Bedienung später vereinheitlichen.

## Etappe: Messhervorhebung, Winkel und Torsion
- Nutzer bestätigt vorherige Etappe. Freigegeben: weiteres kleineres Handmenü, dauerhaft beschriftete/hervorgehobene Messatome und Verbindungen, kompakte/transparente Labelhintergründe, Winkel-/Torsionsmessung.
- Handmenü 0,245×0,288 m (weitere circa 10 % kleiner), eigene Messseite mit Distanz (2 Atome oder Bindung), Winkel (3 Atome), Torsion (4 Atome), Reset und Beenden. Weiter nur CIF-Einzelmolekül; keine periodischen Zellmessungen.
- Winkel zwischen A-B und C-B, B als Scheitel, 0–180°. Torsion: Achse B→C; v und w sind die auf deren Normalebene projizierten Richtungen B→A und C→D. atan2((Achse×v)·w, v·w), Ausgabe -180 bis +180°. Nullvektoren/kollineare Torsionspunkte werden als nicht definiert angezeigt; keine erfundenen Zahlen. Werte aus Å-Metadaten, keine visuelle Skalierungsabhängigkeit.
- Messlabels in separater Map unabhängig von normalen Pins und Labelmodus; ausgewählte Atome bleiben beschriftet, auch wenn normale Labels Aus sind. Gelbe transparente Aura (Opacity 0,32) um Atome, gelbe transparente Stabüberlagerung (0,65) entlang aufeinanderfolgender Messpunkte. Das sind Messhilfen, keine neu behaupteten chemischen Bindungen. Originalmaterialien unverändert; auch ungebundene Punkte messbar.
- Ergebnistextur UV-Zuschnitt nach gemessener Breite; alle Atom-/Messhintergründe Alpha 0,65, Text und Rahmen deckend. Keine Sprite-Gesamtopacity reduziert. Reset/Beenden/Modell- oder Geometriewechsel entfernt Messlabels, Auren und Ergebnis, normale Pins bleiben erhalten. Nächster Klick nach vollständiger Messung beginnt neue Auswahl; erneutes ausgewähltes Atom während unvollständiger Auswahl nimmt es zurück.
- Tests erweitert: bekannte Winkel 45/90/180°, Torsion 0/±90/180°, entartete Geometrien, Rotations-/Translations-/Skalierungsinvarianz, Atom-/Bindungsauswahlfolge, persistente Messlabels, Reset/Rücknahme, Ergebnisbreite und Zell-Ausschluss. Rendering/Auren-Pico-Test noch offen; keine neuen Abhängigkeiten/Assetänderungen.
- Nachtest: alle drei Modi, Klickreihenfolge, Auren/Labels sichtbar, Schrift deckend bei transparentem Hintergrund, Skalieren/Styles/Reset/Variantenwechsel, normaler Pinmodus und Zeichnen nach Beenden. Bei Torsion kann Vorzeichen von anderen Programmen abweichen, wenn dort andere Reihenfolge/Konvention verwendet wird.

## Etappe: Direktbuttons und freistehende Schrift
- Nutzer meldet bisherige Messung als gut, Labels aber schlecht sichtbar hinter Messgeometrie. Rechteckhintergründe entfernt; weiße deckende Schrift mit dunkler Kontur. Atomlabels Richtung Kamera vor Atomoberfläche mit kleinem Aufwärtsversatz; Messwert Richtung Betrachter vor Messzentrum. RenderOrder Atomlabels 1100/Messwert 1101 statt hinter Messhilfen 1001/1002; Tiefentest weiter aus. Echte Messkoordinaten nicht verändert.
- Handmenü ohne Mess-/Style-/Info-Unterseiten. Direkte Symbolbutton-Reihen mit kurzen Beschriftungen: Messung 2/3/4 Atome, Winkelbogen; Styles Kugel-Stab/raumfüllend/Wires/Sticks. Aktive Auswahl hellrot und 5 Pixel eingedrückt. Messbutton toggelt aktiven Modus aus; anderer schaltet exklusiv um und räumt vorherige Messung auf. Style bleibt exklusiv, da immer eine Darstellung nötig ist.
- Labels-Modusbutton und Resets bleiben direkt. Kurzinfo und Elementlegende auf derselben Fläche. Ausführliche Modelltexte nicht gelöscht, aber nicht mehr auf separater Handmenüseite. Vorhandener Modell-/Browsermenüpfad bleibt für Texte; VR-Zugänglichkeit langer Texte kann später separat verbessert werden. Bei mehr als drei Varianten weiterhin Durchblättern derselben Ansichtsliste statt Untermenü.
- Auraopacity 0,16 statt 0,32; Messstabopacity 0,35 statt 0,65. Keine Änderung von Elementfarben/Strukturdaten.
- Fünf Node-Tests ausgeführt und bestanden, einschließlich neuer Direktmenü-Layout-/Buttonumschalttests und Messmodus-Toggle. Syntax der drei JS-Dateien und Diffkontrolle bestanden. Keine Agenten-Renderingtests. Nächster Pico-Test: vollständige Fläche, Symbolverständlichkeit, gegenseitiger Ausschluss, Aus-Toggle, freistehende Schrift vor Messhilfen und blassere Auren.

## Etappe: Menüfeedback, Bewegung und Co-Grundlage
- Neue Freigabe: überlappendes Space-Filling-Symbol, Hoverfeedback, kurze Druckanimation aller Buttons, Navigation mit offenem Handmenü, Beginn Co-Import nach getrennten Schritten.
- hand-menu.js: überlappende Kreise für Space-Filling, aktueller Laser-Ray für UV-Buttonhover, goldener Hoverrahmen, heller Hoverhintergrund; 180-ms-Druckzustand bei Symbol- und Textbuttons einschließlich Reset. Trefferbereiche unverändert. Aktive Style-/Messbuttons bleiben zusätzlich hellrot/eingedrückt.
- app.js: nur zusätzliche Handmenü-Navigationssperre entfernt. Hauptmenü- und Komfortablauf bleiben erhalten. Handmenü-hide setzt Navigation nicht mehr unnötig zurück. Zeichnen/Raumaktionen bleiben während Handmenü gesperrt.
- Neues cif-structure.js bewusst noch nicht in index.html oder Modelllader eingebunden. Begrenzte numerische Importbasis für vorliegendes Co-Produkt1: quoted/multiline CIF-Werte, unsichere Zahlen mit Klammernotation, trikline Zellbasis, Symmetrieterme ohne eval, Codes wie 2_666, Sites mit Original-Labels/Besetzung/CIF-Uij und geometrischer Bindungsprüfung. Keine vollständige Molekül-/Zellrekonstruktion, keine kartesische ADP-Tensortransformation und kein allgemeiner CIF-Parser zugesichert.
- co-structure.test.cjs ausgeführt: 36 unabhängige Sites, 20 Nicht-H, 6 Elemente, 22 tabellierte Bindungen; alle Sites voll besetzt; Uij bei Nicht-H erhalten. Zellvolumen 765,8157077 Å³; maximale Abweichung tabellierter/berechneter Bindungsabstände 0,0003697 Å. Mehrzeilige SHELX-Felder korrekt als Text, ungültige Symmetrie abgelehnt.
- Alle sechs Tests, Syntax von hand-menu.js/app.js/cif-structure.js und Diffprüfung bestanden. Zwischenzeitlicher Syntaxfehler bei Buttonindex-Deklaration durch Tests entdeckt und korrigiert. Keine Agenten-Gerätetests, keine neuen Abhängigkeiten, GLB-/CIF-Assets unverändert.
- Nächstes Paket: vollständige zusammenhängende Co-Einheit aus expliziten Symmetriebindungen rekonstruieren, fehlende H-Bindungen und Bestandteile absichern, dann Teststation Team B hinzufügen. Umgebungsvorschau, Reichweiten/Übernahme und Formeleinheit als separate Zukunftspakete, nicht automatisch umgesetzt.

## Etappe: gespeicherte Messungen und Co-Nicht-H-Rekonstruktion
- Mehrere Ergebnisanzeigen gespeichert, inklusive eigener Geometrie/Labelmaterialien und jeweiligem Modus. Moduswechsel/Beenden löscht nur unvollständige Auswahl. Neue Messung erhält abgeschlossene Ergebnisse; gemeinsame Atomlabels als Union gespeichert und aktueller Auswahl. Resetbutton ausdrücklich Alle Messungen zurücksetzen. Betroffene Anzeigen bei Modellgeometrie-/Raumwechsel bereinigen, nicht beim bloßen Auswählen eines anderen Modells. Keine Speicherung über Browser-Neuladen.
- Farben: Distanz gelb, Winkel rot (#ff5555), Torsion blau (#5599ff), jeweils Messzahl/Auren/Messlinien passend. Winkelbogen in A-B-C-Ebene; Torsion durch transparente Dreiecke A-B-C und B-C-D veranschaulicht. Geometrische Hilfen, keine Kristall-/Koordinationsflächen. Bei entarteter Geometrie kein gültiger Winkelbogen; Torsionsflächen können entarten. Viele Messungen können Bild/Leistung belasten, keine automatische Labelkollisionslösung.
- Handmenüversatz 10 cm entlang Hand→Kopf negativ, also vor Hand vom Kopf weg. Augenmittelpunkt-Ausrichtung und Einblendkriterien erhalten; Pico-Ergonomie ungeprüft.
- Co-Rekonstruktion ausschließlich vorliegende P-1-Symmetrie und explizite Bindungstabelle: symmetrievervollständigte zusammenhängende Nicht-H-Einheit 36 Atome/44 Bindungen, zwei Co mit jeweils sechs Nachbarn. Bindungsabstände aller rekonstruierten Kanten gegen CIF geprüft. H-Bindungen nicht tabelliert und noch nicht ergänzt; weitere unabhängige Bestandteile außerhalb verbundener Einheit nicht automatisch übernommen. Kein allgemeiner Netzwerkimport und keine sichtbare VR-Teststation.
- Sechs Node-Tests ausgeführt und bestanden. Messauswahltest ergänzt für Archiv/Union, Erhalt über Auswahlende und explizites Reset; Geometrie-Erzeugung dort gestubbt, kein Three.js-Renderingtest. Co-Test um rekonstruierte Nicht-H-Einheit/Koordinationsgrad/Abstände ergänzt. Syntax von measurements.js/hand-menu.js/cif-structure.js und Diffkontrolle bestanden. Assets unverändert; kein Commit/Push.
- Rückmelderegel: Nach tatsächlichem Headset-Test meldet Nutzer nur Probleme, sonst zufrieden. Agent protokolliert keine nicht belegte Testausführung und kennzeichnet eigene Tests getrennt.
- Nächstes Paket: gespeicherte Distanz/Winkel/Torsion kombiniert auf Pico prüfen, Reset/Farbzuordnung/Menüabstand; Co-H-Zuordnung und begrenzte Teststation Team B vorbereiten. Noch kein Co-Modell auf Headset sichtbar.

## Etappe: sichtbares Co-Testmodell und Handmenü-Zielpunkt
- Handmenü: Zielkreis 3,6 mm Durchmesser, Opacity 0,55, Farbe aus gewählter Laserhand; auf aktueller Treffer-UV, keine Raycast-Blockade. Cursorressourcen beim Entfernen freigeben. Legende bei sechs Elementen auf zwei Zeilen statt Überlauf.
- cif-structure.js vor cif-model.js eingebunden, Team B Station 1 an linker Wand mit zwei Varianten. Keine Begrüßungs-/GLB-Ersetzung. Verbindungsansicht ausdrücklich zusammenhängende zweikernige Koordinationseinheit, kein vollständiges stöchiometrisches Ensemble inklusive Kristallwasser/Gegenionen.
- Nicht tabellierte H-Bindungen: pro unabhängigem H alle C/N/O-Abbilder aus zwei Symmetrieoperationen und Nachbarzellen prüfen. Genau ein Kandidat 0,6–1,25 Å erforderlich, sonst Importabbruch. Als geometrisch ergänzt dokumentiert, keine Wasserstoffbrücken erzeugt. Verbindung 64 Atome/72 Bindungen; excludedSites O1,H3,H2,Cl03. Zelle alle 72 Atome/76 Bindungen einschließlich freiem Chlorid/Kristallwasser. Vollbesetzung und konkrete 36-Site-P-1-Teststruktur begrenzt, kein generischer Import.
- Gemeinsamer Renderer: elementweise Materialien, vier Styles. Space-Filling-Radiuskonvention (Å): H 1,20; C 1,70; N 1,55; O 1,52; Cl 1,75; Co 2,00. Co-Wert ausdrücklich gewählter Darstellungswert, nicht aus CIF abgeleitet. Ball-and-Stick H-Radius 0,20, andere 0,32. Trikliner Rahmen aus Zellmatrix; periodische Bindungen in fraktionellen Koordinaten teilen, danach kartesisch transformieren. Einzelverbindung nutzt bestehende Manipulation/Normalisierung/Messung; Zellmessung weiter gesperrt.
- Tests erweitert für beide Co-Ansichten, Atom-/Bindungszahlen, ausgelassene Sites, Bindungslängen, periodische Teilstücklängen und Zellgrenzen sowie O-Space-Filling-Radius. C60-Tests unverändert bestehen. Keine Tensortransformation/Ellipsoid-/Polyederumsetzung, keine Renderer-/Pico-Tests des Agenten.
- Geändert: hand-menu.js, cif-structure.js, cif-model.js, rooms.js, index.html, co-structure-/cif-model-Tests und drei Dokumentationsdateien. Assets unverändert, kein Commit/Push/Installation.
- Pico-Test: Team B betreten, Station 1 auswählen, Verbindung/Zelle wechseln, vier Styles und sechs Elementfarben, Labels/Anheften/Greifen/Skalieren/Reset prüfen; Co-Abstände gegen CIF und Messung in Verbindungsansicht vergleichen. Zelle auf korrekten schiefwinkligen Rahmen/Randbindungen prüfen. Co01 besitzt je sechs Koordinationsnachbarn, vollständige Einheit zwei Co-Zentren. Bei fehlender Darstellung Konsole bzw. Statusmeldung angeben.

## Etappe: elementfarbige Stäbe und erleichterte Atomtreffer
- Nutzer bestätigt gutes Co-Modell. Wires/Capped Sticks jetzt Bindungshälften in Endatomfarben. Neutraler Stylewechsel stellt ursprüngliches Bindungsmaterial wieder her; elementweise Materialien geteilt und beim Entfernen freigegeben.
- Molekülbindungen am Mittelpunkt geteilt, gleiche Bindungsmetadaten an beiden Hälften. Zellbindungen zusätzlich bei t=0,5 geteilt; Farbhälfte aus globaler Bindungsparametrisierung, nicht Mittelpunkt des zufälligen Zellabschnitts. C60-Zelle nun 804 Renderabschnitte, weiterhin 240 Atome/360 Bindungen.
- Atom-Mesh-Raycast in Wires/Capped Sticks analytisch auf Kugelradius 0,22 Å erweitert. Reale Mesh-Geometrie/Bounds nicht verändert; zurückgelieferter Treffer gehört zum originalen Atommesh, ohne Face normaler Ray-Rückfall. Andere Styles verwenden ursprüngliches Mesh-Raycast. Keine unsichtbaren Proxy-Meshes in Normalisierung.
- Sechs Node-Tests ausgeführt/bestanden: Stylematerialwechsel, Erhalt von Struktur-/Bindungswerten, Co-Zellabschnitte mit je halber summierter Bindungslänge pro Farbhälfte. Syntax/Diffprüfung bestanden. Analytischer Raycast nicht mit echter Three.js-Rendererintegration getestet; Pico-Auswahlgenauigkeit/Leistung offen.
- Geändert: cif-model.js, tests/cif-model.test.cjs, index.html, Übersicht/Ideen/Plan. Kein Commit/Push/Assetänderung. Fortsetzungscheckpoint am Anfang PROJECT_CONTEXT.md ergänzt, vor Compact lesen/sichern.
- Nächste Reihenfolge: aktuelle Änderung auf Pico prüfen, Co-Koordinationsansicht/Polyeder oder fachlich korrekte ADP-Ellipsoide planen, Umgebungsauswahl/Ausblenden; dann NaCl/Salzklasse und weitere CIFs. Keine pauschale Universalitätszusage nach fester Anzahl Strukturen.

## Etappe: Co-Koordinationsumgebung und Polyhedral-Style
- Nutzerfreigabe: Koordinationsumgebung, danach Polyhedral. Ohne Umbenennung/Ersetzung anderer Stationen und ohne Assetänderungen.
- Dritte Co-Ansicht in Team B Station 1: `co-coordination`, `cifMode: coordination`. Erstes Co-Zentrum der rekonstruierten Komplexeinheit und sechs über CIF-Bindungen identifizierte Nachbarn: 2 N, 2 O, 2 Cl; 7 Atome/6 Bindungen. Ein Cl-Symmetrieabbild bleibt ausdrücklich erhalten. Koordinaten zum Co-Zentrum verschoben, IDs/Original-Labels/Modellnummern/Symmetrieinformationen nicht neu erfunden. Bond-Indizes auf Ausschnitt abgebildet. Kein zweites Co und keine vollständigen Liganden im Koordinationsausschnitt.
- Co-Komplex speichert zwei Koordinationsumgebungen, Ausschnitt eine. Polyhedral als fünfter direkter Symbolbutton mit transparenter Co-farbiger Hülle (opacity 0,20) über Kugel-Stab. Atom-/Bindungsmessungen und Labels weiterhin möglich, Flächen haben leeres Raycast und blockieren Auswahl nicht. Kein neues Paket und kein Buildsystem.
- Geometrie: numerische konvexe Hülle aus sechs tatsächlichen Nachbarpositionen. Unterstützende Ebenen bestimmen, koplanare Facetten einmal sortieren/triangulieren, nach außen gerichtete Normalen. Acht Dreiecke pro Co-Oktaeder, keine Idealgeometrie und keine zusätzlichen Bindungsmetadaten an Polyederkanten. Ressourcen beim Modellabbau freigegeben.
- Polyhedral nur verfügbar, wenn Koordinationsmetadaten vorhanden: Komplex und Koordinationsansicht, nicht C60 und Co-Zelle. Wechsel aus Polyhedral in nicht unterstützte Ansicht zeigt Kugel-Stab und markiert diesen Button; gespeicherte Stylepräferenz erlaubt Rückkehr zu Polyhedral beim Rückwechsel. Zellpolyeder brauchen später vollständige Nachbarabbilder über Zellgrenzen.
- Messmodus nun für `molecule` und `coordination` freigegeben, periodische Zellmessung weiter gesperrt. Modellinformation unterscheidet Koordinationsansicht korrekt. Menüfläche nicht vergrößert; fünf Styles nebeneinander, Pico-Treffbarkeit/Lesbarkeit prüfen.
- Tests ausgeführt: sechs Node-Testdateien bestanden, Syntaxprüfungen der geänderten JavaScript-Dateien bestanden. Neue Tests für Atom-/Bindungszahl, 2N/2O/2Cl, Originalmetadaten, Abstände, geschlossene Hülle/12 Kanten/8 Flächen, Zentrum innerhalb und Normalen nach außen; Würfel mit koplanaren Flächen, entartete Hülle, Stylewechsel/Rückfall, fünfter Menübutton/Layout, Messung im Koordinationsausschnitt. Tests mit numerischen Funktionen und vereinfachten Objekten, kein tatsächlicher Three.js-/Pico-Renderingtest.
- Pico-Nachtest: Team B Station 1, Komplex → Zelle → Koordinationsumgebung; genau ein Co mit sechs Nachbarn. In Ausschnitt vier bisherige Styles plus Polyhedral vergleichen; transparentes verzerrtes Oktaeder, Labels/Messung/Greifen/Skalieren/Reset testen. Im Komplex zwei Polyeder, in Zelle kein Polyederbutton. Rückwechsel/keine überzähligen Flächen und C60-Regression prüfen.
- Bearbeitet: js/cif-structure.js, js/cif-model.js, js/rooms.js, js/hand-menu.js, js/measurements.js, js/vr-tools.js, index.html, vier Tests (co-structure/cif-model/hand-menu/measurements), PROJECT_CONTEXT.md, Ideen.txt und diese Planung. Kein Commit, Push, Löschen oder Installation.
- Nächstes Paket erst nach Rückmeldung planen: Ellipsoide mit korrekter ADP-Tensortransformation und festgelegter Wahrscheinlichkeit oder Umgebungsauswahl/Ausblenden. Keine Universalitätszusage.

## Etappe: Handmenüüberschriften und nächste Planungswünsche
- Nutzer bestätigt gute Pico-Darstellung der Koordinationsansicht/Polyeder, meldet übermalte Überschriften Styles/Messen/Legende.
- Ursache: Überschrift bei y+30 auf Schriftgrundlinie gezeichnet, danach y nur um 30 erhöht; nachfolgende Rechtecke übermalen Unterlängen. Textzeilenhöhe jetzt 44 Pixel, Platz unter Grundlinie plus Abstand. Keine Vergrößerung der physischen Menüfläche oder neue Unterseite.
- Layouttest erfasst Textgrundlinien/Rechtecke, prüft mindestens 10 Pixel Abstand vor nachfolgenden Flächen und Inhalt innerhalb 900 Pixel. Echter Pico-Nachtest offen.
- Wünsche dokumentiert, nicht umgesetzt: Zahnrad-Einstellungsseite mit Menügröße und Bindungsfarbe, später Umgebungsradius/H-Brückenparameter. Nutzer schlägt damit Ausnahme vom früheren Untermenüverzicht vor: direkte Arbeitsbuttons beibehalten, seltene Einstellungen separat. Globale Laser-/Komfortoptionen bleiben Hauptmenü. Bindungsfarbenmodus (einheitlich vs. Endatomfarben) und Geltung pro Modell/Style vor Umsetzung festlegen.
- Empfehlung nächstes Paket: periodische Umgebung für Co-Komplex, transparenter Kandidatenmodus mit Radius und reversibler Übernahme. Standardmäßig ganze Moleküle/Ionen ergänzen, Atommodus später; Reichweite minimaler Atomabstand zur Basisstruktur, keine Bindungsregel. Symmetrie-IDs/Zellabbilder behalten. H-Brücken danach mit geeigneten Donoren/Akzeptoren, H-Zuordnung, Abstands- und Winkelbedingungen; Kontakte als geometrische Kandidaten kennzeichnen, nicht als chemischen Beweis.
- Geändert: js/hand-menu.js, tests/hand-menu.test.cjs, index.html, PROJECT_CONTEXT.md, Ideen.txt und diese Planung. Kein Commit/Push/Assetänderung.

## Etappe: Zahnrad, Menügröße und Bindungsfarben
- Freigabe: Zahnrad und besprochene Optionen umsetzen. Header-Zahnrad oben rechts, eigene Einstellungsseite mit Zurückbutton; Hauptseite behält direkte Werkzeuge. Hover/Triggerfeedback aus bestehender Buttonlogik. Kein zusätzliches Hauptmenü oder globaler Komfortumbau.
- Menügröße Kleiner 85 %, Standard 100 %, Größer 115 %, relative Skalierung der bisherigen 0,245×0,288-m-Fläche. Root-Skalierung lässt Plane-Raycast-UVs gleich, Canvasbuttons unverändert, Laserpunkt als Kind skaliert/positioniert korrekt mit. Gilt sitzungsweit und für beide Hände/alle Modelle, nicht persistent über Browserneustart.
- CIF-Bindungsmodi pro Modell: auto/Style-Standard (Wires/Capped Sticks endatomfarbig, andere Styles neutral), element/Endatomfarben (alle sichtbaren Bindungen elementfarbige Hälften), uniform/Einheitlich. Palette Grau #949494, Weiß #eeeeee, Dunkelgrau #333333, Orange #ff9d38. Farbwahl aktiviert uniform. Space-Filling zeigt weiterhin keine Bindungen. Neutralmaterial getrennt von Atommaterial, keine Änderung an Atomen/Legende/Polyedern/Messungen/Zellrahmen. Keine neuen Materialien bei jedem Klick. Farbwechsel verändert keine Koordinaten/Normalisierung.
- Root-Präferenzen auf neue CIF-Varianten beim Laden übertragen; zurück zur Werkzeugseite/Stylewechsel erhält Präferenz. Beim Raumneubau oder Reload Standard. GLB: Größe ja, keine Bindungsfarben, weil keine strukturierte Bond-Metadaten. Keine Umgebung-/H-Brückenplatzhalter.
- Tests tatsächlich ausgeführt: sechs Testdateien bestanden, Syntax der zwei geänderten JS-Dateien geprüft. Neue Tests: Zahnrad/Zurück, 11 Einstellungsbuttons und GLB-Rückfall, Layout, gültige/ungültige Größe und Skalierung, Farbmodus/Palette, auto-Wiederherstellung und Stylewechsel, ungültige Farben/Modi/Pending-Visual-Abbruch. Tests verwenden numerische Funktionen/vereinfachte Objekte; kein Renderer-/Pico-Test.
- Pico-Nachtest: Zahnrad mit beiden Laserhänden, Größen 85/100/115 (Laserzielpunkt und Randbuttons korrekt), Zurück/Wiederöffnen; Co-Komplex und Zelle mit Uniform/Endatom/Standard in vier Styles, Polyhedral im Komplex. Variantenwechsel erhält Farben, Atomlegende/Messfarben unverändert, Space-Filling ohne Stäbe. Menü aus-/einblenden führt wie bisher zur Werkzeugseite.
- Bearbeitet: js/hand-menu.js, js/cif-model.js, tests/hand-menu.test.cjs, tests/cif-model.test.cjs, index.html und drei Dokumente. Keine Pakete/Assets geändert, kein Commit/Push/Löschen. Nächste Planung: periodische Umgebungskandidaten, Auswahl/Übernahme, danach H-Brücken.