"use client";

import { useEffect, useRef, useState } from "react";
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
import { ChevronLeft, ChevronRight, Layers, Pause, Play, RotateCcw } from "lucide-react";
import type { JourneyCluster } from "@/lib/tracer-store";

const IFRAME_SRC = "/demo-store?embedded=1&replay=1";
const PANEL_WIDTH = 340;
const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDuration(milliseconds: number) {
  if (milliseconds < 1000) return `${milliseconds}ms`;
  const totalSeconds = Math.round(milliseconds / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function FriendlyCursor({ color }: { color: string }) {
  return (
    <svg width="26" height="34" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 3L20.8 18.8H14.6L17.8 30.2L12.4 31.8L9.2 20.4L4 25.6V3Z" fill={color} stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function JourneyPanel() {
  const { data, isLoading } = useSWR("/api/tracer/journeys", fetcher, {
    refreshInterval: 15000,
    fallbackData: { clusters: [] }
  });

  const clusters: JourneyCluster[] = data?.clusters ?? [];

  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [playheadMs, setPlayheadMs] = useState(0);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  // Auto-select first cluster when data arrives
  useEffect(() => {
    if (clusters.length > 0 && !clusters.find((c) => c.id === selectedClusterId)) {
      setSelectedClusterId(clusters[0]?.id ?? null);
    }
  }, [clusters, selectedClusterId]);

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId) ?? clusters[0];
  const replayDurationMs = !selectedCluster
    ? 1000
    : Math.max(1000, ...selectedCluster.streams.map((s) => s.points[s.points.length - 1]?.ts ?? 0));

  useEffect(() => {
    if (!playing || !selectedCluster) return;
    const interval = window.setInterval(() => {
      setPlayheadMs((v) => (v + 180 >= replayDurationMs ? 0 : v + 180));
    }, 120);
    return () => window.clearInterval(interval);
  }, [playing, replayDurationMs, selectedCluster]);

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

  if (!selectedCluster) {
    return (
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h3" sx={{ fontSize: "1.3rem", mb: 1 }}>Journey Replay</Typography>
          <Typography color="text.secondary">
            No session data yet. Install the SDK and interact with your app to generate journey clusters.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const replayProgress = replayDurationMs === 0 ? 0 : Math.min(100, (playheadMs / replayDurationMs) * 100);

  function getPointAt(playhead: number, points: typeof selectedCluster.streams[number]["points"]) {
    if (points.length === 0) return null;
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].ts <= playhead) return points[i];
    }
    return points[0];
  }

  return (
    <Box sx={{ position: "relative", display: "flex", gap: 0, overflow: "hidden" }}>
      <Box sx={{ flex: 1, minWidth: 0, transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)", mr: panelOpen ? `${PANEL_WIDTH + 16}px` : 0 }}>
        <Card>
          <CardContent sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", lg: "center" }} spacing={2}>
                <Box>
                  <Typography variant="h3" sx={{ fontSize: "1.3rem", mb: 0.5 }}>Journey definition</Typography>
                  <Typography color="text.secondary">Multi-cursor overlay groups similar sessions into a single visual summary.</Typography>
                </Box>
                <Button variant="outlined" size="small" startIcon={panelOpen ? <ChevronRight size={15} /> : <Layers size={15} />} onClick={() => setPanelOpen((v) => !v)} sx={{ whiteSpace: "nowrap", borderColor: panelOpen ? "primary.main" : undefined, color: panelOpen ? "primary.main" : undefined }}>
                  {panelOpen ? "Hide clusters" : "Journey clusters"}
                </Button>
              </Stack>

              {selectedCluster && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: selectedCluster.color, flexShrink: 0 }} />
                  <Typography variant="body2" color="text.secondary">Replaying cluster:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedCluster.label}</Typography>
                  <Chip label={`${selectedCluster.sessionCount} sessions`} size="small" />
                </Stack>
              )}

              <Box sx={{ position: "relative", overflow: "hidden", borderRadius: "8px", border: "1px solid rgba(226, 232, 240, 0.10)", backgroundColor: "#0B1220" }}>
                <iframe title="Tracer journey replay surface" src={IFRAME_SRC} sandbox="allow-same-origin allow-scripts" style={{ width: "100%", height: 680, border: 0, display: "block" }} />
                <Box ref={overlayRef} sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {selectedCluster.streams.map((stream) => {
                    const point = getPointAt(playheadMs, stream.points);
                    if (!point) return null;
                    return (
                      <Box key={stream.sessionId} sx={{ position: "absolute", left: `calc(${point.x * 100}% - 8px)`, top: `calc(${point.y * 100}% - 8px)`, transform: "translate(-50%, -50%)", transition: "left 120ms linear, top 120ms linear" }}>
                        <FriendlyCursor color={stream.color} />
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <Card sx={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                <CardContent sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Replay progress</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatDuration(playheadMs)} / {formatDuration(replayDurationMs)}</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={replayProgress} />
                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" startIcon={playing ? <Pause size={16} /> : <Play size={16} />} onClick={() => setPlaying((v) => !v)}>
                        {playing ? "Pause replay" : "Play replay"}
                      </Button>
                      <Button variant="outlined" startIcon={<RotateCcw size={16} />} onClick={() => setPlayheadMs(0)}>Restart</Button>
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
          <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: "rgba(45, 212, 255, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "primary.main" }}>
                <Layers size={16} />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Journey clusters</Typography>
                <Typography variant="caption" color="text.secondary">{clusters.length} behavior groups</Typography>
              </Box>
            </Stack>
            <IconButton size="small" onClick={() => setPanelOpen(false)} sx={{ color: "text.secondary", "&:hover": { color: "text.primary", bgcolor: "rgba(255,255,255,0.06)" } }}>
              <ChevronLeft size={18} />
            </IconButton>
          </Box>

          <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>Select a category to replay how that class of users navigates the app.</Typography>
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5, "&::-webkit-scrollbar": { width: 4 }, "&::-webkit-scrollbar-thumb": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.1)" } }}>
            <Stack spacing={1.25}>
              {clusters.map((cluster) => {
                const isSelected = selectedCluster.id === cluster.id;
                return (
                  <Card key={cluster.id} onClick={() => { setSelectedClusterId(cluster.id); setPlayheadMs(0); setPlaying(true); }} sx={{ cursor: "pointer", position: "relative", border: "1px solid", borderColor: isSelected ? cluster.color : "rgba(255,255,255,0.06)", backgroundColor: isSelected ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)", transition: "all 0.2s", "&:hover": { borderColor: cluster.color, backgroundColor: "rgba(255,255,255,0.05)", transform: "translateY(-1px)", boxShadow: `0 4px 16px ${cluster.color}22` } }}>
                    {isSelected && <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: "4px 0 0 4px", bgcolor: cluster.color }} />}
                    <CardContent sx={{ p: 2, pl: isSelected ? 2.5 : 2 }}>
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: cluster.color, flexShrink: 0 }} />
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.875rem" }} noWrap>{cluster.label}</Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.5 }}>{cluster.description}</Typography>
                          </Box>
                          <Chip label={`${cluster.sessionCount}`} size="small" sx={{ height: 20, fontSize: "0.7rem", bgcolor: isSelected ? `${cluster.color}22` : undefined, color: isSelected ? cluster.color : undefined, borderColor: isSelected ? cluster.color : undefined, flexShrink: 0 }} variant={isSelected ? "outlined" : "filled"} />
                        </Stack>
                        <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          <Chip label={`⏱ ${formatDuration(cluster.avgDurationMs)}`} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
                          <Chip label={`😤 ${cluster.avgFrustrationIndex}`} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          <Box component="span" sx={{ color: "text.disabled" }}>Path: </Box>{cluster.topPath}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>

          <Box sx={{ px: 2.5, py: 1.5, borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary">Click a cluster to switch replay →</Typography>
          </Box>
        </Card>
      </Box>

      {!panelOpen && (
        <Box onClick={() => setPanelOpen(true)} sx={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, cursor: "pointer", bgcolor: "primary.main", color: "#000", borderRadius: "8px 0 0 8px", px: 0.75, py: 1.5, boxShadow: "-4px 0 16px rgba(45, 212, 255, 0.35)", zIndex: 20, transition: "all 0.2s", "&:hover": { px: 1, boxShadow: "-6px 0 20px rgba(45, 212, 255, 0.5)" } }}>
          <Layers size={14} />
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.6rem", writingMode: "vertical-rl", textOrientation: "mixed", letterSpacing: "0.05em" }}>CLUSTERS</Typography>
          <ChevronLeft size={14} />
        </Box>
      )}
    </Box>
  );
}
