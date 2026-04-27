import { Datastore } from "@google-cloud/datastore";
import { PubSub } from "@google-cloud/pubsub";
import { Storage } from "@google-cloud/storage";

// Lazy load clients
let datastore: Datastore | null = null;
let pubsub: PubSub | null = null;
let storage: Storage | null = null;

const getProjectId = () =>
  process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCP_PROJECT;

export function getDatastore() {
  if (!datastore) {
    datastore = new Datastore({ projectId: getProjectId() });
  }
  return datastore;
}

export function getPubSub() {
  if (!pubsub) {
    pubsub = new PubSub({ projectId: getProjectId() });
  }
  return pubsub;
}

export function getStorage() {
  if (!storage) {
    storage = new Storage({ projectId: getProjectId() });
  }
  return storage;
}

// ─── Shared Types ──────────────────────────────────────────────────────────

export interface StoredSession {
  projectId: string;
  sessionId: string;
  route: string;
  startedAt: number;
  endedAt: number;
  userLabel: string;
  userSegment: string;
  source: "sdk" | "seed";
  events: StoredEvent[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredEvent {
  id: string;
  type: "route" | "impression" | "hover" | "click" | "mousemove" | "scroll" | "custom";
  ts: number;
  route: string;
  elementId?: string;
  elementLabel?: string;
  rect?: { x: number; y: number; width: number; height: number };
  x?: number;
  y?: number;
  hoverMs?: number;
  repeatIndex?: number;
  name?: string;
  payload?: Record<string, string | number | boolean>;
}
