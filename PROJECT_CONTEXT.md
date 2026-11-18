# PROJECT_CONTEXT.md

## Zweck des VR-Raums
Der VR-Raum wurde speziell für die Veranstaltung zur Festkörperchemie (FKC) entwickelt. Ziel ist es, interaktive und immersive Erfahrungen zu schaffen, durch die Studierende Modelle von Festkörperstrukturen und chemischen Prozessen räumlich erkunden können.

## Wichtige Projektdateien und ihre Aufgaben
- **`index.html`**: Einstiegspunkt der Anwendung. Hier werden die A-Frame-Bibliothek und alle zentralen Skripte eingebunden.
- **`styles.css`**: Definiert das Erscheinungsbild der Benutzeroberfläche.
- **`js/vr-controls.js`**: Steuert VR-Interaktionen und Benutzeraktionen.
- **`js/app.js`**: Enthält die Hauptlogik der Anwendung.
- **`.nojekyll`**: Stellt sicher, dass GitHub Pages reine HTML- und JavaScript-Dateien ausliefert.

## Nachgewiesene Start- und Testmöglichkeiten
Um die Anwendung lokal zu starten und zu testen:
1. Lokalen Entwicklungsserver einrichten (z. B. Python HTTP-Server oder Node.js http-server).
2. Die Datei `index.html` im Browser öffnen, der WebXR-/WebVR unterstützt, z. B. Chrome.
3. Aufrufen der Anwendung unter `http://localhost:<PORT>`.

## Bekannte Probleme und offene Fragen
- **Fehlender Kontext:** Einige JavaScript-Dateien im `js`-Ordner (z. B. `vr-controls.js`) wurden noch nicht auf ihren spezifischen Inhalt untersucht.
- **Mögliche Abhängigkeiten:** Nicht klar, ob alle eingebundenen Dateien und verlinkten Bibliotheken mit den aktuellen Anforderungen kompatibel sind.

## Aktueller Arbeitsstand
Lesender Zugriff auf die wichtigsten Dateien wurde durchgeführt. Weiterführende Analysen könnten in den JavaScript-Dateien Vertiefung finden, um das VR-Raumerlebnis vollständig zu evaluieren.

## Umbauplanung und nächstes Arbeitspaket
Die bestätigten Anforderungen, die lesende Bestandsaufnahme und offene Entscheidungen sind in [docs/VR_REDESIGN_PLAN.md](docs/VR_REDESIGN_PLAN.md) dokumentiert.

Vereinbartes nächstes Arbeitspaket: **CIF-Basis reproduzierbar absichern** — aktuelle Dateien und Git-Status prüfen, vorhandene lokale Startumgebung feststellen, Variantenwechsel und CIF-Manipulation/Reset am PC sowie numerische Strukturprüfungen durchführen und Ergebnisse dokumentieren. Noch kein Elementarzellenumbau, keine Atomlabels und keine allgemeine Modularisierung.

Bisher wurden keine Browser-, Pico- oder numerischen Strukturtests durch den Agenten ausgeführt. Die oben genannten Serveroptionen sind Vorschläge, keine nachgewiesenen lokalen Startmöglichkeiten. Mit der Speicherung der Planung wurde kein Anwendungscode geändert und das nächste Arbeitspaket noch nicht ausgeführt.