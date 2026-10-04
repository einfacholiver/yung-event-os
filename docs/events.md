# Events-Modul

## Seiten

- `/events`: reale Events der Organisation mit Slug `yung`, Suche nach Name und Statusfilter.
- `/events/[id]`: Overview mit Name, Status, Beginn, Ende, Zeitzone, Ort und Beschreibung.
- `/events/[id]/finances`, `/invoices`, `/documents`, `/tasks`, `/media`, `/permissions`, `/tickets`, `/analytics`: direkt verlinkbare Bereiche mit einem eindeutigen Platzhalter.

Die Tab-Navigation verwendet normale Links mit `aria-current`, damit Direktaufrufe, Browser-Verlauf und Tastaturbedienung funktionieren. Overview liegt direkt auf der Event-Detailroute. Unbekannte Events und unbekannte Bereiche zeigen die Nicht-gefunden-Seite.

Noch keine Anlage, Bearbeitung oder Löschung von Events. Die acht weiteren Bereiche haben keine Fachfunktionen. Insbesondere werden keine Drive-Dateien, Tickets oder Analytics-Daten abgerufen und keine Finanzwerte erfunden.

## Datenzugriff

Datenabfragen liegen unter `src/modules/events/server`, UI und Navigation unter `src/modules/events/components`. Die App-Router-Seiten setzen diese Bausteine zusammen. PostgreSQL wird ausschließlich serverseitig abgefragt; Seiten werden dynamisch gerendert. Der Build benötigt keine laufende Datenbank.

Das ist eine lesende Vorschau für die Organisation YUNG. Listen- und Detailabfragen filtern fest nach dem Organisations-Slug `yung`; es wird keine Organisations-ID aus dem Browser akzeptiert. Eine Anmeldung und echte Berechtigungsprüfung sind weiterhin nicht eingerichtet. Vor einem öffentlichen oder Mehrbenutzerbetrieb muss der feste Organisationskontext durch einen authentifizierten Kontext mit Zugriffsprüfung ersetzt werden.

Für den Datenzugriff genügt DATABASE_URL. AUTH_SECRET wird erst von Auth.js benötigt. Die Startseite bleibt ohne Datenbank aufrufbar und verlinkt auf Events. Fehlende Daten werden als leer dargestellt, Datenbankfehler über eine Fehleransicht mit erneutem Ladeversuch. Es gibt keinen Demo-Daten-Fallback.

## Lokal testen

Nach Einrichtung der .env und PostgreSQL:

```sh
npm run db:deploy
npm run db:seed
npm run dev
```

http://localhost:3000/events öffnen und eines der fünf Seed-Events auswählen. Suche und Statusfilter ausprobieren, alle neun Tabs anklicken und eine Unterseite direkt neu laden. Für bislang nicht gesetzte Termine oder Orte erscheinen entsprechende Hinweise.

`npm test` prüft zusätzlich Listenfilter, leere Ergebnisse, Navigation und Organisationsfilter der Datenabfragen. Die E2E-Tests unter `tests/e2e/events.spec.ts` prüfen Seed-Events, Detailseiten, Tabs, Direktaufruf und unbekannte IDs. Diese Tests benötigen die dedizierte PostgreSQL-Testdatenbank mit TEST_DATABASE_URL (wie im CI-Workflow), sonst werden sie übersprungen.

Lokal sind lint, typecheck, Tests und Build prüfbar. Auf diesem Host ist keine .env vorhanden und Docker nicht verfügbar; eine Browserprüfung mit echten Event-Daten wurde hier nicht durchgeführt.
