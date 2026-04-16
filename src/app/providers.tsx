"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { tracerTheme } from "../theme/tracerTheme";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={tracerTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
