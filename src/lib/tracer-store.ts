export type TracerEventType = "route" | "impression" | "hover" | "click" | "mousemove" | "custom";

export type TracerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TracerEvent = {
  id: string;
  type: TracerEventType;
  ts: number;
  route: string;
  elementId?: string;
  elementLabel?: string;
  rect?: TracerRect;
  x?: number;
  y?: number;
  hoverMs?: number;
  repeatIndex?: number;
  name?: string;
};

export type TracerSession = {
  id: string;
  projectId: string;
  route: string;
  startedAt: number;
  endedAt: number;
  userLabel: string;
  userSegment: string;
  source: "seed" | "live";
  events: TracerEvent[];
};

export type TracerStoreData = {
  version: number;
  projectId: string;
  seededAt: number | null;
  sessions: TracerSession[];
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

export const TRACER_STORAGE_KEY = "tracer-demo-store-v2";
export const TRACER_DATA_EVENT = "tracer:data-updated";
export const TRACER_SESSION_KEY = "tracer-demo-live-session-id";
export const DEMO_APP_ROUTE = "/demo-store";
const STORE_VERSION = 2;
const VIEWPORT = { width: 1200, height: 860 };

const TRACKED_ELEMENTS: Record<string, TrackedElementDefinition> = {
  home: {
    id: "home",
    label: "Home",
    route: DEMO_APP_ROUTE,
    description: "Landing hero entry point",
    rect: { x: 72, y: 116, width: 660, height: 232 }
  },
  product: {
    id: "product",
    label: "Product",
    route: DEMO_APP_ROUTE,
    description: "Feature comparison panel",
    rect: { x: 72, y: 402, width: 372, height: 194 }
  },
  pricing: {
    id: "pricing",
    label: "Pricing",
    route: DEMO_APP_ROUTE,
    description: "Plan and budget card",
    rect: { x: 472, y: 402, width: 284, height: 194 }
  },
  cart: {
    id: "cart",
    label: "Add to Cart",
    route: DEMO_APP_ROUTE,
    description: "Cart intent and bundling CTA",
    rect: { x: 72, y: 628, width: 396, height: 94 }
  },
  checkout: {
    id: "checkout",
    label: "Checkout",
    route: DEMO_APP_ROUTE,
    description: "Secure checkout CTA",
    rect: { x: 836, y: 190, width: 302, height: 190 }
  },
  purchase: {
    id: "purchase",
    label: "Purchase",
    route: DEMO_APP_ROUTE,
    description: "Completed conversion state",
    rect: { x: 836, y: 470, width: 302, height: 154 }
  }
};

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function getBrowserWindow() {
  return typeof window === "undefined" ? null : window;
}

function getDefaultStore(): TracerStoreData {
  return {
    version: STORE_VERSION,
    projectId: "tracer-demo",
    seededAt: null,
    sessions: []
  };
}

function writeTracerStore(store: TracerStoreData) {
  const browserWindow = getBrowserWindow();

  if (!browserWindow) {
    return;
  }

  browserWindow.localStorage.setItem(TRACER_STORAGE_KEY, JSON.stringify(store));
  browserWindow.dispatchEvent(new CustomEvent(TRACER_DATA_EVENT));

  if (browserWindow.parent && browserWindow.parent !== browserWindow) {
    browserWindow.parent.postMessage({ type: TRACER_DATA_EVENT }, browserWindow.location.origin);
  }
}

function toNormalizedPoint(x: number, y: number) {
  return {
    x: Math.min(1, Math.max(0, x / VIEWPORT.width)),
    y: Math.min(1, Math.max(0, y / VIEWPORT.height))
  };
}

function getElementCenter(elementId: string) {
  const element = TRACKED_ELEMENTS[elementId];

  if (!element) {
    return { x: 0.5, y: 0.5 };
  }

  return toNormalizedPoint(element.rect.x + element.rect.width / 2, element.rect.y + element.rect.height / 2);
}

function buildSeedSession(
  path: string[],
  options: {
    sessionId: string;
    userLabel: string;
    userSegment: string;
    startedAt: number;
    stepIntervalsMs: number[];
    frustrationBursts?: Array<{ elementId: string; repeats: number; startOffsetMs: number }>;
  }
): TracerSession {
  const allTrackedIds = Object.keys(TRACKED_ELEMENTS);
  const events: TracerEvent[] = [];

  events.push({
    id: createId("route"),
    type: "route",
    ts: options.startedAt,
    route: DEMO_APP_ROUTE
  });

  allTrackedIds.forEach((elementId, index) => {
    const element = TRACKED_ELEMENTS[elementId];
    events.push({
      id: createId("impression"),
      type: "impression",
      ts: options.startedAt + 40 + index * 8,
      route: DEMO_APP_ROUTE,
      elementId,
      elementLabel: element.label,
      rect: element.rect
    });
  });

  const pointerStart = { x: 0.08, y: 0.12 };
  events.push({
    id: createId("move"),
    type: "mousemove",
    ts: options.startedAt + 90,
    route: DEMO_APP_ROUTE,
    x: pointerStart.x,
    y: pointerStart.y
  });

  let absoluteTime = options.startedAt + 200;

  path.forEach((elementId, index) => {
    const element = TRACKED_ELEMENTS[elementId];
    const point = getElementCenter(elementId);
    const hoverMs = Math.max(600, Math.round(options.stepIntervalsMs[index] * 0.42));

    events.push({
      id: createId("move"),
      type: "mousemove",
      ts: absoluteTime,
      route: DEMO_APP_ROUTE,
      elementId,
      elementLabel: element.label,
      x: point.x,
      y: point.y
    });

    events.push({
      id: createId("hover"),
      type: "hover",
      ts: absoluteTime + 300,
      route: DEMO_APP_ROUTE,
      elementId,
      elementLabel: element.label,
      rect: element.rect,
      hoverMs
    });

    events.push({
      id: createId("click"),
      type: "click",
      ts: absoluteTime + hoverMs,
      route: DEMO_APP_ROUTE,
      elementId,
      elementLabel: element.label,
      rect: element.rect,
      x: point.x,
      y: point.y,
      repeatIndex: 1
    });

    absoluteTime += options.stepIntervalsMs[index];
  });

  (options.frustrationBursts ?? []).forEach((burst) => {
    const point = getElementCenter(burst.elementId);
    const element = TRACKED_ELEMENTS[burst.elementId];

    for (let index = 0; index < burst.repeats; index += 1) {
      events.push({
        id: createId("move"),
        type: "mousemove",
        ts: options.startedAt + burst.startOffsetMs + index * 240,
        route: DEMO_APP_ROUTE,
        elementId: burst.elementId,
        elementLabel: element.label,
        x: point.x,
        y: point.y
      });

      events.push({
        id: createId("click"),
        type: "click",
        ts: options.startedAt + burst.startOffsetMs + 90 + index * 240,
        route: DEMO_APP_ROUTE,
        elementId: burst.elementId,
        elementLabel: element.label,
        rect: element.rect,
        x: point.x,
        y: point.y,
        repeatIndex: index + 2
      });
    }
  });

  const endedAt = Math.max(...events.map((event) => event.ts)) + 1200;

  return {
    id: options.sessionId,
    projectId: "tracer-demo",
    route: DEMO_APP_ROUTE,
    startedAt: options.startedAt,
    endedAt,
    userLabel: options.userLabel,
    userSegment: options.userSegment,
    source: "seed",
    events
  };
}

function buildSeedSessions() {
  const startedAt = Date.now() - 1000 * 60 * 60 * 3;

  return [
    buildSeedSession(["home", "product", "cart", "checkout", "purchase"], {
      sessionId: "seed_fast_1",
      userLabel: "Aarav",
      userSegment: "Returning team",
      startedAt,
      stepIntervalsMs: [8000, 14000, 17000, 22000, 26000]
    }),
    buildSeedSession(["home", "product", "cart", "checkout", "purchase"], {
      sessionId: "seed_fast_2",
      userLabel: "Mia",
      userSegment: "Power user",
      startedAt: startedAt + 60000,
      stepIntervalsMs: [9000, 15000, 18000, 21000, 28000]
    }),
    buildSeedSession(["home", "pricing", "product", "cart", "checkout", "purchase"], {
      sessionId: "seed_pricing_1",
      userLabel: "Noah",
      userSegment: "Budget-conscious team",
      startedAt: startedAt + 120000,
      stepIntervalsMs: [11000, 21000, 16000, 20000, 26000, 34000]
    }),
    buildSeedSession(["home", "pricing", "product", "cart"], {
      sessionId: "seed_pricing_2",
      userLabel: "Isla",
      userSegment: "New visitor",
      startedAt: startedAt + 180000,
      stepIntervalsMs: [12000, 22000, 19000, 24000]
    }),
    buildSeedSession(["home", "product", "cart", "checkout"], {
      sessionId: "seed_friction_1",
      userLabel: "Ethan",
      userSegment: "Checkout blocker",
      startedAt: startedAt + 240000,
      stepIntervalsMs: [9000, 15000, 24000, 34000],
      frustrationBursts: [{ elementId: "checkout", repeats: 3, startOffsetMs: 78000 }]
    }),
    buildSeedSession(["home", "product", "cart", "checkout", "purchase"], {
      sessionId: "seed_friction_2",
      userLabel: "Sofia",
      userSegment: "Checkout blocker",
      startedAt: startedAt + 300000,
      stepIntervalsMs: [9000, 17000, 24000, 38000, 56000],
      frustrationBursts: [{ elementId: "checkout", repeats: 2, startOffsetMs: 82000 }]
    }),
    buildSeedSession(["home", "product"], {
      sessionId: "seed_explore_1",
      userLabel: "Luca",
      userSegment: "Explorer",
      startedAt: startedAt + 360000,
      stepIntervalsMs: [10000, 24000]
    }),
    buildSeedSession(["home", "product", "cart", "checkout", "purchase"], {
      sessionId: "seed_fast_3",
      userLabel: "Olivia",
      userSegment: "Returning team",
      startedAt: startedAt + 420000,
      stepIntervalsMs: [7000, 12000, 16000, 20000, 24000]
    }),
    buildSeedSession(["home", "pricing", "cart", "checkout", "purchase"], {
      sessionId: "seed_pricing_3",
      userLabel: "Liam",
      userSegment: "Plan comparer",
      startedAt: startedAt + 480000,
      stepIntervalsMs: [10000, 18000, 24000, 31000, 41000]
    })
  ];
}

export function readTracerStore(): TracerStoreData {
  const browserWindow = getBrowserWindow();

  if (!browserWindow) {
    return getDefaultStore();
  }

  const rawStore = browserWindow.localStorage.getItem(TRACER_STORAGE_KEY);

  if (!rawStore) {
    return getDefaultStore();
  }

  try {
    const parsed = JSON.parse(rawStore) as TracerStoreData;

    if (parsed.version !== STORE_VERSION || !Array.isArray(parsed.sessions)) {
      return getDefaultStore();
    }

    return parsed;
  } catch {
    return getDefaultStore();
  }
}

export function ensureTracerSeedData() {
  const currentStore = readTracerStore();

  if (currentStore.seededAt) {
    return currentStore;
  }

  const nextStore: TracerStoreData = {
    ...currentStore,
    seededAt: Date.now(),
    sessions: [...buildSeedSessions(), ...currentStore.sessions]
  };

  writeTracerStore(nextStore);

  return nextStore;
}

export function subscribeToTracerData(listener: () => void) {
  const browserWindow = getBrowserWindow();

  if (!browserWindow) {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === TRACER_STORAGE_KEY) {
      listener();
    }
  };

  const handleCustomEvent = () => {
    listener();
  };

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === TRACER_DATA_EVENT) {
      listener();
    }
  };

  browserWindow.addEventListener("storage", handleStorage);
  browserWindow.addEventListener(TRACER_DATA_EVENT, handleCustomEvent);
  browserWindow.addEventListener("message", handleMessage);

  return () => {
    browserWindow.removeEventListener("storage", handleStorage);
    browserWindow.removeEventListener(TRACER_DATA_EVENT, handleCustomEvent);
    browserWindow.removeEventListener("message", handleMessage);
  };
}

