#!/usr/bin/env bash
# Update the live AWS deployment (server image -> ECS, client -> S3 + CloudFront).
# Usage: ./update.sh [all|server|client] [--no-pull] [--yes] [--dry-run]
# Run from WSL/Linux/macOS (not from Windows PowerShell). Every setting below can be overridden via the environment.
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT="${ACCOUNT:-382598155084}"
ECR_REPO="${ECR_REPO:-wv-hub}"
CLUSTER="${CLUSTER:-WvServer-ClusterEB0386A7-TQg39VGWbOpz}"
SERVICE="${SERVICE:-WvServer-ServiceD69D759B-WEmAXyRKbJQG}"
BUCKET="${BUCKET:-wvclient-clientbucketb0ec996f-8o40hk1hrtup}"
DISTRIBUTION_ID="${DISTRIBUTION_ID:-E1K8QJZGMQ8H9M}"
DOMAIN="${DOMAIN:-seanwylie.ca}"
CLIENT_SUBDOMAIN="${CLIENT_SUBDOMAIN:-play}"
SERVER_SUBDOMAIN="${SERVER_SUBDOMAIN:-game}"
SERVER_HOST="${SERVER_HOST:-${SERVER_SUBDOMAIN}.${DOMAIN}}"
CLIENT_HOST="${CLIENT_HOST:-${CLIENT_SUBDOMAIN}.${DOMAIN}}"
WV_SERVER_URL="${WV_SERVER_URL:-wss://${SERVER_HOST}}"
WV_STORY_URL="${WV_STORY_URL:-https://w4sz7b3ppxcb2gixj56sugn57i0pjxru.lambda-url.us-east-1.on.aws/}"
ARCH="${ARCH:-amd64}"   # amd64 matches CDK -c arch=x86; use arm64 for the default CDK arch
ECR_REGISTRY="${ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ECR_URI="${ECR_REGISTRY}/${ECR_REPO}"
export AWS_REGION AWS_DEFAULT_REGION="$AWS_REGION"

TARGET=all; PULL=1; YES=0; DRY=0
for a in "$@"; do
  case "$a" in
    all|server|client) TARGET="$a" ;;
    --no-pull) PULL=0 ;;
    --yes|-y) YES=1 ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n 2,4p "$0"; exit 0 ;;
    *) echo "Unknown argument: $a (usage: ./update.sh [all|server|client] [--no-pull] [--yes] [--dry-run])" >&2; exit 2 ;;
  esac
done

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
# run: print the command in dry-run mode, otherwise execute it
run() { if [ "$DRY" = 1 ]; then printf '[dry-run]'; printf ' %q' "$@"; printf '\n'; else "$@"; fi; }

cd "$(dirname "$0")"
[ "$DRY" = 1 ] && say "DRY RUN: commands are printed, nothing is executed"

# --- 1. preflight ---
say "Checking tools"
need=(git npm node); [ "$TARGET" != client ] && need+=(docker); need+=(aws); [ "$TARGET" != server ] && need+=(curl)
for t in "${need[@]}"; do
  if ! command -v "$t" >/dev/null 2>&1; then
    if [ "$DRY" = 1 ]; then echo "warning: '$t' not found (would fail in a real run)"; else die "'$t' is required but not installed"; fi
  fi
done
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) die "Run this from WSL/Linux/macOS, not Git Bash/Windows." ;; esac

if [ "$DRY" = 1 ]; then
  echo "[dry-run] aws sts get-caller-identity --query Account --output text  (expect $ACCOUNT)"
else
  got="$(aws sts get-caller-identity --query Account --output text)" || die "aws sts get-caller-identity failed: check your AWS login/profile"
  [ "$got" = "$ACCOUNT" ] || die "AWS account is $got but this deployment is in $ACCOUNT. Check AWS_PROFILE."
fi

if [ -n "$(git status --porcelain)" ]; then
  die "Working tree has uncommitted changes. Commit or stash them first (git status), then re-run."
fi
if [ "$PULL" = 1 ]; then say "git pull --ff-only"; run git pull --ff-only; else echo "Skipping git pull (--no-pull)"; fi
SHA="$(git rev-parse --short HEAD)"
echo "Deploying git $SHA (target: $TARGET, image arch: linux/$ARCH)"

if [ "$YES" != 1 ] && [ "$DRY" != 1 ]; then
  [ "$TARGET" != client ] && echo "WARNING: the server redeploy restarts the hub; active parties and dungeon runs will be dropped."
  read -r -p "Continue? [y/N] " ans; case "$ans" in y|Y|yes) ;; *) echo "Aborted."; exit 1 ;; esac
elif [ "$TARGET" != client ]; then echo "WARNING: the server redeploy restarts the hub; active parties will drop."; fi

