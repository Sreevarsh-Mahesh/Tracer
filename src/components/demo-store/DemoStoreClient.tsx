"use client";

import { useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography
} from "@mui/material";

const trackedButtonSx = {
  borderRadius: "10px",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  backgroundColor: "#FFFFFF",
  cursor: "pointer",
  textAlign: "left",
  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: "0 16px 36px rgba(15, 23, 42, 0.12)",
    borderColor: "rgba(14, 165, 233, 0.36)"
  },
  "&:focus-visible": {
    outline: "2px solid #0EA5E9",
    outlineOffset: 2
  }
} as const;

/**
 * Dynamically import the SDK to avoid SSR issues.
 * This uses the local tracer-sdk package via the tsconfig path alias in dev,
 * and the published `tracer-sdk` npm package in production.
 */
async function initTracer(embedded: boolean) {
  // Dynamic import to work in both dev (path alias) and prod (npm package)
  const { default: tracer } = await import("tracer-sdk");

  return tracer.init({
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID ?? "tracer-demo",
    apiKey: process.env.NEXT_PUBLIC_TRACER_API_KEY ?? "tk_dev_local",
    endpoint: typeof window !== "undefined"
      ? `${window.location.origin}/api/ingest`
      : "/api/ingest",
    route: "/demo-store",
    userLabel: embedded ? "Embedded dashboard tester" : "Public demo visitor",
    userSegment: embedded ? "Dashboard iframe session" : "Standalone product session",
  });
}