export function getTrackedElements() {
  return Object.values(TRACKED_ELEMENTS);
}

export function getOrCreateLiveSessionId(projectId: string) {
  const browserWindow = getBrowserWindow();

  if (!browserWindow) {
    return createId("live");
  }

  const existing = browserWindow.sessionStorage.getItem(TRACER_SESSION_KEY);

  if (existing) {
    return existing;
  }

  const sessionId = createId("live");
  browserWindow.sessionStorage.setItem(TRACER_SESSION_KEY, sessionId);

  return sessionId;
}

export function appendTracerEvent(
  sessionId: string,
  event: TracerEvent,
  sessionMeta: {
    projectId: string;
    route: string;
    userLabel: string;
    userSegment: string;
    source?: "seed" | "live";
  }
) {
  const currentStore = readTracerStore();
  const existingSessions = [...currentStore.sessions];
  const sessionIndex = existingSessions.findIndex((session) => session.id === sessionId);

  if (sessionIndex === -1) {
    existingSessions.push({
      id: sessionId,
      projectId: sessionMeta.projectId,
      route: sessionMeta.route,
      startedAt: event.ts,
      endedAt: event.ts,
      userLabel: sessionMeta.userLabel,
      userSegment: sessionMeta.userSegment,
      source: sessionMeta.source ?? "live",
      events: [event]
    });
  } else {
    const session = existingSessions[sessionIndex];
    existingSessions[sessionIndex] = {
      ...session,
      route: sessionMeta.route,
      endedAt: Math.max(session.endedAt, event.ts),
      userLabel: sessionMeta.userLabel,
      userSegment: sessionMeta.userSegment,
      events: [...session.events, event]
    };
  }

  writeTracerStore({
    ...currentStore,
    sessions: existingSessions
  });
}

