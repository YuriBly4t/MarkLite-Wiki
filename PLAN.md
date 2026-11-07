# 📝 Projektplan & Wissensbasis: Minimalistische Self-Hosted Markdown-Wiki WebApp

## 1. Überblick & Vision

Ziel ist die Entwicklung einer schlanken, schnellen und vollständig selbst gehosteten Web-Applikation für Notizen und persönliche Dokumentation im Markdown-Format mit Bild-Uploads und Benutzer-Login.

* **Zielsystem Produktion**: **Debian VM mit CasaOS** (leichtgewichtig, Docker-basiert, Web-Dashboard).
* **Testumgebung**: **ZorinOS PC** (Ubuntu/Debian-Basis für bequemes lokales Testen vor dem Rollout).
* **Fokus**: Ablenkungsfreiheit, einfache Bedienung, modernes minimalistisches Design, optimiert für Laptop/PC und Smartphone.

---

## 2. Wissensbasis: Datenbank-Arten & REST-API verständlich erklärt

### 2.1 Was ist der Unterschied zwischen den Datenbank-Arten?

In der Softwareentwicklung gibt es verschiedene Konzepte, wie Daten dauerhaft gespeichert werden:

| Datenbank-Art | Typische Vertreter | Wie funktioniert sie? | Vorteile | Nachteile | Eignung für dieses Projekt |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Datei-basiertes SQL (Eingebettet)** | **SQLite** | Die gesamte Datenbank ist **eine einzige Datei** (`wiki.db`) auf der Festplatte. Die App greift direkt darauf zu; es läuft kein eigener Datenbank-Dienst im Hintergrund. | Extrem sparsam (nur ~5 MB RAM), keine Konfiguration, kinderleichte Backups (einfach Datei kopieren), rasend schnell bei Lesezugriffen. | Nicht ausgelegt für hunderte gleichzeitige Schreiber (Concurreny Locking). | ⭐⭐⭐⭐⭐ **Perfekt!** Ideal für CasaOS, Debian VMs und Notiz-Apps. |
| **Client-Server Relational (SQL)** | **PostgreSQL, MariaDB, MySQL** | Ein eigener, dauerhaft laufender Dienst (Server) wartet auf Anfragen über ein Netzwerk-Port (z. B. 3306 oder 5432). | Kann tausende gleichzeitige Benutzer verwalten, komplexe Berechtigungen, Clustering. | Braucht deutlich mehr RAM (oft 150–500 MB nur für die DB), muss separat eingerichtet, gewartet und im Docker-Netzwerk verknüpft werden. | ⭐⭐ Für ein persönliches Wiki unnötig schwerfällig. |
| **Dokumenten-basiert (NoSQL)** | **MongoDB, CouchDB** | Speichert Daten nicht in Tabellen mit festen Spalten, sondern als flexible JSON-ähnliche Dokumente. | Flexible Datenstrukturen, wenn sich Datenfelder ständig ändern. | Höherer Speicher- und Ressourcenverbrauch, weniger Transaktionssicherheit bei strengen Beziehungen. | ⭐⭐ Für hierarchische Wiki-Notizen mit Relationen nicht optimal. |
| **In-Memory / Key-Value** | **Redis, KeyDB** | Hält Daten primär im Arbeitsspeicher (RAM) vor. | Nahezu latenzfreie Abfragen (Mikrosekunden). | Daten sind flüchtig, RAM-intensiv; dient meist als Cache oder Session-Speicher neben einer Haupt-DB. | ⭐ Für ein schlankes Wiki überdimensioniert. |

> [!NOTE]
> **Fazit für dein CasaOS / ZorinOS Setup:**
> Wir nutzen **SQLite**. Auf deiner CasaOS-Debian-VM bedeutet das: **Null zusätzliche Container**, **minimaler RAM-Verbrauch** und die gesamte Datensicherung besteht einfach darin, den Ordner `data/` zu kopieren.

---

### 2.2 Was ist eine REST-API?

