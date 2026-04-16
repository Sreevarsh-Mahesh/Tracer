/**
 * tracer-sdk — Lightweight product analytics SDK
 *
 * Zero dependencies. Captures clicks, hovers, mouse movements,
 * and route changes on elements annotated with `data-tracer-id`.
 * Batches events and flushes them over HTTP to the Tracer ingestion endpoint.
 *
 * @example
 * ```ts
 * import tracer from 'tracer-sdk';
 *
 * tracer.init({
 *   projectId: 'my-app',
 *   apiKey: 'tk_live_abc123',
 *   endpoint: 'https://your-tracer-dashboard.vercel.app/api/ingest'
 * });
 * ```
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type TracerEventType =
  | "route"
  | "impression"
  | "hover"
  | "click"
  | "mousemove"
  | "custom";

export interface TracerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TracerEvent {
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
  payload?: Record<string, string | number | boolean>;
}

export interface TracerInitOptions {
  /** Unique project identifier — must match your Tracer dashboard project */
  projectId: string;
  /** API key from the Tracer dashboard settings panel */
  apiKey: string;
  /** Full URL of the ingestion endpoint, e.g. https://your-dashboard.vercel.app/api/ingest */
  endpoint: string;
  /** Override the auto-detected route (defaults to window.location.pathname) */
  route?: string;
  /** Human-readable label for this user / session */
  userLabel?: string;
  /** User segment for clustering (e.g. "power-user", "new-visitor") */
  userSegment?: string;
  /** Batch flush interval in ms — default 5000 */
  flushIntervalMs?: number;
  /** Max events per batch — default 200 */
  maxBatchSize?: number;
  /** Mouse-move throttle interval in ms — default 150 */
  mouseMoveThrottleMs?: number;
}

// ─── Internals ───────────────────────────────────────────────────────────────

const SESSION_KEY = "__tracer_session_id__";
let activeConfig: TracerInitOptions | null = null;
let activeSessionId: string | null = null;
let activeCleanup: (() => void) | null = null;

// Event batch queue
let eventQueue: TracerEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

// Hover tracking
const hoverStartTimes = new Map<string, number>();

// Repeat-click detection (rage clicks)
const clickStreaks = new Map<string, { lastTs: number; repeatIndex: number }>();

function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}

function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return uid("s");

  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uid("s");
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getTrackedElement(target: Element | null): {
  id: string;
  label: string;
  rect: TracerRect;
} | null {
  const el = target?.closest<HTMLElement>("[data-tracer-id]");
  if (!el) return null;

  const rect = el.getBoundingClientRect();
  return {
    id: el.dataset.tracerId ?? "",
    label:
      el.dataset.tracerLabel ?? el.textContent?.trim().slice(0, 80) ?? "element",
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  };
}

function throttle<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last < ms) return;
    last = now;
    fn(...args);
  }) as T;
}

// ─── Batching & Network ─────────────────────────────────────────────────────

function enqueue(event: TracerEvent) {
  eventQueue.push(event);

  const max = activeConfig?.maxBatchSize ?? 200;
  if (eventQueue.length >= max) {
    flush();
  }
}

function buildPayload() {
  if (eventQueue.length === 0 || !activeConfig) return null;

  const events = eventQueue.splice(0);
  return {
    projectId: activeConfig.projectId,
    apiKey: activeConfig.apiKey,
    sessionId: activeSessionId,
    route: activeConfig.route ?? (typeof location !== "undefined" ? location.pathname : "/"),
    userLabel: activeConfig.userLabel ?? "Anonymous",
    userSegment: activeConfig.userSegment ?? "default",
    events,
  };
}

function flush() {
  const payload = buildPayload();
  if (!payload || !activeConfig) return;

  const url = activeConfig.endpoint;
  const body = JSON.stringify(payload);

  // Try sendBeacon first (works even during page unload)
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      url,
      new Blob([body], { type: "application/json" })
    );
    if (sent) return;
  }

  // Fallback to fetch (fire-and-forget)
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Silently swallow network errors — analytics should never break the host app
  });
}

function startFlushTimer() {
  if (flushTimer) clearInterval(flushTimer);
  const interval = activeConfig?.flushIntervalMs ?? 5000;
  flushTimer = setInterval(flush, interval);
}

function stopFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

// ─── DOM Instrumentation ─────────────────────────────────────────────────────

function recordImpressions(route: string) {
  document.querySelectorAll<HTMLElement>("[data-tracer-id]").forEach((el, i) => {
    enqueue({
      id: uid("imp"),
      type: "impression",
      ts: Date.now() + i * 2,
      route,
      elementId: el.dataset.tracerId,
      elementLabel:
        el.dataset.tracerLabel ?? el.textContent?.trim().slice(0, 80) ?? "element",
      rect: {
        x: Math.round(el.getBoundingClientRect().x),
        y: Math.round(el.getBoundingClientRect().y),
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      },
    });
  });
}