function getClickPath(session: TracerSession) {
  const clicks = session.events.filter((event) => event.type === "click" && event.elementId);
  const path: string[] = [];

  clicks.forEach((event) => {
    if (event.elementId && path[path.length - 1] !== event.elementId) {
      path.push(event.elementId);
    }
  });

  return path;
}

function getFrustrationClicks(session: TracerSession) {
  return session.events.filter((event) => event.type === "click" && (event.repeatIndex ?? 1) > 1).length;
}

function getSessionDuration(session: TracerSession) {
  return Math.max(0, session.endedAt - session.startedAt);
}

function getSessionFrustrationIndex(session: TracerSession) {
  const frustrationClicks = getFrustrationClicks(session);
  const checkoutHoverMs = session.events
    .filter((event) => event.type === "hover" && event.elementId === "checkout")
    .reduce((sum, event) => sum + (event.hoverMs ?? 0), 0);

  return Math.min(100, Math.round(frustrationClicks * 24 + checkoutHoverMs / 400));
}

export function getHeatmapMetrics(route = DEMO_APP_ROUTE) {
  const sessions = readTracerStore().sessions.filter((session) => session.route === route);

  return getTrackedElements()
    .map((element) => {
      const impressions = sessions.flatMap((session) =>
        session.events.filter((event) => event.type === "impression" && event.elementId === element.id)
      );
      const clicks = sessions.flatMap((session) =>
        session.events.filter((event) => event.type === "click" && event.elementId === element.id)
      );
      const hovers = sessions.flatMap((session) =>
        session.events.filter((event) => event.type === "hover" && event.elementId === element.id)
      );

      const repeatClicksAfterFirst = clicks.filter((event) => (event.repeatIndex ?? 1) > 1).length;
      const avgHoverMs =
        hovers.length === 0
          ? 0
          : Math.round(hovers.reduce((sum, event) => sum + (event.hoverMs ?? 0), 0) / hovers.length);
      const clickedPct = impressions.length === 0 ? 0 : Math.min(100, Math.round((clicks.length / impressions.length) * 100));
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
        frustrationIndex
      } satisfies HeatmapMetric;
    })
    .sort((left, right) => right.frustrationIndex - left.frustrationIndex);
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
      return {
        label: "Fast Checkout",
        description: "Focused users who progress from home to purchase with minimal hesitation.",
        color: "#2DD4FF"
      };
    case "pricing-detour":
      return {
        label: "Pricing Comparison",
        description: "Users who pause at pricing, compare value, then continue or exit.",
        color: "#F59E0B"
      };
    case "checkout-friction":
      return {
        label: "Checkout Friction",
        description: "Sessions with repeated checkout attempts or stalled completion.",
        color: "#FB7185"
      };
    default:
      return {
        label: "Exploration",
        description: "Users browsing product surfaces without reaching the purchase path.",
        color: "#94A3B8"
      };
  }
}

