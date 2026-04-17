"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography
} from "@mui/material";
import { Activity, Flame, Lock, Route, Settings, Store } from "lucide-react";
import { HeatmapPanel } from "./panels/HeatmapPanel";
import { JourneyPanel } from "./panels/JourneyPanel";
import { FunnelPanel } from "./panels/FunnelPanel";
import { SettingsPanel } from "./panels/SettingsPanel";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const panelTabs = [
  { label: "UI Heatmap" },
  { label: "Journey Replay" },
  { label: "Conversion Funnels" },
  { label: "Settings" }
];

interface TracerDashboardProps {
  projectId?: string;
  hostUrl?: string;
}

export function TracerDashboard({ projectId, hostUrl }: TracerDashboardProps = {}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);

  const endpoint = `/api/tracer/overview${projectId ? `?projectId=${projectId}` : ""}`;
  const { data: overview, isLoading } = useSWR(endpoint, fetcher, {
    refreshInterval: 10000,
    fallbackData: {
      totalSessions: 0,
      liveSessions: 0,
      clusterCount: 0,
      trackedElementCount: 6
    }
  });

  const summaryCards = [
    {
      title: "Tracked Sessions",
      value: overview?.totalSessions?.toString() ?? "0",
      hint: `${overview?.liveSessions ?? 0} captured via SDK`,
      icon: Activity
    },
    {
      title: "Replay Clusters",
      value: overview?.clusterCount?.toString() ?? "0",
      hint: "Summary journeys grouped by behavior",
      icon: Route
    },
    {
      title: "Tracked Elements",
      value: overview?.trackedElementCount?.toString() ?? "0",
      hint: "Available across heatmap and funnel panels",
      icon: Flame
    }
  ];

  async function handleLogout() {
    await fetch("/api/tracer/logout", { method: "POST" });
    router.replace("/tracer/login");
    router.refresh();
  }

  return (
    <Box sx={{ minHeight: "100vh", px: { xs: 2, md: 4 }, py: 3 }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", xl: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", xl: "center" }}
          spacing={2}
        >
          <Box>
            <Chip icon={<Lock size={14} />} label="Protected developer workspace" sx={{ mb: 1.5 }} />
            <Typography variant="h2" sx={{ mb: 1 }}>
              Tracer dashboard
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
              Structured analytics for developers: inspect element-level heatmaps, clustered replay
              summaries, and custom conversion funnels — powered by real SDK data from Firestore.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button href="/demo-store" target="_blank" rel="noreferrer" variant="outlined" startIcon={<Store size={16} />}>
              Open Instrumented App
            </Button>
            <Button variant="contained" onClick={handleLogout}>
              Sign out
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "repeat(3, 1fr)" },
            gap: 2
          }}
        >
          {summaryCards.map(({ title, value, hint, icon: Icon }) => (
            <Card key={title}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      {title}
                    </Typography>
                    {isLoading ? (
                      <Skeleton width={60} height={40} />
                    ) : (
                      <Typography variant="h3" sx={{ mt: 0.5 }}>
                        {value}
                      </Typography>
                    )}
                    <Typography color="text.secondary">{hint}</Typography>
                  </Box>
                  <Avatar
                    variant="rounded"
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 1,
                      bgcolor: "rgba(45, 212, 255, 0.14)",
                      color: "primary.main"
                    }}
                  >
                    <Icon size={24} />
                  </Avatar>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Card>
          <CardContent sx={{ p: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(_, nextValue) => setActiveTab(nextValue)}
              variant="scrollable"
              scrollButtons="auto"
            >
              {panelTabs.map((tab) => (
                <Tab key={tab.label} label={tab.label} />
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {activeTab === 0 ? <HeatmapPanel projectId={projectId} hostUrl={hostUrl} /> : null}
        {activeTab === 1 ? <JourneyPanel projectId={projectId} hostUrl={hostUrl} /> : null}
        {activeTab === 2 ? <FunnelPanel projectId={projectId} hostUrl={hostUrl} /> : null}
        {activeTab === 3 ? <SettingsPanel /> : null}
      </Stack>
    </Box>
  );
}
