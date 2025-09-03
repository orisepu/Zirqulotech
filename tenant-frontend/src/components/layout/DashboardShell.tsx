"use client";

import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CssBaseline,
  Divider,
  useTheme,Breadcrumbs,
  useMediaQuery,
  Skeleton,Tooltip
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import { Brightness4, Brightness7 } from "@mui/icons-material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useColorMode } from "@/context/ThemeContext";
import AssessmentIcon from "@mui/icons-material/Assessment";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ToasterProvider from "@/components/ToasterProvider";
import "react-toastify/dist/ReactToastify.css";
import api from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { useUsuario } from "@/context/UsuarioContext";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import BreadcrumbsExplorador from "@/components/BreadcrumbsExplorador";
import { useQueryClient } from "@tanstack/react-query";
const drawerWidth = 220;
const collapsedWidth = 64;
export default function DashboardShell({
  children,
  
}: {
  children: React.ReactNode;
  
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { toggleColorMode } = useColorMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const usuario = useUsuario();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tenantAccess, setTenantAccess] = useState<string[]>([]);
  
  
  const queryClient = useQueryClient();
 


 

  const tiendaId = usuario?.rol_actual?.tienda_id;

  const { data: nombreTienda, isLoading: cargandoTienda } = useQuery({
    queryKey: ["nombre-tienda", tiendaId],
    queryFn: async () => {
      if (!tiendaId) return null;
      const res = await api.get(`/api/tiendas/${tiendaId}/`);
      return res.data.nombre;
    },
    enabled: !!tiendaId, // no ejecutar si no hay tiendaId
    staleTime: 1000 * 60 * 10,
  });

  React.useEffect(() => {
    const stored = localStorage.getItem("tenantAccess");
    if (stored) {
      setTenantAccess(JSON.parse(stored));
    }
  }, []);

  const navItems = [
    { label: "Dashboard", icon: <HomeIcon />, to: "/dashboard" },
    { label: "Clientes", icon: <HomeIcon />, to: "/clientes" },
    { label: "Oportunidades", icon: <AssessmentIcon />, to: "/oportunidades" },
    ...(tenantAccess.includes("public")
      ? [
          { label: "Oportunidades Global", icon: <Inventory2Icon />, to: "/oportunidades-global" },
          { label: "Recepción", icon: <Inventory2Icon />, to: "/recepcion" },
        ]
      : []),
    { label: "Mi Perfil", icon: <PersonIcon />, to: "/perfil" },
    ...(usuario?.rol_actual?.rol === "manager"
      ? [{ label: "Gestionar Usuarios", icon: <GroupsIcon />, to: "/usuarios" }]
      : []),
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    localStorage.clear(); // también puedes usar tus claves manuales
    sessionStorage.clear();

    router.push("/login");
    window.location.reload();
  };

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Toolbar />
      {!isMobile && (
        <IconButton onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      )}
      <Divider />
      <List sx={{ flexGrow: 1 }}>
      {navItems.map((item) => (
        <Tooltip
          key={item.label}
          title={collapsed ? item.label : ""}
          placement="right"
          arrow
        >
          <ListItem
            component={Link}
            href={item.to}
            onClick={() => setMobileOpen(false)}
            sx={{
              cursor: "pointer",
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 1 : 2,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: collapsed ? 0 : 2,
                justifyContent: "center",
              }}
            >
              {item.icon}
            </ListItemIcon>
            {!collapsed && <ListItemText primary={item.label} />}
          </ListItem>
        </Tooltip>
      ))}
    </List>
      <Divider />
    <List>
      <Tooltip title={collapsed ? "Cerrar sesión" : ""} placement="right" arrow>
        <ListItem
          onClick={handleLogout}
          sx={{
            cursor: "pointer",
            justifyContent: collapsed ? "center" : "flex-start",
            px: collapsed ? 1 : 2,
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              mr: collapsed ? 0 : 2,
              justifyContent: "center",
            }}
          >
            <LogoutIcon />
          </ListItemIcon>
          {!collapsed && <ListItemText primary="Cerrar sesión" />}
        </ListItem>
      </Tooltip>
    </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: "primary" }}
      >
        <Toolbar sx={{display: "grid",gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",gap: 1,}}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {isMobile && (
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={handleDrawerToggle}
          sx={{ mr: 2, display: { md: "none" } }}
        >
          <MenuIcon />
        </IconButton>
      )}
  {/* 🧑 Bienvenida */}
  <Typography
                variant="h6"
                sx={{ display: { xs: "none", sm: "block" }, whiteSpace: "nowrap" }}
                title={usuario ? usuario.name : undefined}
              >
    {usuario ? `Bienvenido, ${usuario.name}` : <Skeleton width={160} />}
  </Typography></Box>
{/* 🧭 Breadcrumbs tipo explorador */}
    <Box sx={{ justifySelf: "center", overflow: "hidden" }}>
                {/* Si los breadcrumbs son largos, que recorten con elipsis */}
                <Box sx={{ maxWidth: { xs: 220, sm: 420, md: 560}, overflow: "hidden" }}>
                  <BreadcrumbsExplorador />
                </Box>
              </Box>
  {/* 🏬 Tienda actual */}
  <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1 }}>
  <Typography sx={{ mr: 2 }}>
    {usuario
      ? cargandoTienda
        ? "Tienda: Cargando..."
        : `Tienda: ${nombreTienda || "Desconocida"}`
      : "Cargando..."}
  </Typography>

  {/* 🌙 Tema */}
  <IconButton onClick={toggleColorMode} color="inherit">
    {theme.palette.mode === "dark" ? <Brightness7 /> : <Brightness4 />}
  </IconButton></Box>
</Toolbar>

      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { md: collapsed ? collapsedWidth : drawerWidth },
          flexShrink: { md: 0 },
        }}
        aria-label="navegación"
      >
        <Drawer
          variant={isMobile ? "temporary" : "permanent"}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "block" },
            "& .MuiDrawer-paper": {
              width: collapsed ? collapsedWidth : drawerWidth,
              boxSizing: "border-box",
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <ToasterProvider />
        {children}
      </Box>
    </Box>
  );
}
