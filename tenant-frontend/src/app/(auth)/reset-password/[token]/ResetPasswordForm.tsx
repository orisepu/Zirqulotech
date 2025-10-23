/**
 * SECURITY FIX (MED-03): Password Reset Form Component
 *
 * Client Component para el formulario de reset de contraseña.
 *
 * Features:
 * - Validación de contraseña en tiempo real (zxcvbn - MED-02)
 * - Toggle de visualización de contraseña
 * - Feedback visual con estados de carga/éxito/error
 * - Redirección automática tras éxito
 * - Diseño responsive y accesible
 * - Validación de 8 caracteres mínimos (CRIT-01)
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
  IconButton,
  alpha,
  useTheme,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import PasswordStrengthIndicator from "@/shared/components/PasswordStrengthIndicator";
import axios from "axios";
import { API_BASE_URL } from "@/shared/config/env";

interface ResetPasswordFormProps {
  token: string;
}

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const theme = useTheme();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Validaciones
  const isValidPassword = password.length >= 8;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidPassword) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (!passwordsMatch) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      await axios.post(`${API_BASE_URL}/api/password-reset/confirm/`, {
        token,
        new_password: password,
      });

      // Mostrar mensaje de éxito
      setSuccess(true);

      // Redirigir al login después de 3 segundos
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        "Error al restablecer la contraseña. El enlace puede haber expirado.";
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
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Nueva contraseña
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Introduce tu nueva contraseña. Debe tener al menos 8 caracteres.
          </Typography>

          {/* Mensaje de éxito */}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              ¡Contraseña actualizada correctamente! Redirigiendo al login...
            </Alert>
          )}

          {/* Mensaje de error */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate autoComplete="off">
            {/* Nueva contraseña */}
            <TextField
              label="Nueva contraseña"
              type={showPassword ? "text" : "password"}
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              autoComplete="new-password"
              error={password.length > 0 && !isValidPassword}
              helperText="Mínimo 8 caracteres"
              InputLabelProps={{ sx: { color: "text.secondary" } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Indicador de fortaleza de contraseña */}
            <PasswordStrengthIndicator
              password={password}
              showSuggestions={true}
              showCrackTime={true}
            />

            {/* Confirmar contraseña */}
            <TextField
              label="Confirmar contraseña"
              type={showConfirmPassword ? "text" : "password"}
              fullWidth
              margin="normal"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              error={confirmPassword.length > 0 && !passwordsMatch}
              helperText={
                confirmPassword.length > 0 && !passwordsMatch
                  ? "Las contraseñas no coinciden"
                  : ""
              }
              InputLabelProps={{ sx: { color: "text.secondary" } }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
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
              disabled={loading || !isValidPassword || !passwordsMatch}
            >
              {loading ? <CircularProgress size={24} /> : "Restablecer contraseña"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
