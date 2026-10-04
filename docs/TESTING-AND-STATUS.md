# Lokaler Teststand und offene Arbeit

Dieser Stand ist eine lokale Testversion, keine vollständig fertige Event-Plattform. Frühere Meldungen haben einzelne Grundlagen zu weitgehend als fertig beschrieben. Maßgeblich ist diese Bestandsaufnahme.

## Starten und anmelden

Bei laufendem Server http://localhost:3000 öffnen. Alle Module sind über die gemeinsame Navigation erreichbar. Google-Login über Google Drive mit lightsignal.dj@gmail.com. Nach Wechsel vom Entwicklungsserver zum Produktionsserver einmal vollständig neu laden und nötigenfalls erneut anmelden. Bestehende Daten, Mappings und Tokens bleiben in PostgreSQL.

Für einen späteren Neustart: Docker Desktop öffnen, im Projekt `npm run db:up`, `npm run db:deploy`, `npm run build` und `npm start -- --hostname 127.0.0.1` ausführen. Alternativ für Entwicklung `npm run dev`. Nur einen Server auf Port 3000 betreiben. Kein neues Build parallel zum Testen einer laufenden Produktionsinstanz starten; Server nach einem Build neu starten.

## Testablauf

1. Events: Pre-Event und die vier Chapters öffnen. Die Detail-Tabs sind überwiegend noch Platzhalter; die nutzbaren Module stehen in der globalen Navigation.
2. Google Drive: Verbindung, gespeicherten Ordner und letzten Sync prüfen. Mapping öffnen und vorhandene Zuordnungen kontrollieren. Die Auswahl zeigt vollständige Pfade. Es werden nur Metadaten geladen.
3. Documents: Dateien öffnen und Eventfilter prüfen. Gespeicherte Kategorie-Mappings haben Vorrang vor der Erkennung anhand des Eventordnernamens. Ein mehreren Events zugeordneter Ordner bleibt bei der automatischen Dokumentzuordnung uneindeutig.
4. Finanzen: Eine reale Einnahme oder Ausgabe mit Event, Datum, Beschreibung und EUR-Betrag erfassen. Nach „Gespeichert“ erscheint sie in der Liste und in der Eventsumme. Keine beliebigen Testbuchungen in echte Eventdaten eintragen: Storno-/Löschfunktionen fehlen noch.
5. Rechnungen: Lieferant, Event, EUR-Betrag und Status eingeben, „Anlegen“ klicken. Danach Betrag/Status ändern, speichern und die Seite neu laden. Rechnungen buchen noch keine Zahlungen; Finanzen separat pflegen.
6. Tasks: Event, Titel, Priorität und Status angeben, anlegen und auf DONE setzen. Nach Neuladen bleibt der Zustand gespeichert.
7. Analytics: Umsatz, Kosten und Gewinn je Event mit der Finanzübersicht vergleichen. Noch keine Besucherzahlen oder Ticketpreise.

## Tatsächlich vorhanden

- PostgreSQL, Prisma, Migrationen, fünf Event-Seeds, Google OAuth und Beschränkung auf das erlaubte Konto.
- Drive-Browser, manuell gestarteter Metadaten-Sync, Kategorie-Mapping und Dokumentenliste.
- Finanzen: EUR-Transaktionen anlegen, auflisten; Einnahmen, Ausgaben und Gewinn je Event.
- Eingangsrechnungen: anlegen; Lieferant, Betrag und Status ändern.
- Tasks: anlegen; Titel, Status und Priorität ändern.
- Analytics: einfacher Vergleich von Umsatz, Kosten und Gewinn.

## Noch offen und Umsetzung

| Bereich                | Nächster Umsetzungsschritt                                                                                                                                         | Benötigte Angaben                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Drive / Mapping        | ROOT-Zuordnung speicherbar machen, Entfernen von Zuordnungen, eindeutige Kategorien; Sync gegen parallele Läufe und Teilfehler absichern, Zwei-Läufe-Datenbanktest | Keine neuen Zugangsdaten                                                      |
| Dokumente / Rechnungen | Drive-Datei mit Rechnung verknüpfen; Rechnungsnummer, Datum, Netto/MwSt/Brutto, Kategorie und Prüfstatus; Bestätigung vor Finanzbuchung                            | Gewünschte Buchungsregeln                                                     |
| Finanzen               | Marge, exakte gemeinsame Summenberechnung, Korrektur/Storno, konsistente Event-Tabs                                                                                | Umgang mit Stornos und Fremdwährungen                                         |
| Tasks                  | Fälligkeit, Zuständige, wiederverwendbare Checklisten und Event-Erstellung                                                                                         | Standardcheckliste kann aus der Roadmap übernommen werden                     |
| Kosten-Sheets          | Tabelle zunächst verlinken; Importvorschau mit Blatt-/Spaltenzuordnung, Validierung und Duplikatschutz, erst danach bestätigte Übernahme                           | Beispieltabelle bzw. Export und Google Sheets-Lesefreigabe                    |
| Tickets                | CSV-Import mit Vorschau und stabiler Ticket-ID, alternativ Anbieter-API; Besucher und Verkäufe getrennt erfassen                                                   | Anbieter oder Beispielexport, Definition tatsächlicher Besucher               |
| Analytics              | Marge, Besucher, Durchschnittspreis, Kosten pro Besucher aus den importierten Daten                                                                                | Ticket-/Besucherdaten                                                         |
| AI-Dokumentanalyse     | Anbieteradapter, ausgewählte Dateien verarbeiten, strukturierte Vorschläge mit Belegstellen; keine automatische Übernahme                                          | Anbieter, lokal hinterlegter API-Key, Freigabe der zu übertragenden Dokumente |
| AI Assistant           | Autorisierte Lesewerkzeuge für Events, Finanzen, Rechnungen, Dokumente und Tasks; begrenzte Anfragen und Protokollierung                                           | Anbieter und Kostenlimit                                                      |
| Betrieb                | Globaler Zugriffsschutz (Events sind noch lokale Vorschau), Rollen, Backups, echte Browser-Integrationstests und Git-Sicherung                                     | Zielhosting vor Veröffentlichung                                              |

Für Sheets, Tickets und AI existieren bisher keine funktionsfähigen Importer oder Anbieteradapter. Eine fehlende Freigabe ist nicht der einzige offene Punkt: Diese Module müssen noch implementiert und mit Beispieldaten getestet werden. API-Keys ausschließlich in lokalen Umgebungsdateien eintragen, nie in Chat oder Git.

## Prüfgrenzen

Lint, Typecheck, Vitest und Produktionsbuild prüfen Code und automatisierte Tests. Grüne Tests sind kein Beleg für vollständige Business-Funktionen. Reale Google-Freigabe und Kontoinhaber-Session werden nicht durch Testdaten ersetzt. Der bisherige wiederholte Sync wurde noch nicht durch einen echten Datenbank-Idempotenztest nachgewiesen.
