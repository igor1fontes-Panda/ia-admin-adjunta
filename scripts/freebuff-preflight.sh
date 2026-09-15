#!/bin/sh
# freebuff-preflight — durable replacement for the platform CLIs' most
# critical functions: verifying the project is deployable BEFORE spending a
# build, and verifying the live site AFTER deploying.
#
# Works in every shell mode:  sh scripts/freebuff-preflight.sh
# The platform CLIs (freebuff-deploy/preview) are injected by the Freebuff
# runtime and can vanish between sessions; this script never depends on them.
#
# Usage:
#   sh scripts/freebuff-preflight.sh              # pre-deploy checks
#   sh scripts/freebuff-preflight.sh --live       # also verify production site
#   PROD_URL=https://iaadminadjuntafreebuffapp.freebuff.app sh scripts/freebuff-preflight.sh --live

set -e
. ./scripts/workspace-env.sh 2>/dev/null || true

PROD_URL="${PROD_URL:-https://iaadminadjuntafreebuffapp.freebuff.app}"
fail=0

step() { printf '\n== %s ==\n' "$1"; }
ok() { printf '  OK  %s\n' "$1"; }
bad() { printf '  FAIL %s\n' "$1"; fail=1; }

step "Toolchain"
command -v node >/dev/null && ok "node $(node --version)" || bad "node missing"
command -v npm >/dev/null && ok "npm $(npm --version)" || bad "npm missing"
command -v python3 >/dev/null && ok "python3 $(python3 --version 2>&1)" || bad "python3 missing"

step "Lockfile sync (npm ci --include=dev will succeed)"
npm ls --package-lock-only >/dev/null 2>&1 && ok "package-lock.json in sync with package.json" || bad "lockfile out of sync — run npm install"

step "Build-time deps present in dependencies/ (hosting skips devDeps)"
for pkg in vite @vitejs/plugin-react tailwindcss postcss autoprefixer; do
  node -e "require('./package.json').dependencies['$pkg'] || process.exit(1)" 2>/dev/null &&
    ok "$pkg in dependencies" || bad "$pkg must be in dependencies"
done

step "Typecheck"
npm run -s typecheck >/dev/null 2>&1 && ok "tsc --noEmit clean" || bad "typecheck errors"

step "Unit tests"
npm run -s test >/dev/null 2>&1 && ok "all tests pass" || bad "tests failing"

step "Production build (exact hosting command)"
node node_modules/vite/bin/vite.js build >/dev/null 2>&1 && ok "vite build succeeded" || bad "build failed"
[ -f dist/index.html ] && ok "dist/index.html exists" || bad "no dist output"

step "Public DB config baked into bundle (static hosting cannot inline env)"
grep -q "supabase.co" dist/assets/*.js 2>/dev/null &&
  ok "Supabase URL present in bundle" || bad "DB config missing from bundle — app would show setup checklist"

step "Autonomous bots runnable"
node --check scripts/bot-lib.mjs 2>/dev/null && ok "bot-lib.mjs syntax" || bad "bot-lib.mjs broken"
node --check scripts/lead-hunter.mjs 2>/dev/null && ok "lead-hunter.mjs syntax" || bad "lead-hunter.mjs broken"
node --check scripts/error-handler.mjs 2>/dev/null && ok "error-handler.mjs syntax" || bad "error-handler.mjs broken"
python3 -m py_compile ai_engine.py scripts/hume_voice.py 2>/dev/null && ok "python bots compile" || bad "python bots broken"

if [ "$1" = "--live" ]; then
  step "Production site ($PROD_URL)"
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$PROD_URL/") || code=000
  [ "$code" = "200" ] && ok "site returns HTTP 200" || bad "site returned HTTP $code"
  asset=$(curl -s --max-time 20 "$PROD_URL/" | grep -o '/assets/index-[^"]*\.js' | head -1 || true)
  if [ -n "$asset" ]; then
    ok "bundle asset: $asset"
    curl -s --max-time 30 "$PROD_URL$asset" | grep -q "supabase.co" &&
      ok "live bundle contains DB config" || bad "live bundle missing DB config — redeploy needed"
  else
    bad "no bundle asset referenced in production HTML"
  fi
fi

printf '\n'
if [ "$fail" -eq 0 ]; then
  echo "PREFLIGHT PASSED — safe to deploy."
else
  echo "PREFLIGHT FAILED — fix the items above before deploying."
  exit 1
fi
