"use client";

import {
  appendTracerEvent,
  ensureTracerSeedData,
  getOrCreateLiveSessionId,
  TRACER_SESSION_KEY,
  type TracerRect
} from "@/lib/tracer-store";

type TracerInitOptions = {
  projectId: string;
  route?: string;
  userLabel?: string;
  userSegment?: string;
};

const hoverStartTimes = new Map<string, number>();
const clickStreaks = new Map<string, { lastTs: number; repeatIndex: number }>();
let activeCleanup: (() => void) | null = null;

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function getTrackedElement(target: Element | null) {
  const trackedElement = target?.closest<HTMLElement>("[data-tracer-id]");

  if (!trackedElement) {
    return null;
  }

  return {
    id: trackedElement.dataset.tracerId ?? "",
    label: trackedElement.dataset.tracerLabel ?? trackedElement.textContent?.trim() ?? "Tracked element",
    rect: getNormalizedRect(trackedElement)
  };
}

function getNormalizedRect(element: HTMLElement): TracerRect {
  const rect = element.getBoundingClientRect();

  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

function throttle<T extends (...args: never[]) => void>(callback: T, waitMs: number) {
  let lastCallTs = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCallTs < waitMs) {
      return;
    }

    lastCallTs = now;
    callback(...args);
  };
}

const tracer = {
  init(options: TracerInitOptions) {
    if (typeof window === "undefined") {
      return () => undefined;
    }

    ensureTracerSeedData();
    activeCleanup?.();

    const route = options.route ?? window.location.pathname;
    const sessionId = getOrCreateLiveSessionId(options.projectId);
    const sessionMeta = {
      projectId: options.projectId,
      route,
      userLabel: options.userLabel ?? "Live developer",
      userSegment: options.userSegment ?? "Demo session",
      source: "live" as const
    };

    appendTracerEvent(
      sessionId,
      {
        id: createId("route"),
        type: "route",
        ts: Date.now(),
        route
      },
      sessionMeta
    );

    const recordImpressions = () => {
      document.querySelectorAll<HTMLElement>("[data-tracer-id]").forEach((element, index) => {
        appendTracerEvent(
          sessionId,
          {
            id: createId("impression"),
            type: "impression",
            ts: Date.now() + index * 2,
            route,
            elementId: element.dataset.tracerId,
            elementLabel: element.dataset.tracerLabel ?? element.textContent?.trim() ?? "Tracked element",
            rect: getNormalizedRect(element)
          },
          sessionMeta
        );
      });
    };

    const handleClick = (event: MouseEvent) => {
      const trackedElement = getTrackedElement(event.target as Element | null);

      if (!trackedElement) {
        return;
      }

      const previousClick = clickStreaks.get(trackedElement.id);
      const isRepeated = previousClick && event.timeStamp - previousClick.lastTs < 1200;
      const repeatIndex = isRepeated ? previousClick.repeatIndex + 1 : 1;

      clickStreaks.set(trackedElement.id, {
        lastTs: event.timeStamp,
        repeatIndex
      });

      appendTracerEvent(
        sessionId,
        {
          id: createId("click"),
          type: "click",
          ts: Date.now(),
          route,
          elementId: trackedElement.id,
          elementLabel: trackedElement.label,
          rect: trackedElement.rect,
          x: Math.min(1, Math.max(0, event.clientX / window.innerWidth)),
          y: Math.min(1, Math.max(0, event.clientY / window.innerHeight)),
          repeatIndex
        },
        sessionMeta
      );
    };

    const handleMouseMove = throttle((event: MouseEvent) => {
      appendTracerEvent(
        sessionId,
        {
          id: createId("move"),
          type: "mousemove",
          ts: Date.now(),
          route,
          x: Math.min(1, Math.max(0, event.clientX / window.innerWidth)),
          y: Math.min(1, Math.max(0, event.clientY / window.innerHeight))
        },
        sessionMeta
      );
    }, 140);

    const handleMouseOver = (event: MouseEvent) => {
      const trackedElement = getTrackedElement(event.target as Element | null);

      if (!trackedElement) {
        return;
      }

      hoverStartTimes.set(trackedElement.id, Date.now());
    };

    const handleMouseOut = (event: MouseEvent) => {
      const trackedElement = getTrackedElement(event.target as Element | null);

      if (!trackedElement) {
        return;
      }

      const startedAt = hoverStartTimes.get(trackedElement.id);

      if (!startedAt) {
        return;
      }

      hoverStartTimes.delete(trackedElement.id);

      appendTracerEvent(
        sessionId,
        {
          id: createId("hover"),
          type: "hover",
          ts: Date.now(),
          route,
          elementId: trackedElement.id,
          elementLabel: trackedElement.label,
          rect: trackedElement.rect,
          hoverMs: Date.now() - startedAt
        },
        sessionMeta
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        window.sessionStorage.removeItem(TRACER_SESSION_KEY);
      }
    };

    window.setTimeout(recordImpressions, 120);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseover", handleMouseOver, true);
    document.addEventListener("mouseout", handleMouseOut, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    activeCleanup = () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handleMouseOver, true);
      document.removeEventListener("mouseout", handleMouseOut, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };

    return activeCleanup;
  },

  track(name: string, payload: Record<string, string | number | boolean> = {}) {
    if (typeof window === "undefined") {
      return;
    }

    const sessionId = window.sessionStorage.getItem(TRACER_SESSION_KEY);

    if (!sessionId) {
      return;
    }

    appendTracerEvent(
      sessionId,
      {
        id: createId("custom"),
        type: "custom",
        ts: Date.now(),
        route: window.location.pathname,
        name,
        elementLabel: JSON.stringify(payload)
      },
      {
        projectId: "tracer-demo",
        route: window.location.pathname,
        userLabel: "Live developer",
        userSegment: "Demo session",
        source: "live"
      }
    );
  }
};

export default tracer;
