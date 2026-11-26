# Multiplayer-Pilot

Die [VR-Seite auf GitHub Pages](https://fkchem-up.github.io/VR-Raum/) bleibt öffentlich und funktioniert im Einzelmodus ohne Server. Im Browserpanel „Multiplayer-Pilot“ ist `https://fkc-vr-multiplayer.onrender.com` vorausgefüllt. „Zugang prüfen“ sendet den Code per HTTPS an den ausgewählten Server und schaltet die Avatar-Verfügbarkeitsprüfung frei. Profil und Positionen werden erst nach „Gemeinsam beitreten“ im VR-Modus übertragen. Alle brauchen denselben Server, denselben Zugangscode und dieselbe Raum-ID, nicht dasselbe WLAN.

Der gemeinsame Zugangscode schützt den gesamten Multiplayer-Dienst, nicht einzelne Räume. Es gibt keine Konten, keine Adminrolle, kein Audio und keinen dauerhaft gespeicherten Lernfortschritt. Der Server prüft eine zufällige Sitzungskennung für die Avatar-Verfügbarkeit und alle Präsenzanfragen. Sie ist zwei Stunden gültig und wird im Browser nur im Arbeitsspeicher gehalten. Nach 20 falschen Codeversuchen im laufenden Minutenfenster pausiert die Codeprüfung bis zu dessen Ende; bestehende Sitzungen laufen weiter. Beim Ausschalten oder Verlassen von VR wird die Kennung verworfen. Ein Serverneustart beendet alle Sitzungen. Anzeigenamen sind freiwillig; Spitznamen genügen. Der Hoster kann technische Logs einschließlich IP-Adressen führen. Die Eignung für den regulären Lehrbetrieb separat klären.

## Was geteilt wird

| Gemeinsam sichtbar | Bleibt lokal oder ist ausgeschlossen |
| --- | --- |
| Avatar mit Vorschau, optionalem Spitznamen, frei wählbarer Form, Farbe und Stil; belegte Optionen sind pro Raum nicht wählbar. Der Würfel nutzt freie Optionen. | Keine Geschlechtsabfrage. Auswahl im Beitrittsmenü; der Server prüft sie beim VR-Beitritt erneut. |
| Kopf und Controller bzw. Zeigehände; virtuelle Augenhöhe 1,60 m. Laser und Treffpunkt, wenn auf ein Modell gezeigt wird. | Haupt- und Handmenü, Steuerhilfe, Laser im Malmodus und Malstriche. |
| Position, Drehung und Größe gemeinsamer Modelle. Eine Person hat die Greiffreigabe; beim Loslassen, Verlassen oder Timeout kann eine andere übernehmen. | Modellreset und Darstellungsstile wie Polyeder oder Kugel–Stab. |
| Ansichten wie Molekül, Koordination oder Zelle, auch für später Beitretende. Fremder Griff sperrt den Wechsel. | Tutorial und offener Strukturraum sind Einzelspielerbereiche. |
| Angeheftete Atomlabels und fertige Distanz-, Winkel- und Torsionsmessungen an derselben Modellvariante. Messwerte werden aus CIF-Koordinaten berechnet. | Flüchtige Laserlabels und noch laufende Messauswahl. Kein dauerhaftes Archiv. |

## Dienst auf einem HTTPS-Host starten

Auf einem Node-Webdienst mit öffentlicher HTTPS-Adresse dieses Repository als Quelle für den Webdienst wählen. Startbefehl: `node server/multiplayer.cjs`. Es gibt keinen Buildschritt und keine zu installierenden Pakete. Node 22 oder neuer verwenden. Umgebungsvariablen beim Host setzen:

- `FKC_ORIGIN=https://fkchem-up.github.io` (nur Schema und Host, **kein** `/VR-Raum/` und kein abschließender Schrägstrich; bei einer anderen Pages-Adresse entsprechend anpassen).
- `FKC_HOST=0.0.0.0` (damit der HTTPS-Proxy des Hosts den Dienst erreicht).
- `FKC_ACCESS_CODE` im Render-Dashboard unter **Environment** setzen. Der Dienst startet ohne Code nicht. Groß-/Kleinschreibung wird beachtet. Den Wert nicht in Git, in der URL oder im Browsercode hinterlegen; nur der Gruppe und nur für den vorgesehenen Server mitteilen. Für besseren Schutz einen längeren, schwer erratbaren Code wählen. Eine Änderung wird beim nächsten Deploy wirksam.
- `PORT` vom Host übernehmen; Standard ist `8787`.

Der Dienst selbst spricht HTTP; der Hosting-Proxy muss öffentlich **HTTPS** anbieten. [Gesundheitsprüfung](https://fkc-vr-multiplayer.onrender.com/health) soll `{"ok":true}` liefern. Eine einzelne Instanz nutzen. Der Pilot nutzt kurze HTTPS-Anfragen statt WebSockets. Render Free kann schlafen; vor dem Test die Gesundheitsprüfung aufrufen. Bei Änderungen an Server oder gemeinsamem Protokoll sowohl GitHub Pages als auch Render aktualisieren; bei ausbleibendem Auto-Deploy in Render **Manual Deploy → Deploy latest commit** wählen. Anschließend beide Pico-Seiten neu laden.

## Zwei Pico-Headsets testen

1. Auf beiden Picos dieselbe VR-Seite und dieselbe vertrauenswürdige Serveradresse verwenden. „Multiplayer-Pilot“ öffnen und mit „Zugang prüfen“ zuerst einen falschen Code (muss abgelehnt werden), dann den vereinbarten Code testen. Avatar wählen, „Gemeinsam beitreten“ klicken, VR starten und das Tutorial überspringen. `?multiplayer=` kann nur die Serveradresse vorgeben; vor der Codeeingabe diese prüfen.
2. Im Begrüßungsraum am Team-B-Podest testen: auf Co zeigen; Modell greifen, drehen, skalieren und übergeben; Ansicht **Molekül → Koordination → Molekül** umschalten; Label anheften und eine Messung abschließen sowie wieder entfernen. Die zweite Person schaut zunächst nur zu.
3. Raum wechseln bzw. VR verlassen; fremde Anzeigen müssen aus dem bisherigen Raum verschwinden. Bei Verbindungsabbruch verfallen alte Teilnehmendenpositionen nach ungefähr fünf Sekunden. Ohne aktiven Beitritt bleibt die Anwendung im Einzelmodus.

## Nächste Etappen

Nutzerbestätigt auf Pico vor Einführung des Zugangscodes: Beitritt, gemeinsames Zeigen, gedrehte Modelle sowie geteilte Labels und Messungen. Zugangscode, gemeinsamen Ansichtswechsel und Betrieb mit größeren Gruppen bzw. über eduroam separat praktisch prüfen. Sinnvolle spätere Pakete: gemeinsames Markieren nach Nachtest des lokalen Malmodus, gemeinsamer Modellreset und bei Bedarf getrennte Gruppensitzungen.