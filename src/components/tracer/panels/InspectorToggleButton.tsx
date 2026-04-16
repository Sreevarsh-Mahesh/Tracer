"use client";

import { Button } from "@mui/material";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

export function InspectorToggleButton({
  open,
  openLabel,
  closeLabel,
  onClick
}: {
  open: boolean;
  openLabel: string;
  closeLabel: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outlined"
      startIcon={open ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
      onClick={onClick}
    >
      {open ? closeLabel : openLabel}
    </Button>
  );
}
