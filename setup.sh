#!/usr/bin/env bash
# ==============================================================================
# WikiAlternative - Setup & Initialisierungs-Skript
# Für ZorinOS (Lokaler Test) und CasaOS / Debian VM
# ==============================================================================

set -e

echo "=========================================================="
echo "   🚀 Initialisierung: WikiAlternative Setup"
echo "=========================================================="

# 1. Verzeichnis prüfen
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 2. Datenverzeichnisse anlegen
echo "[1/4] Erstelle Datenordner (data/ und data/uploads)..."
mkdir -p data/uploads

# 3. Zufälliges Session-Secret generieren
echo "[2/4] Generiere kryptografisch sicheres Session-Secret..."

if command -v openssl >/dev/null 2>&1; then
    RANDOM_SECRET=$(openssl rand -hex 32)
elif command -v node >/dev/null 2>&1; then
    RANDOM_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
elif command -v python3 >/dev/null 2>&1; then
    RANDOM_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
else
    # Fallback mit urandom
    RANDOM_SECRET=$(head -c 32 /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
fi

# 4. .env Datei erstellen oder aktualisieren
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
    echo "[3/4] Eine .env Datei existiert bereits."
    # Prüfen ob SESSION_SECRET schon gesetzt ist
    if grep -q "SESSION_SECRET=" "$ENV_FILE" && ! grep -q "SESSION_SECRET=hier_geheimes_secret_eintragen" "$ENV_FILE"; then
        echo "      Bestehendes SESSION_SECRET wird beibehalten."
    else
        echo "      Ersetze Platzhalter durch neues Zufalls-Secret..."
        sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${RANDOM_SECRET}/" "$ENV_FILE"
    fi
else
    echo "[3/4] Erstelle neue .env Datei aus Vorlage..."
    cat <<EOF > "$ENV_FILE"
# Server Konfiguration
PORT=3000
NODE_ENV=production

# Kryptografisch generiertes Sitzungs-Geheimnis
SESSION_SECRET=${RANDOM_SECRET}

# Maximale Bild-Uploadgröße in Megabyte
MAX_UPLOAD_SIZE_MB=25
EOF
    echo "      .env erfolgreich mit zufälligem 64-Zeichen-Secret generiert!"
fi

# 5. Abschluss & Start-Hinweise
echo "[4/4] Berechtigungen setzen..."
chmod -R 755 data 2>/dev/null || true

echo "=========================================================="
echo "   ✅ Setup erfolgreich vorbereitet!"
echo "=========================================================="
echo ""
echo "▶️  Nächste Schritte:"
echo ""
echo "Option A: Starten mit Docker / CasaOS (Empfohlen):"
echo "   docker compose up -d"
echo ""
echo "Option B: Lokaler Test auf ZorinOS ohne Docker:"
echo "   npm install"
echo "   npm start"
echo ""
echo "🌐 Danach im Browser aufrufen:"
echo "   http://localhost:3000 (auf ZorinOS)"
echo "   oder http://<DEBIAN-VM-IP>:3000 (im CasaOS-Netzwerk)"
echo ""
echo "Beim ersten Aufruf erscheint automatisch der Setup-Dialog"
echo "zur Erstellung deines Administrator-Accounts."
echo "=========================================================="

