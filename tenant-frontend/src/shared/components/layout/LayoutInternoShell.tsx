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
import Image from 'next/image'
import { useColorMode } from '@/context/ThemeContext'
import { useUsuario } from '@/context/UsuarioContext'
import ToasterProvider from '@/components/ToasterProvider'
import BuscadorUniversal from '@/components/BuscadorUniversal'
import NotificacionesBell from '@/features/notifications/components/NotificacionesBell'
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { getSecureItem } from '@/shared/lib/secureStorage'
import { getWebSocketUrl } from '@/shared/config/env'
import { useWebSocketWithRetry } from '@/hooks/useWebSocketWithRetry'
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

  // Construct WebSocket URL with token
  const [wsUrl, setWsUrl] = useState<string>('')
  const [wsEnabled, setWsEnabled] = useState(true)
  const [tokenRefreshTrigger, setTokenRefreshTrigger] = useState(0)
  const tokenRefreshAttemptsRef = useRef(0)
  const MAX_TOKEN_REFRESH_ATTEMPTS = 3

  useEffect(() => {
    const loadWsUrl = async () => {
      // IMPORTANTE: No construir URL si ya alcanzamos el límite
      if (tokenRefreshAttemptsRef.current >= MAX_TOKEN_REFRESH_ATTEMPTS) {
        console.warn('⚠️ No se construye URL: límite de intentos alcanzado')
        setWsUrl('')
        setWsEnabled(false)
        return
      }

      const token = await getSecureItem('access')
      if (!token) {
        console.warn('⚠️ No se pudo obtener token para WebSocket de notificaciones')
        return
      }

      const url = getWebSocketUrl(`/ws/notificaciones/?token=${token}`)
      console.log('🔄 Construyendo URL de WebSocket de notificaciones con token actualizado')
      setWsUrl(url)
    }
    loadWsUrl()
  }, [tokenRefreshTrigger])

  // Use WebSocket hook with retry
  const { socket } = useWebSocketWithRetry({
    url: wsUrl,
    enabled: !!wsUrl && wsEnabled,
    maxRetries: 5,
    initialRetryDelay: 2000,
    maxRetryDelay: 30000,
    onOpen: () => {
      console.log('✅ WebSocket de notificaciones conectado')
      tokenRefreshAttemptsRef.current = 0
      setWsEnabled(true)
    },
    onMessage: (data) => {
      console.log('📨 Notificación recibida:', data);

      // Disparar evento personalizado para que otros componentes puedan escucharlo
      const event = new CustomEvent('ws-notification', { detail: data });
      window.dispatchEvent(event);
    },
    onClose: () => {
      console.warn('🔌 WebSocket de notificaciones cerrado')

      const nuevoIntento = tokenRefreshAttemptsRef.current + 1
      console.log(`📊 Contador actual: ${tokenRefreshAttemptsRef.current}, nuevo: ${nuevoIntento}, máximo: ${MAX_TOKEN_REFRESH_ATTEMPTS}`)

      if (nuevoIntento <= MAX_TOKEN_REFRESH_ATTEMPTS) {
        console.log(`🔄 Solicitando URL con token actualizado (intento ${nuevoIntento}/${MAX_TOKEN_REFRESH_ATTEMPTS})...`)
        tokenRefreshAttemptsRef.current = nuevoIntento
        setTokenRefreshTrigger(prev => prev + 1)
      } else {
        console.error(`❌ LÍMITE ALCANZADO: ${nuevoIntento} > ${MAX_TOKEN_REFRESH_ATTEMPTS}. WebSocket DESHABILITADO permanentemente.`)
        tokenRefreshAttemptsRef.current = nuevoIntento
        setWsEnabled(false)
        setWsUrl('')
      }
    },
    onError: (error) => {
      console.error('❌ Error en WebSocket de notificaciones:', error)
    },
  })

  const navItems = [
    { label: 'Dashboard',               icon: <SpaceDashboardRounded />, to: '/dashboard' },
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
          // Lógica mejorada para evitar selecciones múltiples con rutas anidadas
          const selected = pathname === item.to ||
            (pathname.startsWith(item.to + "/") &&
             !navItems.some(otherItem =>
               otherItem !== item &&
               otherItem.to.startsWith(item.to + "/") &&
               pathname.startsWith(otherItem.to)
             ));

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
            pl: "5px",
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
            {/* Logo */}
            <Image
              src={theme.palette.mode === "dark" ? "/imagenes/zirqulo-logo-dark.png" : "/imagenes/zirqulo-logo-light.png"}
              alt="Zirqulo"
              width={50}
              height={50}
              style={{ objectFit: "contain" }}
            />
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
            <Box sx={{ maxWidth: { xs: "14rem", sm: "28rem", md: "36rem" }, overflow: "hidden" }}>
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