function attachDomListeners(route: string) {
  const moveThrottle = activeConfig?.mouseMoveThrottleMs ?? 150;

  const handleClick = (e: MouseEvent) => {
    const tracked = getTrackedElement(e.target as Element | null);
    if (!tracked) return;

    const prev = clickStreaks.get(tracked.id);
    const isRepeat = prev && e.timeStamp - prev.lastTs < 1200;
    const repeatIndex = isRepeat ? prev!.repeatIndex + 1 : 1;
    clickStreaks.set(tracked.id, { lastTs: e.timeStamp, repeatIndex });

    enqueue({
      id: uid("clk"),
      type: "click",
      ts: Date.now(),
      route,
      elementId: tracked.id,
      elementLabel: tracked.label,
      rect: tracked.rect,
      x: Math.min(1, Math.max(0, e.clientX / window.innerWidth)),
      y: Math.min(1, Math.max(0, e.clientY / window.innerHeight)),
      repeatIndex,
    });
  };

  const handleMouseMove = throttle((e: MouseEvent) => {
    enqueue({
      id: uid("mv"),
      type: "mousemove",
      ts: Date.now(),
      route,
      x: Math.min(1, Math.max(0, e.clientX / window.innerWidth)),
      y: Math.min(1, Math.max(0, e.clientY / window.innerHeight)),
    });
  }, moveThrottle);

  const handleMouseOver = (e: MouseEvent) => {
    const tracked = getTrackedElement(e.target as Element | null);
    if (!tracked) return;
    hoverStartTimes.set(tracked.id, Date.now());
  };

  const handleMouseOut = (e: MouseEvent) => {
    const tracked = getTrackedElement(e.target as Element | null);
    if (!tracked) return;

    const startedAt = hoverStartTimes.get(tracked.id);
    if (!startedAt) return;
    hoverStartTimes.delete(tracked.id);

    enqueue({
      id: uid("hvr"),
      type: "hover",
      ts: Date.now(),
      route,
      elementId: tracked.id,
      elementLabel: tracked.label,
      rect: tracked.rect,
      hoverMs: Date.now() - startedAt,
    });
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flush(); // Flush remaining events when user leaves
    }
  };

  const handleBeforeUnload = () => {
    flush();
  };

  // Record initial impressions after a short delay (let DOM settle)
  setTimeout(() => recordImpressions(route), 200);

  document.addEventListener("click", handleClick, true);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseover", handleMouseOver, true);
  document.addEventListener("mouseout", handleMouseOut, true);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("beforeunload", handleBeforeUnload);

  return () => {
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseover", handleMouseOver, true);
    document.removeEventListener("mouseout", handleMouseOut, true);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("beforeunload", handleBeforeUnload);
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

const tracer = {
  /**
   * Initialize the Tracer SDK. Call this once on app mount.
   * Returns a cleanup function to stop tracking.
   *
   * @example
   * ```ts
   * const cleanup = tracer.init({
   *   projectId: 'my-app',
   *   apiKey: 'tk_live_abc123',
   *   endpoint: 'https://your-dashboard.vercel.app/api/ingest'
   * });
   *
   * // Later, to stop:
   * cleanup();
   * ```
   */
  init(options: TracerInitOptions): () => void {
    if (typeof window === "undefined") {
      return () => undefined;
    }

    // Tear down previous instance
    activeCleanup?.();
    stopFlushTimer();
    eventQueue = [];
    hoverStartTimes.clear();
    clickStreaks.clear();

    activeConfig = options;
    activeSessionId = getSessionId();
    const route = options.route ?? window.location.pathname;

    // Record initial route event
    enqueue({
      id: uid("rt"),
      type: "route",
      ts: Date.now(),
      route,
    });

    // Attach DOM listeners
    const removeDomListeners = attachDomListeners(route);

    // Start periodic flush
    startFlushTimer();

    activeCleanup = () => {
      removeDomListeners();
      flush();
      stopFlushTimer();
      activeConfig = null;
      activeSessionId = null;
      activeCleanup = null;
    };

    return activeCleanup;
  },

  /**
   * Track a custom named event with optional payload.
   *
   * @example
   * ```ts
   * tracer.track('signup_complete', { plan: 'pro', source: 'landing' });
   * ```
   */
  track(name: string, payload: Record<string, string | number | boolean> = {}) {
    if (typeof window === "undefined" || !activeConfig) return;

    enqueue({
      id: uid("cst"),
      type: "custom",
      ts: Date.now(),
      route: window.location.pathname,
      name,
      payload,
    });
  },

  /**
   * Manually flush the event queue. Normally events are flushed
   * automatically every 5 seconds and on page unload.
   */
  flush() {
    flush();
  },

  /**
   * Tear down the SDK — removes all listeners and flushes remaining events.
   */
  destroy() {
    activeCleanup?.();
  },
};

export default tracer;