**REST** steht für *Representational State Transfer*. Es ist die standardisierte "Sprache" bzw. Schnittstelle, über die das Frontend (dein Webbrowser auf PC oder Handy) mit dem Backend (dem Server) spricht.

#### Wie funktioniert das in der Praxis?
Früher lud der Browser bei jedem Klick eine komplett neue HTML-Seite vom Server. 
Bei einer modernen Web-App mit **REST-API** lädt der Browser die Benutzeroberfläche nur **ein einziges Mal**. Wenn du danach eine Notiz speicherst, nach einem Begriff suchst oder ein Bild hochlädst, schickt der Browser im Hintergrund unbemerkt strukturierte Datenpakete (meist im **JSON-Format**) an den Server.

Dabei nutzt REST die Standard-Methoden des HTTP-Protokolls:

* `GET /api/notes`: *"Gib mir die Liste aller Notizen."* (Server antwortet mit einer Liste im JSON-Format)
* `POST /api/notes`: *"Erstelle eine neue Notiz."* (Browser schickt Titel & Markdown-Text mit)
* `PUT /api/notes/3`: *"Aktualisiere die bestehende Notiz Nr. 3."*
* `DELETE /api/notes/3`: *"Lösche Notiz Nr. 3."*
* `POST /api/upload`: *"Hier ist eine Bilddatei, speichere sie und gib mir den Link zurück."*

**Vorteile:**
1. **Kein Flackern oder Neuladen:** Der Editor bleibt offen, während im Hintergrund gespeichert wird.
2. **Spart mobile Bandbreite:** Es werden nur die reinen Textdaten übertragen, nicht das gesamte Seitenlayout.

---

## 3. Ersteinrichtung & Setup-Dialog

Damit die App sofort einsatzbereit und trotzdem sicher ist, gibt es zwei Stufen:

### 3.1 Skript zur Generierung des Session-Secrets (`setup.sh`)
Für die Absicherung der Login-Sitzungen (Cookies) wird ein kryptografisches Geheimnis (`SESSION_SECRET`) benötigt.
* Das mitgelieferte Skript `setup.sh` generiert beim ersten Ausführen automatisch ein zufälliges 64-Zeichen-Hexadezimal-Secret (via `openssl` oder `crypto.randomBytes`).
* Es erstellt automatisch die Konfigurationsdatei `.env` und die Ordner `data/uploads`.
* Du musst keine Passwörter oder Secrets von Hand in Konfigurationsdateien tippen.

### 3.2 Web-basierter Setup-Dialog (First-Run Wizard)
Wenn du die WebApp zum allerersten Mal im Browser öffnest:
1. **Erkennung**: Das Backend prüft beim Aufruf, ob bereits ein Benutzer in der SQLite-Datenbank existiert (`SELECT COUNT(*) FROM users`).
2. **Automatischer Redirect**: Ist die Datenbank noch leer, wird der Nutzer automatisch auf den **Setup-Dialog** (`/setup`) weitergeleitet.
3. **Schlichte Einrichtungsmaske**:
   * Begrüßung: *"Willkommen bei deinem persönlichen Markdown-Wiki"*
   * Eingabe: Gewünschter Administrator-Benutzername und sicheres Passwort (mit Bestätigung).
4. **Initialisierung & Sofort-Login**:
   * Das Passwort wird mit `bcryptjs` gehasht und in der SQLite-Datenbank gespeichert.
   * Es wird sofort eine sichere Session gestartet und direkt in den Editor weitergeleitet.
5. **Permanente Sperre**:
   * Sobald ein Administrator existiert, ist die Setup-Route `/api/auth/setup` für immer gesperrt und verweigert jeden weiteren Zugriff (`403 Forbidden`).

---

## 4. Zielsysteme & Deployment (CasaOS & ZorinOS)

