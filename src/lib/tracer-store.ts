/**
 * Server-side analytics computation layer.
 *
 * These functions query Firestore for session data and compute
 * the same metrics that the old localStorage-based tracer-store.ts did,
 * but reading from the cloud database instead.
 *
 * Used by the /api/tracer/* dashboard API routes.
 */

import { getDb, SESSIONS_COLLECTION, type StoredSession, type StoredEvent } from "./firebase-admin";

// ─── Types (re-exported for dashboard components) ────────────────────────────

export type TracerEventType = "route" | "impression" | "hover" | "click" | "mousemove" | "custom";

export type TracerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TracerEvent = StoredEvent;

export type TracerSession = {
  id: string;
  projectId: string;
  route: string;
  startedAt: number;
  endedAt: number;
  userLabel: string;
  userSegment: string;
  source: "sdk" | "seed";
  events: TracerEvent[];
};

export type TrackedElementDefinition = {
  id: string;
  label: string;
  route: string;
  description: string;
  rect: TracerRect;
};

export type HeatmapMetric = {
  elementId: string;
  label: string;
  description: string;
  rect: TracerRect;
  impressions: number;
  clicks: number;
  clickedPct: number;
  ignoredPct: number;
  avgHoverMs: number;
  repeatClicksAfterFirst: number;
  frustrationIndex: number;
};

export type ReplayPoint = {
  x: number;
  y: number;
  ts: number;
  type: "move" | "click";
};

export type JourneyCluster = {
  id: string;
  label: string;
  description: string;
  color: string;
  sessionCount: number;
  avgDurationMs: number;
  avgFrustrationIndex: number;
  topPath: string;
  streams: Array<{
    sessionId: string;
    color: string;
    points: ReplayPoint[];
  }>;
};

export type FunnelStepMetric = {
  elementId: string;
  label: string;
  route: string;
  sessionsReached: number;
  dropOffPct: number | null;
  avgTimeFromPreviousMs: number | null;
};

// ─── Tracked element registry ────────────────────────────────────────────────
// These are the well-known elements the demo store tracks.
// In a production version, this would be dynamically discovered from ingested data.

export const DEMO_APP_ROUTE = "/demo-store";

const TRACKED_ELEMENTS: Record<string, TrackedElementDefinition> = {
  home: {
    id: "home",
    label: "Home",
    route: DEMO_APP_ROUTE,
    description: "Landing hero entry point",
    rect: { x: 72, y: 116, width: 660, height: 232 },
  },
  product: {
    id: "product",
    label: "Product",
    route: DEMO_APP_ROUTE,
    description: "Feature comparison panel",
    rect: { x: 72, y: 402, width: 372, height: 194 },
  },
  pricing: {
    id: "pricing",
    label: "Pricing",
    route: DEMO_APP_ROUTE,
    description: "Plan and budget card",
    rect: { x: 472, y: 402, width: 284, height: 194 },
  },
  cart: {
    id: "cart",
    label: "Add to Cart",
    route: DEMO_APP_ROUTE,
    description: "Cart intent and bundling CTA",
    rect: { x: 72, y: 628, width: 396, height: 94 },
  },
  checkout: {
    id: "checkout",
    label: "Checkout",
    route: DEMO_APP_ROUTE,
    description: "Secure checkout CTA",
    rect: { x: 836, y: 190, width: 302, height: 190 },
  },
  purchase: {
    id: "purchase",
    label: "Purchase",
    route: DEMO_APP_ROUTE,
    description: "Completed conversion state",
    rect: { x: 836, y: 470, width: 302, height: 154 },
  },
};

// ─── Firestore data access ───────────────────────────────────────────────────

export async function fetchAllSessions(projectId?: string): Promise<TracerSession[]> {
  const db = getDb();
  let query: FirebaseFirestore.Query = db.collection(SESSIONS_COLLECTION);

  // Firestore requires a composite index for where() + orderBy().
  if (projectId) {
    query = query.where("projectId", "==", projectId).limit(400);
  } else {
    query = query.orderBy("startedAt", "desc").limit(200);
  }

  const snapshot = await query.get();

  const sessions = snapshot.docs.map((doc) => {
    const data = doc.data() as StoredSession;
    return {
      id: data.sessionId,
      projectId: data.projectId,
      route: data.route,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      userLabel: data.userLabel,
      userSegment: data.userSegment,
      source: data.source,
      events: data.events ?? [],
    } as TracerSession;
  });

  if (projectId) {
    sessions.sort((a, b) => b.startedAt - a.startedAt);
  }

  return sessions;
}

// ─── Public helpers ──────────────────────────────────────────────────────────

