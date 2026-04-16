import { alpha, createTheme } from "@mui/material/styles";

const colors = {
  bg: "#05070B",
  panel: "rgba(10, 14, 24, 0.72)",
  panelStrong: "rgba(13, 18, 30, 0.88)",
  line: "rgba(226, 232, 240, 0.12)",
  lineActive: "rgba(45, 212, 255, 0.38)",
  text: "#F8FAFC",
  subtext: "#CBD5E1",
  blue: "#2DD4FF",
  mint: "#7CF7C2",
  amber: "#FFB84D",
  danger: "#FB7185"
};

const glassPanel = {
  backgroundImage: "none",
  backgroundColor: colors.panel,
  border: `1px solid ${colors.line}`,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)"
};

export const tracerTheme = createTheme({
  spacing: 8,
  shape: { borderRadius: 4 },
  palette: {
    mode: "dark",
    primary: { main: colors.blue, contrastText: "#031018" },
    secondary: { main: colors.mint },
    warning: { main: colors.amber },
    error: { main: colors.danger },
    background: { default: colors.bg, paper: colors.panelStrong },
    text: { primary: colors.text, secondary: colors.subtext },
    divider: colors.line
  },
  typography: {
    fontFamily: '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", "Avenir Next", sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.04em"
    },
    h2: {
      fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", "Avenir Next", sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.03em"
    },
    h3: {
      fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", "Avenir Next", sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.02em"
    },
    button: { fontWeight: 700, textTransform: "none" },
    overline: { letterSpacing: "0.16em", fontWeight: 700 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body": {
          minHeight: "100%"
        },
        body: {
          background:
            "radial-gradient(circle at 12% 15%, rgba(45,212,255,.18), transparent 22%), radial-gradient(circle at 86% 10%, rgba(255,184,77,.10), transparent 18%), linear-gradient(180deg, #020407 0%, #05070B 100%)",
          color: colors.text
        },
        "body::before": {
          content: '""',
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,.22), transparent 85%)"
        },
        "*": {
          boxSizing: "border-box"
        },
        "*:focus-visible": {
          outline: `2px solid ${alpha(colors.blue, 0.9)}`,
          outlineOffset: 2
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: glassPanel
      }
    },
    MuiCard: {
      styleOverrides: {
        root: glassPanel
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          ...glassPanel,
          backgroundColor: colors.panelStrong
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: 8,
          paddingInline: 18
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #2DD4FF 0%, #0EA5E9 100%)",
          boxShadow: "0 10px 24px rgba(45,212,255,0.28)"
        },
        outlined: {
          borderColor: colors.lineActive,
          backgroundColor: alpha(colors.blue, 0.06)
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: `1px solid ${colors.line}`,
          backgroundColor: alpha(colors.blue, 0.08)
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          ...glassPanel,
          color: colors.text,
          borderRadius: 6,
          padding: "10px 12px"
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: alpha("#0B1220", 0.72),
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: colors.line
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: colors.lineActive
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: colors.blue,
            borderWidth: 1
          }
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: 8,
          textTransform: "none",
          fontWeight: 700
        }
      }
    }
  }
});
