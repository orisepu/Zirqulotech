"use client";

import React, { useState } from "react";
import { AppBar, Toolbar, Typography, IconButton, Box, Drawer, List, ListItem, ListItemIcon, ListItemText, CssBaseline, Divider, useTheme, useMediaQuery, Skeleton, Tooltip } from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import MenuIcon from "@mui/icons-material/Menu";
import SpaceDashboardIcon from "@mui/icons-material/SpaceDashboard";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import ContactPhoneIcon from "@mui/icons-material/ContactPhone";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import PublicIcon from "@mui/icons-material/Public";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useColorMode } from "@/context/ThemeContext";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import FlagIcon from "@mui/icons-material/Flag";
import ToasterProvider from "@/components/ToasterProvider";
import "react-toastify/dist/ReactToastify.css";
import api from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { useUsuario } from "@/context/UsuarioContext";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import BreadcrumbsExplorador from "@/components/BreadcrumbsExplorador";
// import { useQueryClient } from "@tanstack/react-query";
const drawerWidth = 220;
const collapsedWidth = 64;
export default function DashboardShell({
  children,
  
}: {
  children: React.ReactNode;
  
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);
  const { toggleColorMode } = useColorMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const usuario = useUsuario();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tenantAccess, setTenantAccess] = useState<string[]>([]);
  
  
  // const queryClient = useQueryClient();
 


 

  const tiendaId = usuario?.rol_actual?.tienda_id;

  const { data: nombreTienda, isLoading: cargandoTienda } = useQuery({
    queryKey: ["tienda-nombre", tiendaId],
    queryFn: async () => {
      if (!tiendaId) return null;
      const res = await api.get(`/api/tiendas/${tiendaId}/`);
      // Normaliza a string por si otros lugares guardaron objeto con esta key
      const d = res.data as any;
      return typeof d === 'string' ? d : (d?.nombre ?? null);
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
    // Inicio / panel principal
    { label: "Dashboard", icon: <SpaceDashboardIcon />, to: "/dashboard" },
    // Gestión de clientes
    { label: "Clientes", icon: <PeopleAltIcon />, to: "/clientes" },
    { label: "Contactos", icon: <ContactPhoneIcon />, to: "/clientes/contactos" },
    // Embudo de oportunidades
    { label: "Oportunidades", icon: <LightbulbIcon />, to: "/oportunidades" },
    { label: "Operaciones", icon: <AssignmentTurnedInIcon />, to: "/operaciones" },
    // Admin (solo superadmin)
    ...(usuario?.es_superadmin ? [{ label: "Admin", icon: <AdminPanelSettingsIcon />, to: "/admin" }] : []),
    // Accesos globales (multi-tenant)
    ...(tenantAccess.includes("public")
      ? [
          { label: "Oportunidades Global", icon: <PublicIcon />, to: "/oportunidades-global" },
          { label: "Recepción", icon: <LocalShippingIcon />, to: "/recepcion" },
        ]
      : []),
    // Perfil de usuario
    
    // Administración
    ...(usuario?.rol_actual?.rol === "manager"
      ? [
          //{ label: "Gestionar Usuarios", icon: <GroupsIcon />, to: "/usuarios" },
          { label: "Objetivos", icon: <FlagIcon />, to: "/objetivos" },
        ]
      : []),
      { label: "Mi Perfil", icon: <PersonIcon />, to: "/perfil" },
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
        <Toolbar sx={{display: "flex",
          alignItems: "center",gap: 2, justifyContent: "space-between"}}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
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
    {usuario ? `Bienvenid@, ${usuario.name}` : <Skeleton width={160} />}
  </Typography></Box>
{/* 🧭 Breadcrumbs tipo explorador */}
    <Box sx={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center", minWidth: 0 }}>
                {/* Si los breadcrumbs son largos, que recorten con elipsis */}
                <Box sx={{ maxWidth: { xs: 220, sm: 420, md: 800, lg: 1000}, overflow: "hidden" }}>
                  <BreadcrumbsExplorador />
                </Box>
              </Box>
  {/* 🏬 Tienda actual */}
  <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1, flexShrink: 0 }}>
  <Typography sx={{ mr: 2, whiteSpace: "nowrap" }}>
    {usuario
      ? cargandoTienda
        ? "Tienda: Cargando..."
        : `Tienda: ${nombreTienda || "Desconocida"}`
      : "Cargando..."}
  </Typography>

  {/* 🌙 Tema */}
  <IconButton onClick={toggleColorMode} color="inherit">
    {theme.palette.mode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
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
          maxWidth: "100%",
          overflow: "auto",
        }}
      >
        <Toolbar />
        <ToasterProvider />
        {children}
      </Box>
    </Box>
  );
}
