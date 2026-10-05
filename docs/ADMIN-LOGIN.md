# Admin-Zugang und Serverbetrieb

Die gesamte Anwendung ist privat. Einziger freigegebener Benutzer ist das von
Google bestätigte Konto `lightsignal.dj@gmail.com`. Keine Registrierung, kein
lokales Passwort und kein öffentlicher Daten-API-Key. Die Anmeldung erfolgt unter
`/login` über Google. Die zusätzliche Drive-Freigabe erfolgt weiterhin separat
in den Integrationen; App-Anmeldung allein benötigt nur Identitätsdaten.

## Bedienung und Test

1. Ein privates Browserfenster öffnen und `/events` aufrufen: Weiterleitung zu `/login`.
2. Mit dem freigegebenen Google-Konto anmelden: Events und bestehende Daten sind sichtbar.
3. Ein anderes Google-Konto verwenden: Zugriff verweigert, keine Events sichtbar.
4. Im Menü auf **Abmelden** klicken: Sitzung wird in der Datenbank beendet.
5. `/api/finances/transactions` ohne Sitzung aufrufen: JSON-Fehler und HTTP 401.

Die Sitzungen liegen in PostgreSQL, neue Sitzungen haben eine Laufzeit von acht
Stunden. Auth.js verwaltet HttpOnly-Cookies und
unter HTTPS Secure-Cookies sowie CSRF-Schutz, OAuth State, PKCE und Nonce. Alte
Sitzungen aus dem bisherigen Entwicklungsstand können ihre bisherige Laufzeit
behalten; vor einer öffentlichen Bereitstellung alle Sitzungen widerrufen.
Die API prüft zusätzlich die Herkunft von schreibenden Anfragen und den Benutzer
vor dem Datenzugriff. Die zentrale Eingangskontrolle schützt auch direkte Links,
Vorschauen und API-Aufrufe; serverseitige Datenzugriffe prüfen unabhängig davon
die gespeicherte Benutzeridentität und Organisation. Öffentliche Ausnahmen sind
nur Login, Auth.js-Endpunkte und technische/Branding-Dateien.

`npm run test:auth` führt einen lokalen HTTP-Zugriffstest aus, einschließlich
einer kurzlebigen Testsitzung des bereits vorhandenen Admins. Sie wird danach
entfernt; es werden keine Eventdaten geändert. `AUTH_TEST_URL` kann auf einen
anderen lokalen Testport gesetzt werden. Der Test verweigert externe Zielhosts.

## Vor öffentlicher Bereitstellung

- Produktionsdomain mit HTTPS und Reverse Proxy einrichten. Nur diesen Proxy
  auf den Node-Prozess zugreifen lassen; Entwicklungsserver nicht veröffentlichen.
- `AUTH_URL` und `APP_URL` auf die tatsächliche HTTPS-Adresse setzen. Der Proxy
  muss Host- und Forwarded-Header selbst setzen und vom Besucher gelieferte Werte
  überschreiben. Kein pauschales Vertrauen in beliebige Hosts konfigurieren.
- In Google Cloud exakt `https://DEINE-DOMAIN/api/auth/callback/google` als
  Redirect-URI registrieren und das Admin-Konto als zugelassenen Testnutzer
  behalten, solange der OAuth-Consent-Screen im Testmodus ist.
- Secrets ausschließlich serverseitig bereitstellen. Eine eigene Produktions-
  Datenbank mit starkem Passwort, Backups und nicht öffentlich erreichbarem
  PostgreSQL-Port verwenden. Lokale Compose-Zugangsdaten nicht übernehmen.
- **AUTH_SECRET nicht in einer bestehenden Datenbank spontan ändern:** Es schützt
  auch gespeicherte Drive-Tokens. Bei neuer Installation einen eigenen starken
  Schlüssel erzeugen; bei Übernahme den bestehenden sicher übertragen oder
  Token-Rotation und erneute Drive-Verbindung gezielt durchführen.
- Vor dem Start `npm ci`, `npm run db:deploy`, `npm run build`; anschließend
  `npm run start` hinter dem Reverse Proxy. PostgreSQL muss erreichbar sein.
- Bestehende Auth-Sitzungen vor Veröffentlichung widerrufen, beispielsweise
  per Prisma Studio ausschließlich die `Session`-Datensätze löschen. Keine
  Event-, Benutzer-, Account- oder Drive-Datensätze löschen.
- Im Google-Konto Zwei-Faktor-Anmeldung oder Passkey aktivieren. Diese Einstellung
  muss der Kontoinhaber selbst vornehmen.
- Vor Veröffentlichung Login, Logout, falsches Konto und anonymen API-Zugriff
  auf der tatsächlichen HTTPS-Domain erneut testen.

## Grenzen der Prüfung

Automatisierte Tests prüfen fehlende Sitzungen, nicht freigegebene Identitäten,
Organisationsgrenzen, direkte API-Zugriffe und geschlossenes Verhalten bei
Datenbankfehlern. Sie ersetzen kein unabhängiges Sicherheits-Audit und keine
Prüfung der späteren Serverkonfiguration.

Die Produktionsabhängigkeiten sind nach den gezielten Updates von `deepmerge-ts`
und `mysql2` im npm-Audit ohne bekannte Meldungen. Das komplette Audit meldet
weiterhin einen `braces`-Befund in der ESLint-Entwicklungswerkzeugkette. Für diesen
Befund bot npm zum Implementierungszeitpunkt keine kompatible korrigierte Version
an; kein erzwungenes Downgrade von Next/ESLint vorgenommen. Entwicklungstools
nicht für fremde Eingaben als öffentliches API verwenden.
