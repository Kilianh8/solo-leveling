# Solo Leveling – Umzug in eine installierbare App (PWA)

Ausgangslage: Diese App lief als Claude-Artefakt (claude.ai/artifact/5cEXa8yu9L359UDRwiWFoj).
Dort speichert sie Daten über `window.claude.use('db')` (Claude-Datenbank). Außerhalb von Claude gibt es das nicht.

## Aufgabe für Claude Code
1. Aus `index.html` eine installierbare PWA machen, gehostet über GitHub Pages:
   - `manifest.webmanifest` mit `"display": "fullscreen"`, Name "Solo Leveling", `theme_color`/`background_color` #000000
   - Icons aus `solo-leveling-icon.png` (192 und 512 px, auch maskable)
   - Service Worker für Offline-Nutzung; neue Versionen beim nächsten Öffnen automatisch laden
2. Speicherung: Claude-DB-Code (`initDB`, `persist` → DB) durch lokale Speicherung ersetzen
   (IndexedDB oder localStorage). Backup/Restore in den Einstellungen bleibt.
3. `strong-history.json` (91 importierte Strong-Trainings) wird weiterhin beim Start nachgeladen.
4. Den Vollbild-Knopf oben links entfernen (im installierten Modus unnötig).
5. Datenübernahme: Nutzer fügt den Text aus "Copy backup" (alte App) unter "Restore backup" (neue App) ein.

Optional später: Sync zwischen Geräten (z. B. Supabase).
