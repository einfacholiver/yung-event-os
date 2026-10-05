# YUNG Event OS

Die Anwendung ist jetzt ausschließlich nach Admin-Anmeldung zugänglich. Login,
Zugriffstests und die Voraussetzungen für den Serverbetrieb stehen unter
[Admin-Zugang](docs/ADMIN-LOGIN.md).

Online-Betrieb mit Netlify und Neon, private Datenübernahme und genaue Einstellungen:
[Deployment-Anleitung](docs/DEPLOY-NETLIFY-NEON.md). Die Cloud-Veröffentlichung muss anschließend auf Netlify geprüft werden.

Aktueller Funktionsumfang, Testablauf und offene Arbeit: [Teststand](docs/TESTING-AND-STATUS.md). Diese Bestandsaufnahme ersetzt frühere pauschale Fertigmeldungen.

Event-Verwaltung mit editierbaren Details und Finanzen, Drive-Mapping und Metadaten-Sync, Dokumenten- und PDF-Vorschau, Media, Genehmigungen und One.com-CSV-Ticketimport. Neue Events können ihre Drive-Ordnerstruktur anlegen. Check-in ist ein Platzhalter; Tasks und AI gehören nicht zum aktuellen Fokus.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui-Konfiguration mit lokaler Button-Komponente, PostgreSQL 17, Prisma 7 mit PostgreSQL-Treiberadapter, Auth.js v5, Zod, Vitest und Playwright. Auth.js v5 wird derzeit als Beta veröffentlicht. Versionen sind im Lockfile fixiert.

## Lokaler Start

Voraussetzungen: Node.js 22.16+ innerhalb der 22er-Linie oder Node.js 24+, npm und Docker mit Compose v2.

1. `npm ci`
2. `.env.example` nach `.env` kopieren.
3. Secret mit `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` erzeugen und als `AUTH_SECRET` in `.env` eintragen.
4. `npm run db:up`
5. `npm run db:deploy` und anschließend `npm run db:seed`
6. `npm run dev` – Anwendung unter http://localhost:3000 öffnen.

Compose-Zugangsdaten sind ausschließlich für lokale Entwicklung. Bei eigenen Datenbankwerten auch DATABASE_URL aktualisieren. PostgreSQL bindet nur an 127.0.0.1. Das benannte Volume bleibt bei `db:down` erhalten.

## Struktur

- `src/app`: Routen, Layout, Styles und Auth-Route.
- `src/components/ui`: wiederverwendbare shadcn/ui-Komponenten.
- `src/modules`: Fachmodule; Events mit Datenabfragen, Listenansicht und Detailnavigation.
- `src/server/auth`: Auth.js-Konfiguration und Prisma-Adapter.
- `src/server/db`: verzögert initialisierter Prisma-Client.
- `src/config`: testbare Zod-Konfigurationsschemas.
- `src/server/env.ts`: serverseitiger Zugriff auf validierte Umgebungsvariablen.
- `src/lib`, `src/hooks`: gemeinsame Utilities und Hooks.
- `prisma`: Schema und versionierte Migrationen.
- `tests/e2e`: Playwright-Tests gegen den Produktionsbuild.

Servermodule sind durch `server-only` vor Client-Imports geschützt. Geheimnisse werden beim Zugriff auf Serverdienste validiert. Installation, Typprüfung, Tests und Build benötigen keine Secrets und keine laufende Datenbank. Der lokale DATABASE_URL-Fallback in prisma.config.ts dient der CLI; die Anwendung verlangt eine explizite URL und ein Secret.

## Authentifizierung

Auth.js verwendet Google OAuth, Datenbanksessions und den Prisma-Adapter. Der Admin-Zugang und die Drive-Verbindung erlauben ausschließlich die verifizierte Google-Identität lightsignal.dj@gmail.com. OAuth-Tokens werden serverseitig verschlüsselt gespeichert. Die technischen Tabellen Account, Session und VerificationToken bleiben erhalten. Geschäftsseiten und API-Endpunkte sind durch Anmeldung und Berechtigungsprüfung geschützt. Hinter einem Reverse Proxy die Auth.js-Host-Konfiguration passend zur Deployment-Umgebung setzen.

## Befehle

