# Sicherheitsprüfung – 15. Oktober 2026

## Umfang und Methode

Gezielte Prüfung des aktuellen Event OS: öffentliche und private Routen,
Google-Anmeldung, serverseitige Autorisierung, Organisationsbindung,
Drive-Zugriffe, Uploads, Datenbankabfragen und Produktionsabhängigkeiten.
Ausgangspunkt war der Cloudflare-Ansatz: Erreichbarkeit berücksichtigen,
Verdacht mit Code und Tests belegen, Korrekturen durch Regressionstests absichern.
Dies ist kein beauftragter Cloudflare-Scan oder vollständiger Penetrationstest.
Cloudflare-Trafficdaten und Kontoeinstellungen standen nicht zur Verfügung.

## Bestätigter Fund und Behebung

**Drive-Mapping: inkonsistente Herkunftsprüfung (CSRF-Härtung).**
`POST /api/integrations/google-drive/mapping` akzeptierte einen fehlenden Origin.
Bei vorhandenem Origin wurde nur der Host verglichen, nicht das Protokoll;
ein ungültiger Origin konnte außerdem außerhalb der Fehlerbehandlung scheitern.
Der lokale Produktionstest mit einer gültigen Testsitzung belegte, dass eine
Anfrage ohne Origin bis zur Eingabevalidierung kam (400 statt 403).

Die Route verwendet jetzt denselben `requireSameOrigin`-Schutz wie die anderen
Schreibschnittstellen: exakter Vergleich mit der Request-Origin, fehlende,
`null`, fremde und syntaktisch ungültige Origins werden vor Authentifizierung,
Body-Verarbeitung und Mapping-Änderung abgewiesen. Ein isolierter Regressionstest
prüft zusätzlich das falsche Protokoll bei gleichem Host und den erlaubten Fall.
Die alte Logik allein belegt keinen gelungenen Fremdzugriff: Eine gültige
Admin-Sitzung war weiterhin erforderlich. Bestehende Mappings bleiben erhalten.

## Bereits vorhandene Schutzmaßnahmen

- Google-Login ausschließlich für die verifizierte Adresse
  `lightsignal.dj@gmail.com`, mit PKCE, State und Nonce.
- Datenbanksitzungen, acht Stunden Laufzeit. Cookie-Präsenz im Proxy ist nur
  eine Weiterleitungshilfe; die tatsächliche Freigabe erfolgt serverseitig.
- Admin-, Google-Account- und Organisationsprüfung vor privaten Datenzugriffen;
  Schreiboperationen sind auf die Organisation begrenzt.
- Drive-Client prüft die tatsächliche Google-Identität vor Drive-Zugriffen.
  Tokens werden verschlüsselt gespeichert und nicht an Browser weitergegeben.
- Parametrisierte Prisma-Abfragen; in der gezielten Suche keine unsicheren
  Raw-SQL-Aufrufe oder `dangerouslySetInnerHTML` außerhalb generierten Codes.
- Begrenzte Upload-Abschnitte und Vorschaugrößen, Datei-/MIME-Prüfungen,
  abgesicherte Google-Uploadziele. Dies ersetzt keinen Malware-Scanner.
- Private Seiten/API-Antworten werden nicht öffentlich gecacht.

## Cloudflare richtig einordnen

Es gibt aktuell keine aktive LLM-Analyse, keinen AI Assistant und keinen
KI-Endpunkt. Der Prompt-Injection-Score schützt deshalb derzeit keine Funktion
dieser App. Er ersetzt weder Anmeldung noch Zugriffskontrolle, SQL-/XSS-Schutz
oder einen Virenscan. Clientseitig gesendete Scores dürfen niemals als
vertrauenswürdige Freigabe dienen.

Laut aktueller Cloudflare-Dokumentation werden entsprechend markierte
LLM-Endpunkte und JSON-Anfragen untersucht; die AI-Erkennungsfelder sind derzeit
ein kostenpflichtiges Enterprise-Add-on. Der zusätzliche Managed-Defense-Dienst
für Codeprüfungen ist laut Ankündigung nur auf Einladung verfügbar. Keiner
dieser Dienste wurde mit dieser Prüfung gebucht oder eingerichtet.

