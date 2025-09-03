// [código antiguo] -> [código nuevo] -> [código antiguo]
"use client";

import {
  Breadcrumbs,
  Typography,
  Link as MuiLink,
  Skeleton,
  Box,                 // <- añadido: contenedor para centrar vertical
  useTheme,            // <- añadido: detectar breakpoint
  useMediaQuery        // <- añadido: detectar breakpoint
} from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import Link from "next/link";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";

export default function BreadcrumbsExplorador() {
  const { breadcrumbs, isReady } = useBreadcrumbs();

  // Altura estándar del Toolbar: 64 (≥sm) / 56 (<sm)
  const theme = useTheme();
  const upSm = useMediaQuery(theme.breakpoints.up("sm"));
  const toolbarHeight = upSm ? 64 : 56;

  return (
    // Contenedor para centrar verticalmente y evitar “bailes”
    <Box
      sx={{
        height: toolbarHeight,         // igual que el Toolbar
        display: "flex",
        alignItems: "center",          // <- centrado vertical
        overflow: "hidden",            // evitar desbordes
      }}
    >
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        // sin márgenes verticales extra: lo centra el Box
        sx={{
          lineHeight: 1,               // altura compacta
          "& .MuiBreadcrumbs-ol": { alignItems: "center" },
        }}
      >
        {!isReady ? (
          <Skeleton width={200} height={20} />  // placeholder estable
        ) : (
          breadcrumbs.map((crumb, i) =>
            crumb.href ? (
              <MuiLink
                key={i}
                component={Link}
                href={crumb.href}
                underline="hover"
                color="inherit"
                sx={{
                  maxWidth: { xs: 140, sm: 260, md: 340 }, // evitar saltos
                  display: "inline-block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                // onClick={() => console.debug("[bc] click", crumb.href)} // quitar en producción
                title={crumb.label}
              >
                {crumb.label}
              </MuiLink>
            ) : (
              <Typography
                key={i}
                color="text.primary"
                fontWeight={600}
                noWrap
                sx={{
                  maxWidth: { xs: 140, sm: 260, md: 340 },
                  display: "inline-block",
                }}
                title={crumb.label}
              >
                {crumb.label}
              </Typography>
            )
          )
        )}
      </Breadcrumbs>
    </Box>
  );
}
// [código antiguo]