export function getTrackedElements(sessions?: TracerSession[]) {
  if (!sessions || sessions.length === 0) return Object.values(TRACKED_ELEMENTS);
  const map = new Map<string, any>();
  sessions.forEach((s) => {
    s.events.forEach((e) => {
      if (e.elementId && !map.has(e.elementId)) {
        map.set(e.elementId, {
          id: e.elementId,
          label: e.elementLabel || e.elementId,
          route: s.route,
          description: `Captured element`,
          rect: e.rect || { x: 0, y: 0, width: 0, height: 0 },
        });
      }
    });
  });
  return Array.from(map.values());
}

// ─── Analytics computations (same logic as before, now server-side) ──────────

function getClickPath(session: TracerSession) {
  const clicks = session.events.filter((e) => e.type === "click" && e.elementId);
  const path: string[] = [];
  clicks.forEach((e) => {
    if (e.elementId && path[path.length - 1] !== e.elementId) {
      path.push(e.elementId);
    }
  });
  return path;
}

function getFrustrationClicks(session: TracerSession) {
  return session.events.filter((e) => e.type === "click" && (e.repeatIndex ?? 1) > 1).length;
}

function getSessionDuration(session: TracerSession) {
  return Math.max(0, session.endedAt - session.startedAt);
}

function getSessionFrustrationIndex(session: TracerSession) {
  const frustrationClicks = getFrustrationClicks(session);
  const checkoutHoverMs = session.events
    .filter((e) => e.type === "hover" && e.elementId === "checkout")
    .reduce((sum, e) => sum + (e.hoverMs ?? 0), 0);
  return Math.min(100, Math.round(frustrationClicks * 24 + checkoutHoverMs / 400));
}

export function computeHeatmapMetrics(sessions: TracerSession[], route = DEMO_APP_ROUTE): HeatmapMetric[] {
  const filteredSessions = sessions.filter((s) => s.route === route);

  return getTrackedElements(filteredSessions)
    .map((element) => {
      const impressions = filteredSessions.flatMap((s) =>
        s.events.filter((e) => e.type === "impression" && e.elementId === element.id)
      );
      const clicks = filteredSessions.flatMap((s) =>
        s.events.filter((e) => e.type === "click" && e.elementId === element.id)
      );
      const hovers = filteredSessions.flatMap((s) =>
        s.events.filter((e) => e.type === "hover" && e.elementId === element.id)
      );

      const repeatClicksAfterFirst = clicks.filter((e) => (e.repeatIndex ?? 1) > 1).length;
      const avgHoverMs =
        hovers.length === 0
          ? 0
          : Math.round(hovers.reduce((sum, e) => sum + (e.hoverMs ?? 0), 0) / hovers.length);
      const clickedPct =
        impressions.length === 0 ? 0 : Math.min(100, Math.round((clicks.length / impressions.length) * 100));
      const ignoredPct = Math.max(0, 100 - clickedPct);
      const frustrationIndex = Math.min(
        100,
        Math.round(repeatClicksAfterFirst * 18 + avgHoverMs / 250 + Math.max(0, ignoredPct - 40) * 0.35)
      );

      return {
        elementId: element.id,
        label: element.label,
        description: element.description,
        rect: element.rect,
        impressions: impressions.length,
        clicks: clicks.length,
        clickedPct,
        ignoredPct,
        avgHoverMs,
        repeatClicksAfterFirst,
        frustrationIndex,
      } satisfies HeatmapMetric;
    })
    .sort((a, b) => b.frustrationIndex - a.frustrationIndex);
}

function buildClusterLabel(session: TracerSession) {
  const clickPath = getClickPath(session);
  const frustrationClicks = getFrustrationClicks(session);
  const duration = getSessionDuration(session);

  if (frustrationClicks >= 2 || (clickPath.includes("checkout") && !clickPath.includes("purchase"))) {
    return "checkout-friction";
  }
  if (clickPath.includes("pricing")) {
    return "pricing-detour";
  }
  if (clickPath.includes("purchase") && duration <= 120000) {
    return "fast-checkout";
  }
  return "exploration";
}

function getClusterDescriptor(clusterId: string) {
  switch (clusterId) {
    case "fast-checkout":
      return { label: "Fast Checkout", description: "Focused users who progress from home to purchase with minimal hesitation.", color: "#2DD4FF" };
    case "pricing-detour":
      return { label: "Pricing Comparison", description: "Users who pause at pricing, compare value, then continue or exit.", color: "#F59E0B" };
    case "checkout-friction":
      return { label: "Checkout Friction", description: "Sessions with repeated checkout attempts or stalled completion.", color: "#FB7185" };
    default:
      return { label: "Exploration", description: "Users browsing product surfaces without reaching the purchase path.", color: "#94A3B8" };
  }
}

