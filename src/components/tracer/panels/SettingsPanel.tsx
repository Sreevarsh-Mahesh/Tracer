"use client";

import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import { Code2, Key, Package, Server } from "lucide-react";

export function SettingsPanel() {
  const apiKey = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_TRACER_API_KEY_DISPLAY ?? "tk_live_••••••••")
    : "";
  const endpoint = typeof window !== "undefined"
    ? `${window.location.origin}/api/ingest`
    : "/api/ingest";
  const projectId = process.env.NEXT_PUBLIC_PROJECT_ID ?? "tracer-demo";

  return (
    <Stack spacing={2.5}>
      {/* SDK Installation */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 36, height: 36, borderRadius: 1,
                  bgcolor: "rgba(45, 212, 255, 0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "primary.main"
                }}
              >
                <Package size={18} />
              </Box>
              <Box>
                <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                  SDK Installation
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Install the Tracer SDK into any web project
                </Typography>
              </Box>
            </Stack>

            <CodeBlock
              label="1. Install the package"
              code="npm install tracer-sdk"
            />

            <CodeBlock
              label="2. Initialize in your app"
              code={`import tracer from 'tracer-sdk';

tracer.init({
  projectId: '${projectId}',
  apiKey: '${apiKey}',
  endpoint: '${endpoint}'
});`}
            />

            <CodeBlock
              label="3. Add data attributes to trackable elements"
              code={`<button data-tracer-id="signup" data-tracer-label="Sign Up">
  Get Started
</button>`}
              language="html"
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 36, height: 36, borderRadius: 1,
                  bgcolor: "rgba(45, 212, 255, 0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "primary.main"
                }}
              >
                <Key size={18} />
              </Box>
              <Box>
                <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                  Project Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your current project credentials
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <Stack spacing={1.5}>
              <ConfigRow label="Project ID" value={projectId} />
              <ConfigRow label="API Key" value={apiKey} />
              <ConfigRow label="Ingestion Endpoint" value={endpoint} />
              <ConfigRow label="Dashboard Password" value="Set via TRACER_DEMO_PASSWORD env" />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Architecture */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 36, height: 36, borderRadius: 1,
                  bgcolor: "rgba(45, 212, 255, 0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "primary.main"
                }}
              >
                <Server size={18} />
              </Box>
              <Box>
                <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                  Architecture
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  How data flows through the system
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <Stack spacing={1} sx={{ pl: 1 }}>
              <FlowStep step="1" label="SDK captures" description="Clicks, hovers, mouse moves, impressions on [data-tracer-id] elements" />
              <FlowStep step="2" label="Batched HTTP" description="Events are queued and flushed every 5s via POST /api/ingest" />
              <FlowStep step="3" label="Pub/Sub → Datastore" description="Events are published to Pub/Sub, processed by a Cloud Function, and stored in Datastore + GCS" />
              <FlowStep step="4" label="Dashboard" description="API routes query Datastore, compute metrics, and serve to this UI" />
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function CodeBlock({ label, code, language }: { label: string; code: string; language?: string }) {
  return (
    <Box>
      <Chip label={label} size="small" sx={{ mb: 1 }} />
      <Box
        component="pre"
        sx={{
          m: 0, p: 2, borderRadius: 2, overflowX: "auto",
          backgroundColor: "rgba(2, 6, 23, 0.8)",
          border: "1px solid rgba(226, 232, 240, 0.08)",
          color: "#E2E8F0", fontSize: "0.82rem", lineHeight: 1.6
        }}
      >
        <code>{code}</code>
      </Box>
    </Box>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: "monospace", fontWeight: 600,
          bgcolor: "rgba(45,212,255,0.06)", px: 1.5, py: 0.5,
          borderRadius: 1, border: "1px solid rgba(45,212,255,0.12)",
          maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis"
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function FlowStep({ step, label, description }: { step: string; label: string; description: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box
        sx={{
          width: 24, height: 24, borderRadius: "50%",
          bgcolor: "rgba(45,212,255,0.14)", color: "primary.main",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.7rem", fontWeight: 700, flexShrink: 0, mt: 0.25
        }}
      >
        {step}
      </Box>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{description}</Typography>
      </Box>
    </Stack>
  );
}
