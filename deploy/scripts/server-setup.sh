#!/bin/bash
# ==============================================================================
# Echo Server Initial Setup
# Run this ONCE after creating your Tencent Cloud Lighthouse instance.
#
# Usage:
#   chmod +x server-setup.sh
#   ./server-setup.sh
#
# This script will:
#   1. Update system packages
#   2. Install Docker Compose (Docker CE is pre-installed on the Lighthouse image)
#   3. Install Git (if not already)
#   4. Configure firewall (UFW)
#   5. Create app directory structure
# ==============================================================================

set -e

echo "============================================"
echo " Echo Server Initial Setup"
echo "============================================"

# ---- Check if running as root ----
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./server-setup.sh)"
  exit 1
fi

# ---- 1. Update system ----
echo ""
echo "[1/5] Updating system packages..."
apt-get update -y && apt-get upgrade -y

# ---- 2. Install Docker Compose ----
echo ""
echo "[2/5] Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
  # Docker Compose v2 (plugin)
  apt-get install -y docker-compose-plugin
  echo "Docker Compose plugin installed."
else
  echo "Docker Compose already installed: $(docker-compose --version)"
fi

# Verify Docker is running
if ! systemctl is-active --quiet docker; then
  echo "Starting Docker..."
  systemctl start docker
  systemctl enable docker
fi
echo "Docker: $(docker --version)"
echo "Docker Compose: $(docker compose version 2>/dev/null || docker-compose --version)"

# ---- 3. Install Git ----
echo ""
echo "[3/5] Installing Git..."
if ! command -v git &> /dev/null; then
  apt-get install -y git
fi
echo "Git: $(git --version)"

# ---- 4. Configure firewall ----
echo ""
echo "[4/5] Configuring firewall (UFW)..."
ufw default deny incoming
ufw default allow outgoing

# SSH
ufw allow 22/tcp

# HTTP / HTTPS (for Echo)
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall (non-interactive)
ufw --force enable
ufw status verbose

# ---- 5. Create app directory ----
echo ""
echo "[5/5] Creating app directory..."
mkdir -p /opt/echo

# ---- Done ----
echo ""
echo "============================================"
echo " Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Clone your repository:"
echo "     cd /opt && git clone <your-repo-url> echo"
echo ""
echo "  2. Copy .env.production from the template:"
echo "     cp deploy/.env.production.example deploy/.env.production"
echo "     nano deploy/.env.production    # Edit secrets"
echo ""
echo "  3. Deploy:"
echo "     cd /opt/echo && docker compose -f deploy/docker-compose.prod.yml up -d"
echo ""
