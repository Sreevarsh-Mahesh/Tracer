"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Typography
} from "@mui/material";
import { Eye, Flame, MousePointer2 } from "lucide-react";
import type { HeatmapMetric } from "@/lib/tracer-store";
import { InspectorToggleButton } from "./InspectorToggleButton";

// Removed hardcoded IFRAME_SRC
const fetcher = (url: string) => fetch(url).then((r) => r.json());

type OverlayBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  metric: HeatmapMetric;
};

function formatHoverTime(milliseconds: number) {
  if (milliseconds < 1000) return `${milliseconds}ms`;
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function MiniDonut({ clickedPct }: { clickedPct: number }) {
  return (
    <Box
      sx={{
        width: 60, height: 60, borderRadius: "50%",
        background: `conic-gradient(#2DD4FF 0 ${clickedPct * 3.6}deg, rgba(226,232,240,0.12) ${clickedPct * 3.6}deg 360deg)`,
        display: "grid", placeItems: "center"
      }}
    >
      <Box
        sx={{
          width: 38, height: 38, borderRadius: "50%",
          display: "grid", placeItems: "center",
          backgroundColor: "rgba(5,7,11,0.92)",
          color: "text.primary", fontSize: 12, fontWeight: 700
        }}
      >
        {clickedPct}%
      </Box>
    </Box>
  );
}

export function HeatmapPanel({ projectId, hostUrl }: { projectId?: string | null; hostUrl?: string | null } = {}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [overlayBoxes, setOverlayBoxes] = useState<OverlayBox[]>([]);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState(true);

  const [currentRoute, setCurrentRoute] = useState(projectId ? "/" : "/demo-store");

  const endpoint = `/api/tracer/heatmap?route=${currentRoute}${projectId ? `&projectId=${projectId}` : ""}`;
  
  const { data, isLoading } = useSWR(endpoint, fetcher, {
    refreshInterval: 15000,
    fallbackData: { metrics: [], elements: [] }
  });

  const metrics: HeatmapMetric[] = data?.metrics ?? [];

  useEffect(() => {
    function syncOverlayPositions() {
      const frameDocument = iframeRef.current?.contentDocument;
      if (!frameDocument) return;

      const frameElements = Array.from(frameDocument.querySelectorAll<HTMLElement>("[data-tracer-id]"));
      const nextBoxes = frameElements
        .map((element) => {
          const metric = metrics.find((item) => item.elementId === element.dataset.tracerId);
          if (!metric) return null;
          const rect = element.getBoundingClientRect();
          return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, metric } satisfies OverlayBox;
        })
        .filter((value): value is OverlayBox => value !== null);

      setOverlayBoxes(nextBoxes);
    }

    const timeout = window.setTimeout(syncOverlayPositions, 150);
    const interval = window.setInterval(syncOverlayPositions, 1200);
    window.addEventListener("resize", syncOverlayPositions);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      window.removeEventListener("resize", syncOverlayPositions);
    };
  }, [metrics]);

  const hoveredBox = overlayBoxes.find((box) => box.metric.elementId === hoveredElementId) ?? null;

  const containerWidth = containerRef.current?.clientWidth ?? 0;
  const containerHeight = containerRef.current?.clientHeight ?? 760;
  const tooltipWidth = 248;
  const tooltipPadding = 16;

  let tooltipLeft = 0;
  let tooltipTop = 0;

  if (hoveredBox) {
    if (hoveredBox.left + hoveredBox.width + tooltipPadding + tooltipWidth < containerWidth) {
      tooltipLeft = hoveredBox.left + hoveredBox.width + tooltipPadding;
    } else if (hoveredBox.left - tooltipWidth - tooltipPadding > 0) {
      tooltipLeft = hoveredBox.left - tooltipWidth - tooltipPadding;
    } else {
      tooltipLeft = Math.max(tooltipPadding, containerWidth - tooltipWidth - tooltipPadding);
    }
    const estimatedHeight = 320;
    tooltipTop = Math.max(12, Math.min(hoveredBox.top, containerHeight - estimatedHeight - 12));
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", xl: showInspector ? "minmax(0, 1.55fr) minmax(320px, 0.85fr)" : "1fr" },
        gap: 2
      }}
    >
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", lg: "center" }} spacing={2}>
              <Box>
                <Typography variant="h3" sx={{ fontSize: "1.3rem", mb: 0.5 }}>UI heatmap</Typography>
                <Typography color="text.secondary">
                  Hover over any tracked UI element to inspect click vs ignored %, average hover time,
                  and post-click frustration — a clean tooltip will appear instantly.
                </Typography>
              </Box>
              <InspectorToggleButton open={showInspector} openLabel="Show insights" closeLabel="Hide insights" onClick={() => setShowInspector((v) => !v)} />
            </Stack>
            <Box ref={containerRef} sx={{ position: "relative", overflow: "hidden", borderRadius: "8px", border: "1px solid rgba(226, 232, 240, 0.10)", backgroundColor: "#0B1220" }}>
              <iframe
                ref={iframeRef}
                title="Tracer heatmap target"
                src={hostUrl ? `${hostUrl}${currentRoute}` : `/demo-store?embedded=1`}
                sandbox="allow-same-origin allow-scripts"
                scrolling="no"
                style={{ width: "100%", height: 760, border: 0, display: "block", overflow: "hidden" }}
                onLoad={() => {
                  const frameDocument = iframeRef.current?.contentDocument;
                  if (!frameDocument) return;
                  // Lock iframe scrolling — scroll is not meaningful in a static heatmap view
                  try {
                    if (!frameDocument.getElementById("__tracer_scroll_lock__")) {
                      const style = frameDocument.createElement("style");
                      style.id = "__tracer_scroll_lock__";
                      style.textContent = "html,body{overflow:hidden!important;}";
                      frameDocument.head?.appendChild(style);
                    }
                  } catch (_) { /* cross-origin guard */ }
                  const frameElements = frameDocument.querySelectorAll<HTMLElement>("[data-tracer-id]");
                  const nextBoxes = Array.from(frameElements)
                    .map((element) => {
                      const metric = metrics.find((item) => item.elementId === element.dataset.tracerId);
                      if (!metric) return null;
                      const rect = element.getBoundingClientRect();
                      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, metric } satisfies OverlayBox;
                    })
                    .filter((value): value is OverlayBox => value !== null);
                  setOverlayBoxes(nextBoxes);
                }}
              />

              <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                {overlayBoxes.map((box) => (
                  <Box
                    key={box.metric.elementId}
                    onMouseEnter={() => setHoveredElementId(box.metric.elementId)}
                    onMouseLeave={() => setHoveredElementId((current) => (current === box.metric.elementId ? null : current))}
                    sx={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height, borderRadius: "4px", pointerEvents: "auto" }}
                  />
                ))}

                {hoveredBox ? (
                  <Card
                    sx={{
                      position: "absolute", left: tooltipLeft, top: tooltipTop,
                      width: 248, pointerEvents: "none",
                      borderColor: "rgba(45,212,255,0.18)",
                      animation: "tracerFadeIn 0.18s ease",
                      "@keyframes tracerFadeIn": {
                        from: { opacity: 0, transform: "translateY(4px)" },
                        to: { opacity: 1, transform: "translateY(0)" }
                      }
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <MiniDonut clickedPct={hoveredBox.metric.clickedPct} />
                        <Box>
                          <Typography variant="h3" sx={{ fontSize: "1rem" }}>{hoveredBox.metric.label}</Typography>
                          <Typography variant="body2" color="text.secondary">{hoveredBox.metric.description}</Typography>
                        </Box>
                      </Stack>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Clicked</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{hoveredBox.metric.clickedPct}%</Typography></Stack>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Ignored</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{hoveredBox.metric.ignoredPct}%</Typography></Stack>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Avg. hover</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{formatHoverTime(hoveredBox.metric.avgHoverMs)}</Typography></Stack>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Extra clicks after first</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{hoveredBox.metric.repeatClicksAfterFirst}</Typography></Stack>
                    </CardContent>
                  </Card>
                ) : null}
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {showInspector ? (
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h3" sx={{ fontSize: "1.2rem", mb: 0.5 }}>Highest-friction elements</Typography>
                <Typography color="text.secondary">These metrics are computed from the recorded impression, hover, and click events.</Typography>
              </Box>
              {isLoading ? (
                <Stack spacing={1.5}>{[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={100} />)}</Stack>
              ) : metrics.length === 0 ? (
                <Card sx={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography color="text.secondary">No session data yet. Install the SDK and interact with your app to generate real metrics.</Typography>
                  </CardContent>
                </Card>
              ) : (
                metrics.map((metric) => (
                  <Card key={metric.elementId} sx={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                    <CardContent sx={{ p: 2 }}>
                      <Stack spacing={1.25}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="h3" sx={{ fontSize: "1rem" }}>{metric.label}</Typography>
                            <Typography variant="body2" color="text.secondary">{metric.description}</Typography>
                          </Box>
                          <Chip icon={metric.frustrationIndex > 45 ? <Flame size={14} /> : <Eye size={14} />} label={`Frustration ${metric.frustrationIndex}`} />
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip icon={<MousePointer2 size={14} />} label={`${metric.clicks} clicks`} size="small" />
                          <Chip label={`${metric.impressions} impressions`} size="small" />
                          <Chip label={`Hover ${formatHoverTime(metric.avgHoverMs)}`} size="small" />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))
              )}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
