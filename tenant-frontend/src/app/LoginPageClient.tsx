"use client";

import LoginForm from "@/features/auth/components/LoginForm";
import { Box } from "@mui/material";

export default function LoginPageClient() {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        px: 2,
        bgcolor: "background.default",
      }}
    >
      <LoginForm />
    </Box>
  );
}