function buildReplayPoints(session: TracerSession): ReplayPoint[] {
  const pointerEvents = session.events.filter(
    (e) => (e.type === "mousemove" || e.type === "click") && typeof e.x === "number" && typeof e.y === "number"
  );
  const startTs = pointerEvents[0]?.ts ?? session.startedAt;

  return pointerEvents.map((e) => ({
    x: e.x ?? 0,
    y: e.y ?? 0,
    ts: e.ts - startTs,
    type: e.type === "click" ? "click" : "move",
  }));
}

export function computeJourneyClusters(sessions: TracerSession[]): JourneyCluster[] {
  const grouped = new Map<string, TracerSession[]>();

  sessions.forEach((session) => {
    const clusterId = buildClusterLabel(session);
    const group = grouped.get(clusterId) ?? [];
    group.push(session);
    grouped.set(clusterId, group);
  });

  return Array.from(grouped.entries())
    .map(([clusterId, clusterSessions], index) => {
      const descriptor = getClusterDescriptor(clusterId);
      const durations = clusterSessions.map(getSessionDuration);
      const avgDurationMs = Math.round(durations.reduce((s, v) => s + v, 0) / clusterSessions.length);
      const avgFrustrationIndex = Math.round(
        clusterSessions.map(getSessionFrustrationIndex).reduce((s, v) => s + v, 0) / clusterSessions.length
      );
      const representativePath = getClickPath(clusterSessions[0])
        .map((step) => TRACKED_ELEMENTS[step]?.label ?? step)
        .join(" → ");
      const streamColors = ["#2DD4FF", "#7CF7C2", "#F472B6"];

      return {
        id: clusterId,
        label: descriptor.label,
        description: descriptor.description,
        color: descriptor.color,
        sessionCount: clusterSessions.length,
        avgDurationMs,
        avgFrustrationIndex,
        topPath: representativePath || "No click path recorded",
        streams: clusterSessions.slice(0, 3).map((session, si) => ({
          sessionId: session.id,
          color: streamColors[(index + si) % streamColors.length],
          points: buildReplayPoints(session),
        })),
      } satisfies JourneyCluster;
    })
    .sort((a, b) => b.sessionCount - a.sessionCount);
}

export function computeFunnelMetrics(sessions: TracerSession[], steps: string[]): FunnelStepMetric[] {
  if (steps.length === 0) return [];

  const matchedTimesByStep = steps.map(() => [] as number[]);
  const sessionsReachedByStep = steps.map(() => 0);

  sessions.forEach((session) => {
    const clickEvents = session.events.filter((e) => e.type === "click" && e.elementId);
    let searchStartIndex = 0;
    let previousTs: number | null = null;

    for (let i = 0; i < steps.length; i++) {
      const matchIndex = clickEvents.findIndex((e, ei) => ei >= searchStartIndex && e.elementId === steps[i]);
      if (matchIndex === -1) break;

      const matchedEvent = clickEvents[matchIndex];
      sessionsReachedByStep[i] += 1;

      if (i > 0 && previousTs !== null) {
        matchedTimesByStep[i].push(matchedEvent.ts - previousTs);
      }

      previousTs = matchedEvent.ts;
      searchStartIndex = matchIndex + 1;
    }
  });

  return steps.map((elementId, index) => {
    const element = TRACKED_ELEMENTS[elementId];
    const previousSessions = index === 0 ? sessionsReachedByStep[index] : sessionsReachedByStep[index - 1];
    const dropOffPct =
      index === 0 || previousSessions === 0
        ? null
        : Math.max(0, Math.round((1 - sessionsReachedByStep[index] / previousSessions) * 100));
    const avgTimeFromPreviousMs =
      matchedTimesByStep[index].length === 0
        ? null
        : Math.round(matchedTimesByStep[index].reduce((s, v) => s + v, 0) / matchedTimesByStep[index].length);

    return {
      elementId,
      label: element?.label ?? elementId,
      route: element?.route ?? DEMO_APP_ROUTE,
      sessionsReached: sessionsReachedByStep[index],
      dropOffPct,
      avgTimeFromPreviousMs,
    } satisfies FunnelStepMetric;
  });
}

export function computeDashboardOverview(sessions: TracerSession[]) {
  const clusters = computeJourneyClusters(sessions);
  return {
    totalSessions: sessions.length,
    liveSessions: sessions.filter((s) => s.source === "sdk").length,
    clusterCount: clusters.length,
    trackedElementCount: getTrackedElements(sessions).length,
  };
}
