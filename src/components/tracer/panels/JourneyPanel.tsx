"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useSWR from "swr";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Skeleton,
  Stack,
  Typography
} from "@mui/material";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  MousePointer2,
  Pause,
  Play,
  RotateCcw
} from "lucide-react";
import type { JourneyCluster, ReplayPoint } from "@/lib/tracer-store";

const IFRAME_SRC = "/?embedded=1&replay=1";
const PANEL_WIDTH = 340;
const IFRAME_HEIGHT = 680;
const SCROLL_TRIGGER_Y = 0.6; // start driving scroll when cursor passes below 60% of viewport
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${(s % 60).toString().padStart(2, "0")}s`;
}

function getPointAt(
  playheadMs: number,
  points: ReplayPoint[]
): ReplayPoint | null {
  if (points.length === 0) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].ts <= playheadMs) return points[i];
  }
  return points[0];
}

function FriendlyCursor({ isClick, color = "#94A3B8" }: { isClick: boolean, color?: string }) {
  const fillColor = isClick ? "#FFFFFF" : color;
  return (
    <svg width="26" height="34" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg" style={{
      transformOrigin: "top left",
      transform: isClick ? "scale(0.85)" : "scale(1)",
      transition: "transform 0.1s"
    }}>
      <path
        d="M5 3L20.8 18.8H14.6L17.8 30.2L12.4 31.8L9.2 20.4L4 25.6V3Z"
        fill={fillColor}
        stroke={isClick ? color : "white"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function JourneyPanel({ projectId, hostUrl }: { projectId?: string | null; hostUrl?: string | null } = {}) {
  const resolvedProjectId = projectId || process.env.NEXT_PUBLIC_PROJECT_ID || null;
  const endpoint = `/api/tracer/journeys${resolvedProjectId ? `?projectId=${resolvedProjectId}` : ""}`;
  const { data, isLoading } = useSWR(endpoint, fetcher, {
    refreshInterval: 15000,
    fallbackData: { clusters: [] },
  });

  const clusters: JourneyCluster[] = data?.clusters ?? [];

  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);

  // Refs for the iframe (avoids stale closure issues in effects)
  const replayIframeRef = useRef<HTMLIFrameElement | null>(null);
  const scrollResetPendingRef = useRef(false);

  // ── Auto-select first cluster when data arrives ──────────────────────────
  useEffect(() => {
    if (clusters.length > 0 && !clusters.find((c) => c.id === selectedClusterId)) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId) ?? null;
  
  // Max duration among all streams to define replay length
  const replayDurationMs = selectedCluster
    ? Math.max(1000, ...selectedCluster.streams.map(s => s.points.length ? s.points[s.points.length - 1].ts : 0))
    : 1000;

  const lockIframeScroll = useCallback(() => {
    const doc = replayIframeRef.current?.contentDocument;
    if (!doc) return;
    try {
      if (!doc.getElementById("__tracer_scroll_lock__")) {
        const style = doc.createElement("style");
        style.id = "__tracer_scroll_lock__";
        style.textContent = "html,body{overflow:hidden!important;pointer-events:none!important;}";
        doc.head?.appendChild(style);
      }
      doc.documentElement.scrollTop = 0;
      doc.body.scrollTop = 0;
    } catch (_) { /* cross-origin guard */ }
  }, []);

  const resetIframeScroll = useCallback(() => {
    const doc = replayIframeRef.current?.contentDocument;
    if (!doc) {
      scrollResetPendingRef.current = true;
      return;
    }
    try {
      doc.documentElement.scrollTop = 0;
      doc.body.scrollTop = 0;
      scrollResetPendingRef.current = false;
    } catch (_) { /* cross-origin guard */ }
  }, []);

  const selectCluster = useCallback(
    (id: string) => {
      setSelectedClusterId(id);
      setPlayheadMs(0);
      setPlaying(true);
      scrollResetPendingRef.current = true;
      resetIframeScroll();
    },
    [resetIframeScroll]
  );

  useEffect(() => {
    if (!playing || !selectedCluster) return;
    const interval = window.setInterval(() => {
      setPlayheadMs((v) => {
        const next = v + 180;
        if (next >= replayDurationMs) {
          setPlaying(false);
          return replayDurationMs;
        }
        return next;
      });
    }, 120);
    return () => window.clearInterval(interval);
  }, [playing, replayDurationMs, selectedCluster]);

  useEffect(() => {
    if (!selectedCluster || selectedCluster.streams.length === 0) return;
    const doc = replayIframeRef.current?.contentDocument;
    if (!doc) return;

    try {
      if (scrollResetPendingRef.current) {
        doc.documentElement.scrollTop = 0;
        doc.body.scrollTop = 0;
        scrollResetPendingRef.current = false;
        return;
      }

      // Drive scroll using the first stream as the "lead"
      const point = getPointAt(playheadMs, selectedCluster.streams[0].points);
      if (!point) return;

      const cursorY = point.y; 

      if (cursorY > SCROLL_TRIGGER_Y) {
        const pageHeight = doc.documentElement.scrollHeight;
        const target = Math.round(cursorY * pageHeight - IFRAME_HEIGHT * SCROLL_TRIGGER_Y);
        doc.documentElement.scrollTop = Math.max(0, target);
      } else if (cursorY < 0.05) {
        doc.documentElement.scrollTop = 0;
      }
    } catch (_) { /* cross-origin guard */ }
  }, [playheadMs, selectedCluster]);

  if (isLoading) {
    return (
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={400} />
            <Skeleton variant="rounded" height={60} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (clusters.length === 0) {
    return (
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h3" sx={{ fontSize: "1.3rem", mb: 1 }}>
            Journey Replay
          </Typography>
          <Typography color="text.secondary">
            No session data yet. Install the SDK and interact with your app to generate cluster replays.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const activeStreams = selectedCluster
    ? selectedCluster.streams.map(stream => ({
        color: stream.color,
        point: getPointAt(playheadMs, stream.points)
      }))
    : [];

  const replayProgress = replayDurationMs === 0 ? 0 : Math.min(100, (playheadMs / replayDurationMs) * 100);

  return (
    <Box sx={{ position: "relative", display: "flex", gap: 0, overflow: "hidden" }}>
      <Box sx={{ flex: 1, minWidth: 0, transition: "margin 0.35s cubic-bezier(0.4, 0, 0.2, 1)", mr: panelOpen ? `${PANEL_WIDTH + 16}px` : 0 }}>
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", lg: "center" }} spacing={2}>
                <Box>
                  <Typography variant="h3" sx={{ fontSize: "1.3rem", mb: 0.5 }}>
                    Clustered Journey Replay
                  </Typography>
                  <Typography color="text.secondary">
                    View summary playback showing aggregate mouse paths and behavior across matching sessions.
                  </Typography>
                </Box>
                <Button variant="outlined" size="small" startIcon={panelOpen ? <ChevronRight size={15} /> : <Layers size={15} />} onClick={() => setPanelOpen((v) => !v)} sx={{ whiteSpace: "nowrap", borderColor: panelOpen ? "primary.main" : undefined, color: panelOpen ? "primary.main" : undefined }}>
                  {panelOpen ? "Hide clusters" : "Clusters"}
                </Button>
              </Stack>

              {selectedCluster && (
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip icon={<Layers size={13} />} label={selectedCluster.label} size="small" sx={{ borderColor: selectedCluster.color, color: selectedCluster.color, borderWidth: 1, borderStyle: "solid" }} />
                  <Chip label={`${selectedCluster.sessionCount} sessions included`} size="small" />
                  <Chip label={`Avg Duration: ${formatDuration(selectedCluster.avgDurationMs)}`} size="small" />
                  {selectedCluster.avgFrustrationIndex > 30 && (
                     <Chip label={`😤 High Friction (${selectedCluster.avgFrustrationIndex} idx)`} size="small" color="error" />
                  )}
                </Stack>
              )}

              <Box sx={{ position: "relative", overflow: "hidden", borderRadius: "8px", border: "1px solid rgba(226, 232, 240, 0.10)", backgroundColor: "#0B1220", height: IFRAME_HEIGHT }}>
                <iframe
                  ref={replayIframeRef}
                  key={selectedClusterId ?? "no-session"}
                  title="Tracer journey replay surface"
                  src={hostUrl ? `${hostUrl}/` : IFRAME_SRC}
                  sandbox="allow-same-origin allow-scripts"
                  style={{ width: "100%", height: IFRAME_HEIGHT, border: 0, display: "block", overflow: "hidden" }}
                  onLoad={() => {
                    lockIframeScroll();
                    if (scrollResetPendingRef.current) resetIframeScroll();
                  }}
                />

                <Box sx={{ position: "absolute", inset: 0, zIndex: 2, cursor: "default", touchAction: "none" }} />

                {activeStreams.map((stream, idx) => stream.point && (
                  <Box
                    key={idx}
                    sx={{
                      position: "absolute",
                      left: `${stream.point.x * 100}%`,
                      top: `${stream.point.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      transition: "left 120ms linear, top 120ms linear",
                      zIndex: 3,
                      pointerEvents: "none",
                    }}
                  >
                    <FriendlyCursor isClick={stream.point.type === "click"} color={stream.color} />
                  </Box>
                ))}

                {!selectedCluster && (
                  <Box sx={{ position: "absolute", inset: 0, zIndex: 4, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(8,14,26,0.7)", backdropFilter: "blur(4px)" }}>
                    <Typography color="text.secondary">Select a behavior cluster to begin playback</Typography>
                  </Box>
                )}
              </Box>

              <Card sx={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                <CardContent sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Replay timeline</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatDuration(playheadMs)} / {formatDuration(replayDurationMs)}</Typography>
                    </Stack>
                    <Box sx={{ cursor: "pointer" }} onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); setPlayheadMs(Math.round(pct * replayDurationMs)); }}>
                      <LinearProgress variant="determinate" value={replayProgress} />
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" startIcon={playing ? <Pause size={16} /> : <Play size={16} />} onClick={() => setPlaying((v) => !v)} disabled={!selectedCluster}>
                        {playing ? "Pause" : "Play"}
                      </Button>
                      <Button variant="outlined" startIcon={<RotateCcw size={16} />} onClick={() => { setPlayheadMs(0); scrollResetPendingRef.current = true; resetIframeScroll(); setPlaying(true); }} disabled={!selectedCluster}>
                        Restart
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Right collapsible Clusters panel */}
      <Box sx={{ position: "absolute", top: 0, right: 0, width: PANEL_WIDTH, height: "100%", transform: panelOpen ? "translateX(0)" : `translateX(${PANEL_WIDTH + 20}px)`, transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)", display: "flex", flexDirection: "column", zIndex: 10, pointerEvents: panelOpen ? "auto" : "none" }}>
        <Card sx={{ height: "100%", display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.35)", border: "1px solid rgba(45, 212, 255, 0.12)", backdropFilter: "blur(12px)", background: "linear-gradient(180deg, rgba(11,18,32,0.97) 0%, rgba(8,14,26,0.98) 100%)" }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: "rgba(45, 212, 255, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "primary.main" }}>
                <Layers size={16} />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Behavior Clusters</Typography>
                <Typography variant="caption" color="text.secondary">{clusters.length} groups found</Typography>
              </Box>
            </Stack>
            <IconButton size="small" onClick={() => setPanelOpen(false)} sx={{ color: "text.secondary", "&:hover": { color: "text.primary", bgcolor: "rgba(255,255,255,0.06)" } }}>
              <ChevronLeft size={18} />
            </IconButton>
          </Box>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>Select a user cluster to watch its summary replay.</Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5, "&::-webkit-scrollbar": { width: 4 }, "&::-webkit-scrollbar-thumb": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.1)" } }}>
            <Stack spacing={1}>
              {clusters.map((cluster) => {
                const isSelected = cluster.id === selectedClusterId;
                return (
                  <Card
                    key={cluster.id}
                    onClick={() => selectCluster(cluster.id)}
                    sx={{
                      cursor: "pointer", position: "relative", border: "1px solid",
                      borderColor: isSelected ? cluster.color : "rgba(255,255,255,0.06)",
                      backgroundColor: isSelected ? `${cluster.color}15` : "rgba(255,255,255,0.02)",
                      transition: "all 0.18s",
                      "&:hover": { borderColor: cluster.color, transform: "translateY(-1px)" }
                    }}
                  >
                    {isSelected && <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "4px 0 0 4px", bgcolor: cluster.color }} />}
                    <CardContent sx={{ p: 1.75, pl: isSelected ? 2.25 : 1.75 }}>
                      <Stack spacing={0.75}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem", color: cluster.color, mb: 0.25 }}>
                              {cluster.label}
                            </Typography>
                          </Box>
                          <Chip
                            label={`${cluster.sessionCount}`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: "0.7rem",
                              bgcolor: isSelected ? `${cluster.color}22` : undefined,
                              color: isSelected ? cluster.color : undefined,
                              borderColor: isSelected ? cluster.color : undefined,
                              flexShrink: 0
                            }}
                            variant={isSelected ? "outlined" : "filled"}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{cluster.description}</Typography>
                        <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          <Chip label={`⏱ ${formatDuration(cluster.avgDurationMs)}`} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
                          <Chip label={`😤 ${cluster.avgFrustrationIndex}`} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          <Box component="span" sx={{ color: "text.disabled" }}>Path: </Box>
                          {cluster.topPath}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        </Card>
      </Box>

      {!panelOpen && (
        <Box onClick={() => setPanelOpen(true)} sx={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, cursor: "pointer", bgcolor: "primary.main", color: "#000", borderRadius: "8px 0 0 8px", px: 0.75, py: 1.5, zIndex: 20 }}>
          <Layers size={14} />
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.6rem", writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "0.05em" }}>CLUSTERS</Typography>
          <ChevronLeft size={14} />
        </Box>
      )}
    </Box>
  );
}
