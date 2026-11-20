# Multiplayer-Pilot

GitHub Pages liefert weiterhin den öffentlichen Einzelspielermodus. Der getrennte Pilot-Dienst überträgt nur Kopf- und Controllerposen, wenn im Browserpanel bewusst „Gemeinsam beitreten“ gewählt wurde und VR läuft. Gleiche Raum-ID und derselbe Server sind nötig, nicht dasselbe WLAN. Kein Konto, Audio oder gespeicherter Lernfortschritt. Das Tutorial wird nicht übertragen. Es gibt keinen Raumcode und keine Adminrolle: Jeder mit Zugang zum Dienst kann beitreten. Für einen beaufsichtigten Test betreiben und danach stoppen; nicht als dauerhaften offenen Dienst für die Lehre betrachten. Der Origin-Filter ist kein Passwortschutz. Anbieter können IP-Adressen protokollieren.

## Dienst auf einem HTTPS-Host starten

Auf einem Node-Webdienst mit öffentlicher HTTPS-Adresse dieses Repository als Quelle für den Webdienst wählen. Startbefehl: `node server/multiplayer.cjs`. Es gibt keinen Buildschritt und keine zu installierenden Pakete. Node 22 oder neuer verwenden. Umgebungsvariablen beim Host setzen:

- `FKC_ORIGIN=https://fkchem-up.github.io` (nur Schema und Host, **kein** `/VR-Raum/` und kein abschließender Schrägstrich; bei einer anderen Pages-Adresse entsprechend anpassen).
- `FKC_HOST=0.0.0.0` (damit der HTTPS-Proxy des Hosts den Dienst erreicht).
- `PORT` vom Host übernehmen; Standard ist `8787`.

Der Dienst selbst spricht HTTP; der Hosting-Proxy muss öffentlich **HTTPS** anbieten. `https://<serveradresse>/health` soll `{"ok":true}` liefern. Eine einzelne Instanz nutzen: Teilnehmer werden nur flüchtig im Speicher gehalten. Der Pilot nutzt kurze HTTPS-Anfragen statt WebSockets.

## Zwei Pico-Headsets testen

1. In beiden Pico-Browsern dieselbe veröffentlichte VR-Seite öffnen. Im Abschnitt „Multiplayer-Pilot“ auf beiden Geräten dieselbe HTTPS-Serveradresse eingeben und „Gemeinsam beitreten“ drücken. `?multiplayer=<URL-kodierte Serveradresse>` kann das Feld vorausfüllen, startet aber keine Übertragung.
2. Auf beiden Geräten VR starten und das Tutorial überspringen. Im selben Raum stehen und nacheinander zur Seite gehen bzw. Controller bewegen. Blaue Köpfe und Controller der anderen Person sollten folgen. Das ist noch keine gemeinsame Modellbearbeitung.
3. Mit einem Gerät den Raum wechseln: Das andere sollte verschwinden. Im neuen Raum zusammenkommen, danach auf einem Gerät VR verlassen. Bei einem Verbindungsabbruch verschwinden alte Serverpositionen nach ungefähr fünf Sekunden. Ohne aktiven Beitritt bleibt die Anwendung im Einzelmodus.

## Nächste Etappen

Synchronisierte Modellbewegung mit serverseitiger Greif-Freigabe, anschließend geteilte Labels sowie Distanz-, Winkel- und später weitere Messungen. Für Messungen stabile Modell-, Varianten- und Atom-IDs verwenden; die Werte stammen weiterhin aus Strukturkoordinaten in Å, nicht aus VR-Anzeigekoordinaten. Private Sitzungen und ein Raumcode lassen sich bei Bedarf separat ergänzen. WebXR-, Pico-Browser- und eduroam-Verhalten erst nach echtem Gerätetest als bestätigt behandeln.