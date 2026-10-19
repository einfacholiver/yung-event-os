# LIGHTSIGNAL-Rechnungen erstellen

Seit 19.10.2026 unter **Rechnungen erstellen** in der Hauptnavigation:
`/invoices/create`.

## Anwendung

1. Empfänger mit Anschrift, Bezeichnung und tatsächliches Leistungsdatum eintragen.
2. Eine oder mehrere Positionen mit Beschreibung, ganzzahliger Anzahl und
   Einzelpreis in EUR ergänzen. Die Summe wird exakt in Cent berechnet.
3. Zahlung auswählen: Überweisung offen (Zahlungsziel 1–90 Tage), Überweisung
   erhalten oder Barzahlung erhalten (jeweils mit Zahlungsdatum).
4. Ablage auswählen: gemappter Einnahmenordner eines Events oder der vorgegebene
   DJ-Gig-Rechnungsordner 2026 mit ID `18xlDM6tllxVCaI46ALs44E4edS4iJbis`.
   Events ohne Einnahmen-Mapping sind nicht auswählbar.
5. **PDF-Vorschau** prüfen. Dies speichert keine Rechnung und vergibt keine Nummer.
6. Angaben bestätigen und **Rechnung erstellen & ablegen** wählen.

Die PDF übernimmt das originale Logo sowie Absender-, Steuer- und Bankangaben
und den Kleinunternehmerhinweis aus der bereitgestellten Vorlage. Rechnungsdatum
und Nummer stammen vom Server, Zeitzone Europe/Berlin. Leistungsdatum und
Zahlungsdatum bleiben davon unabhängig. Umlaute werden unterstützt, nicht von
den verwendeten PDF-Schriften unterstützte Zeichen wie Emojis werden abgewiesen.

### Absender und Bankverbindung ändern

Unter **Absender: LIGHTSIGNAL GBR** sind Firmenname, Inhaberzeile, Straße,
PLZ/Ort, Telefon, E-Mail und Steuernummer bearbeitbar. Die Inhaberzeile ist mit
**Daniel Ecklkofer & Oliver Schöfberger GbR** vorausgefüllt. Die bisherigen
Adress-, Kontakt- und Steuerangaben bleiben die Vorauswahl. Unter **Bankdaten
bearbeiten** lassen sich Bankname, IBAN und BIC ändern; auch hier ist die
bisherige Verbindung vorbelegt. IBAN-Prüfziffer und BIC-Format werden geprüft.

Die Änderungen gelten für die jeweilige Rechnung und werden in ihrem Snapshot
gespeichert. Vorschau, Absenderblock, Rücksendezeile und Fußzeilen verwenden
diese Angaben. Bereits ausgestellte PDFs werden nicht neu erzeugt oder geändert.
Eine neu geladene Seite bzw. **Weitere Rechnung erstellen** verwendet wieder
die bisherigen Standardwerte; es werden keine globalen Stammdaten überschrieben.

## Nummerierung und Wiederholungen

Format: `JJJJ-MM-(1000 + Monatszähler)`, beispielsweise `2026-10-1001`,
`2026-10-1002`; im nächsten Monat wieder ab `1001`. Der Zähler gilt gemeinsam
für Event- und DJ-Gig-Rechnungen derselben Organisation.

Vor der ersten Rechnung eines Monats werden die bestehenden Dateinamen im
DJ-Gig-Ordner und in allen gemappten Einnahmenordnern einschließlich Unterordnern
geprüft. Bekannte ausgehende Rechnungsnummern aus der Datenbank werden ebenfalls
berücksichtigt. Erkannte Nummern werden übersprungen. Die Prüfung erfasst
Nummern in Dateinamen, nicht den Text fremder PDFs. Dateien ohne Nummer im Namen,
Rechnungen außerhalb dieser Ordner und parallel außerhalb der App neu vergebene
Nummern sind nicht verlässlich erkennbar. Deshalb neue Rechnungen künftig über
diese Funktion erstellen. Die Suche bricht bei mehr als 100 Ordnern oder 10.000
Dateien ab, statt eine ungeprüfte Nummer zu vergeben.

Die Datenbank serialisiert die Vergabe mit einer Transaktionssperre pro
Organisation und Monat. Eindeutige Schlüssel schützen Nummer und Monatszähler.
Die Erstellungs-ID verhindert eine zweite Rechnung bei wiederholter Anfrage.
Andere Angaben mit derselben ID werden als Konflikt abgewiesen.

