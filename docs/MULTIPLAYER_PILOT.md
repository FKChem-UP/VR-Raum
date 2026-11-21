# Multiplayer-Pilot

Die [VR-Seite auf GitHub Pages](https://fkchem-up.github.io/VR-Raum/) bleibt öffentlich und funktioniert im Einzelmodus ohne Server. Im Browserpanel „Multiplayer-Pilot“ ist `https://fkc-vr-multiplayer.onrender.com` vorausgefüllt. Übertragen wird erst nach bewusstem Klick auf „Gemeinsam beitreten“ und im VR-Modus. Alle brauchen denselben Server und dieselbe Raum-ID, nicht dasselbe WLAN.

Der Pilot hat keine Konten, keinen Raumcode, keine Adminrolle, kein Audio und keinen dauerhaft gespeicherten Lernfortschritt. Anzeigenamen sind freiwillig; Spitznamen genügen. Avatare und Sitzungszustände werden nur im Arbeitsspeicher gehalten. Der Dienst ist offen; der Origin-Filter ist kein Zugriffsschutz. Der Hosting-Anbieter kann technische Logs einschließlich IP-Adressen führen. Für beaufsichtigte Tests nutzen; die Eignung für den regulären Lehrbetrieb separat klären.

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
- `PORT` vom Host übernehmen; Standard ist `8787`.

Der Dienst selbst spricht HTTP; der Hosting-Proxy muss öffentlich **HTTPS** anbieten. [Gesundheitsprüfung](https://fkc-vr-multiplayer.onrender.com/health) soll `{"ok":true}` liefern. Eine einzelne Instanz nutzen. Der Pilot nutzt kurze HTTPS-Anfragen statt WebSockets. Render Free kann schlafen; vor dem Test die Gesundheitsprüfung aufrufen. Bei Änderungen an Server oder gemeinsamem Protokoll sowohl GitHub Pages als auch Render aktualisieren; bei ausbleibendem Auto-Deploy in Render **Manual Deploy → Deploy latest commit** wählen. Anschließend beide Pico-Seiten neu laden.

## Zwei Pico-Headsets testen

1. Auf beiden Picos dieselbe VR-Seite öffnen, „Multiplayer-Pilot“ ausklappen und dieselbe Serveradresse verwenden. „Gemeinsam beitreten“ wählen, VR starten und das Tutorial überspringen. Ein `?multiplayer=`-Parameter kann die Adresse vorgeben, startet aber keinen Beitritt.
2. Im Begrüßungsraum am Team-B-Podest testen: auf Co zeigen; Modell greifen, drehen, skalieren und übergeben; Ansicht **Molekül → Koordination → Molekül** umschalten; Label anheften und eine Messung abschließen sowie wieder entfernen. Die zweite Person schaut zunächst nur zu.
3. Raum wechseln bzw. VR verlassen; fremde Anzeigen müssen aus dem bisherigen Raum verschwinden. Bei Verbindungsabbruch verfallen alte Teilnehmendenpositionen nach ungefähr fünf Sekunden. Ohne aktiven Beitritt bleibt die Anwendung im Einzelmodus.

## Nächste Etappen

Nutzerbestätigt auf Pico: Beitritt, gemeinsames Zeigen, gedrehte Modelle sowie geteilte Labels und Messungen. Den gemeinsamen Ansichtswechsel und den Betrieb mit größeren Gruppen bzw. über eduroam separat praktisch prüfen. Sinnvolle spätere Pakete: gemeinsames Markieren nach Nachtest des lokalen Malmodus, gemeinsamer Modellreset und bei Bedarf Raumcode. Keine dieser Erweiterungen gilt bereits als umgesetzt.