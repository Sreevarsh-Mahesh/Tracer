"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronLeft, ChevronRight, GitFork, RefreshCcw, Route } from "lucide-react";
import type { FunnelStepMetric, TrackedElementDefinition } from "@/lib/tracer-store";

const IFRAME_SRC = "/demo-store?embedded=1&builder=1";
const PANEL_WIDTH = 340;

function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) return "--";
  if (milliseconds < 1000) return `${milliseconds}ms`;
  const totalSeconds = Math.round(milliseconds / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function paintTrackedSteps(frameDocument: Document | null, steps: string[]) {
  if (!frameDocument) return;
  frameDocument.querySelectorAll<HTMLElement>("[data-tracer-id]").forEach((element) => {
    const elementId = element.dataset.tracerId;
    const activeIndex = elementId ? steps.indexOf(elementId) : -1;
    element.style.outline = activeIndex >= 0 ? "3px solid #2DD4FF" : "1px solid transparent";
    element.style.outlineOffset = "2px";
    element.style.boxShadow = activeIndex >= 0 ? "0 0 0 6px rgba(45, 212, 255, 0.14)" : "none";
  });
}

const funnelFetcher = async (url: string, steps: string[]) => {
  if (steps.length === 0) return { metrics: [], elements: [] };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steps }),
  });
  return res.json();
};

