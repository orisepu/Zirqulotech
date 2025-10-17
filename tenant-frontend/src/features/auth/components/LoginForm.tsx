// [código antiguo] -> [código nuevo] -> [código antiguo]
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { login as loginRequest } from "@/services/api";
import { setSecureItem } from "@/shared/lib/secureStorage";
import {
  Button,
  TextField,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Box,
  InputAdornment,
  IconButton,
  Checkbox,
  FormControlLabel,
  Snackbar,
  Alert,
  alpha,
  useTheme,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

export default function LoginForm() {
  const router = useRouter();
  const theme = useTheme(); // ← para claro/oscuro

  // —— estado del formulario ——
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmpresa, setRememberEmpresa] = useState(true);

  // —— UI/UX ——
  const [error, setError] = useState("");
  const [showError, setShowError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Precargar empresa recordada
  useEffect(() => {
    const storedEmpresa = localStorage.getItem("rememberedEmpresa");
    if (storedEmpresa) setEmpresa(storedEmpresa);
  }, []);

  // Validación simple
  const isValid = useMemo(() => {
    const okEmpresa = empresa.trim().length > 0;
    // SECURITY FIX (CRIT-02): RFC 5322 simplified regex - rechaza XSS/SQLi payloads
    const okEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
    const okPass = password.length >= 8; // SECURITY FIX (CRIT-01): Forzar mínimo 8 caracteres (OWASP ASVS 2.1.1)
    return okEmpresa && okEmail && okPass;
  }, [empresa, email, password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError("");
    setShowError(false);

    try {
      const res = await loginRequest(empresa.trim(), email.trim(), password);

      const { access, refresh, user, schema, tenantAccess } = res.data;

      // ✅ Guardar tokens sensibles en secure storage (encriptado + memoria)
      // IMPORTANTE: Esperar a que TODOS los tokens se guarden antes de redirigir
      await Promise.all([
        setSecureItem("access", access),
        setSecureItem("refresh", refresh),
        setSecureItem("schema", schema),
        setSecureItem("user", JSON.stringify(user)),
        setSecureItem("tenantAccess", JSON.stringify(tenantAccess)),
      ]);

      // SECURITY FIX: Set HTTP cookie flag for middleware authentication check
      // Note: The actual token stays secure in sessionStorage, this is just a flag
      // Middleware needs this cookie to verify authentication on server-side
      const isProduction = window.location.protocol === 'https:';
      document.cookie = `access=true; path=/; max-age=86400; SameSite=Lax${isProduction ? '; Secure' : ''}`;

      // Empresa recordada puede quedarse en localStorage (no es sensible)
      if (rememberEmpresa) {
        localStorage.setItem("rememberedEmpresa", empresa.trim());
      } else {
        localStorage.removeItem("rememberedEmpresa");
      }

      // Pequeño delay para asegurar que los tokens estén disponibles en memoria
      await new Promise(resolve => setTimeout(resolve, 100));

      router.push("/dashboard");
      // Evitamos que Snackbar quede abierto
      setShowError(false);
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "Error al iniciar sesión o credenciales incorrectas.";
      setError(detail);
      setShowError(true);
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
        bgcolor: "background.default", // ← fondo sólido del tema (oscuro/claro)
      }}
    >
      <Card
        elevation={8}
        sx={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 3,
          // Fondo del card: usa paper; en dark añadimos un pelín de alpha para separarlo del bg
          bgcolor:
            theme.palette.mode === "dark"
              ? alpha(theme.palette.background.paper, 0.9)
              : theme.palette.background.paper,
          // Borde sutil para contraste en dark
          border:
            theme.palette.mode === "dark"
              ? `1px solid ${alpha(theme.palette.common.white, 0.06)}`
              : `1px solid ${alpha(theme.palette.common.black, 0.06)}`,
        }}
      >
        <CardContent
          component="form"
          onSubmit={handleLogin}
          noValidate
          autoComplete="on"
          sx={{ p: 4 }}
        >
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Iniciar sesión en la app
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Accede con tus credenciales de empresa.
          </Typography>

          {/* Empresa */}
          <TextField
            label="Empresa"
            fullWidth
            margin="normal"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            required
            autoFocus
            autoComplete="organization"
            // Mejoramos contraste de label/placeholder en dark
            InputLabelProps={{
              sx: { color: "text.secondary" }, // // quitar en producción si no te gusta
            }}
            FormHelperTextProps={{ sx: { color: "text.secondary" } }}
            // (adornos como los tenías)
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <BusinessIcon />
                </InputAdornment>
              ),
            }}
          />

          {/* Email */}
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            InputLabelProps={{ sx: { color: "text.secondary" } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MailOutlineIcon />
                </InputAdornment>
              ),
            }}
          />

          {/* Contraseña */}
          <TextField
            label="Contraseña"
            type={showPass ? "text" : "password"}
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            InputLabelProps={{ sx: { color: "text.secondary" } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPass((v) => !v)}
                    edge="end"
                  >
                    {showPass ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            helperText="Mínimo 8 caracteres"
          />

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberEmpresa}
                  onChange={(e) => setRememberEmpresa(e.target.checked)}
                />
              }
              label="Recordar empresa"
              sx={{ color: "text.secondary" }}
            />
            {/* SECURITY FIX (MED-03): Enlace a recuperación de contraseña */}
            <Button
              variant="text"
              size="small"
              onClick={() => router.push("/forgot-password")}
              sx={{ textTransform: "none" }}
            >
              ¿Olvidaste tu contraseña?
            </Button>
          </Box>

          {/* Botón: refuerzo de contraste cuando está deshabilitado en dark */}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{
              mt: 2,
              "&.Mui-disabled": {
                // En dark, el disabled de MUI puede verse muy apagado; elevamos un poco
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
            disabled={loading || !isValid}
          >
            {loading ? <CircularProgress size={24} /> : "Entrar"}
          </Button>
        </CardContent>
      </Card>

      {/* Snackbar de error sin cambios */}
      <Snackbar
        open={showError}
        autoHideDuration={4000}
        onClose={() => setShowError(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setShowError(false)} severity="error" variant="filled" sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
