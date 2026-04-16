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
import type { ReplaySession } from "@/app/api/tracer/journeys/route";

const IFRAME_SRC = "/demo-store?embedded=1&replay=1";
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

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getPointAt(
  playheadMs: number,
  points: ReplaySession["points"]
): ReplaySession["points"][number] | null {
  if (points.length === 0) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].ts <= playheadMs) return points[i];
  }
  return points[0];
}

function FriendlyCursor({ isClick }: { isClick: boolean }) {
  const color = isClick ? "#2DD4FF" : "#94A3B8";
  return (
    <svg width="26" height="34" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 3L20.8 18.8H14.6L17.8 30.2L12.4 31.8L9.2 20.4L4 25.6V3Z"
        fill={color}
        stroke="white"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function JourneyPanel() {
  const { data, isLoading } = useSWR("/api/tracer/journeys", fetcher, {
    refreshInterval: 15000,
    fallbackData: { sessions: [] },
  });

  const sessions: ReplaySession[] = data?.sessions ?? [];

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);

  // Refs for the iframe (avoids stale closure issues in effects)
  const replayIframeRef = useRef<HTMLIFrameElement | null>(null);
  const scrollResetPendingRef = useRef(false); // sentinel: needs a hard scroll-to-0 on next iframe access

  // ── Auto-select first session when data arrives ──────────────────────────
  useEffect(() => {
    if (sessions.length > 0 && !sessions.find((s) => s.id === selectedSessionId)) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;
  const replayDurationMs = selectedSession?.points.length
    ? Math.max(1000, selectedSession.points[selectedSession.points.length - 1].ts)
    : 1000;

  // ── Iframe scroll lock: inject CSS into frame, block user scroll ──────────
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
      // Immediately reset scroll to top on lock
      doc.documentElement.scrollTop = 0;
      doc.body.scrollTop = 0;
    } catch (_) { /* cross-origin guard */ }
  }, []);

  // ── Hard scroll-reset: called whenever a new session is selected ──────────
  const resetIframeScroll = useCallback(() => {
    const doc = replayIframeRef.current?.contentDocument;
    if (!doc) {
      // iframe not ready yet — mark as pending so the onLoad handler picks it up
      scrollResetPendingRef.current = true;
      return;
    }
    try {
      doc.documentElement.scrollTop = 0;
      doc.body.scrollTop = 0;
      scrollResetPendingRef.current = false;
    } catch (_) { /* cross-origin guard */ }
  }, []);

  // ── Session switch: reset playhead + scroll state synchronously ───────────
  const selectSession = useCallback(
    (id: string) => {
      setSelectedSessionId(id);
      setPlayheadMs(0);
      setPlaying(true);
      // Mark scroll reset as pending — the next scroll-drive effect will apply it
      scrollResetPendingRef.current = true;
      resetIframeScroll();
    },
    [resetIframeScroll]
  );

  // ── Playback timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing || !selectedSession) return;
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
  }, [playing, replayDurationMs, selectedSession]);

  // ── Programmatic scroll: drive iframe scroll from cursor Y position ────────
  useEffect(() => {
    if (!selectedSession) return;
    const doc = replayIframeRef.current?.contentDocument;
    if (!doc) return;

    try {
      // If a reset is pending (new session just selected), enforce it first
      if (scrollResetPendingRef.current) {
        doc.documentElement.scrollTop = 0;
        doc.body.scrollTop = 0;
        scrollResetPendingRef.current = false;
        return;
      }

      const point = getPointAt(playheadMs, selectedSession.points);
      if (!point) return;

      const cursorY = point.y; // 0–1 normalised

      if (cursorY > SCROLL_TRIGGER_Y) {
        // Smoothly scroll so the cursor stays visible
        const pageHeight = doc.documentElement.scrollHeight;
        const target = Math.round(cursorY * pageHeight - IFRAME_HEIGHT * SCROLL_TRIGGER_Y);
        doc.documentElement.scrollTop = Math.max(0, target);
      } else if (cursorY < 0.05) {
        // Cursor back at the top — scroll to top
        doc.documentElement.scrollTop = 0;
      }
    } catch (_) { /* cross-origin guard */ }
  }, [playheadMs, selectedSession]);

  // ── Render ─────────────────────────────────────────────────────────────────

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

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h3" sx={{ fontSize: "1.3rem", mb: 1 }}>
            Journey Replay
          </Typography>
          <Typography color="text.secondary">
            No session data yet. Install the SDK and interact with your app to generate replays.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const currentPoint = selectedSession
    ? getPointAt(playheadMs, selectedSession.points)
    : null;

  const replayProgress =
    replayDurationMs === 0 ? 0 : Math.min(100, (playheadMs / replayDurationMs) * 100);

  return (
    <Box sx={{ position: "relative", display: "flex", gap: 0, overflow: "hidden" }}>
      {/* ── Main replay area ──────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          transition: "margin 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          mr: panelOpen ? `${PANEL_WIDTH + 16}px` : 0,
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
                    Journey replay
                  </Typography>
                  <Typography color="text.secondary">
                    Individual session mouse-path and click replay. Select a session from the panel.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={panelOpen ? <ChevronRight size={15} /> : <Layers size={15} />}
                  onClick={() => setPanelOpen((v) => !v)}
                  sx={{
                    whiteSpace: "nowrap",
                    borderColor: panelOpen ? "primary.main" : undefined,
                    color: panelOpen ? "primary.main" : undefined,
                  }}
                >
                  {panelOpen ? "Hide sessions" : "Sessions"}
                </Button>
              </Stack>

              {/* Active session info strip */}
              {selectedSession && (
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip
                    icon={<MousePointer2 size={13} />}
                    label={selectedSession.userLabel}
                    size="small"
                  />
                  <Chip label={`Route: ${selectedSession.route}`} size="small" />
                  <Chip
                    label={`${selectedSession.clickCount} clicks`}
                    size="small"
                    color={selectedSession.frustrationClicks > 0 ? "warning" : "default"}
                  />
                  {selectedSession.frustrationClicks > 0 && (
                    <Chip
                      label={`😤 ${selectedSession.frustrationClicks} rage clicks`}
                      size="small"
                      color="error"
                    />
                  )}
                  <Chip
                    label={formatTime(selectedSession.startedAt)}
                    size="small"
                    sx={{ ml: "auto" }}
                  />
                </Stack>
              )}

              {/* Iframe + overlay */}
              <Box
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: "8px",
                  border: "1px solid rgba(226, 232, 240, 0.10)",
                  backgroundColor: "#0B1220",
                  height: IFRAME_HEIGHT,
                }}
              >
                <iframe
                  ref={replayIframeRef}
                  key={selectedSessionId ?? "no-session"} /* force remount on session switch */
                  title="Tracer journey replay surface"
                  src={IFRAME_SRC}
                  sandbox="allow-same-origin allow-scripts"
                  scrolling="no"
                  style={{
                    width: "100%",
                    height: IFRAME_HEIGHT,
                    border: 0,
                    display: "block",
                    overflow: "hidden",
                  }}
                  onLoad={() => {
                    lockIframeScroll();
                    // If a reset was pending before load completed, apply it now
                    if (scrollResetPendingRef.current) {
                      resetIframeScroll();
                    }
                  }}
                />

                {/* Transparent interaction blocker */}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 2,
                    cursor: "default",
                    touchAction: "none",
                  }}
                />

                {/* Cursor overlay */}
                {currentPoint && (
                  <Box
                    sx={{
                      position: "absolute",
                      left: `${currentPoint.x * 100}%`,
                      top: `${currentPoint.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      transition: "left 120ms linear, top 120ms linear",
                      zIndex: 3,
                      pointerEvents: "none",
                    }}
                  >
                    <FriendlyCursor isClick={currentPoint.type === "click"} />
                  </Box>
                )}

                {/* Empty state overlay */}
                {!selectedSession && (
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "rgba(8,14,26,0.7)",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <Typography color="text.secondary">Select a session to begin replay</Typography>
                  </Box>
                )}
              </Box>

              {/* Playback controls */}
              <Card sx={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                <CardContent sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        Replay progress
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatDuration(playheadMs)} / {formatDuration(replayDurationMs)}
                      </Typography>
                    </Stack>

                    {/* Clickable scrubber */}
                    <Box
                      sx={{ cursor: "pointer" }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        setPlayheadMs(Math.round(pct * replayDurationMs));
                      }}
                    >
                      <LinearProgress variant="determinate" value={replayProgress} />
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        startIcon={playing ? <Pause size={16} /> : <Play size={16} />}
                        onClick={() => setPlaying((v) => !v)}
                        disabled={!selectedSession}
                      >
                        {playing ? "Pause" : "Play"}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<RotateCcw size={16} />}
                        onClick={() => {
                          setPlayheadMs(0);
                          scrollResetPendingRef.current = true;
                          resetIframeScroll();
                          setPlaying(true);
                        }}
                        disabled={!selectedSession}
                      >
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

      {/* ── Right collapsible sessions panel ─────────────────────────────── */}
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
          pointerEvents: panelOpen ? "auto" : "none",
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
            background:
              "linear-gradient(180deg, rgba(11,18,32,0.97) 0%, rgba(8,14,26,0.98) 100%)",
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
              flexShrink: 0,
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
                  color: "primary.main",
                }}
              >
                <Layers size={16} />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  Sessions
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {sessions.length} recorded
                </Typography>
              </Box>
            </Stack>
            <IconButton
              size="small"
              onClick={() => setPanelOpen(false)}
              sx={{
                color: "text.secondary",
                "&:hover": { color: "text.primary", bgcolor: "rgba(255,255,255,0.06)" },
              }}
            >
              <ChevronLeft size={18} />
            </IconButton>
          </Box>

          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              flexShrink: 0,
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              Click a session to replay its exact mouse path and clicks.
            </Typography>
          </Box>

          {/* Session list */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              px: 2,
              py: 1.5,
              "&::-webkit-scrollbar": { width: 4 },
              "&::-webkit-scrollbar-thumb": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.1)" },
            }}
          >
            <Stack spacing={1}>
              {sessions.map((session) => {
                const isSelected = session.id === selectedSessionId;
                return (
                  <Card
                    key={session.id}
                    onClick={() => selectSession(session.id)}
                    sx={{
                      cursor: "pointer",
                      position: "relative",
                      border: "1px solid",
                      borderColor: isSelected
                        ? "primary.main"
                        : "rgba(255,255,255,0.06)",
                      backgroundColor: isSelected
                        ? "rgba(45,212,255,0.07)"
                        : "rgba(255,255,255,0.02)",
                      transition: "all 0.18s",
                      "&:hover": {
                        borderColor: "primary.main",
                        backgroundColor: "rgba(45,212,255,0.05)",
                        transform: "translateY(-1px)",
                        boxShadow: "0 4px 16px rgba(45,212,255,0.12)",
                      },
                    }}
                  >
                    {isSelected && (
                      <Box
                        sx={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 3,
                          borderRadius: "4px 0 0 4px",
                          bgcolor: "primary.main",
                        }}
                      />
                    )}
                    <CardContent sx={{ p: 1.75, pl: isSelected ? 2.25 : 1.75 }}>
                      <Stack spacing={0.75}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          spacing={1}
                        >
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, fontSize: "0.85rem" }}
                            noWrap
                          >
                            {session.userLabel}
                          </Typography>
                          {session.frustrationClicks > 0 && (
                            <Chip
                              label="😤"
                              size="small"
                              sx={{ height: 18, fontSize: "0.7rem" }}
                            />
                          )}
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block" }}
                        >
                          {formatTime(session.startedAt)} · {formatDuration(session.durationMs)}
                        </Typography>
                        <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                          <Chip
                            label={`${session.clickCount} clicks`}
                            size="small"
                            sx={{ height: 17, fontSize: "0.67rem" }}
                          />
                          <Chip
                            label={`${session.hoverCount} hovers`}
                            size="small"
                            sx={{ height: 17, fontSize: "0.67rem" }}
                          />
                          <Chip
                            label={session.route}
                            size="small"
                            sx={{ height: 17, fontSize: "0.67rem" }}
                          />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>

          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              flexShrink: 0,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Click a session to switch replay →
            </Typography>
          </Box>
        </Card>
      </Box>

      {/* Floating re-open tab */}
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
            "&:hover": { px: 1, boxShadow: "-6px 0 20px rgba(45, 212, 255, 0.5)" },
          }}
        >
          <Layers size={14} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: "0.6rem",
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              letterSpacing: "0.05em",
            }}
          >
            SESSIONS
          </Typography>
          <ChevronLeft size={14} />
        </Box>
      )}
    </Box>
  );
}