# --- 2. server ---
deploy_server() {
  say "Server: build + push ${ECR_URI}:latest and :${SHA}"
  if [ "$DRY" = 1 ]; then echo "[dry-run] aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY"
  else aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"; fi
  run docker buildx build --platform "linux/${ARCH}" -f server/Dockerfile -t "${ECR_URI}:latest" -t "${ECR_URI}:${SHA}" --push .
  say "Server: force new ECS deployment (waits until stable)"
  if [ "$DRY" = 1 ]; then echo "[dry-run] aws ecs update-service --cluster $CLUSTER --service $SERVICE --force-new-deployment >/dev/null"
  else aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment >/dev/null; fi
  run aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE"
}

# --- 3. client ---
deploy_client() {
  say "Client: dependencies"
  # A node_modules installed from Windows has win32 native binaries (esbuild/rollup) that fail on Linux.
  if [ -d node_modules/@esbuild ] && ! ls node_modules/@esbuild 2>/dev/null | grep -q "^linux-" ; then
    echo "node_modules was installed on another OS (no @esbuild/linux-* package). Removing it and reinstalling for $(uname -s)."
    run rm -rf node_modules
  fi
  if [ -f package-lock.json ]; then run npm ci; else run npm install; fi
  say "Client: build"
  if [ "$DRY" = 1 ]; then echo "[dry-run] VITE_WV_SERVER=$WV_SERVER_URL VITE_WV_STORY_URL=$WV_STORY_URL npm run build"
  else VITE_WV_SERVER="$WV_SERVER_URL" VITE_WV_STORY_URL="$WV_STORY_URL" npm run build; fi
  say "Client: upload to s3://$BUCKET"
  # Same cache rules as infra/ci/deploy.yml.template
  run aws s3 sync dist/assets "s3://${BUCKET}/assets" --cache-control "public,max-age=31536000,immutable"
  run aws s3 sync dist "s3://${BUCKET}" --exclude "assets/*" --exclude "index.html" --exclude "sw.js" --exclude "version.json" --exclude "*.webmanifest" --cache-control "public,max-age=3600"
  run aws s3 cp dist/index.html "s3://${BUCKET}/index.html" --cache-control "no-cache"
  run aws s3 cp dist/sw.js "s3://${BUCKET}/sw.js" --cache-control "no-cache" --content-type "text/javascript"
  run aws s3 cp dist/version.json "s3://${BUCKET}/version.json" --cache-control "no-cache, no-store, must-revalidate" --content-type "application/json"
  run aws s3 cp dist/manifest.webmanifest "s3://${BUCKET}/manifest.webmanifest" --cache-control "no-cache" --content-type "application/manifest+json"
  say "Client: CloudFront invalidation"
  if [ "$DRY" = 1 ]; then echo "[dry-run] aws cloudfront create-invalidation ... && aws cloudfront wait invalidation-completed"
  else INV_ID="$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" --query "Invalidation.Id" --output text)"; echo "invalidation $INV_ID started; waiting for it to complete (up to ~2 min)"
    aws cloudfront wait invalidation-completed --distribution-id "$DISTRIBUTION_ID" --id "$INV_ID" && echo "invalidation $INV_ID completed" || echo "WARNING: invalidation $INV_ID not confirmed complete yet"; fi
  BUILD_ID_LOCAL="$(node -e "console.log(require('./dist/version.json').id)" 2>/dev/null || echo '?')"
}

case "$TARGET" in
  server) deploy_server ;;
  client) deploy_client ;;
  all) deploy_server; deploy_client ;;
esac

# --- 4. verify ---
say "Health checks"
check() { # url label
  if [ "$DRY" = 1 ]; then echo "[dry-run] curl -fsS --max-time 15 $1"; return 0; fi
  if curl -fsS --max-time 15 -o /dev/null "$1"; then echo "OK    $2 ($1)"; else echo "FAIL  $2 ($1)"; FAILED=1; fi
}
FAILED=0
[ "$TARGET" != client ] && check "https://${SERVER_HOST}/healthz" "server"
[ "$TARGET" != server ] && check "https://${CLIENT_HOST}/" "client"
if [ "$TARGET" != server ] && [ "$DRY" != 1 ]; then
  LIVE_ID="$(curl -fsS --max-time 15 -H 'Cache-Control: no-cache' "https://${CLIENT_HOST}/version.json?t=$(date +%s)" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id)}catch{console.log('?')}})" || echo '?')"
  if [ "$LIVE_ID" = "${BUILD_ID_LOCAL:-?}" ]; then echo "OK    deployed build id $LIVE_ID is live"; else echo "WARN  live build id is '$LIVE_ID' but just built '${BUILD_ID_LOCAL:-?}' (CDN may still be propagating)"; FAILED=1; fi
fi

say "Summary"
echo "git:     $SHA"
[ "$TARGET" != client ] && echo "server:  ${ECR_URI}:${SHA} (linux/$ARCH) -> ${SERVICE}"
[ "$TARGET" != server ] && echo "client:  https://${CLIENT_HOST}/ build ${BUILD_ID_LOCAL:-?} (CloudFront invalidation /* started; may take a minute)"
[ "$DRY" = 1 ] && echo "(dry run: nothing was changed)"
[ "$FAILED" = 0 ] || { echo "Some health checks failed: the new ECS task may still be starting, or the invalidation is pending. Re-check shortly."; exit 1; }
