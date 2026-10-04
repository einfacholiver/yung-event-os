# Datenbank und Kernmodelle

## Umfang

Elf Kernmodelle plus die ausdrücklich beibehaltenen technischen Auth.js-Tabellen Account, Session und VerificationToken. Kein AI-Modell, Ticketimport, One.com oder aktive Drive-Anbindung. Es gibt keine neuen API-Endpunkte und keine Berechtigungs- oder Zahlungsabläufe.

| Modell             | Zweck                                                             |
| ------------------ | ----------------------------------------------------------------- |
| Organization       | Organisationsgrenze mit eindeutigem Slug                          |
| User               | Auth.js-Nutzer mit optionalem Organisationsbezug                  |
| Event              | Event mit Status, optionalen Terminen, Ort und Zeitzone           |
| DriveConnection    | Verbindungsmetadaten für das erlaubte Konto                       |
| DriveItem          | Datei- oder Ordnermetadaten, externe IDs je Verbindung eindeutig  |
| DriveFolderMapping | Event-Ordner je Zweck, ausschließlich echte Ordner                |
| Transaction        | Einnahme oder Ausgabe mit positivem Dezimalbetrag                 |
| Invoice            | Eingangs-/Ausgangsrechnung mit Betrag und Status                  |
| Task               | Aufgabe mit Event, Status, Priorität und optionaler Zuweisung     |
| Permission         | Explizite Berechtigungszuweisung pro Nutzer, Ressource und Aktion |
| ActivityLog        | Aktivitätsdatensatz mit optionalem Akteur und Event               |

## Beziehungen und Datenregeln

- Jeder fachliche Datensatz gehört einer Organisation. Nutzer gehören derzeit höchstens einer Organisation an. Neue Auth.js-Nutzer können zunächst ohne Organisation existieren; die spätere Aufnahme in eine Organisation ist noch nicht implementiert.
- Zusammengesetzte Fremdschlüssel verhindern organisationsübergreifende Beziehungen, unter anderem zwischen Event und Aufgabe, Nutzer und Berechtigung sowie Rechnung und Transaktion. Jede spätere Datenabfrage muss trotzdem selbst den Organisationskontext prüfen; es gibt noch keine Row-Level-Security oder Autorisierungslogik.
- Organisationen und referenzierte Fachdaten sind durch Restrict vor versehentlichem Löschen geschützt. Nutzer mit Aufgaben oder Logs müssen vor einer Löschung fachlich behandelt werden. Die vorhandenen Auth-Cascades bleiben erhalten.
- Event-Slugs sind innerhalb einer Organisation eindeutig. Start und Ende sind optional, ein gesetztes Ende darf nicht vor einem gesetzten Start liegen. Standardzeitzone: Europe/Berlin. Zeitwerte beim Schreiben als UTC-Zeitpunkte behandeln.
- Finanzbeträge verwenden Decimal(14,2), keine Fließkommazahlen. Transaktionsbeträge sind größer als null; die Richtung beschreibt Einnahme oder Ausgabe. Rechnungsbeträge sind nicht negativ. Währungen bestehen aus drei Großbuchstaben, standardmäßig EUR. Eine fachliche Währungsprüfung und Rechnungsnummernvergabe folgen später.
- Eine Transaktion kann optional auf eine Rechnung zeigen; mehrere Teilzahlungen sind möglich. Übereinstimmung von Währung, Event, Summen und Rechnungsstatus ist noch keine implementierte Geschäftsregel.
- DriveConnection akzeptiert per SQL-Constraint ausschließlich `lightsignal.dj@gmail.com`. Diese Einschränkung ersetzt bei einer späteren Integration nicht die Prüfung der tatsächlich verbundenen Identität. Es werden keine OAuth-Tokens gespeichert; credentialReference ist nur für einen späteren externen Secret-Verweis vorgesehen.
- DriveFolderMapping verwendet einen zusammengesetzten Fremdschlüssel inklusive Ordner-Typ. Dateien können nicht als Ordner zugeordnet und zugeordnete Ordner nicht in Dateien umgewandelt werden. Je Event und Zweck gibt es höchstens eine Zuordnung.
- Permission mit eventId gilt als Event-Zuweisung, ohne eventId als Organisations-Zuweisung. Partielle eindeutige Indizes verhindern Duplikate in beiden Fällen. Es gibt noch keine automatische Vergabe, Rollenauflösung oder Auswertung von MANAGE.
- ActivityLog speichert historische Einträge; entityType/entityId sind bewusst lose Referenzen, kein polymorpher Fremdschlüssel. Keine Secrets in metadata ablegen. Schreibschutz/Unveränderbarkeit auf Datenbankrollen-Ebene ist noch nicht eingerichtet.

