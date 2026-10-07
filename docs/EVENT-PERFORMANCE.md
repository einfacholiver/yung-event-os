# Event-Seiten schneller laden

Beim Öffnen eines Events und beim Reiterwechsel wurden mehrere Datenbankzugriffe wiederholt oder unnötig nacheinander ausgeführt. Folgende Änderungen reduzieren diese Arbeit:

- Anmeldung und Drive-Verbindung werden mit React `cache` innerhalb desselben Server-Renderings nur einmal geladen. Es gibt keinen gemeinsamen Cache über Benutzer oder Anfragen hinweg; jede neue Anfrage prüft die Berechtigung erneut.
- Event-Layout, Metadaten und Reiter verwenden dieselbe Anfragefunktion für das Event.
- Dokumente laden Events, Dateien und Ordner parallel. Die Dokument-Reiter verwenden bereits geladene Ordner und Mappings auch für die Upload-Ziele und ihre vollständigen Pfade. Zwei zusätzliche Abfragen entfallen.
- Die Zuordnung verwendet Maps statt wiederholter linearer Ordnersuchen.
- Finanzen laden Buchungen und Dokumente parallel; Tickets laden Verkaufspositionen und Bestellungen parallel.
- Rechnungs-Auswahllisten werden erst beim Öffnen von „Rechnung zuordnen“ beziehungsweise „Verknüpfung ändern“ gerendert. Geschlossene Zeilen erzeugen keine wiederholten Listen aller Rechnungsdateien.
- Eine Ladegrenze direkt unter dem Event-Layout ermöglicht die Teilvorladung der Navigation und zeigt während des Reiterwechsels sofort eine Rückmeldung.

Die Optimierung verwendet weiterhin aktuelle Datenbankabfragen. Sie ändert keine Finanzdaten oder Drive-Dateien und schwächt die Anmeldung nicht ab. Kaltstarts bei Neon und Netlify bleiben möglich. Eine feste Beschleunigung in Sekunden ist ohne Messung in der angemeldeten Online-Version nicht zugesichert.

## Prüfen

In der Online-Version ein Event öffnen und mehrmals Overview, Finanzen, Dokumente, Media und Tickets wechseln. Nach dem Speichern eines Betrags oder Upload einer Datei muss die Änderung weiterhin sichtbar sein. Für eine vergleichbare Messung dieselben Reiter nach dem ersten Aufruf erneut öffnen; Aufrufe nach einer längeren Pause getrennt bewerten.
