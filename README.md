# 📝 MarkLite Wiki

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![AI Generated](https://img.shields.io/badge/Code-100%25%20AI%20Generated-orange)](#-important-disclaimer-ai-generated-code)

> A clean, distraction-free, and fully self-hosted Markdown wiki and personal note-taking web application with native image support, responsive UI, and secure authentication.

---

> [!WARNING]
> ### ⚠️ IMPORTANT DISCLAIMER: AI-GENERATED CODE
> **This entire codebase was generated 100% automatically by Artificial Intelligence (AI) and has NOT been manually audited, reviewed, or verified by a human software developer or cybersecurity expert.**
>
> - It may contain unknown vulnerabilities, edge-case bugs, or functional limitations.
> - Hosting and deploying this application in local networks or on the public internet is done **entirely at your own risk**.
> - Before using this application in sensitive or production environments, a thorough manual code audit is strongly recommended.

---

## 🌟 Highlights & Features

- **Distraction-Free Writing**: Inspired by Bear, iA Writer, and Obsidian. A clean, typography-focused interface without cluttered toolbars.
- **Multi-User & Role Management**:
  - The first registered user is automatically assigned the **Administrator** role.
  - Support for multiple user accounts with registration.
- **Folders & Organization**:
  - Organize notes into custom folders or keep them uncategorized.
  - Quick folder filter navigation in the sidebar with live note counters.
- **Sharing & Collaboration**:
  - **Share with Users**: Share notes or entire folders with other registered users with granular permissions (*Can View* or *Can Edit*).
  - **Public Link Sharing**: Generate read-only shareable links (`/shared/<token>`) accessible to anyone without requiring an account.
  - **Shared with Me**: Dedicated sidebar view displaying all notes and folders shared with you.
- **Markdown with Live Preview & View Modes (Desktop & Mobile)**:
  - **Write Mode**: Full-width, distraction-free writing environment.
  - **Split View**: Side-by-side live editor and rendered markdown preview on desktop/laptop.
  - **Preview Mode**: Clean, presentation-grade viewing for reference and reading.
- **Seamless Image Management**:
  - **Clipboard Paste (`Ctrl + V`)**: Paste screenshots directly from your clipboard into the editor.
  - **Drag & Drop**: Drag image files straight onto the page.
  - Automatic background upload and instant Markdown referencing (`![Image](/api/uploads/...)`).
- **First-Run Setup Wizard & Authentication**:
  - Automatically guides you through creating an administrator account on first visit.
  - Permanently locks the setup endpoint once an admin exists.
  - Encrypted passwords via `bcryptjs` and secure `HttpOnly` session cookies.
- **Fully Responsive**:
  - Tailored for desktop, laptop, tablet, and mobile (touch-friendly drawer navigation, mobile toolbar).
- **Organization & Search**:
  - Instant full-text search across titles and note content.
  - Dynamic tagging system (`#work`, `#linux`, `#ideas`) with filter pills.
  - Pin important notes to the top (📌 Pinned Notes).
- **Dark Mode & Light Mode**:
  - Follows system preference or toggles manually with a single click.
- **Zero-Cloud & 100% Standalone**:
  - Zero external CDN dependencies at runtime (runs completely offline and in air-gapped home labs).
  - All data resides in a single, portable SQLite database file (`data/wiki.db`).

---

## 🚀 Quickstart with Docker (Recommended)

### 1. Clone the repository
```bash
git clone https://github.com/YuriBly4t/MarkLite-Wiki.git
cd MarkLite-Wiki
```

### 2. Run initial setup
The included setup script initializes data directories and generates a cryptographically secure 64-character session secret in `.env`:
```bash
./setup.sh
```

### 3. Start with Docker Compose
```bash
docker compose up -d
```

### 4. Open in browser
- Local machine: `http://localhost:3000`
- Network / Server: `http://<SERVER-IP>:3000`

On your first visit, the **Setup Wizard** will automatically appear to create your admin account.

---

## 🏠 Running on CasaOS (Debian VM)

MarkLite Wiki is lightweight and designed to run effortlessly on CasaOS or any Debian-based server:

1. **Get the files**: Clone via SSH or upload the repository folder into CasaOS via the *Files* app.
2. **Initialize**: Run `./setup.sh` inside the directory.
3. **Launch**: Run `docker compose up -d` (or import `docker-compose.yml` via the CasaOS *Custom App* feature).
4. **Data Persistence**: All your data is stored in the mapped `./data` folder and survives container restarts and upgrades.

---

## 💻 Local Testing on Linux (Ubuntu, Debian, ZorinOS) without Docker

```bash
# 1. Initialize environment
./setup.sh

# 2. Install dependencies
npm install

# 3. Start the application
npm start
```

---

## 💾 Backups & Data Persistence

All user accounts, notes, and uploaded pictures are consolidated inside the `data/` directory:

```text
data/
├── wiki.db          # SQLite database (notes, tags, users)
└── uploads/         # All uploaded image files
```

- **Backup**: Simply copy the `data/` directory to your backup drive, NAS, or cloud storage.
- **Restore**: Copy the `data/` directory back in place and restart the container (`docker compose restart`).

---

## ⚙️ Configuration (`.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Web server listening port | `3000` |
| `SESSION_SECRET` | 64-character random key for signing cookies | *(generated by setup.sh)* |
| `MAX_UPLOAD_SIZE_MB` | Maximum image upload size in MB | `25` |
| `NODE_ENV` | Environment mode | `production` |

---

## 📁 Project Structure

```text
├── data/                      # Persistent storage (SQLite & uploads)
├── src/
│   ├── server/               # Express backend
│   │   ├── routes/           # REST API routes (Auth, Notes, Upload)
│   │   ├── middleware/       # Authentication guards
│   │   ├── db.js             # SQLite initialization & queries
│   │   └── index.js          # Server entry point
│   └── public/               # Frontend (SPA)
│       ├── css/style.css     # Responsive design & themes
│       ├── js/app.js         # Client application logic, autosave, drag & drop
│       ├── js/markdown.js    # Standalone Markdown parser
│       ├── index.html        # Main app UI
│       ├── login.html        # Login view
│       └── setup.html        # First-run setup wizard
├── Dockerfile                # Multi-stage container build
├── docker-compose.yml        # Docker Compose configuration
├── setup.sh                  # Setup & secret generation script
└── LICENSE                   # MIT License with AI disclaimer
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
