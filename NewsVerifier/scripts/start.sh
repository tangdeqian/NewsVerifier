#!/usr/bin/env bash
# =============================================================================
# start.sh — Start backend + frontend together
# =============================================================================
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  FKA-Owl Full Stack Launcher"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Start backend ──
echo "[start] Starting Flask backend on port 5000 …"
(
  cd "$ROOT_DIR/FAK-Owl/code"
  conda run -n FKA_Owl python server.py &
  echo $! > /tmp/fka_owl_backend.pid
  echo "[start] Backend PID: $(cat /tmp/fka_owl_backend.pid)"
)

sleep 2

# ── Start frontend ──
echo "[start] Starting React frontend on port 3000 …"
(
  cd "$ROOT_DIR/frontend"
  if [ ! -d node_modules ]; then
    npm install
  fi
  REACT_APP_API_URL=http://localhost:5000 npm start &
  echo $! > /tmp/fka_owl_frontend.pid
)

echo ""
echo "✓ Backend:  http://localhost:5000"
echo "✓ Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both services"

# Wait for interrupt
trap "kill $(cat /tmp/fka_owl_backend.pid) $(cat /tmp/fka_owl_frontend.pid) 2>/dev/null; exit 0" INT
wait
