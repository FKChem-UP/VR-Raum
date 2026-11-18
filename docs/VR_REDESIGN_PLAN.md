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