## Migrationen

1. `20261004000000_auth_foundation`: vorhandene Auth-Tabellen.
2. `20261004010000_core_models`: additive Kernmodelle, User-Erweiterung mit Zeitstempel-Backfill, Fremdschlüssel, Indizes und SQL-Constraints. Ausführung in einer Transaktion, kein Löschen vorhandener Tabellen.

CHECK-Constraints und partielle Permission-Indizes stehen ausdrücklich im SQL, da sie nicht vollständig im Prisma-Schema abbildbar sind. Künftige Migrationen müssen diese Regeln erhalten. `prisma db push` ersetzt nicht den versionierten Migrationspfad.

## Seed

```sh
npm run db:up
npm run db:deploy
npm run db:seed
```

Der Seed benötigt DATABASE_URL in .env, aber kein AUTH_SECRET. Er erzeugt eine Organisation mit Name YUNG und Slug yung sowie diese Events:

| Name           | Slug           | Status |
| -------------- | -------------- | ------ |
| YUNG Pre-Event | yung-pre-event | DRAFT  |
| Chapter One    | chapter-one    | DRAFT  |
| Chapter Two    | chapter-two    | DRAFT  |
| Chapter Three  | chapter-three  | DRAFT  |
| Chapter Four   | chapter-four   | DRAFT  |

Keine erfundenen Termine, Orte, Konten, Rechnungen, Transaktionen oder Benutzer. Die Seed-Daten liegen in prisma/seed-data.ts, die atomare Upsert-Logik in prisma/seed-core.ts. Wiederholte Aufrufe erstellen keine Duplikate und überschreiben keine vorhandenen Änderungen. Slugs dienen als stabile Seed-Schlüssel; bei nachträglicher Änderung eines Slugs würde der nächste Seed den ursprünglichen Slug neu anlegen.

Prisma 7 führt Seeds nicht automatisch bei Migrationen aus; `db:seed` ist ein eigener Schritt.

## Prüfung

`npm test` führt zusätzlich echte SQL-Migrationstests mit einer flüchtigen PGlite-PostgreSQL-Engine aus. Geprüft werden Migration über bestehende Auth-Daten, Organisationsgrenzen, Konto-Einschränkung, Ordnerzuordnung, eindeutige Berechtigungen, Dezimalbeträge, Datumsreihenfolge und Löschschutz.

`npm run test:db` prüft den tatsächlichen Prisma-Seed gegen PostgreSQL. Dafür TEST_DATABASE_URL auf eine dedizierte leere Testdatenbank setzen, deren Name mit `_test` endet, und Migrationen vorher mit DATABASE_URL auf derselben Datenbank anwenden. Der Test führt den Seed mehrfach aus und prüft, dass IDs und bestehende Änderungen erhalten bleiben. Niemals eine produktive Datenbank dafür verwenden.

CI stellt PostgreSQL 17 bereit, wendet Migrationen an und führt Seed und Seed-Integrationstest aus. Lokal ist Docker nicht verfügbar: SQL-Migrationen sind über PGlite geprüft, ein Lauf des Prisma-Seeds gegen den Docker-PostgreSQL-Dienst steht aus. Die Konfiguration allein bestätigt noch keinen erfolgreichen CI-Lauf.
