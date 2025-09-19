"use client";

import { CardHeader, ToggleButtonGroup, ToggleButton, CardHeaderProps } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import React from "react";

export interface CardHeaderWithToggleProps extends CardHeaderProps {
  toggleValue: string;
  toggleOptions: Array<{ value: string; label: React.ReactNode }>;
  onToggleChange: (value: string) => void;
}

export default function CardHeaderWithToggle({
  toggleValue,
  toggleOptions,
  onToggleChange,
  action,
  ...rest
}: CardHeaderWithToggleProps) {
  const theme = useTheme();

  const handleChange = (_: React.SyntheticEvent | null, value: string | null) => {
    if (!value || value === toggleValue) return;
    onToggleChange(value);
  };

  return (
    <CardHeader
      {...rest}
      action={
        <ToggleButtonGroup
          size="small"
          value={toggleValue}
          exclusive
          onChange={handleChange}
          sx={{
            backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.65 : 0.85),
            borderRadius: 5,
            p: 0.25,
            '& .MuiToggleButton-root': {
              px: 1.75,
            },
          }}
        >
          {toggleOptions.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      }
      sx={{
        px: 3,
        py: 2,
        '& .MuiCardHeader-title': { fontSize: 16, fontWeight: 600 },
        ...(rest.sx || {}),
      }}
    />
  );
}
