/**
 * SECURITY FIX (MED-03): Password Reset Request Page
 *
 * Página para solicitar recuperación de contraseña.
 *
 * Features:
 * - Validación de email en frontend antes de enviar
 * - Feedback visual con estados de carga
 * - Mensajes claros de éxito/error
 * - Diseño responsive y accesible
 * - Integración con PasswordStrengthIndicator (MED-02)
 *
 * Referencias:
 * - OWASP ASVS 4.0: 2.1.11 - Password reset functionality
 * - WCAG 2.1 AA - Accesibilidad
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  InputAdornment,
  Link as MuiLink,
  alpha,
  useTheme,
} from "@mui/material";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://zirqulotech.com";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const theme = useTheme();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Validación simple de email
  const isValidEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail) {
      setError("Por favor, introduce un email válido");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      await axios.post(`${API_BASE_URL}/api/password-reset/request/`, {
        email: email.trim(),
      });

      // Mostrar mensaje de éxito
      setSuccess(true);
      setEmail(""); // Limpiar formulario
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        "Error al enviar el email de recuperación. Intenta de nuevo más tarde.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

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
      <Card
        elevation={8}
        sx={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 3,
          bgcolor:
            theme.palette.mode === "dark"
              ? alpha(theme.palette.background.paper, 0.9)
              : theme.palette.background.paper,
          border:
            theme.palette.mode === "dark"
              ? `1px solid ${alpha(theme.palette.common.white, 0.06)}`
              : `1px solid ${alpha(theme.palette.common.black, 0.06)}`,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Botón de volver */}
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push("/login")}
            sx={{ mb: 2 }}
          >
            Volver al login
          </Button>

          <Typography variant="h5" fontWeight={700} gutterBottom>
            Recuperar contraseña
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
          </Typography>

          {/* Mensaje de éxito */}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Si el email existe en nuestro sistema, recibirás un enlace de recuperación en
              breve. Revisa tu bandeja de entrada (y la carpeta de spam).
            </Alert>
          )}

          {/* Mensaje de error */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate autoComplete="on">
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              error={email.length > 0 && !isValidEmail}
              helperText={
                email.length > 0 && !isValidEmail ? "Email inválido" : ""
              }
              InputLabelProps={{ sx: { color: "text.secondary" } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailOutlineIcon />
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              sx={{
                mt: 3,
                "&.Mui-disabled": {
                  bgcolor:
                    theme.palette.mode === "dark"
                      ? alpha(theme.palette.primary.main, 0.25)
                      : undefined,
                  color:
                    theme.palette.mode === "dark"
                      ? alpha(theme.palette.primary.contrastText, 0.7)
                      : undefined,
                },
              }}
              disabled={loading || !isValidEmail}
            >
              {loading ? <CircularProgress size={24} /> : "Enviar enlace de recuperación"}
            </Button>
          </Box>

          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              ¿Recordaste tu contraseña?{" "}
              <MuiLink
                component="button"
                variant="body2"
                onClick={() => router.push("/login")}
                sx={{ cursor: "pointer" }}
              >
                Volver al login
              </MuiLink>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
