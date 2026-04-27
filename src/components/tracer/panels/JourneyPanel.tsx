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
  Typography,
  ToggleButtonGroup,
  ToggleButton
} from "@mui/material";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Clock,
  Pause,
  Play,
  RotateCcw
} from "lucide-react";
import type { JourneyCluster, TracerSession, TracerEvent, ReplayPoint } from "@/lib/tracer-store";

const IFRAME_SRC = "/?embedded=1&replay=1";
const PANEL_WIDTH = 340;
const IFRAME_HEIGHT = 680;
const SCROLL_TRIGGER_Y = 0.6; // For clusters, start driving scroll when cursor passes below 60% of viewport
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${(s % 60).toString().padStart(2, "0")}s`;
}

function timeAgo(ms: number) {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
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

function getSessionStateAt(playheadMs: number, events: TracerEvent[]) {
  if (!events || events.length === 0) return { x: 0, y: 0, scrollY: 0, isClick: false, hasScroll: false };
  const startTs = events[0].ts;
  
  let lastX = 0;
  let lastY = 0;
  let lastScrollY = 0;
  let isClick = false;
  let hasScroll = false;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.ts - startTs <= playheadMs) {
      if (e.type === "mousemove" || e.type === "click") {
        if (e.x !== undefined) lastX = e.x;
        if (e.y !== undefined) lastY = e.y;
        isClick = e.type === "click";
      } else if (e.type === "scroll") {
        if (e.scrollY !== undefined) lastScrollY = e.scrollY;
        hasScroll = true;
      }
    } else {
      break;
    }
  }
  return { x: lastX, y: lastY, scrollY: lastScrollY, isClick, hasScroll };
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
  const projectQuery = resolvedProjectId ? `?projectId=${resolvedProjectId}` : "";
  
  const { data: clusterData, isLoading: isLoadingClusters } = useSWR(`/api/tracer/journeys${projectQuery}`, fetcher, {
    refreshInterval: 15000,
    fallbackData: { clusters: [] },
  });
  const { data: sessionData, isLoading: isLoadingSessions } = useSWR(`/api/tracer/sessions${projectQuery}`, fetcher, {
    refreshInterval: 15000,
    fallbackData: { sessions: [] },
  });

  const clusters: JourneyCluster[] = clusterData?.clusters ?? [];
  const sessions: TracerSession[] = sessionData?.sessions ?? [];

  const [viewMode, setViewMode] = useState<"clusters" | "sessions">("sessions");
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);

  const replayIframeRef = useRef<HTMLIFrameElement | null>(null);
  const scrollResetPendingRef = useRef(false);

  const selectedCluster = viewMode === "clusters" ? clusters.find((c) => c.id === selectedClusterId) ?? null : null;
  const selectedSession = viewMode === "sessions" ? sessions.find((s) => s.id === selectedSessionId) ?? null : null;
  
  const replayDurationMs = viewMode === "clusters" 
    ? (selectedCluster ? Math.max(1000, ...selectedCluster.streams.map(s => s.points.length ? s.points[s.points.length - 1].ts : 0)) : 1000)
    : (selectedSession ? Math.max(1000, selectedSession.endedAt - selectedSession.startedAt) : 1000);

  // Auto-select based on mode
  useEffect(() => {
    if (viewMode === "clusters" && clusters.length > 0 && !clusters.find((c) => c.id === selectedClusterId)) {
      setSelectedClusterId(clusters[0].id);
    }
    if (viewMode === "sessions" && sessions.length > 0 && !sessions.find((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [viewMode, clusters, sessions, selectedClusterId, selectedSessionId]);

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

  const selectItem = useCallback(
    (id: string) => {
      if (viewMode === "clusters") setSelectedClusterId(id);
      else setSelectedSessionId(id);
      setPlayheadMs(0);
      setPlaying(true);
      scrollResetPendingRef.current = true;
      resetIframeScroll();
    },
    [viewMode, resetIframeScroll]
  );

  useEffect(() => {
    if (!playing) return;
    if (viewMode === "clusters" && !selectedCluster) return;
    if (viewMode === "sessions" && !selectedSession) return;

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
  }, [playing, replayDurationMs, selectedCluster, selectedSession, viewMode]);

  // Handle iframe scroll updates
  useEffect(() => {
    const doc = replayIframeRef.current?.contentDocument;
    if (!doc) return;

    try {
      if (scrollResetPendingRef.current) {
        doc.documentElement.scrollTop = 0;
        doc.body.scrollTop = 0;
        scrollResetPendingRef.current = false;
        return;
      }

      if (viewMode === "clusters" && selectedCluster && selectedCluster.streams.length > 0) {
        // Drive scroll using the first stream as the "lead" cursor y position
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
      } else if (viewMode === "sessions" && selectedSession) {
        const state = getSessionStateAt(playheadMs, selectedSession.events);
        if (state.hasScroll) {
          // Drive exact scroll position
          doc.documentElement.scrollTop = state.scrollY;
        } else {
          // Fallback to cursor-driven scroll if scroll events missing
          if (state.y > SCROLL_TRIGGER_Y) {
            const pageHeight = doc.documentElement.scrollHeight;
            const target = Math.round(state.y * pageHeight - IFRAME_HEIGHT * SCROLL_TRIGGER_Y);
            doc.documentElement.scrollTop = Math.max(0, target);
          } else if (state.y < 0.05) {
            doc.documentElement.scrollTop = 0;
          }
        }
      }
    } catch (_) { /* cross-origin guard */ }
  }, [playheadMs, selectedCluster, selectedSession, viewMode]);

  if (isLoadingClusters || isLoadingSessions) {
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

  const activeStreams = viewMode === "clusters" && selectedCluster
    ? selectedCluster.streams.map(stream => ({
        color: stream.color,
        point: getPointAt(playheadMs, stream.points)
      }))
    : [];
    
  const sessionState = viewMode === "sessions" && selectedSession
    ? getSessionStateAt(playheadMs, selectedSession.events)
    : null;

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
                    {viewMode === "clusters" ? "Clustered Journey Replay" : "Individual Session Replay"}
                  </Typography>
                  <Typography color="text.secondary">
                    {viewMode === "clusters" 
                      ? "View summary playback showing aggregate mouse paths and behavior across matching sessions."
                      : "Watch full length replays of individual users exactly as they interacted with your app."}
                  </Typography>
                </Box>
                <Button variant="outlined" size="small" startIcon={panelOpen ? <ChevronRight size={15} /> : (viewMode === "clusters" ? <Layers size={15} /> : <Clock size={15} />)} onClick={() => setPanelOpen((v) => !v)} sx={{ whiteSpace: "nowrap", borderColor: panelOpen ? "primary.main" : undefined, color: panelOpen ? "primary.main" : undefined }}>
                  {panelOpen ? `Hide ${viewMode}` : (viewMode === "clusters" ? "Clusters" : "Sessions")}
                </Button>
              </Stack>

              {viewMode === "clusters" && selectedCluster && (
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip icon={<Layers size={13} />} label={selectedCluster.label} size="small" sx={{ borderColor: selectedCluster.color, color: selectedCluster.color, borderWidth: 1, borderStyle: "solid" }} />
                  <Chip label={`${selectedCluster.sessionCount} sessions included`} size="small" />
                  <Chip label={`Avg Duration: ${formatDuration(selectedCluster.avgDurationMs)}`} size="small" />
                </Stack>
              )}
              
              {viewMode === "sessions" && selectedSession && (
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip icon={<Clock size={13} />} label={`${timeAgo(selectedSession.startedAt)}`} size="small" sx={{ borderColor: "#2DD4FF", color: "#2DD4FF", borderWidth: 1, borderStyle: "solid" }} />
                  <Chip label={`ID: ${selectedSession.id.slice(0, 8)}`} size="small" />
                  <Chip label={`Duration: ${formatDuration(selectedSession.endedAt - selectedSession.startedAt)}`} size="small" />
                </Stack>
              )}

              <Box sx={{ position: "relative", overflow: "hidden", borderRadius: "8px", border: "1px solid rgba(226, 232, 240, 0.10)", backgroundColor: "#0B1220", height: IFRAME_HEIGHT }}>
                <iframe
                  ref={replayIframeRef}
                  key={(viewMode === "clusters" ? selectedClusterId : selectedSessionId) ?? "no-session"}
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

                {/* Cluster multiple cursors */}
                {viewMode === "clusters" && activeStreams.map((stream, idx) => stream.point && (
                  <Box
                    key={idx}
                    sx={{
                      position: "absolute", left: `${stream.point.x * 100}%`, top: `${stream.point.y * 100}%`,
                      transform: "translate(-50%, -50%)", transition: "left 120ms linear, top 120ms linear", zIndex: 3, pointerEvents: "none",
                    }}
                  >
                    <FriendlyCursor isClick={stream.point.type === "click"} color={stream.color} />
                  </Box>
                ))}
                
                {/* Individual session single cursor */}
                {viewMode === "sessions" && sessionState && (
                  <Box
                    sx={{
                      position: "absolute", left: `${sessionState.x * 100}%`, top: `${sessionState.y * 100}%`,
                      transform: "translate(-50%, -50%)", transition: "left 120ms linear, top 120ms linear", zIndex: 3, pointerEvents: "none",
                    }}
                  >
                    <FriendlyCursor isClick={sessionState.isClick} color="#2DD4FF" />
                  </Box>
                )}

                {((viewMode === "clusters" && !selectedCluster) || (viewMode === "sessions" && !selectedSession)) && (
                  <Box sx={{ position: "absolute", inset: 0, zIndex: 4, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(8,14,26,0.7)", backdropFilter: "blur(4px)" }}>
                    <Typography color="text.secondary">Select a {viewMode === "clusters" ? "cluster" : "session"} to begin playback</Typography>
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
                      <Button variant="contained" startIcon={playing ? <Pause size={16} /> : <Play size={16} />} onClick={() => setPlaying((v) => !v)} disabled={(viewMode === "clusters" && !selectedCluster) || (viewMode === "sessions" && !selectedSession)}>
                        {playing ? "Pause" : "Play"}
                      </Button>
                      <Button variant="outlined" startIcon={<RotateCcw size={16} />} onClick={() => { setPlayheadMs(0); scrollResetPendingRef.current = true; resetIframeScroll(); setPlaying(true); }} disabled={(viewMode === "clusters" && !selectedCluster) || (viewMode === "sessions" && !selectedSession)}>
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

      {/* Right collapsible panel */}
      <Box sx={{ position: "absolute", top: 0, right: 0, width: PANEL_WIDTH, height: "100%", transform: panelOpen ? "translateX(0)" : `translateX(${PANEL_WIDTH + 20}px)`, transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)", display: "flex", flexDirection: "column", zIndex: 10, pointerEvents: panelOpen ? "auto" : "none" }}>
        <Card sx={{ height: "100%", display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.35)", border: "1px solid rgba(45, 212, 255, 0.12)", backdropFilter: "blur(12px)", background: "linear-gradient(180deg, rgba(11,18,32,0.97) 0%, rgba(8,14,26,0.98) 100%)" }}>
          
          <Box sx={{ px: 2, pt: 2, pb: 1, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
               <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Playback List</Typography>
               <IconButton size="small" onClick={() => setPanelOpen(false)} sx={{ color: "text.secondary", "&:hover": { color: "text.primary", bgcolor: "rgba(255,255,255,0.06)" } }}>
                 <ChevronLeft size={18} />
               </IconButton>
            </Stack>
            <ToggleButtonGroup
              color="primary"
              value={viewMode}
              exclusive
              onChange={(_, next) => { if (next) setViewMode(next); }}
              aria-label="View Mode"
              fullWidth
              size="small"
              sx={{ bgcolor: "rgba(0,0,0,0.2)" }}
            >
              <ToggleButton value="sessions" sx={{ py: 0.5, fontSize: "0.75rem", textTransform: "none" }}><Clock size={14} style={{ marginRight: 6 }}/> By Time</ToggleButton>
              <ToggleButton value="clusters" sx={{ py: 0.5, fontSize: "0.75rem", textTransform: "none" }}><Layers size={14} style={{ marginRight: 6 }}/> By Cluster</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          
          <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5, "&::-webkit-scrollbar": { width: 4 }, "&::-webkit-scrollbar-thumb": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.1)" } }}>
            <Stack spacing={1}>
              {viewMode === "clusters" && clusters.length === 0 && <Typography variant="body2" color="text.secondary">No clusters found.</Typography>}
              {viewMode === "sessions" && sessions.length === 0 && <Typography variant="body2" color="text.secondary">No sessions found.</Typography>}
              
              {/* CLUSTERS VIEW */}
              {viewMode === "clusters" && clusters.map((cluster) => {
                const isSelected = cluster.id === selectedClusterId;
                return (
                  <Card
                    key={cluster.id}
                    onClick={() => selectItem(cluster.id)}
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
                          <Chip label={`${cluster.sessionCount}`} size="small" sx={{ height: 20, fontSize: "0.7rem", bgcolor: isSelected ? `${cluster.color}22` : undefined, color: isSelected ? cluster.color : undefined, borderColor: isSelected ? cluster.color : undefined, flexShrink: 0 }} variant={isSelected ? "outlined" : "filled"} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{cluster.description}</Typography>
                        <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          <Chip label={`⏱ ${formatDuration(cluster.avgDurationMs)}`} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
              
              {/* SESSIONS VIEW */}
              {viewMode === "sessions" && sessions.map((session) => {
                const isSelected = session.id === selectedSessionId;
                const duration = session.endedAt - session.startedAt;
                return (
                  <Card
                    key={session.id}
                    onClick={() => selectItem(session.id)}
                    sx={{
                      cursor: "pointer", position: "relative", border: "1px solid",
                      borderColor: isSelected ? "#2DD4FF" : "rgba(255,255,255,0.06)",
                      backgroundColor: isSelected ? `rgba(45,212,255,0.05)` : "rgba(255,255,255,0.02)",
                      transition: "all 0.18s",
                      "&:hover": { borderColor: "#2DD4FF", transform: "translateY(-1px)" }
                    }}
                  >
                    {isSelected && <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "4px 0 0 4px", bgcolor: "#2DD4FF" }} />}
                    <CardContent sx={{ p: 1.5, pl: isSelected ? 2 : 1.5 }}>
                      <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem", color: isSelected ? "#2DD4FF" : "white" }}>
                            {timeAgo(session.startedAt)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{formatDuration(duration)}</Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontFamily: "monospace" }}>
                          ID: {session.id.slice(0, 8)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          Events: {session.events.length}
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
          {viewMode === "clusters" ? <Layers size={14} /> : <Clock size={14} />}
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.6rem", writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "0.05em" }}>{viewMode === "clusters" ? "CLUSTERS" : "SESSIONS"}</Typography>
          <ChevronLeft size={14} />
        </Box>
      )}
    </Box>
  );
}
