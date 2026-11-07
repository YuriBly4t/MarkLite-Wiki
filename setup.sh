#!/usr/bin/env bash
# ==============================================================================
# MarkLite Wiki - Setup & Initialization Script
# For Linux (ZorinOS, Ubuntu, Debian) and CasaOS / Docker
# ==============================================================================

set -e

echo "=========================================================="
echo "   🚀 Initializing: MarkLite Wiki Setup"
echo "=========================================================="

# 1. Resolve directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 2. Create data directories
echo "[1/4] Creating data directories (data/ and data/uploads)..."
mkdir -p data/uploads

# 3. Generate random session secret
echo "[2/4] Generating cryptographically secure session secret..."

if command -v openssl >/dev/null 2>&1; then
    RANDOM_SECRET=$(openssl rand -hex 32)
elif command -v node >/dev/null 2>&1; then
    RANDOM_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
elif command -v python3 >/dev/null 2>&1; then
    RANDOM_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
else
    RANDOM_SECRET=$(head -c 32 /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 64)
fi

# 4. Create or update .env file
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
    echo "[3/4] An existing .env file was found."
    if grep -q "SESSION_SECRET=" "$ENV_FILE" && ! grep -q "SESSION_SECRET=hier_geheimes_secret_eintragen" "$ENV_FILE" && ! grep -q "SESSION_SECRET=change_this_secret" "$ENV_FILE"; then
        echo "      Existing SESSION_SECRET retained."
    else
        echo "      Replacing placeholder with new random secret..."
        sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${RANDOM_SECRET}/" "$ENV_FILE"
    fi
else
    echo "[3/4] Generating new .env file from template..."
    cat <<EOF > "$ENV_FILE"
# Server Configuration
PORT=3000
NODE_ENV=production

# Cryptographically generated session secret
SESSION_SECRET=${RANDOM_SECRET}

# Maximum image upload size in megabytes
MAX_UPLOAD_SIZE_MB=25
EOF
    echo "      .env created successfully with a 64-character random secret!"
fi

# 5. Permissions & finish
echo "[4/4] Setting folder permissions..."
chmod -R 755 data 2>/dev/null || true

echo "=========================================================="
echo "   ✅ Setup completed successfully!"
echo "=========================================================="
echo ""
echo "▶️  Next steps:"
echo ""
echo "Option A: Start with Docker / CasaOS (Recommended):"
echo "   docker compose up -d"
echo ""
echo "Option B: Local testing without Docker:"
echo "   npm install"
echo "   npm start"
echo ""
echo "🌐 Then open in your browser:"
echo "   http://localhost:3000"
echo "   or http://<SERVER-IP>:3000"
echo ""
echo "On your first visit, the setup wizard will open"
echo "to help you create your administrator account."
echo "=========================================================="
