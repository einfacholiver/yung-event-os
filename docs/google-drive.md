# Google Drive: Verbindung und Browser

Dieser Meilenstein implementiert Settings → Integrations → Google Drive → Connect, einen manuellen Browser, das Speichern einer Ordner-ID und einen manuellen Metadaten-Sync. Der Sync schreibt nur DriveItem-Metadaten und keine Dateiinhalte; es gibt kein Event-Mapping und keine Änderungen an Drive-Dateien. Browser-Abfragen erfolgen nach einem Klick.

## Einrichtung

1. Im Google-Cloud-Projekt die Google Drive API aktivieren. Google Sheets API wird hier noch nicht benötigt.
2. Einen OAuth-Client vom Typ Webanwendung verwenden. Autorisierte Redirect-URI: `http://localhost:3000/api/auth/callback/google`.
3. In Google Auth Platform die Zielgruppe und bei Testbetrieb den Testnutzer `lightsignal.dj@gmail.com` konfigurieren. Unter Datenzugriff zusätzlich zu OpenID, E-Mail und Profil den Scope `https://www.googleapis.com/auth/drive.metadata.readonly` hinzufügen. Er erlaubt Metadatenzugriff auf Drive, aber weder Dateiinhalte noch Schreibzugriffe. Für bestehende Ordnerstrukturen ist der engere `drive.file`-Scope nicht ausreichend.
4. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `DATABASE_URL` und `AUTH_URL=http://localhost:3000` lokal in `.env.local` hinterlegen. `.env.example` enthält ausschließlich Platzhalter. Keine echten Werte committen oder in Chats kopieren. `APP_URL` ist reserviert; Auth.js verwendet `AUTH_URL`.
5. `npm run db:deploy` anwenden und den Entwicklungsserver neu starten. Die YUNG-Organisation muss durch `npm run db:seed` vorhanden sein.
6. Die Integrationsseite öffnen und Connect anklicken. Ausschließlich mit `lightsignal.dj@gmail.com` anmelden und Metadatenzugriff bestätigen.

## Manueller Abnahmetest vor dem nächsten Meilenstein

- Ohne Login ist der Browser nicht sichtbar; der Browse-Endpunkt liefert 401.
- Nach Login erscheint Verbunden. Meine Ablage öffnen und den echten Ordner Veranstaltungen anklicken.
- Diesen Ordner auswählen. Die angezeigte Google Folder ID muss der ID aus der Google-Drive-URL entsprechen. Nach Neuladen bleibt die Auswahl erhalten.
- Veranstaltungen erneut öffnen und die vorhandenen Eventordner prüfen: YUNG Pre-Event und YUNG Chapter One bis Four.
- Chapter Four öffnen und die tatsächlichen Inhalte kontrollieren, beispielsweise Ausgaben, Einnahmen, Genehmigungen, MEDIA und Chapter_Four_Kosten… . Namen werden von Google geliefert, nicht als Beispieldaten erzeugt.
- Breadcrumbs und Zurücknavigation prüfen. Bei mehr als 100 Einträgen Weitere laden verwenden. Eine Datei öffnet sich in Google Drive.
- Disconnect entfernt die lokalen OAuth-Tokens und blockiert den Browser. Die gespeicherte Ordnerauswahl bleibt für erneutes Verbinden erhalten. Abmelden beendet nur die App-Session.
- „Drive synchronisieren“ läuft den gespeicherten Ordner rekursiv durch. Wiederholte Syncs aktualisieren dieselben `connectionId`/`externalId`-Datensätze und erzeugen keine Duplikate. `lastSyncedAt` wird erst nach vollständig erfolgreichem Lauf gesetzt; nicht mehr gelistete Einträge werden als `trashed` markiert.

Die echte Google-Anmeldung und dieser Strukturvergleich benötigen den Kontoinhaber. Automatisierte Tests verwenden API-Antworten als Testdaten und ersetzen diese Abnahme nicht. Der erste manuelle Sync kann nach erfolgreicher Abnahme gestartet werden.

## Technische Grenzen und Betrieb

- Jede Browser- und Auswahloperation prüft Session, YUNG-Zugehörigkeit, verknüpftes Google-Konto und anschließend die Google-Userinfo mit verifizierter E-Mail und passender Subject-ID, bevor Drive abgefragt wird.
- Navigation ist auf Meine Ablage begrenzt. Geteilte Ablagen und Ordner-Shortcuts werden nicht verfolgt. Die Auswahl prüft die Elternkette bis Meine Ablage; die Wurzel selbst kann nicht als Eventordner gespeichert werden.
- `DriveConnection.rootFolderId`, `rootFolderName` und `folderSelectedAt` speichern die bestätigte Auswahl. `DriveItem` speichert ID, Parent-ID, Name, MIME-Type, Typ, URL und Änderungszeitpunkt. Der Name dient nur der Anzeige. Noch keine automatische Eventzuordnung.
- Access- und Refresh-Tokens liegen AES-256-GCM-verschlüsselt in Account. Der Schlüssel wird aus AUTH_SECRET abgeleitet. Dieses Secret stabil halten und sicher sichern; nach Änderung müssen Verbindungen erneut autorisiert werden.
- Abgelaufene Access-Tokens werden serverseitig erneuert. Bei fehlender oder widerrufener Berechtigung fordert die UI erneutes Verbinden. Tokens gelangen weder in Browserantworten noch in Logs.
- Disconnect trennt lokal; die Google-Freigabe kann der Kontoinhaber zusätzlich in seinem Google-Konto unter Drittanbieter-Verbindungen widerrufen.
- Die OAuth-Freigabe gilt für Metadaten im gesamten Konto. Die Ordnerauswahl ist eine Anwendungseinstellung und begrenzt nicht den Google-Scope.
- Events sind weiterhin eine lokale Vorschau ohne globalen Zugriffsschutz. Vor öffentlicher Bereitstellung ist ein eigener Meilenstein für umfassende Autorisierung erforderlich.

Referenzen: [Drive-Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Dateiliste](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

## Lokaler Prüfstand (4. Oktober 2026)

Migration `20261004020000_drive_connection` auf PostgreSQL angewendet. Die Integrationsseite wurde im Browser geprüft; anonyme Browse-Anfragen liefern 401. Connect führt erfolgreich zur Google-Anmeldung für YUNG Event OS. Eine zunächst blockierte Google-Verbindung des Entwicklungsservers wurde durch Start außerhalb der Netzwerk-Sandbox behoben. Der echte Login, die Folder-Auswahl und der Strukturvergleich sind noch offen; es wurde noch kein Drive-Ordner gespeichert oder synchronisiert.
