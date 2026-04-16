"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography
} from "@mui/material";

export function TracerLoginForm({ nextRoute }: { nextRoute: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/tracer/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    setSubmitting(false);

    if (!response.ok) {
      setError("The developer key was rejected. For the local demo, use the configured password.");
      return;
    }

    router.push(nextRoute);
    router.refresh();
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 3 }}>
      <Card sx={{ width: "100%", maxWidth: 520 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
            <Typography variant="h2" sx={{ fontSize: "2rem" }}>
              Developer dashboard access
            </Typography>
            <Typography color="text.secondary">
              This route is protected separately from the public product surface. The local demo
              password defaults to `tracer-demo` unless `TRACER_DEMO_PASSWORD` is set.
            </Typography>
            <TextField
              type="password"
              label="Developer key"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              fullWidth
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Checking access..." : "Unlock /tracer"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
