# Event-Arbeitsbereich

Stand: 4. Oktober 2026. Der Fokus liegt auf den fünf vorhandenen Events und ihren Drive-Unterlagen. Tasks und AI sind nicht Teil der sichtbaren Hauptnavigation; bestehende Daten bleiben erhalten.

## Anwendung

1. Unter /events ein Event öffnen. Overview → Event bearbeiten speichert Beginn, Ende, Ort, Beschreibung und Status. Die Eingabe der Uhrzeiten erfolgt in der angezeigten Browser-Zeitzone; Speicherung als UTC.
2. Dokumente → Einnahmerechnungen / Ausgabenrechnungen zeigt die synchronisierten Dateien unter den jeweils zugewiesenen Ordnern, einschließlich Unterordnern und vollständigem Pfad. Alle Dokumente enthält auch vorhandene Google Sheets. Links öffnen das Original; Inhalte werden nicht geändert.
3. Genehmigungen zeigt den zugeordneten Genehmigungsordner. Media zeigt den MEDIA-Ordner. Für echte Bildvorschauen auf „Bildvorschauen freigeben“ klicken und Google-Lesezugriff bestätigen. Nur lightsignal.dj@gmail.com ist erlaubt. Die Galerie lädt JPEG, PNG, GIF, WebP und AVIF bis 10 MB; andere Dateien lassen sich in Drive öffnen.
4. Finanzen → Neue Buchung erfasst Datum, Einnahme/Ausgabe, Beschreibung und EUR-Betrag. Bestehende Zeilen lassen sich bearbeiten. Kennzahlen und Analytics basieren ausschließlich auf diesen Buchungen. Alte Excel/Sheets-Beträge und PDFs werden nicht automatisch gebucht.
5. Tickets → CSV auswählen → Vorschau prüfen → nach Kontrolle des Eventnamens importieren. Unterstützt wird das konkrete One.com-Semikolonformat mit AnzahlTicket, AnzahlTable und AnzahlLounge. Wiederholung aktualisiert Bestellungen anhand der Bestellnummer innerhalb desselben Events. Fehlende Bestellungen werden nicht gelöscht. Keine Namen, E-Mails oder Anschriften werden gespeichert. Fehlende Mengen bleiben unbekannt; Bestellungen sind keine Besucherzahlen.
6. Check-in System ist ein absichtlich inaktiver Platzhalter.

## Grenzen / nächste Schritte

PDF-Rechnungen und Genehmigungen lassen sich mit „PDF-Vorschau öffnen“ direkt in der Dateiliste anzeigen und wieder schließen. Dazu wird dieselbe Google-Dateifreigabe wie für Bilder verwendet. PDFs werden erst auf Klick geladen, auf Identität und Eventzuordnung geprüft und bis maximal 20 MB angezeigt. Bei Ladeproblemen bleibt der Link zum Original in Drive verfügbar.

- Die Beispieldatei wird nicht automatisch einem Event zugeordnet oder importiert.
- Alte Finanzstatistiken benötigen manuelle Buchungen oder später einen separat abgestimmten Import der bisherigen Kostenübersichten.
- Google muss den zusätzlichen read-only Scope für Bildinhalte genehmigen. Eventuell muss er im Google-Cloud-Consent-Screen ergänzt werden. Ohne ihn funktionieren Dateilisten und Original-Links weiter.
- Einlass, verifizierte Besucherzahlen und durchschnittliche Ticketpreise aus gemischten Warenkörben sind noch nicht umgesetzt.
- Es gibt keine automatische Rechnungsanalyse und keine AI. Neue Eventordner werden nur nach zusätzlicher Google-Freigabe und ausdrücklichem Anlegen des Events erstellt.

## Neue Events mit Drive-Struktur

Unter Events → Neues Event kann ein Event wie Chapter Five angelegt werden. Der Eventname und der Drive-Ordner heißen einheitlich YUNG Chapter Five. Darunter erstellt die App Ausgaben, Einnahmen, Genehmigungen und MEDIA und speichert ROOT und die vier Kategorie-Mappings. Datum und Ort lassen sich anschließend im Overview ergänzen.

Für diesen Ablauf ist eine zusätzliche Google-Schreibfreigabe erforderlich. Google bietet den umfassenden Drive-Scope an, weil der vorhandene Veranstaltungen-Ordner bereits außerhalb der App angelegt wurde. Der Ablauf erstellt ausschließlich neue Ordner unter dem gespeicherten Ausgangsordner. Vor jedem Drive-Zugriff wird die aktuelle Google-Identität gegen lightsignal.dj@gmail.com und den gespeicherten Google-Subject geprüft. Die vorhandenen Dokumente werden nicht bearbeitet.

Die App reserviert fünf von Google generierte Ordner-IDs in einem ActivityLog, bevor sie Ordner anlegt. Bei einem Netzwerkfehler kann derselbe Eventname erneut verwendet werden; bereits erstellte IDs werden geprüft und weiterverwendet. Existierende Events ohne solchen Auftrag und gleichnamige Drive-Einträge werden als Konflikt gemeldet, damit keine fremden Strukturen übernommen werden. Lokale Ordner und Mappings werden erst nach vollständigem Anlegen aller fünf Drive-Ordner zusammen gespeichert.

Das Anlegen echter Google-Ordner muss nach Bestätigung der zusätzlichen OAuth-Freigabe einmal in der Anwendung geprüft werden. Automatisierte Prüfungen verwenden simulierte Google-Antworten, damit Tests keine echten Veranstaltungsordner erzeugen.

## Zahlungsstatus und Chapter-Four-Übernahme

Buchungen haben jetzt „Bereits bezahlt / eingegangen“ und „Bezahlt von“ (Oliver, Daniel, Konto, PayPal). Bereits übernommene abweichende Quellbezeichnungen bleiben auswählbar. Beim Entfernen des Häkchens wird die Zahlerzuordnung geleert. Ausgaben werden für das Event insgesamt gerechnet, unabhängig davon, ob sie bezahlt sind; private Auslagen werden durch eine spätere Erstattung nicht nochmals zur Ausgabe.

Am 5. Oktober wurden für Chapter Four 35 positive Ausgaben aus KOSTEN!A17:C55 der bereitgestellten Chapter_Four_Kosten.xlsx mit zusammen 10.102 EUR übernommen. Vier entfallene Positionen mit 0 EUR wurden ausgelassen. Die Summenzeile C63 zeigt nur 9.252 EUR, weil dort die 850 EUR aus B17 fehlen. Eingetragen wurden außerdem die vom Nutzer angegebenen Sponsorings (200 EUR Blacksmith Tattoo Studio, 100 EUR Melle Beauty, 1.250 EUR AVP Autoland). Keine Ticketeinnahmen wurden übernommen. Die ursprünglichen Zahlungsstatus wurden beibehalten. „Ecki“ wird bis zur Identitätsklärung nicht automatisch als Daniel interpretiert. Sponsor-Zahlungseingänge sind noch nicht bestätigt. Mangels Einzelbuchungsdaten wurde das Eventdatum als Buchungsdatum verwendet; Quellzeilen und Annahmen stehen im ActivityLog.

## Technische Prüfung

`npm run db:deploy` wendet die additiven Migrationen für TicketOrder und Zahlungsstatus an. Danach `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` und `npm start`. Auth.js und die vorhandenen Ordnerzuordnungen bleiben bestehen. Ticketimporte laufen atomar in einer Transaktion und haben einen eindeutigen Schlüssel aus Event und Bestellnummer.
