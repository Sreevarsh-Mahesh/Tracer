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

const IFRAME_SRC = "/?embedded=1&builder=1";
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

const funnelFetcher = async ([url, steps, projectId]: [string, string[], string | null | undefined]) => {
  if (steps.length === 0) return { metrics: [], elements: [] };
  const targetUrl = projectId ? `${url}?projectId=${projectId}` : url;
  const res = await fetch(targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steps }),
  });
  return res.json();
};

export function FunnelPanel({ projectId, hostUrl }: { projectId?: string | null; hostUrl?: string | null } = {}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [builderHint, setBuilderHint] = useState(
    "Start a new custom journey by clicking tracked buttons inside the iframe in the order you care about."
  );
  const [panelOpen, setPanelOpen] = useState(true);

  const resolvedProjectId = projectId || process.env.NEXT_PUBLIC_PROJECT_ID || null;

  const { data: funnelData } = useSWR(
    steps.length > 0 ? ["/api/tracer/funnels", steps, resolvedProjectId] : null,
    funnelFetcher,
    { refreshInterval: 10000, fallbackData: { metrics: [], elements: [] } }
  );

  const funnelMetrics: FunnelStepMetric[] = funnelData?.metrics ?? [];
  const trackedElements: TrackedElementDefinition[] = funnelData?.elements ?? [];

  useEffect(() => {
    paintTrackedSteps(iframeRef.current?.contentDocument ?? null, steps);
  }, [steps]);

  useEffect(() => {
    return () => { 
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: "TRACER_STOP_BUILDER" }, "*");
      }
    };
  }, []);

  function lockFrameScroll() {
    // Intentionally empty for cross-origin compliance
  }

  function attachListener() {
    // Intentionally empty for cross-origin compliance
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "TRACER_BUILDER_CLICK") {
        const { elementId, elementLabel } = event.data;
        if (!elementId) return;

        setSteps((currentSteps) => {
          if (currentSteps.includes(elementId)) {
            setBuilderHint(`${elementLabel || elementId} is already part of this funnel.`);
            return currentSteps;
          }
          const next = [...currentSteps, elementId];
          setBuilderHint(`${elementLabel || elementId} added as step ${next.length}.`);
          return next;
        });
      }
    };
    
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function handleClear() {
    setSteps([]);
    setBuilderHint("Start a new custom journey by clicking tracked buttons inside the iframe in the order you care about.");
  }

  return (
    <Box sx={{ position: "relative", display: "flex", overflow: "hidden" }}>
      {/* ── Main builder area ── */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          mr: panelOpen ? `${PANEL_WIDTH + 16}px` : 0
        }}
      >
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              {/* Header */}
              <Stack
                direction={{ xs: "column", lg: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", lg: "center" }}
                spacing={2}
              >
                <Box>
                  <Typography variant="h3" sx={{ fontSize: "1.3rem", mb: 0.5 }}>
                    Conversion funnel builder
                  </Typography>
                  <Typography color="text.secondary">
                    Click elements in the iframe to build a custom journey definition on the right.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    variant="outlined"
                    startIcon={<RefreshCcw size={16} />}
                    onClick={handleClear}
                  >
                    New journey
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={panelOpen ? <ChevronRight size={15} /> : <GitFork size={15} />}
                    onClick={() => setPanelOpen((v) => !v)}
                    sx={{
                      whiteSpace: "nowrap",
                      borderColor: panelOpen ? "primary.main" : undefined,
                      color: panelOpen ? "primary.main" : undefined
                    }}
                  >
                    {panelOpen ? "Hide definition" : "Journey definition"}
                  </Button>
                </Stack>
              </Stack>

              {/* Steps breadcrumb bar */}
              {steps.length > 0 && (
                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                    Building:
                  </Typography>
                  {steps.map((stepId, idx) => {
                    const element = trackedElements.find((item) => item.id === stepId);
                    return (
                      <Stack key={stepId} direction="row" alignItems="center" spacing={0.5}>
                        <Chip
                          icon={<Route size={12} />}
                          label={element?.label ?? stepId}
                          size="small"
                          sx={{ height: 22, fontSize: "0.72rem" }}
                        />
                        {idx < steps.length - 1 && (
                          <ChevronRight size={12} style={{ opacity: 0.4 }} />
                        )}
                      </Stack>
                    );
                  })}
                </Stack>
              )}

              {/* Iframe builder viewport */}
              <Box
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: "8px",
                  border: "1px solid rgba(226, 232, 240, 0.10)",
                  backgroundColor: "#0B1220",
                  "& iframe": { display: "block" }
                }}
              >
                <iframe
                  ref={iframeRef}
                  title="Tracer funnel builder surface"
                  src={hostUrl ? hostUrl : IFRAME_SRC}
                  sandbox="allow-same-origin allow-scripts"
                  style={{ width: "100%", height: 680, border: 0, display: "block" }}
                  onLoad={() => {
                    if (iframeRef.current?.contentWindow) {
                      iframeRef.current.contentWindow.postMessage({ type: "TRACER_START_BUILDER" }, "*");
                    }
                    paintTrackedSteps(iframeRef.current?.contentDocument ?? null, steps);
                  }}
                />
                <Card
                  sx={{
                    position: "absolute",
                    left: 18,
                    bottom: 18,
                    maxWidth: 440,
                    borderColor: "rgba(45,212,255,0.18)"
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
                      Builder guidance
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {builderHint}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* ── Right collapsible panel ── */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          width: PANEL_WIDTH,
          height: "100%",
          transform: panelOpen ? "translateX(0)" : `translateX(${PANEL_WIDTH + 20}px)`,
          transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          zIndex: 10,
          pointerEvents: panelOpen ? "auto" : "none"
        }}
      >
        <Card
          sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            boxShadow: "-8px 0 32px rgba(0,0,0,0.35)",
            border: "1px solid rgba(45, 212, 255, 0.12)",
            backdropFilter: "blur(12px)",
            background: "linear-gradient(180deg, rgba(11,18,32,0.97) 0%, rgba(8,14,26,0.98) 100%)"
          }}
        >
          {/* Panel header */}
          <Box
            sx={{
              px: 2.5,
              py: 2,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  bgcolor: "rgba(45, 212, 255, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "primary.main"
                }}
              >
                <GitFork size={16} />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  Journey definition
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {steps.length === 0 ? "No steps selected" : `${steps.length} step${steps.length > 1 ? "s" : ""} defined`}
                </Typography>
              </Box>
            </Stack>
            <IconButton
                size="small"
                onClick={() => setPanelOpen(false)}
                sx={{
                  color: "text.secondary",
                  "&:hover": { color: "text.primary", bgcolor: "rgba(255,255,255,0.06)" }
                }}
              >
                <ChevronLeft size={18} />
              </IconButton>
          </Box>

          {/* Panel description */}
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              Unique clicked steps become a custom funnel with live drop-off and timing analytics.
            </Typography>
          </Box>

          {/* Scrollable funnel metrics */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              px: 2,
              py: 1.5,
              "&::-webkit-scrollbar": { width: 4 },
              "&::-webkit-scrollbar-thumb": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.1)" }
            }}
          >
            {funnelMetrics.length === 0 ? (
              <Card sx={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.7 }}>
                    Click elements in the iframe to build your custom conversion funnel.
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Stack spacing={1.25}>
                {funnelMetrics.map((metric, index) => (
                  <Stack key={metric.elementId} direction="row" spacing={1.25} alignItems="stretch">
                    {/* Step number + connector */}
                    <Stack alignItems="center" sx={{ minWidth: 36, flexShrink: 0 }}>
                      <Avatar
                        sx={{
                          width: 30,
                          height: 30,
                          fontSize: 12,
                          fontWeight: 700,
                          bgcolor: alpha("#2DD4FF", 0.14),
                          color: "#2DD4FF",
                          border: "1px solid rgba(45,212,255,0.32)"
                        }}
                      >
                        {index + 1}
                      </Avatar>
                      {index < funnelMetrics.length - 1 ? (
                        <Box
                          sx={{
                            width: 2,
                            flex: 1,
                            minHeight: 32,
                            mt: 0.75,
                            backgroundColor: "rgba(226,232,240,0.12)"
                          }}
                        />
                      ) : null}
                    </Stack>

                    {/* Step card */}
                    <Card sx={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
                        <Stack spacing={0.75}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: "0.62rem" }}>
                                Step {index + 1}
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 700, fontSize: "0.875rem" }}
                                noWrap
                              >
                                {metric.label}
                              </Typography>
                            </Box>
                            <Chip
                              label={`${metric.sessionsReached}`}
                              size="small"
                              sx={{ height: 18, fontSize: "0.68rem", flexShrink: 0 }}
                            />
                          </Stack>

                          {metric.dropOffPct !== null ? (
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              <Chip
                                label={`↓ ${metric.dropOffPct}% drop`}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: "0.65rem",
                                  bgcolor: metric.dropOffPct > 50 ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                                  color: metric.dropOffPct > 50 ? "#f87171" : undefined
                                }}
                              />
                              <Chip
                                label={`⏱ ${formatDuration(metric.avgTimeFromPreviousMs)}`}
                                size="small"
                                sx={{ height: 18, fontSize: "0.65rem" }}
                              />
                            </Stack>
                          ) : (
                            <Chip
                              label="Entry step"
                              size="small"
                              sx={{ height: 18, fontSize: "0.65rem", alignSelf: "flex-start" }}
                            />
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>

          {/* Panel footer */}
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              flexShrink: 0
            }}
          >
            <Button
              fullWidth
              size="small"
              variant="outlined"
              startIcon={<RefreshCcw size={13} />}
              onClick={handleClear}
              sx={{ fontSize: "0.75rem" }}
            >
              Clear &amp; restart funnel
            </Button>
          </Box>
        </Card>
      </Box>

      {/* ── Floating re-open tab when panel is closed ── */}
      {!panelOpen && (
          <Box
            onClick={() => setPanelOpen(true)}
            sx={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.5,
              cursor: "pointer",
              bgcolor: "primary.main",
              color: "#000",
              borderRadius: "8px 0 0 8px",
              px: 0.75,
              py: 1.5,
              boxShadow: "-4px 0 16px rgba(45, 212, 255, 0.35)",
              zIndex: 20,
              transition: "all 0.2s",
              "&:hover": {
                px: 1,
                boxShadow: "-6px 0 20px rgba(45, 212, 255, 0.5)"
              }
            }}
          >
            <GitFork size={14} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                fontSize: "0.6rem",
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                letterSpacing: "0.05em"
              }}
            >
              JOURNEY
            </Typography>
            <ChevronLeft size={14} />
          </Box>
      )}
    </Box>
  );
}
