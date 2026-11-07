# 📝 MarkLite Wiki

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![AI Generated](https://img.shields.io/badge/Code-100%25%20AI%20Generated-orange)](#-wichtiger-hinweis--disclaimer)

> Eine schlanke, minimalistische und vollständig selbstgehostete Web-Applikation für Notizen und persönliche Dokumentation im Markdown-Format – mit nativer Bildverwaltung, ablenkungsfreiem Design und Benutzer-Authentifizierung.

---

> [!WARNING]
> ### ⚠️ WICHTIGER HINWEIS / DISCLAIMER: KI-GENERIERTER CODE
> **Dieser Quellcode wurde zu 100 % automatisiert durch Künstliche Intelligenz (KI) generiert und wurde NICHT manuell durch einen menschlichen Softwareentwickler oder IT-Sicherheitsexperten überprüft oder auditiert.**
> 
> - Es können unbekannte Sicherheitslücken, Programmierfehler oder funktionale Einschränkungen enthalten sein.
> - Die Nutzung, Bereitstellung im lokalen Netzwerk oder im Internet erfolgt **vollständig auf eigene Verantwortung und eigenes Risiko**.
> - Vor einem Einsatz in sicherheitskritischen Umgebungen wird eine manuelle Begutachtung des Codes dringend empfohlen.

---

## 🌟 Highlights & Funktionen

- **Ablenkungsfreies Schreiben**: Inspiriert von Bear, Notion und Obsidian. Minimalistisches, schnelles Interface ohne überladene Toolbars.
- **Markdown Live-Vorschau**:
  - **Split-View**: Gleichzeitiges Tippen und Lesen auf Desktop/Laptop.
  - **Reiner Lesemodus**: Perfekt zum Nachschlagen von Dokumentationen.
  - **Fokus-Schreibmodus**: Maximale Übersicht auf mobilen Geräten.
- **Bilder nahtlos einfügen**:
  - **Zwischenablage / Clipboard (`Strg + V`)**: Screenshots direkt in den Editor einfügen.
  - **Drag & Drop**: Bilddateien einfach in den Editor ziehen.
  - Automatischer Upload und sofortige Verlinkung im Markdown (`![Bild](/api/uploads/...)`).
- **Integrierter Setup-Wizard & Login**:
  - Beim ersten Start führt ein Web-Einrichtungsdialog durch die Erstellung des Administrator-Accounts.
  - Danach wird der Setup-Endpunkt dauerhaft verriegelt.
  - Sichere Passwort-Verschlüsselung via `bcryptjs` und abgesicherte `HttpOnly`-Session-Cookies.
- **Vollständig responsiv**:
  - Optimiert für PC, Laptop, Tablet und Smartphone (Touch-Drawer-Menü, angepasste Schriftgrößen).
- **Organisation**:
  - Schnelle Volltextsuche über Titel und Inhalte.
  - Dynamisches Tag-System (`#arbeit`, `#linux`, `#ideen`).
  - Wichtige Notizen anpinnen (📌 Pinned Notes).
- **Dark Mode & Light Mode**:
  - Automatische Anpassung an das Betriebssystem oder manueller Umschalter.
- **Zero-Cloud & 100 % Autark**:
  - Keine externen CDN-Abhängigkeiten zur Laufzeit (funktioniert auch offline oder in isolierten LAN-Umgebungen).
  - Alle Daten liegen in einer einzigen SQLite-Datei (`data/wiki.db`).

---

## 🚀 Schnellstart mit Docker (Empfohlen)

### 1. Repository klonen
```bash
git clone https://github.com/<DEIN-BENUTZERNAME>/MarkLite-Wiki.git
cd MarkLite-Wiki
```

### 2. Setup ausführen
Das mitgelieferte Setup-Skript legt die Datenordner an und generiert automatisch ein kryptografisch sicheres Session-Secret in der `.env`-Datei:
```bash
./setup.sh
```

### 3. Container starten
```bash
docker compose up -d
```

### 4. Öffnen & Einrichten
Rufe die Anwendung im Browser auf:
- Lokal: `http://localhost:3000`
- Im Heimnetzwerk: `http://<SERVER-IP>:3000`

Beim ersten Aufruf erscheint automatisch der **Setup-Dialog** zur Erstellung deines Administrator-Accounts.

---

## 🏠 Einsatz auf CasaOS (Debian VM)

MarkLite Wiki ist ideal für CasaOS geeignet, da es keine zusätzlichen Datenbank-Container (wie MySQL oder PostgreSQL) benötigt.

1. **Ordner bereitstellen**: Klone das Repo per SSH oder lade den Ordner über die CasaOS-App *Dateien* hoch.
2. **Initialisieren**: Führe im Ordner `./setup.sh` aus.
3. **Starten**: Führe `docker compose up -d` aus oder binde die `docker-compose.yml` in CasaOS als *Custom App* ein.
4. **Volume-Persistenz**: Alle Daten werden im lokalen Ordner `./data` gemountet und bleiben bei Container-Updates erhalten.

---

## 💻 Lokaler Test auf Linux (ZorinOS / Ubuntu / Debian) ohne Docker

```bash
# 1. Setup ausführen
./setup.sh

# 2. Abhängigkeiten installieren
npm install

# 3. Server starten
npm start
```

---

## 💾 Backups & Datensicherung

Alle Notizen, Passwörter und hochgeladenen Bilder befinden sich gebündelt im Verzeichnis `data/`:

```text
data/
├── wiki.db          # SQLite Datenbank (Notizen, Tags, Nutzer)
└── uploads/         # Alle hochgeladenen Bilder
```

- **Backup**: Sichere einfach den Ordner `data/` auf ein Backup-Medium oder NAS.
- **Wiederherstellung**: Kopiere den Ordner `data/` zurück und starte den Container neu (`docker compose restart`).

---

## ⚙️ Konfiguration (`.env`)

| Variable | Beschreibung | Standard |
| :--- | :--- | :--- |
| `PORT` | Webserver-Port | `3000` |
| `SESSION_SECRET` | 64-Zeichen Zufallsschlüssel für Session-Cookies | *(wird von setup.sh generiert)* |
| `MAX_UPLOAD_SIZE_MB` | Maximale Dateigröße für Bild-Uploads in MB | `25` |
| `NODE_ENV` | Umgebung | `production` |

---

## 📁 Projektstruktur

```text
├── data/                      # Persistente Daten (SQLite & Uploads)
├── src/
│   ├── server/               # Express Backend
│   │   ├── routes/           # REST-API (Auth, Notes, Upload)
│   │   ├── middleware/       # Authentifizierungsschutz
│   │   ├── db.js             # SQLite Initialisierung & Queries
│   │   └── index.js          # Server-Einstiegspunkt
│   └── public/               # Frontend (SPA)
│       ├── css/style.css     # Responsive Styling & Themes
│       ├── js/app.js         # App-Logik, Autosave, Drag & Drop
│       ├── js/markdown.js    # Autarker Markdown-Parser
│       ├── index.html        # Hauptoberfläche
│       ├── login.html        # Login-Maske
│       └── setup.html        # Ersteinrichtungs-Wizard
├── Dockerfile                # Multi-Arch Docker-Build
├── docker-compose.yml        # Compose-Konfiguration
├── setup.sh                  # Setup- & Secret-Generierungs-Skript
└── LICENSE                   # MIT Lizenz & AI Disclaimer
```

---

## 📄 Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** lizenziert – siehe die [LICENSE](LICENSE) Datei für Details.