Falls später KI hinzukommt: Dokumentinhalte als unvertrauenswürdige Daten
behandeln, Werkzeuge serverseitig autorisieren und auf konkrete Zwecke begrenzen,
keine Geheimnisse/gesamte Datenbank im Prompt, Schreibaktionen nur nach expliziter
Bestätigung. Ein Injection-Score wäre eine zusätzliche Erkennungsschicht und
keine Sicherheitsgarantie; indirekte Angriffe aus Dokumenten separat testen.

Quellen:

- https://developers.cloudflare.com/waf/detections/ai-security-for-apps/
- https://developers.cloudflare.com/waf/detections/ai-security-for-apps/prompt-injection/
- https://blog.cloudflare.com/vulnerability-discovery-remediation/

## Offene Maßnahmen und Grenzen

1. **Google-Konto absichern:** Passkey/Zwei-Faktor-Authentifizierung und
   Wiederherstellungswege im Google-Konto prüfen. Durch die gemeinsam verwendete
   Adresse sind Oliver und Daniel in Sitzungen/Auditlogs nicht unterscheidbar.
2. **Verteiltes Rate Limiting:** Kein eigener dauerhaft verteilter App-Limiter
   nachgewiesen; Netlify-/Cloudflare-Regeln und Limits müssen im Providerkonto
   geprüft werden. Ein In-Memory-Zähler wäre im Serverless-Betrieb unzuverlässig.
3. **CSP ausbauen:** Die vorhandene CSP beschränkt Frames, Base-URL und Objects,
   enthält jedoch noch keine restriktive `script-src`. Eine Nonce-basierte CSP
   muss mit Next-Rendering, PDF-Vorschau und Produktionshosting getestet werden.
4. **Cloudflare vor Netlify:** Ein eigener Proxy schützt nur Verkehr, der ihn
   durchläuft. Bei einer späteren Einrichtung auch direkte Netlify-/Deploy-URLs
   berücksichtigen und den Origin gegen Umgehung absichern.
5. **Betrieb:** Wiederherstellung eines Backups testen, Provider-/Google-Zugriffe
   regelmäßig prüfen und Abhängigkeitsscans wiederholen. Null bekannte Advisories
   bedeutet nicht, dass keine unbekannten Schwachstellen existieren.

## Nachweise

`tests/security/auth-smoke.ts` läuft ausschließlich gegen localhost. Es prüft
anonyme und gefälschte Sitzungen, RSC- und Proxy-Umgehungsversuche, API-Zugriffe,
gültige/widerrufene Sitzungen sowie 15 Schreibhandler mit fehlender, `null` und
fremder Origin trotz gültiger Sitzung. Nur eine temporäre Testsitzung wird in
Neon angelegt und abschließend gelöscht; keine Finanz-, Event- oder Drive-Daten
werden geändert und Sitzungstokens werden nicht an die Online-App gesendet.

Öffentliche Onlineprüfung ohne Cookies: `/login` antwortet 200, `/events`
leitet mit 307 auf `/login`, Drive-Browse liefert 401. Login liefert CSP,
nosniff und HSTS; die frühen Proxy-Antworten liefern no-store und HSTS, jedoch
keine CSP/nosniff. Es wurde kein Lasttest gegen die Online-App durchgeführt.

Produktionsabhängigkeiten: `npm audit --omit=dev` meldete am Prüftag null bekannte
Schwachstellen.

Abschlussprüfungen bestanden: `npm run lint`, `npm run typecheck`, `npm run test`
(44 Dateien, 175 Tests), `npm run build`. Der erweiterte Auth-Smoke-Test gegen den
korrigierten lokalen Produktionsbuild und Neon bestand ebenfalls: alle 15
Schreibhandler wiesen die drei unerlaubten Origin-Varianten mit 403 zurück;
anonyme, gefälschte und widerrufene Sitzungen wurden gesperrt, die gültige
Admin-Sitzung wurde akzeptiert und die Testsitzung anschließend gelöscht.