function buildReplayPoints(session: TracerSession): ReplayPoint[] {
  const pointerEvents = session.events.filter(
    (event) => (event.type === "mousemove" || event.type === "click") && typeof event.x === "number" && typeof event.y === "number"
  );
  const startTs = pointerEvents[0]?.ts ?? session.startedAt;

  return pointerEvents.map((event) => ({
    x: event.x ?? 0,
    y: event.y ?? 0,
    ts: event.ts - startTs,
    type: event.type === "click" ? "click" : "move"
  }));
}

export function getJourneyClusters() {
  const sessions = readTracerStore().sessions;
  const groupedSessions = new Map<string, TracerSession[]>();

  sessions.forEach((session) => {
    const clusterId = buildClusterLabel(session);
    const clusterSessions = groupedSessions.get(clusterId) ?? [];
    clusterSessions.push(session);
    groupedSessions.set(clusterId, clusterSessions);
  });

  return Array.from(groupedSessions.entries())
    .map(([clusterId, clusterSessions], index) => {
      const descriptor = getClusterDescriptor(clusterId);
      const durations = clusterSessions.map(getSessionDuration);
      const avgDurationMs = Math.round(durations.reduce((sum, value) => sum + value, 0) / clusterSessions.length);
      const avgFrustrationIndex = Math.round(
        clusterSessions.map(getSessionFrustrationIndex).reduce((sum, value) => sum + value, 0) / clusterSessions.length
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
        streams: clusterSessions.slice(0, 3).map((session, streamIndex) => ({
          sessionId: session.id,
          color: streamColors[(index + streamIndex) % streamColors.length],
          points: buildReplayPoints(session)
        }))
      } satisfies JourneyCluster;
    })
    .sort((left, right) => right.sessionCount - left.sessionCount);
}