export function FunnelPanel() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const listenerCleanupRef = useRef<(() => void) | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [builderHint, setBuilderHint] = useState(
    "Start a new custom journey by clicking tracked buttons inside the iframe in the order you care about."
  );
  const [panelOpen, setPanelOpen] = useState(true);

  // Fetch funnel metrics from API when steps change
  const { data: funnelData } = useSWR(
    steps.length > 0 ? ["/api/tracer/funnels", steps] : null,
    ([url, s]) => funnelFetcher(url, s),
    { fallbackData: { metrics: [], elements: [] } }
  );

  const funnelMetrics: FunnelStepMetric[] = funnelData?.metrics ?? [];
  const trackedElements: TrackedElementDefinition[] = funnelData?.elements ?? [];

  useEffect(() => {
    paintTrackedSteps(iframeRef.current?.contentDocument ?? null, steps);
  }, [steps]);

  useEffect(() => {
    return () => { listenerCleanupRef.current?.(); };
  }, []);

  function attachListener() {
    listenerCleanupRef.current?.();
    const frameDocument = iframeRef.current?.contentDocument;
    if (!frameDocument) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const trackedElement = target?.closest<HTMLElement>("[data-tracer-id]");
      if (!trackedElement) return;

      event.preventDefault();
      event.stopPropagation();

      const elementId = trackedElement.dataset.tracerId ?? "";
      setSteps((prev) => {
        if (prev[prev.length - 1] === elementId) return prev;
        const next = [...prev, elementId];
        setBuilderHint(`Added "${trackedElement.dataset.tracerLabel ?? elementId}" as step ${next.length}.`);
        return next;
      });
    };

    frameDocument.addEventListener("click", handleClick, true);
    listenerCleanupRef.current = () => frameDocument.removeEventListener("click", handleClick, true);
  }

  function handleClear() {
    setSteps([]);
    setBuilderHint("Start a new custom journey by clicking tracked buttons inside the iframe in the order you care about.");
    paintTrackedSteps(iframeRef.current?.contentDocument ?? null, []);
  }

  return (
    <Box sx={{ position: "relative", display: "flex", gap: 0, overflow: "hidden" }}>
      {/* Main builder area */}
      <Box sx={{ flex: 1, minWidth: 0, transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)", mr: panelOpen ? `${PANEL_WIDTH + 16}px` : 0 }}>
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", lg: "center" }} spacing={2}>
                <Box>
                  <Typography variant="h3" sx={{ fontSize: "1.3rem", mb: 0.5 }}>Conversion funnel builder</Typography>
                  <Typography color="text.secondary">
                    Click UI elements in the order you want to track — each click adds a new step to the
                    funnel. The Journey definition panel shows drop-off rates and timing between each step.
                  </Typography>
                </Box>
                <Button variant="outlined" size="small" startIcon={panelOpen ? <ChevronRight size={15} /> : <GitFork size={15} />} onClick={() => setPanelOpen((v) => !v)} sx={{ whiteSpace: "nowrap", borderColor: panelOpen ? "primary.main" : undefined, color: panelOpen ? "primary.main" : undefined }}>
                  {panelOpen ? "Hide journey" : "Journey definition"}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={`${steps.length} step${steps.length === 1 ? "" : "s"} recorded`} />
                <Typography variant="body2" color="text.secondary">{builderHint}</Typography>
              </Stack>

              <Box sx={{ position: "relative", overflow: "hidden", borderRadius: "8px", border: "1px solid rgba(226, 232, 240, 0.10)", backgroundColor: "#0B1220" }}>
                <iframe
                  ref={iframeRef}
                  title="Tracer funnel builder surface"
                  src={IFRAME_SRC}
                  sandbox="allow-same-origin allow-scripts"
                  style={{ width: "100%", height: 680, border: 0, display: "block" }}
                  onLoad={() => { attachListener(); paintTrackedSteps(iframeRef.current?.contentDocument ?? null, steps); }}
                />
              </Box>

              <Stack direction="row" spacing={1}>
                <Button variant="contained" startIcon={<Route size={16} />} sx={{ flex: 1 }} onClick={() => { paintTrackedSteps(iframeRef.current?.contentDocument ?? null, steps); }}>
                  Inspect funnel
                </Button>
                <Button variant="outlined" startIcon={<RefreshCcw size={16} />} onClick={handleClear}>Clear & restart</Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Right collapsible Journey definition panel */}
      <Box sx={{ position: "absolute", top: 0, right: 0, width: PANEL_WIDTH, height: "100%", transform: panelOpen ? "translateX(0)" : `translateX(${PANEL_WIDTH + 20}px)`, transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)", display: "flex", flexDirection: "column", zIndex: 10, pointerEvents: panelOpen ? "auto" : "none" }}>
        <Card sx={{ height: "100%", display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.35)", border: "1px solid rgba(45, 212, 255, 0.12)", backdropFilter: "blur(12px)", background: "linear-gradient(180deg, rgba(11,18,32,0.97) 0%, rgba(8,14,26,0.98) 100%)" }}>
          {/* Panel header */}
          <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: "rgba(45, 212, 255, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "primary.main" }}>
                <GitFork size={16} />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Journey definition</Typography>
                <Typography variant="caption" color="text.secondary">{steps.length === 0 ? "No steps yet" : `${steps.length} step${steps.length === 1 ? "" : "s"} in funnel`}</Typography>
              </Box>
            </Stack>
            <IconButton size="small" onClick={() => setPanelOpen(false)} sx={{ color: "text.secondary", "&:hover": { color: "text.primary", bgcolor: "rgba(255,255,255,0.06)" } }}>
              <ChevronLeft size={18} />
            </IconButton>
          </Box>

          {/* Journey description */}
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              {steps.length === 0
                ? "Click elements in the preview to define the steps of your conversion funnel."
                : "Drop-off rates and timing below are computed from real session data."}
            </Typography>
          </Box>

          {/* Scrollable step list */}
          <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5, "&::-webkit-scrollbar": { width: 4 }, "&::-webkit-scrollbar-thumb": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.1)" } }}>
            {steps.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Avatar variant="rounded" sx={{ width: 48, height: 48, mx: "auto", mb: 2, bgcolor: "rgba(45,212,255,0.12)", color: "primary.main" }}>
                  <GitFork size={22} />
                </Avatar>
                <Typography variant="body2" color="text.secondary">Click buttons in the preview to build your funnel path.</Typography>
              </Box>
            ) : (
              <Stack spacing={0.5}>
                {steps.map((elementId, idx) => {
                  const metric = funnelMetrics[idx];
                  const element = trackedElements.find((e) => e.id === elementId);
                  const label = element?.label ?? elementId;

                  return (
                    <Box key={`${elementId}-${idx}`}>
                      {idx > 0 && (
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.75, pl: 2 }}>
                          <Box sx={{ width: 1.5, height: 22, bgcolor: "primary.main", borderRadius: 1 }} />
                          {metric?.dropOffPct != null && (
                            <Chip
                              label={`${metric.dropOffPct}% drop-off`}
                              size="small"
                              sx={{
                                height: 18, fontSize: "0.68rem",
                                bgcolor: metric.dropOffPct > 30 ? alpha("#FB7185", 0.14) : undefined,
                                color: metric.dropOffPct > 30 ? "#FB7185" : undefined,
                              }}
                            />
                          )}
                          {metric?.avgTimeFromPreviousMs != null && (
                            <Chip label={`⏱ ${formatDuration(metric.avgTimeFromPreviousMs)}`} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
                          )}
                        </Stack>
                      )}
                      <Card sx={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <CardContent sx={{ p: 1.5 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: "rgba(45,212,255,0.14)", color: "primary.main", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700 }}>
                                {idx + 1}
                              </Box>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
                                {metric && (
                                  <Typography variant="caption" color="text.secondary">{metric.sessionsReached} sessions reached</Typography>
                                )}
                              </Box>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>

          {/* Panel footer */}
          <Box sx={{ px: 2.5, py: 1.5, borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <Button variant="outlined" size="small" fullWidth startIcon={<RefreshCcw size={14} />} onClick={handleClear}>
              Clear & restart
            </Button>
          </Box>
        </Card>
      </Box>

      {/* Floating re-open tab */}
      {!panelOpen && (
        <Box onClick={() => setPanelOpen(true)} sx={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, cursor: "pointer", bgcolor: "primary.main", color: "#000", borderRadius: "8px 0 0 8px", px: 0.75, py: 1.5, boxShadow: "-4px 0 16px rgba(45, 212, 255, 0.35)", zIndex: 20, transition: "all 0.2s", "&:hover": { px: 1, boxShadow: "-6px 0 20px rgba(45, 212, 255, 0.5)" } }}>
          <GitFork size={14} />
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.6rem", writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "0.05em" }}>JOURNEY</Typography>
          <ChevronLeft size={14} />
        </Box>
      )}
    </Box>
  );
}
