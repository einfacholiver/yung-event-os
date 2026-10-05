# YUNG Event OS auf Netlify und Neon

Die Anwendung ist für Netlify mit Neon PostgreSQL vorbereitet. Das Neon-Projekt `yung-event-os` mit PostgreSQL in Frankfurt ist bereits angelegt. Die Veröffentlichung und der echte Cloud-Test stehen noch aus. Die vorhandenen Daten bleiben lokal erhalten.

## 1. Neon-Verbindungen privat hinterlegen

Im Neon-Projekt unter **Connect** die Datenbank auswählen. Zwei Verbindungsstrings kopieren: einmal mit **Connection pooling** aktiviert, einmal ohne Pooling. Die URLs enthalten ein Passwort und gehören nicht in Chats, Screenshots oder Git.

Im Projektordner eine Kopie von `.env.cloud.example` namens `.env.cloud` anlegen:

```ini
DATABASE_URL=<Neon-Verbindung mit Pooling>
DIRECT_DATABASE_URL=<Neon-Verbindung ohne Pooling>
```

Die von Neon gelieferten TLS-Parameter behalten. `DATABASE_URL` ist für die Anwendung, `DIRECT_DATABASE_URL` für Migrationen und Datenübernahme. `.env.cloud` wird von Git ignoriert. Die lokale `.env.local` weiterhin für localhost verwenden; sie soll noch auf die lokale Datenbank zeigen.

## 2. Vorhandene Daten übernehmen

Docker Desktop und die lokale PostgreSQL-Datenbank müssen laufen. Im Projektterminal:

```powershell
npm run db:up
npm run cloud:export
```

Der Export nennt eine Datei unter `backups/`, zum Beispiel `backups/yung-...dump`. Die zugehörige `.dump.json` enthält Prüfsumme und Datensatzanzahlen. Beide Dateien privat aufbewahren. Sie enthalten sensible Daten; niemals in Git, Netlify oder einen öffentlichen Ordner hochladen.

Anschließend mit dem tatsächlich ausgegebenen Dateinamen:

```powershell
npm run cloud:import -- backups/DEIN-DATEINAME.dump
```

Der Import akzeptiert ausschließlich eine direkte Neon-TLS-Verbindung und eine leere Zieldatenbank. Er legt das Schema mit den bestehenden Prisma-Migrationen an, importiert die Daten in einer Transaktion und vergleicht die Datensatzanzahlen mit dem Export. Bestehende Datensätze auf Neon werden nicht überschrieben. Lokale Datensätze werden nicht verändert.

Events, Finanzen, Ticketdaten, Konten, Drive-Metadaten und Mappings werden mit ihren IDs übernommen. Browser-Sessions werden ausgeschlossen; auf der Online-Seite meldest du dich neu an. Für die übernommenen verschlüsselten Google-Tokens muss Netlify denselben **AUTH_SECRET** wie die lokale Installation verwenden.

Nach dem Import **nicht `db:seed` ausführen**: Der Seed ist zum initialen Einrichten gedacht, die bestehenden Daten sind bereits übernommen. Während des abschließenden Umzugs keine parallelen Änderungen lokal oder auf Neon machen; spätere lokale Änderungen werden nicht automatisch übertragen.

## 3. Code über GitHub bereitstellen

Netlify verwendet den Quellcode des GitHub-Repositories `yung-event-os`. Den geprüften Stand committen und pushen. Unter Netlify **Import an existing project → GitHub** das Repository auswählen. Kein ZIP, kein `.next`-Ordner und kein Drag-and-drop-Upload: Next.js benötigt serverseitige Funktionen.

Als Produktionsbranch den Branch wählen, auf dem der vorbereitete Stand tatsächlich liegt. Aktuell ist das `feat/event-workspace`; `main` erst verwenden, nachdem die Änderungen dorthin übernommen wurden. Eine Verbindung mit einem alten Stand von `main` würde die neuen Anpassungen nicht enthalten.

Die Datei `netlify.toml` setzt:

- Build command: `npm run build:netlify`
- Publish directory: `.next`
- Node.js: 22
- Schutz vor veralteten Server-Actions während eines Deployments
- keine Deploy-Previews oder Branch-Deployments mit Produktionsdaten

Netlify erkennt Next.js und installiert seinen Adapter automatisch. Keinen alten Adapter manuell hinzufügen. Ein erster Build ohne vollständige Umgebungsvariablen bricht absichtlich ab und nennt nur die fehlenden Variablennamen.

## 4. Netlify-Umgebungsvariablen einrichten

Zuerst den endgültigen Site-Namen festlegen. Beispiel: `https://DEIN-SITENAME.netlify.app`. Den tatsächlichen Namen überall identisch verwenden.

Unter **Project configuration → Environment variables** die folgenden Werte eintragen. Zugriff für **Builds und Functions**, Kontext **Production**. Keine geheimen Werte mit `NEXT_PUBLIC_` veröffentlichen.

| Variable               | Wert                                                           |
| ---------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`         | Neon-URL mit Pooling                                           |
| `DIRECT_DATABASE_URL`  | Neon-URL ohne Pooling                                          |
| `AUTH_SECRET`          | Genau der vorhandene lokale Wert, wenn Daten übernommen werden |
| `GOOGLE_CLIENT_ID`     | Bestehende Google-OAuth-Client-ID                              |
| `GOOGLE_CLIENT_SECRET` | Bestehendes Google-OAuth-Client-Secret                         |
| `AUTH_URL`             | `https://DEIN-SITENAME.netlify.app`                            |
| `APP_URL`              | Derselbe HTTPS-Ursprung wie `AUTH_URL`                         |

