'use client'

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
  Divider,ListItemButton,
  useTheme,
  useMediaQuery,Tooltip
} from '@mui/material'
import {
  Brightness4,
  Brightness7,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  SpaceDashboardRounded,
  HandshakeRounded,
  ViewKanbanRounded,
  SettingsSuggestRounded,
  MoveToInboxRounded,
  FactCheckRounded,
  DevicesOtherRounded,
  ConstructionRounded,
  CategoryRounded,
  AdminPanelSettingsRounded,
} from '@mui/icons-material'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useColorMode } from '@/context/ThemeContext'
import { useUsuario } from '@/context/UsuarioContext'
import ToasterProvider from '@/components/ToasterProvider'
import BuscadorUniversal from '@/components/BuscadorUniversal'
import NotificacionesBell from '@/components/notificaciones/NotificacionesBell'
import React, { useState, useEffect } from 'react'
import { getAccessToken } from '@/services/api'
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import BreadcrumbsExplorador from "@/components/BreadcrumbsExplorador";

const drawerWidth = 220
const collapsedWidth = 64;

export default function LayoutInternoShell({ children }: { children: React.ReactNode }) {
  const { toggleColorMode } = useColorMode()
  const theme = useTheme()
  const [collapsed, setCollapsed] = useState(true);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const usuario = useUsuario()
  const pathname = usePathname();

  const [socket, setSocket] = useState<WebSocket | null>(null)

   const token = typeof window !== 'undefined' ? getAccessToken() : null

  useEffect(() => {
    if (!token) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/notificaciones/?token=${token}`)
    setSocket(ws)

    ws.onclose = () => {
      console.warn('🔌 WebSocket cerrado. Intentando reconectar en 3s...')
      setTimeout(() => {
        setSocket(new WebSocket(`${proto}://${window.location.host}/ws/notificaciones/?token=${token}`))
      }, 3000)
    }

    return () => {
      ws.close()
    }
  }, [token])

  const navItems = [
    { label: 'Dashboard',               icon: <SpaceDashboardRounded />, to: '/dashboard' },
    // Solo superadmin
    ...(usuario?.es_superadmin ? [{ label: 'Admin', icon: <AdminPanelSettingsRounded />, to: '/admin' }] : []),
    { label: 'Partners',                icon: <HandshakeRounded />,      to: '/partners' },
    { label: 'Oportunidades / Pipeline',icon: <ViewKanbanRounded />,     to: '/pipeline-global' },
    { label: 'Operaciones',             icon: <SettingsSuggestRounded />,to: '/oportunidades-global' },
    { label: 'Recepción',               icon: <MoveToInboxRounded />,    to: '/recepcion' },
    { label: 'Auditorias',              icon: <FactCheckRounded />,      to: '/auditorias' },
    { label: 'Dispositivos',            icon: <DevicesOtherRounded />,   to: '/dispositivos' },
    { label: 'Piezas',                  icon: <ConstructionRounded />,   to: '/dispositivos/piezas' },
    { label: 'Tipos Piezas',            icon: <CategoryRounded />,       to: '/dispositivos/piezas/tipos' },
  ]
  

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen)

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("schema");
    localStorage.removeItem("chat_id");
    localStorage.removeItem("tenantAccess");
    localStorage.removeItem("user");
    sessionStorage.clear()
    router.push("/login");
    window.location.reload();
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar />
      
      {!isMobile && (
        <IconButton onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      )}
      <List sx={{ flexGrow: 1 }}>
        {navItems.map((item) => {
          const selected = pathname === item.to || pathname.startsWith(item.to + "/");

          const Item = (
            <ListItemButton
              component={Link}
              href={item.to}
              selected={selected}
              onClick={() => setMobileOpen(false)}
              sx={{
                cursor: "pointer",
                justifyContent: collapsed ? "center" : "flex-start",
                px: collapsed ? 1 : 2,
                borderLeft: selected ? 2 : 0,
                borderLeftColor: selected ? "primary.main" : "transparent",
                "&.Mui-selected": {
                  bgcolor: "action.selected",
                  "&:hover": { bgcolor: "action.selected" },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: collapsed ? 0 : 2,
                  justifyContent: "center",
                  color: selected ? "primary.main" : "inherit",
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && <ListItemText primary={item.label} />}
            </ListItemButton>
          );

          return collapsed ? (
            <Tooltip key={item.label} title={item.label} placement="right" arrow>
              {Item}
            </Tooltip>
          ) : (
            <React.Fragment key={item.label}>{Item}</React.Fragment>
          );
        })}
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
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        {/* Grid 3 columnas: izq (menu+welcome) | centro (breadcrumbs) | dcha (acciones) */}
        <Toolbar
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 1,
          }}
        >
          {/* IZQUIERDA: menú (mobile) + bienvenida */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isMobile && (
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleDrawerToggle}
                aria-label="Abrir menú de navegación"
              >
                <MenuIcon />
              </IconButton>
            )}
            {/* 🧑 Bienvenida a la izquierda */}
            <Typography
              variant="h6"
              sx={{ display: { xs: "none", sm: "block" }, whiteSpace: "nowrap" }}
              title={usuario ? usuario.name : undefined}
            >
              {usuario ? `Soporte: ${usuario.name}` : "Cargando..."}
            </Typography>
          </Box>

          {/* CENTRO: breadcrumbs centrados */}
          <Box sx={{ justifySelf: "center", overflow: "hidden" }}>
            {/* Si los breadcrumbs son largos, que recorten con elipsis */}
            <Box sx={{ maxWidth: { xs: 220, sm: 420, md: 560}, overflow: "hidden" }}>
              <BreadcrumbsExplorador />
            </Box>
          </Box>

          {/* DERECHA: buscador + notificaciones + tema */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1 }}>
            <BuscadorUniversal />
            {socket && <NotificacionesBell socket={socket} />}
            <IconButton onClick={toggleColorMode} color="inherit" aria-label="Cambiar tema">
              {theme.palette.mode === "dark" ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: collapsed ? collapsedWidth : drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: collapsed ? collapsedWidth : drawerWidth,
              boxSizing: 'border-box',
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
  )
}