| Befehl                                        | Zweck                                                    |
| --------------------------------------------- | -------------------------------------------------------- |
| `npm run dev`                                 | Entwicklungsserver                                       |
| `npm run build` / `npm start`                 | Produktionsbuild / Server                                |
| `npm run lint` / `npm run lint:fix`           | ESLint prüfen / korrigieren                              |
| `npm run typecheck`                           | Prisma- und Next-Typen erzeugen, TypeScript prüfen       |
| `npm test` / `npm run test:watch`             | Unit- und Komponententests                               |
| `npm run test:coverage`                       | Testabdeckung                                            |
| `npm run test:e2e:install`                    | Chromium für Playwright installieren                     |
| `npm run test:e2e` / `npm run test:e2e:ui`    | Browsertests / interaktive Tests; vorher Build ausführen |
| `npm run format` / `npm run format:check`     | Prettier formatieren / prüfen                            |
| `npm run check`                               | lint, typecheck, test, build nacheinander                |
| `npm run db:up` / `npm run db:down`           | Lokale Datenbank starten / stoppen                       |
| `npm run db:generate` / `npm run db:validate` | Prisma-Client erzeugen / Schema prüfen                   |
| `npm run db:migrate -- --name <name>`         | Entwicklungsmigration erstellen und anwenden             |
| `npm run db:deploy` / `npm run db:studio`     | Migrationen anwenden / Daten ansehen                     |

Weitere shadcn/ui-Komponenten mit `npx shadcn@latest add <komponente>` hinzufügen. Komponenten werden als Quellcode verwaltet.

## Google Drive

Unter `/settings/integrations/google-drive` verbinden, durch Meine Ablage navigieren und den Veranstaltungsordner auswählen. Gespeichert wird die echte Google-Folder-ID. Der Button „Drive synchronisieren“ schreibt ausschließlich Drive-Metadaten idempotent in `DriveItem`; Dateien werden nicht heruntergeladen. Ausschließlich **lightsignal.dj@gmail.com** ist erlaubt; die Identität wird vor jeder Drive-Operation geprüft. Einrichtung und manueller Abnahmetest: [docs/google-drive.md](docs/google-drive.md). Weitere Meilensteine: [docs/roadmap.md](docs/roadmap.md).

Unter `/documents` stehen synchronisierte Dateien mit vollständigem Drive-Pfad, Eventfilter und direktem Google-Drive-Link bereit.

## Prüfstatus der ursprünglichen Grundlage (4. Oktober 2026)

- lint, typecheck, test (7 Tests), build, Prettier-Prüfung und Prisma-Schemavalidierung erfolgreich.
- Docker ist in der Ausführungsumgebung nicht installiert. Die initiale Migration wurde aus dem Schema generiert, aber lokal nicht gegen PostgreSQL ausgeführt.
- npm audit meldet 9 hohe transitive Befunde über braces, deepmerge-ts und mysql2 (einschließlich übergeordneter Pakete). Mit --omit=dev bleiben 4 Befunde in der Prisma-Abhängigkeitskette. npm schlägt dafür inkompatible Major-Downgrades vor; diese wurden nicht automatisch angewendet. Vor Produktivbetrieb erneut prüfen und upstream behobene Versionen übernehmen.
- Die globale npm-Verknüpfung dieser Windows-Umgebung verweist auf eine fehlende npm-cli.js. Für die Prüfungen wurde die vorhandene CLI unter C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js direkt mit Node ausgeführt. Die Projekt-Scripts sind normale npm-Scripts.
- Playwright ist eingerichtet, der lokale E2E-Lauf konnte jedoch nicht abgeschlossen werden: Chromium startet auf diesem Host mit `spawn UNKNOWN` auch außerhalb der Sandbox nicht. Der zusätzliche Headless-Shell-Download scheiterte zuvor an `ENOSPC`; die Konfiguration nutzt deshalb Chromium mit `--no-shell`. Der CI-Workflow führt den Browsertest unter Linux aus; ein CI-Ergebnis liegt noch nicht vor.

## Datenbank und Kernmodelle

Modellübersicht, Datenregeln, Seed-Verhalten und aktuelle Datenbankprüfungen: [docs/database.md](docs/database.md). `npm run db:seed` legt YUNG und fünf Event-Entwürfe wiederholbar an. `npm run test:db` prüft den echten Prisma-Seed gegen eine separate PostgreSQL-Testdatenbank mit TEST_DATABASE_URL.

## Events-Oberfläche

Unter `/events` stehen Event-Liste, Suche und Statusfilter bereit. `/events/[id]` zeigt Stammdaten und neun navigierbare Bereiche. Die acht Folgebereiche sind Platzhalter. Die Startseite verlinkt auf Events. Einrichtung, Testhinweise und aktueller Zugriffsrahmen: [docs/events.md](docs/events.md).

## Lokale Umgebungsdateien

Die Anwendung liest `.env.local` und `.env`. Prisma-CLI und Seed lesen ebenfalls beide Dateien, wobei `.env.local` Vorrang vor `.env` hat; bereits gesetzte Prozessvariablen bleiben maßgeblich. DATABASE_URL muss in einer dieser Dateien stehen. Für die lokale Compose-Datenbank steht die passende URL in `.env.example`. Nach Änderungen den Entwicklungsserver neu starten. OAuth-Zugangsdaten allein konfigurieren keine Datenbank.