Die privaten Werte aus deiner lokalen Konfiguration direkt in Netlify kopieren. Sie müssen niemandem im Chat mitgeteilt werden. `.env`, `.env.local` und `.env.cloud` nicht hochladen. Weitere Variablen aus experimentellen AI-Funktionen sind für den aktuellen Event-Workflow nicht erforderlich.

## 5. Google OAuth für die Online-Adresse freigeben

In Google Cloud im bestehenden Projekt **Google Auth Platform → Clients** den verwendeten OAuth-Webclient öffnen. Bei den autorisierten Redirect-URIs ergänzen:

```text
https://DEIN-SITENAME.netlify.app/api/auth/callback/google
```

Die bestehende localhost-URI behalten, damit die lokale Entwicklung weiter funktioniert. Falls autorisierte JavaScript-Ursprünge konfiguriert sind, auch den HTTPS-Ursprung der Online-Seite ergänzen. Bei OAuth im Testmodus muss `lightsignal.dj@gmail.com` weiterhin als Testnutzer eingetragen sein.

Die App erlaubt weiterhin nur den Admin `lightsignal.dj@gmail.com`. Ein zweiter Nutzer ist noch nicht freigeschaltet. Google Cloud als Testnutzer eingetragen zu sein reicht allein nicht für App-Zugriff. Für Daniel kann später eine explizite Benutzerfreigabe mit eigenem Konto ergänzt werden.

## 6. Deployment starten und testen

Nach Datenübernahme, Variablen und OAuth-Konfiguration in Netlify einen Produktions-Deploy starten. Erst der erfolgreiche Netlify-Build bestätigt die Adapter-Kompatibilität auf der Hosting-Plattform. Die lokalen Prüfungen ersetzen diesen Test nicht.

1. Online-Adresse in einem privaten Browserfenster öffnen: zuerst muss die Login-Seite erscheinen.
2. Ohne Anmeldung `/events`, `/documents` und `/api/events/irgendeine-id/documents/upload` aufrufen. Keine Geschäftsdaten dürfen angezeigt werden; die API muss Anmeldung verlangen.
3. Mit `lightsignal.dj@gmail.com` anmelden. Alle fünf Events und bestehende Finanzdaten prüfen.
4. Unter Drive-Integration Konto und Mappings prüfen. Falls Google eine erneute Freigabe verlangt, **Connect** verwenden. Die bestehenden Ordner nicht neu erzeugen.
5. Drive-Sync durchführen und erneut ausführen. Es dürfen keine doppelten Dateien entstehen. Bei Unterbrechung **Drive synchronisieren** erneut anklicken; **Sync neu starten** verwirft nur den gespeicherten Lauf und startet die Metadatenprüfung neu.
6. PDF-Vorschau und Bilder prüfen, insbesondere eine Datei über 4,5 MB. Die Antworten werden gestreamt; die tatsächliche Unterstützung muss auf Netlify bestätigt werden. Bestehende Größenlimits bleiben: PDF 20 MB, Bildvorschau 10 MB.
7. Eine kleine Testdatei in den passenden Drive-Ordner hochladen, anschließend eine größere Mediendatei. Uploads erfolgen in Abschnitten bis 2 MiB, bis zu 20 MB für Dokumente/Genehmigungen und 100 MB für Medien. Der Browser erhält keine Google-Tokens. Wiederholen setzt denselben Upload fort; andere Datei auswählen beginnt einen neuen Upload.
8. Event bearbeiten, speichern, Seite neu laden; Finanzen-Sortierung und Filter sowie Tickets prüfen. Abmelden und kontrollieren, dass die Daten wieder gesperrt sind.

Noch nicht benötigte Testdateien anschließend gezielt in Google Drive entfernen und erneut synchronisieren. Ein neues Event zum Testen erzeugt echte Drive-Ordner; deshalb nur bewusst anlegen.

## Kosten und Betrieb

Netlify Free erlaubt kommerzielle Projekte; das verfügbare Kontingent ist begrenzt. Beim Ausschöpfen der Free-Credits können Projekte pausieren. Neon Free hat ebenfalls Limits für Speicher und Rechenzeit. Große Bilder, PDF-Vorschauen und Medien-Uploads verbrauchen Hosting-Kontingent. Es gibt daher keine Zusage für unbegrenzten kostenlosen Betrieb. Für große Videos kann der Link zum Original in Drive sinnvoll sein.

Die Online-Anwendung und die lokale Anwendung benutzen nach dem Umzug getrennte Datenbanken. Die öffentliche Adresse bietet Zugriff auf die geschützte Anwendung; es wird keine öffentliche API für alle Nutzer freigegeben. Die Login- und Berechtigungsprüfungen bleiben aktiv.

## Offizielle Dokumentation

- [Netlify: Next.js](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Netlify: Preise und Kontingente](https://www.netlify.com/pricing/)
- [Neon: Prisma](https://neon.com/docs/guides/prisma)
- [Google Drive: wiederaufnehmbare Uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)

## Was noch von dir benötigt wird

Nur die privaten Einstellungen in Neon, Netlify und Google Cloud sowie der erste echte Cloud-Test. Keine Geheimnisse im Chat senden. Sobald `.env.cloud` lokal ausgefüllt ist, kann die Datenübernahme erfolgen. Die tatsächliche Netlify-Adresse wird für die beiden URL-Variablen und den Google-Redirect benötigt.
