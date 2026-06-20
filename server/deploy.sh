#!/usr/bin/env bash
# Build and deploy the FlowState push server WITHOUT touching user data.
#
# Durability guarantee: every user's events, reminders, and push subscriptions live in
# bbolt at $REMOTE_DIR/data/flowstate.db. This script ONLY swaps the binary and restarts
# the service — it never deletes, moves, or overwrites the data directory. Updating the
# server therefore cannot lose anyone's scheduled times.
#
# Usage:
#   # with an ssh key already authorized on the VPS:
#   ./deploy.sh
#   # or with password auth (sshpass), pointing at a file holding the root password:
#   VPS_PASS_FILE=/path/to/pwfile ./deploy.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
HOST="${VPS_HOST:-69.164.244.64}"
SSH_USER="${VPS_USER:-root}"
REMOTE_DIR="/opt/flowstate"

SSH=(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
SCP=(scp -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
if [ -n "${VPS_PASS_FILE:-}" ]; then
  SSH=(sshpass -f "$VPS_PASS_FILE" "${SSH[@]}")
  SCP=(sshpass -f "$VPS_PASS_FILE" "${SCP[@]}")
fi

echo "» building static linux/amd64 binary…"
( cd "$HERE" && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o /tmp/flowstate-server-linux-amd64 . )

echo "» uploading new binary…"
"${SCP[@]}" /tmp/flowstate-server-linux-amd64 "$SSH_USER@$HOST:$REMOTE_DIR/flowstate-server.new"

echo "» swapping binary + restarting (data dir is left untouched)…"
"${SSH[@]}" "$SSH_USER@$HOST" bash -s <<'REMOTE'
set -e
systemctl stop flowstate
mv /opt/flowstate/flowstate-server.new /opt/flowstate/flowstate-server
chown flowstate:flowstate /opt/flowstate/flowstate-server
chmod 755 /opt/flowstate/flowstate-server
systemctl start flowstate
sleep 1
echo -n "service: "; systemctl is-active flowstate
curl -sf http://127.0.0.1:8091/api/health >/dev/null && echo "health: ok"
REMOTE

echo "» done — users' scheduled times preserved."
