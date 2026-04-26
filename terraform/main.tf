terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# ─── Variables ─────────────────────────────────────────────────────────────────

variable "project_id" {
  type        = string
  description = "The Google Cloud Project ID"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "The GCP region to deploy resources to"
}

variable "tracer_api_key" {
  type        = string
  default     = "tk_dev_local"
  sensitive   = true
  description = "API key the SDK uses to authenticate with the ingestion endpoint"
}

# ─── Provider ──────────────────────────────────────────────────────────────────

provider "google" {
  project = var.project_id
  region  = var.region
}

# ─── 1. Enable Required APIs ──────────────────────────────────────────────────

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "pubsub.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "storage.googleapis.com",
    "eventarc.googleapis.com",
    "datastore.googleapis.com",
    "firestore.googleapis.com",
    "artifactregistry.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# ─── 2. Firestore in Datastore Mode ───────────────────────────────────────────
# Datastore requires either an App Engine app or a Firestore database in
# DATASTORE_MODE. We use google_firestore_database with type DATASTORE_MODE.
# NOTE: If your project already has a Firestore or Datastore database, you may
# need to import it: terraform import google_firestore_database.tracer_db "(default)"

resource "google_firestore_database" "tracer_db" {
  name                        = "(default)"
  location_id                 = var.region
  type                        = "DATASTORE_MODE"
  delete_protection_state     = "DELETE_PROTECTION_DISABLED"
  deletion_policy             = "DELETE"
  depends_on                  = [google_project_service.apis]

  lifecycle {
    ignore_changes = [
      location_id,
      type,
    ]
  }
}

# ─── 3. Pub/Sub Topic for Events ──────────────────────────────────────────────

resource "google_pubsub_topic" "tracer_events" {
  name       = "tracer-events"
  depends_on = [google_project_service.apis]
}

# ─── 4. Cloud Storage Bucket for DOM Snapshots ────────────────────────────────

resource "google_storage_bucket" "snapshots_bucket" {
  name          = "${var.project_id}-tracer-snapshots"
  location      = var.region
  force_destroy = true
  depends_on    = [google_project_service.apis]

  uniform_bucket_level_access = true
}

# ─── 5. Cloud Storage Bucket for Function Source ──────────────────────────────

resource "google_storage_bucket" "function_source" {
  name          = "${var.project_id}-gcp-worker-source"
  location      = var.region
  force_destroy = true
  depends_on    = [google_project_service.apis]

  uniform_bucket_level_access = true
}

# Archive for the Cloud Function source
data "archive_file" "gcp_worker_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../gcp-worker"
  output_path = "${path.module}/../gcp-worker.zip"
}

resource "google_storage_bucket_object" "worker_zip_object" {
  name   = "source-${data.archive_file.gcp_worker_zip.output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.gcp_worker_zip.output_path
}

# ─── 6. Cloud Function v2 (Event-driven Pub/Sub Worker) ──────────────────────

resource "google_cloudfunctions2_function" "gcp_worker" {
  name        = "tracer-worker"
  location    = var.region
  description = "Processes Tracer events from PubSub into Datastore and GCS"

  build_config {
    runtime     = "nodejs20"
    entry_point = "processTracerEvents"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.worker_zip_object.name
      }
    }
  }

  service_config {
    max_instance_count = 100
    available_memory   = "256M"
    timeout_seconds    = 60
    environment_variables = {
      SNAPSHOTS_BUCKET = google_storage_bucket.snapshots_bucket.name
    }
  }

  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic   = google_pubsub_topic.tracer_events.id
    retry_policy   = "RETRY_POLICY_DO_NOT_RETRY"
  }

  depends_on = [google_project_service.apis]
}

# ─── 7. Cloud Run Service (Dashboard & API) ──────────────────────────────────

resource "google_cloud_run_v2_service" "tracer_dashboard" {
  name     = "tracer-dashboard"
  location = var.region

  template {
    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello" # Placeholder — real image deployed by gcloud
      env {
        name  = "PUBSUB_TOPIC_NAME"
        value = "tracer-events"
      }
      env {
        name  = "TRACER_API_KEY"
        value = var.tracer_api_key
      }
      env {
        name  = "TRACER_DEMO_PASSWORD"
        value = "tracer-demo"
      }
      env {
        name  = "NEXT_PUBLIC_PROJECT_ID"
        value = "tracer-demo"
      }
      env {
        name  = "NEXT_PUBLIC_TRACER_API_KEY"
        value = var.tracer_api_key
      }
      env {
        name  = "NEXT_PUBLIC_TRACER_API_KEY_DISPLAY"
        value = "tk_dev_local"
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT_ID"
        value = var.project_id
      }
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }
  }

  depends_on = [google_project_service.apis]

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
    ]
  }
}

# ─── 8. Public Access IAM for Cloud Run ──────────────────────────────────────

resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = var.project_id
  location = google_cloud_run_v2_service.tracer_dashboard.location
  name     = google_cloud_run_v2_service.tracer_dashboard.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ─── Outputs ─────────────────────────────────────────────────────────────────

output "dashboard_url" {
  value       = google_cloud_run_v2_service.tracer_dashboard.uri
  description = "The public URL of the Tracer Dashboard on Cloud Run"
}

output "pubsub_topic" {
  value       = google_pubsub_topic.tracer_events.id
  description = "Full name of the Pub/Sub topic for event ingestion"
}

output "snapshots_bucket" {
  value       = google_storage_bucket.snapshots_bucket.name
  description = "GCS bucket for event snapshot blobs"
}

output "worker_function" {
  value       = google_cloudfunctions2_function.gcp_worker.name
  description = "Name of the Cloud Function processing events"
}
