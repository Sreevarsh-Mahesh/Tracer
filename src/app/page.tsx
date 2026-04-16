import Link from "next/link";
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";

export default function HomePage() {
  return (
    <Box sx={{ minHeight: "100vh", px: 3, py: 5, display: "grid", placeItems: "center" }}>
      <Card sx={{ width: "100%", maxWidth: 980 }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={3}>
            <Chip label="Tracer • Demo-ready analytics workspace" sx={{ alignSelf: "flex-start" }} />
            <Typography variant="h2" sx={{ maxWidth: 720 }}>
              Instrument a product surface, then inspect heatmaps, clustered journeys, and funnels in a protected dashboard.
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 780 }}>
              The demo store below imports a lightweight SDK with `import tracer from "tracer"`,
              records mouse movement, clicks, hover durations, and replay paths, then the protected
              `/tracer` dashboard turns that into the three analytics panels you asked for.
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 2
              }}
            >
              <Card sx={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                      Public Instrumented App
                    </Typography>
                    <Typography color="text.secondary">
                      Use the product surface like a real user. Every hover, click, and cursor path
                      is logged by the demo SDK.
                    </Typography>
                    <Button component={Link} href="/demo-store" variant="contained">
                      Open Demo Store
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
              <Card sx={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="h3" sx={{ fontSize: "1.2rem" }}>
                      Protected Developer Dashboard
                    </Typography>
                    <Typography color="text.secondary">
                      Review heatmaps, clustered journeys, and custom funnels behind the `/tracer`
                      auth gate.
                    </Typography>
                    <Button component={Link} href="/tracer" variant="outlined">
                      Open Dashboard Login
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
            <Card sx={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="overline" color="text.secondary">
                  Demo SDK Example
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    mt: 1.5,
                    p: 2,
                    borderRadius: 3,
                    overflowX: "auto",
                    backgroundColor: "rgba(2, 6, 23, 0.8)",
                    border: "1px solid rgba(226, 232, 240, 0.08)",
                    color: "#E2E8F0"
                  }}
                >
                  {`import tracer from "tracer";

tracer.init({
  projectId: "tracer-demo",
  route: "/demo-store",
  userLabel: "Live developer"
});`}
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