export function DemoStoreClient({ embedded }: { embedded: boolean }) {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    initTracer(embedded).then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => { cleanup?.(); };
  }, [embedded]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #F7FBFF 0%, #EEF6FF 100%)",
        color: "#0F172A",
        p: embedded ? 2 : 3
      }}
    >
      <Stack spacing={embedded ? 2 : 3}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            px: 2.5,
            py: 2,
            borderRadius: "10px",
            backgroundColor: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(15,23,42,0.08)",
            boxShadow: "0 18px 30px rgba(148, 163, 184, 0.18)"
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ color: "#0F172A" }}>
              Tracer Demo Commerce App
            </Typography>
            <Typography sx={{ color: "#475569", fontSize: 14 }}>
              Instrumented with `import tracer from "tracer-sdk"` — all interactions are sent to Firestore via the ingestion API.
            </Typography>
          </Box>
          {!embedded ? (
            <Stack direction="row" spacing={1}>
              <Chip label="SDK active" sx={{ backgroundColor: "#DCFCE7", color: "#15803D" }} />
              <Chip label="Funnel tracked" sx={{ backgroundColor: "#DBEAFE", color: "#1D4ED8" }} />
            </Stack>
          ) : null}
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1.25fr 0.75fr" },
            gap: 3
          }}
        >
          <Stack spacing={3}>
            <Box
              component="button"
              type="button"
              data-tracer-id="home"
              data-tracer-label="Home"
              sx={{
                ...trackedButtonSx,
                p: 3,
                background: "linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)",
                color: "#F8FAFC",
                boxShadow: "0 22px 44px rgba(37, 99, 235, 0.24)"
              }}
            >
              <Stack spacing={2}>
                <Chip
                  label="Tracked step • Home"
                  sx={{ alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.18)", color: "#F8FAFC" }}
                />
                <Typography variant="h4" sx={{ fontSize: "2rem", color: "#F8FAFC", maxWidth: 620 }}>
                  Launch product analytics that developers actually trust.
                </Typography>
                <Typography sx={{ color: "rgba(248,250,252,0.86)", maxWidth: 620 }}>
                  Capture rage clicks, hover intent, replay clusters, and custom funnels without
                  sending the team into dashboard overload.
                </Typography>
              </Stack>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 2
              }}
            >
              <Box
                component="button"
                type="button"
                data-tracer-id="product"
                data-tracer-label="Product"
                sx={{ ...trackedButtonSx, p: 2.5 }}
              >
                <Stack spacing={1.5}>
                  <Chip
                    label="Tracked step • Product"
                    sx={{ alignSelf: "flex-start", backgroundColor: "#E0F2FE", color: "#0369A1" }}
                  />
                  <Typography variant="h6" sx={{ color: "#0F172A" }}>
                    Replay + Journey Intelligence
                  </Typography>
                  <Typography sx={{ color: "#475569", fontSize: 14 }}>
                    Cluster similar user behavior into summary journeys instead of forcing manual replay review.
                  </Typography>
                </Stack>
              </Box>

              <Box
                component="button"
                type="button"
                data-tracer-id="pricing"
                data-tracer-label="Pricing"
                sx={{ ...trackedButtonSx, p: 2.5 }}
              >
                <Stack spacing={1.5}>
                  <Chip
                    label="Tracked step • Pricing"
                    sx={{ alignSelf: "flex-start", backgroundColor: "#FEF3C7", color: "#B45309" }}
                  />
                  <Typography variant="h6" sx={{ color: "#0F172A" }}>
                    Starter Plan
                  </Typography>
                  <Typography sx={{ color: "#475569", fontSize: 14 }}>
                    Compare value, event volume, and replay depth before the user commits.
                  </Typography>
                </Stack>
              </Box>
            </Box>

            <Card sx={{ backgroundColor: "rgba(255,255,255,0.90)", border: "1px solid rgba(15,23,42,0.08)" }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack spacing={2}>
                  <Typography variant="overline" sx={{ color: "#64748B" }}>
                    Recommended Bundle
                  </Typography>
                  <Typography variant="h6" sx={{ color: "#0F172A" }}>
                    Replay Intelligence Suite
                  </Typography>
                  <Typography sx={{ color: "#475569", fontSize: 14 }}>
                    Heatmap overlays, replay clustering, frustration scoring, and custom funnel design in one workspace.
                  </Typography>
                  <Button
                    data-tracer-id="cart"
                    data-tracer-label="Add to Cart"
                    variant="contained"
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Add to cart
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          <Stack spacing={3}>
            <Card sx={{ backgroundColor: "rgba(255,255,255,0.92)", border: "1px solid rgba(15,23,42,0.08)" }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack spacing={2}>
                  <Typography variant="overline" sx={{ color: "#64748B" }}>
                    Checkout
                  </Typography>
                  <Typography variant="h6" sx={{ color: "#0F172A" }}>
                    Finish setup
                  </Typography>
                  <Divider />
                  <Box sx={{ height: 44, borderRadius: 3, backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }} />
                  <Box sx={{ height: 44, borderRadius: 3, backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }} />
                  <Button
                    data-tracer-id="checkout"
                    data-tracer-label="Checkout"
                    variant="contained"
                    sx={{ justifyContent: "flex-start", textAlign: "left" }}
                  >
                    Continue to secure checkout
                  </Button>
                  <Typography sx={{ color: "#475569", fontSize: 13 }}>
                    Repeated clicks here are treated as a friction signal in the dashboard.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Box
              component="button"
              type="button"
              data-tracer-id="purchase"
              data-tracer-label="Purchase"
              sx={{
                ...trackedButtonSx,
                p: 2.5,
                background: "linear-gradient(180deg, #ECFDF5 0%, #DCFCE7 100%)",
                borderColor: "rgba(22,163,74,0.18)"
              }}
            >
              <Stack spacing={1.5}>
                <Chip
                  label="Tracked step • Purchase"
                  sx={{ alignSelf: "flex-start", backgroundColor: "#BBF7D0", color: "#166534" }}
                />
                <Typography variant="h6" sx={{ color: "#14532D" }}>
                  Purchase complete
                </Typography>
                <Typography sx={{ color: "#166534", fontSize: 14 }}>
                  The final conversion marker closes the funnel and contributes to success clusters.
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