export function getCustomFunnelMetrics(steps: string[]) {
  if (steps.length === 0) {
    return [];
  }

  const sessions = readTracerStore().sessions;
  const matchedTimesByStep = steps.map(() => [] as number[]);
  const sessionsReachedByStep = steps.map(() => 0);

  sessions.forEach((session) => {
    const clickEvents = session.events.filter((event) => event.type === "click" && event.elementId);
    let searchStartIndex = 0;
    let previousTs: number | null = null;

    for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
      const matchIndex = clickEvents.findIndex(
        (event, eventIndex) => eventIndex >= searchStartIndex && event.elementId === steps[stepIndex]
      );

      if (matchIndex === -1) {
        break;
      }

      const matchedEvent = clickEvents[matchIndex];
      sessionsReachedByStep[stepIndex] += 1;

      if (stepIndex > 0 && previousTs !== null) {
        matchedTimesByStep[stepIndex].push(matchedEvent.ts - previousTs);
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
        : Math.round(matchedTimesByStep[index].reduce((sum, value) => sum + value, 0) / matchedTimesByStep[index].length);

    return {
      elementId,
      label: element?.label ?? elementId,
      route: element?.route ?? DEMO_APP_ROUTE,
      sessionsReached: sessionsReachedByStep[index],
      dropOffPct,
      avgTimeFromPreviousMs
    } satisfies FunnelStepMetric;
  });
}

export function getDashboardOverview() {
  const store = readTracerStore();

  return {
    totalSessions: store.sessions.length,
    liveSessions: store.sessions.filter((session) => session.source === "live").length,
    clusterCount: getJourneyClusters().length,
    trackedElementCount: getTrackedElements().length
  };
}
