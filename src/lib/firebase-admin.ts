import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK initialization for server-side Firestore access.
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID     — Your GCP project ID
 *   FIREBASE_SERVICE_ACCOUNT — Base64-encoded service account JSON key
 *
 * In development, you can also set FIRESTORE_EMULATOR_HOST to use the emulator.
 */

let cachedApp: App | null = null;
let cachedDb: Firestore | null = null;

function getApp(): App {
  if (cachedApp) return cachedApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    cachedApp = existingApps[0];
    return cachedApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!projectId) {
    throw new Error(
      "Missing FIREBASE_PROJECT_ID environment variable. " +
        "Set it in .env.local or your hosting provider's env config."
    );
  }

  if (encodedServiceAccount) {
    // Production: use service account key
    const serviceAccount = JSON.parse(
      Buffer.from(encodedServiceAccount, "base64").toString("utf-8")
    );
    cachedApp = initializeApp({
      credential: cert(serviceAccount),
      projectId,
    });
  } else {
    // Development: use default credentials or emulator
    cachedApp = initializeApp({ projectId });
  }

  return cachedApp;
}

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getApp());
  return cachedDb;
}

// ─── Collection helpers ──────────────────────────────────────────────────────

export const SESSIONS_COLLECTION = "tracer_sessions";

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
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface StoredEvent {
  id: string;
  type: "route" | "impression" | "hover" | "click" | "mousemove" | "custom";
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
