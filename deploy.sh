#!/bin/bash
# ─── Tracer GCP Deployment Script ────────────────────────────────────────────
# Usage: ./deploy.sh <gcp-project-id>
#
# Deploys the entire Tracer analytics platform to Google Cloud:
# 1. Provisions infrastructure with Terraform (Pub/Sub, Datastore, Cloud Functions, GCS)
# 2. Builds and deploys the Next.js Dashboard + API to Cloud Run
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Ensure PATH includes homebrew and gcloud on macOS
export PATH="/opt/homebrew/bin:/opt/homebrew/share/google-cloud-sdk/bin:$PATH"

# ─── Parse Arguments ─────────────────────────────────────────────────────────

PROJECT_ID="${1:-}"
REGION="${2:-us-central1}"

if [ -z "$PROJECT_ID" ]; then
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  Tracer — GCP Deployment                                   ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Usage: ./deploy.sh <gcp-project-id> [region]"
  echo ""
  echo "  gcp-project-id   Your Google Cloud project ID (required)"
  echo "  region           GCP region (default: us-central1)"
  echo ""
  echo "Prerequisites:"
  echo "  • gcloud CLI installed and authenticated (gcloud auth login)"
  echo "  • terraform CLI installed"
  echo "  • Node.js 20+ installed"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Tracer — Deploying to Google Cloud                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Project:  $PROJECT_ID"
echo "  Region:   $REGION"
echo ""

# ─── Pre-flight Checks ──────────────────────────────────────────────────────

echo "▸ Running pre-flight checks..."

if ! command -v gcloud &>/dev/null; then
  echo "✗ gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
  exit 1
fi
echo "  ✓ gcloud CLI found"

if ! command -v terraform &>/dev/null; then
  echo "✗ terraform CLI not found. Install: https://developer.hashicorp.com/terraform/install"
  exit 1
fi
echo "  ✓ terraform CLI found"

if ! command -v node &>/dev/null; then
  echo "✗ Node.js not found. Install Node.js 20+."
  exit 1
fi
echo "  ✓ Node.js $(node --version) found"

# Verify gcloud authentication
if ! gcloud auth print-access-token --project="$PROJECT_ID" &>/dev/null; then
  echo "✗ gcloud not authenticated. Run: gcloud auth login"
  exit 1
fi
echo "  ✓ gcloud authenticated"

# Set the active project
gcloud config set project "$PROJECT_ID" --quiet
echo "  ✓ Active project set to $PROJECT_ID"
echo ""

# ─── Step 1: Build the tracer-sdk ────────────────────────────────────────────

echo "▸ Step 1/3: Building tracer-sdk..."
cd tracer-sdk
npm install --ignore-scripts 2>/dev/null || true
npx tsup src/index.ts --format esm,cjs --dts --clean
cd ..
echo "  ✓ tracer-sdk built successfully"

echo "▸ Building delight-cart-ui storefront..."
cd delight-cart-ui
npm install --ignore-scripts 2>/dev/null || true
# Inject env vars directly into the build command
VITE_TRACER_PROJECT_ID=tracer-demo VITE_TRACER_API_KEY=tk_dev_local VITE_TRACER_ENDPOINT=/api/ingest npm run build
# Copy output to the Next.js public directory
rm -rf ../public/assets ../public/index.html
cp -r dist/* ../public/
cd ..
echo "  ✓ delight-cart-ui built successfully"
echo ""

# ─── Step 2: Provision Infrastructure with Terraform ────────────────────────

echo "▸ Step 2/3: Provisioning GCP infrastructure with Terraform..."
cd terraform
terraform init -input=false
terraform apply \
  -var="project_id=$PROJECT_ID" \
  -var="region=$REGION" \
  -auto-approve \
  -input=false
cd ..
echo "  ✓ Infrastructure provisioned"
echo ""

# ─── Step 3: Deploy Dashboard to Cloud Run ──────────────────────────────────

echo "▸ Step 3/3: Building and deploying Tracer Dashboard to Cloud Run..."
gcloud run deploy tracer-dashboard \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --port 8080 \
  --update-env-vars \
"PUBSUB_TOPIC_NAME=tracer-events,\
TRACER_API_KEY=tk_dev_local,\
TRACER_DEMO_PASSWORD=tracer-demo,\
NEXT_PUBLIC_PROJECT_ID=tracer-demo,\
NEXT_PUBLIC_TRACER_API_KEY=tk_dev_local,\
NEXT_PUBLIC_TRACER_API_KEY_DISPLAY=tk_dev_local,\
GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID" \
  --set-build-env-vars \
"NEXT_PUBLIC_PROJECT_ID=tracer-demo,\
NEXT_PUBLIC_TRACER_API_KEY=tk_dev_local,\
NEXT_PUBLIC_TRACER_API_KEY_DISPLAY=tk_dev_local"

echo ""

# ─── Deployment Summary ─────────────────────────────────────────────────────

DASHBOARD_URL=$(gcloud run services describe tracer-dashboard \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format 'value(status.url)' 2>/dev/null || echo "")

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✓ Deployment Complete!                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Dashboard URL:     ${DASHBOARD_URL:-<pending>}"
echo "  Ingestion API:     ${DASHBOARD_URL:-<pending>}/api/ingest"
echo "  Demo Store:        ${DASHBOARD_URL:-<pending>}/demo-store"
echo "  Dashboard Login:   ${DASHBOARD_URL:-<pending>}/tracer"
echo ""
echo "  Dashboard password: tracer-demo"
echo ""
echo "  ─── SDK Integration ───────────────────────────────────────"
echo ""
echo "  import tracer from 'tracer-sdk';"
echo ""
echo "  tracer.init({"
echo "    projectId: 'tracer-demo',"
echo "    apiKey: 'tk_dev_local',"
echo "    endpoint: '${DASHBOARD_URL:-<url>}/api/ingest'"
echo "  });"
echo ""
echo "  Then visit /tracer on your app to see the dashboard."
echo ""