### 4.1 Lokaler Test auf ZorinOS
ZorinOS basiert auf Ubuntu und ist ideal für schnelle Tests:
1. Im Terminal in den Ordner wechseln: `cd WikiAlternative`
2. Einrichten: `./setup.sh`
3. Abhängigkeiten installieren & starten:
   ```bash
   npm install
   npm run dev  # oder npm start
   ```
4. Im Browser öffnen: `http://localhost:3000`

### 4.2 Produktion auf CasaOS (Debian VM)
CasaOS bietet eine einfache Weboberfläche und Docker-Unterstützung:
* **Option 1: Docker Compose (Schnellste Variante)**:
  1. Ordner auf die VM kopieren.
  2. Im Ordner `./setup.sh` ausführen (generiert `.env`).
  3. `docker compose up -d` ausführen.
  4. Die App läuft sofort auf Port `3000` und kann über `http://<IP-der-VM>:3000` aufgerufen werden.
* **Option 2: CasaOS Custom App**:
  * Über das CasaOS-Dashboard -> "App Store" -> "Custom Install" kann die `docker-compose.yml` direkt importiert werden.
  * Das Volume `./data` wird auf der VM gemountet, sodass Notizen und Bilder auch bei Container-Updates sicher erhalten bleiben.

---

## 5. UI/UX & Responsive Konzept (Laptop/PC vs. Smartphone)

* **Laptop / Desktop**:
  * **Linke Seitenleiste**: Notizen-Liste, Suchfeld, Tag-Filter, Button "Neue Notiz", Benutzerprofil / Logout.
  * **Zentraler Bereich**: Minimalistischer Editor. Wahlweise "Live Split-View" (links Markdown tippen, rechts gerendertes Ergebnis) oder purer Vollbild-Schreibmodus.
  * **Tastatur-Freundlich**: `Strg + S` zum Speichern, `Strg + V` zum direkten Einfügen von Screenshots als Bild.
* **Smartphone**:
  * **Burger-Menü / Drawer**: Notizenliste wird von links eingeblendet und schließt sich bei Auswahl automatisch.
  * **Optimierte Toolbar**: Schnelltasten über der mobilen Tastatur (Überschrift, Fett, Kursiv, Checkbox `- [ ]`, Bild einfügen).
  * **Fokus-Modus**: Volle Bildschirmbreite für das Schreiben ohne störende Navigationselemente.
  * **Touch-Gesten**: Sauberes Scrolling, große Buttons für Daumenbedienung.
* **Themes**: Dark Mode & Light Mode (automatische Erkennung der Systemeinstellung + manueller Umschalter).

---

## 6. Schritt-für-Schritt Umsetzungsplan

1. **Phase 1: Backend & Datenbank-Basis**
   * Express-Server aufsetzen, SQLite-Verbindung und Tabellen initialisieren (`users`, `notes`, `tags`, `attachments`).
   * Authentifizierungs-System mit Session-Cookies und Setup-Route erstellen.
2. **Phase 2: Bild-Upload-Pipeline**
   * Multer-Handler für Drag & Drop und Clipboard-Uploads (`/api/upload`) mit Dateityp-Prüfung (PNG, JPG, WebP, GIF, SVG).
3. **Phase 3: Notizen-CRUD & Suche**
   * Endpunkte zum Erstellen, Lesen, Bearbeiten, Löschen, Pinnen und Durchsuchen von Notizen.
4. **Phase 4: Responsive Frontend & Setup-Dialog**
   * Schlichte, elegante HTML/CSS/JS-Oberfläche (Desktop + Mobil).
   * First-Run Setup-Dialog & Login-Maske.
   * Markdown-Rendering mit Live-Vorschau, Syntax-Highlighting und direkter Screenshot-Einfügefunktion.
5. **Phase 5: Dockerfile, Docker Compose & CasaOS-Feinschliff**
   * Erstellung des Multi-Arch Dockerfiles und der `docker-compose.yml`.
   * Fertigstellung der Dokumentation mit Schritt-für-Schritt-Anleitung für ZorinOS und CasaOS.