Die endgültigen Angaben und PDF-Bytes werden in `InvoiceDocument` unverändert
gespeichert. Es wird zusätzlich ein ausgehender `Invoice`-Datensatz angelegt und
die Erstellung protokolliert. Die bestehende generische Bearbeitungs-API darf
solche ausgestellten Rechnungen nicht nachträglich ändern. Ein Storno- oder
Korrekturworkflow ist nicht Teil dieser Erweiterung.

## Drive und Finanzen

Die App prüft vor jedem Drive-Zugriff weiterhin die verifizierte Google-Identität
`lightsignal.dj@gmail.com`. Sie braucht die bestehende Drive-Schreibfreigabe.
Falls diese fehlt, bietet die Seite die Google-Freigabe an. Die Zielordner-ID ist
serverseitig festgelegt oder stammt aus dem geprüften Event-Mapping; der Browser
darf keine beliebige Uploadadresse bestimmen.

Erstellung und Upload sind getrennte Schritte. Bei einem Drive-Ausfall bleibt
die fertige Rechnung in der App sichtbar und herunterladbar. **In Drive ablegen /
erneut versuchen** verwendet dieselben PDF-Bytes und dieselbe Google-Datei-ID;
es wird weder eine neue Nummer noch eine zweite PDF erzeugt. Ein inzwischen
geändertes Event-Mapping verhindert das Ablegen im falschen Ordner.

Nach erfolgreichem Event-Upload ist die PDF sofort im gecachten Dokumentbestand
und am Rechnungsdatensatz verknüpft. Unter Event → Finanzen kann sie einer
Einnahmenbuchung zugeordnet werden. Die Rechnungserstellung legt **keine**
Transaktion an und erhöht deshalb keine Finanzsummen automatisch. Der DJ-Gig-
Ordner wird durch diese Funktion nicht zum synchronisierten Event-Root geändert.

Die Übersicht zeigt die letzten 50 ausgestellten Rechnungen mit PDF-Vorschau,
Download, Drive-Link bzw. Wiederholungsaktion. Gespeicherte PDFs lassen sich auch
bei nicht verfügbarer Drive-Verbindung herunterladen; Anmeldung bleibt nötig.

## Umsetzung und Validierung

- Additive Migration `20261019000000_invoice_creation`: `InvoiceDocument` und
  `InvoiceCounter`; keine Änderung bestehender Geschäftsdaten. Vorherige
  Geschäftsdaten lokal im ignorierten Backupordner gesichert; Datensatzanzahlen
  nach der Neon-Migration unverändert.
- PDF-Erzeugung lokal im Node-Server mit `pdf-lib`, ohne externen PDF-Dienst.
  Das aus der Vorlage extrahierte Logo wird explizit für Netlify gebündelt.
- Private API-Routen, serverseitige Organisationsprüfung, exakte Origin-Prüfung
  für Schreibzugriffe, JSON-Body auf 100 KB begrenzt, private/no-store-Antworten.
- Tests für Monatswechsel, vorhandene Nummern, centgenaue Summen, ungültige
  Angaben, Idempotenz, Upload-Wiederholung, Identitätsfehler, Mapping-Wechsel,
  Datenbank-Constraints sowie ein- und mehrseitige PDFs.
- PDF-Layouts auf allen Seiten gerendert und visuell geprüft.
- Lokaler Browser prüft Formular, echte PDF-Vorschau, Zahlungs-/Eventauswahl
  und Breiten 390/768/1440 px ohne eine Rechnung auszustellen. Zusätzlich
  bestehende Event-/Finanz-Browsertests und Zugriffstests für 18 Schreibhandler.
- Ein echter neuer Rechnungsupload zu Google Drive wird erst durch die
  bewusste Erstellung einer Rechnung ausgelöst und wurde beim Entwicklertest
  nicht gegen das echte Drive ausgeführt.

Abschlussstand: Lint und Typprüfung bestanden; 48 Testdateien mit 187 Tests grün.
Die bisherigen acht Browsertests und der zusätzliche Rechnungs-Vorschautest
bestanden. Der erweiterte Auth-Smoke-Test blockiert unerlaubte Zugriffe auf alle
18 Schreibhandler. Die Vorschau und Browsertests verbrauchten keine Rechnungsnummer.

Produktionsabhängigkeiten: npm-Audit ohne bekannte Funde am 19.10.2026. Im
vollständigen Audit bleiben fünf transitive/übergeordnete Meldungen innerhalb
der bestehenden ESLint-Entwicklungswerkzeuge; npm schlägt dafür einen
inkompatiblen Next-ESLint-Downgrade vor. Dieser wurde nicht automatisch angewendet.
