"use client";

import LoginForm from "@/features/auth/components/LoginForm";
import { Box } from "@mui/material";

export default function LoginPage() {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        px: 2,
        bgcolor: "background.default", // ← usa el tema (dark/light)
      }}
    >
      <LoginForm />
    </Box>
  );
}