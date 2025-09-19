'use client';

import React, { createContext, useMemo, useState, useContext, useEffect } from 'react';
import { ThemeProvider, createTheme, Theme, alpha } from '@mui/material/styles';
import GlobalStyles from '@mui/material/GlobalStyles';
import CssBaseline from '@mui/material/CssBaseline';
import Paper from '@mui/material/Paper';
import { AlertColor, SxProps } from '@mui/material';
import type { SystemStyleObject } from '@mui/system';
import { getFilledAlertStyles } from '@/utils/alertStyles';


type SemanticColorKey =
  | 'primary' | 'secondary' | 'accent'
  | 'success' | 'info' | 'warning' | 'error';

type StripeSide = 'left' | 'right' | 'top' | 'bottom';

// 👇 Añadimos el nuevo color 'accent' a MUI (TS)
declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary'];
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
  }
}
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    accent: true;
  }
}
declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    accent: true;
  }
}
declare module '@mui/material/Alert' {
  interface AlertPropsColorOverrides {
    accent: true;
  }
}

export type ColorModeContextType = {
  mode: 'light' | 'dark';
  toggleColorMode: () => void;
};

const ColorModeContext = createContext<ColorModeContextType | undefined>(undefined);

export const useColorMode = () => {
  const ctx = useContext(ColorModeContext);
  if (!ctx) throw new Error('useColorMode must be used inside <ThemeWrapper>');
  return ctx;
};

type ThemeWrapperProps = { children: React.ReactNode; initialMode?: 'light' | 'dark' };

const chipSoftColor = (
  theme: Theme,
  key: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error'
) => {
  const paletteEntry = theme.palette[key];
  return {
    backgroundColor: paletteEntry.main,
    color: '#fff',
    '& .MuiChip-icon': { color: '#fff' },
    '& .MuiChip-deleteIcon': { color: alpha('#fff', 0.8) },
  };
};

export const ThemeWrapper: React.FC<ThemeWrapperProps> = ({ children, initialMode }) => {
  const [mode, setMode] = useState<'light' | 'dark'>(initialMode ?? 'light');

  useEffect(() => {
    const getCookieMode = () => {
      if (typeof document === 'undefined') return null;
      const m = document.cookie.match(/(?:^|; )theme_mode=(dark|light)/);
      return m ? (m[1] as 'dark' | 'light') : null;
    };

    let desired: 'light' | 'dark' | null = null;
    const savedLS = localStorage.getItem('theme_mode');
    if (savedLS === 'dark' || savedLS === 'light') desired = savedLS as 'dark' | 'light';
    if (!desired) {
      const savedCookie = getCookieMode();
      if (savedCookie) desired = savedCookie;
    }
    if (!desired && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      desired = 'dark';
    }
    if (desired && desired !== mode) setMode(desired);

    // Sync cookie/localStorage with current mode
    const toPersist = desired || mode;
    try {
      localStorage.setItem('theme_mode', toPersist);
      document.cookie = `theme_mode=${toPersist}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colorMode = useMemo<ColorModeContextType>(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode(prev => {
          const next = prev === 'light' ? 'dark' : 'light';
          localStorage.setItem('theme_mode', next);
          try { document.cookie = `theme_mode=${next}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch (_) {}
          return next;
        });
      },
    }),
    [mode]
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
            mode,
            primary:   { main: '#2F6A4F', light: '#5C8F75', dark: '#204A36' }, // verde bosque → solo para botones/acciones
            secondary: { main: '#4F709C', light: '#7899C3', dark: '#2F4A73' }, // azul neutro suave
            accent:    { main: '#C7724C', light: '#E1A688', dark: '#8E4F34' }, // terracota
            success: { main: '#2e7d32' },
            info:    { main: '#0288d1' },
            warning: { main: '#ed6c02' },
            error:   { main: '#d32f2f' },
            ...(mode === 'light'
              ? {
                  background: { default: '#F5F8F6', paper: '#FFFFFF' }, // neutro
                  divider: '#E5E7EB',
                  text: { primary: '#111827', secondary: '#4B5563' },
                }
              : {
                  background: { default: '#0F141A', paper: '#161B22' }, // neutro oscuro
                  divider: 'rgba(255,255,255,0.12)',
                  text: { primary: '#E5E7EB', secondary: '#9CA3AF' },
                }),
          },
        typography: {
          fontFamily: [
            'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto',
            'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif',
          ].join(','),
          h1: { fontWeight: 700, letterSpacing: -0.5 },
          h2: { fontWeight: 700, letterSpacing: -0.25 },
          h3: { fontWeight: 700 }, h4: { fontWeight: 700 },
          h5: { fontWeight: 700 }, h6: { fontWeight: 700 },
          button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0.2 },
          body1: { lineHeight: 1.6 }, body2: { lineHeight: 1.5 },
        },
        shape: { borderRadius: 12 },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: ({ theme }: { theme: Theme }) => ({
                backgroundColor: theme.palette.background.default,
                color: theme.palette.text.primary,
              }),
              html: ({ theme }: { theme: Theme }) => ({
                backgroundColor: theme.palette.background.default,
                color: theme.palette.text.primary,
              }),
            },
          },
         
          // Superficies
          MuiPaper: {
            styleOverrides: {
              root: ({ theme }: { theme: Theme }) => ({
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.background.paper, 0.9)
                    : '#FBFCF9',
                ...(theme.palette.mode === 'light' && {
                  backgroundImage: 'linear-gradient(180deg, #FBFCF9, #F7FAF4)',
                  boxShadow: '0 8px 26px rgba(0, 0, 0, 0.15)',
                }),
                border:
                  theme.palette.mode === 'light'
                    ? `1px solid ${theme.palette.divider}`
                    : '1px solid rgba(255,255,255,0.06)',
              }),
            },
          },

          // Cards
          MuiCard: {
            styleOverrides: {
              root: ({ theme }: { theme: Theme }) => ({
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.background.paper, 0.6)
                    : '#FFFFFF',
                ...(theme.palette.mode === 'light' && {
                  backgroundImage: 'linear-gradient(180deg, #FFFFFF, #F9FBF7)',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.07)',
                }),
                border:
                  theme.palette.mode === 'light'
                    ? `1px solid ${theme.palette.divider}`
                    : '1px solid rgba(255,255,255,0.06)',
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? '0 2px 12px rgba(0,0,0,0.35)'
                    : '0 6px 18px rgba(0,0,0,0.06)',
              }),
            },
          },

          MuiAlert: {
            styleOverrides: {
              root: ({ theme, ownerState }: { theme: Theme; ownerState: { variant?: string; severity?: any } }) => {
                if (ownerState.variant === 'filled') {
                  const severity = (ownerState.severity as AlertColor | undefined) ?? 'info';
                  return getFilledAlertStyles(severity)(theme);
                }
                return {};
              },
            },
          },

          // AppBar
          MuiAppBar: {
            defaultProps: { elevation: 0, color: 'default' },
            styleOverrides: {
              root: ({ theme }: { theme: Theme }) => ({
                backgroundColor:
                  theme.palette.mode === 'light'
                    ? 'rgba(251,252,249,0.95)'
                    : 'rgba(18,22,28,0.9)',
                backdropFilter: 'saturate(180%) blur(8px)',
                borderBottom:
                  theme.palette.mode === 'light'
                    ? `1px solid ${theme.palette.divider}`
                    : '1px solid rgba(255,255,255,0.06)',
                ...(theme.palette.mode === 'light' && {
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }),
              }),
            },
          },

          // Inputs
          MuiOutlinedInput: {
            styleOverrides: {
              root: ({ theme }: { theme: Theme }) => ({
                borderRadius: 10,
                ...(theme.palette.mode === 'light' && {
                  backgroundColor: '#F9FBF7',
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: alpha(theme.palette.text.primary, 0.25),
                  },
                }),
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.primary.main,
                  boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.16)}`,
                },
              }),
              input: { paddingBlock: 12 },
            },
          },

          // Botones (añadimos sombra solo en light)
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
              root: { borderRadius: 10, paddingInline: 16, '&:active': { transform: 'translateY(0.5px)' } },
              containedPrimary: ({ theme }: { theme: Theme }) => ({
                ...(theme.palette.mode === 'light' && {
                  boxShadow: '0 6px 16px rgba(47,106,79,0.22)',
                  '&:hover': { boxShadow: '0 8px 22px rgba(47,106,79,0.26)' },
                }),
              }),
              // 👉 soporte visual para color="accent"
              contained: ({ theme, ownerState }: { theme: Theme; ownerState: { color?: string } }) =>
                ownerState.color === 'accent'
                  ? {
                      backgroundColor: theme.palette.accent.main,
                      color: '#fff',
                      '&:hover': { backgroundColor: theme.palette.accent.dark },
                      ...(theme.palette.mode === 'light' && {
                        boxShadow: '0 6px 16px rgba(199,114,76,0.24)',
                      }),
                    }
                  : {},
              outlined: ({ theme, ownerState }: { theme: Theme; ownerState: { color?: string } }) =>
                ownerState.color === 'accent'
                  ? {
                      borderColor: alpha(theme.palette.accent.main, 0.5),
                      color: theme.palette.accent.main,
                      '&:hover': { borderColor: theme.palette.accent.main, backgroundColor: alpha(theme.palette.accent.main, 0.06) },
                    }
                  : {},
            },
          },

          // List / Chips / Tabs
          MuiListItem: {
            styleOverrides: {
              root: ({ theme }: { theme: Theme }) => ({
                color: theme.palette.text.primary,
                '&:hover': {
                  borderRadius: 15,
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.08)'
                      : alpha(theme.palette.primary.main, 0.06),
                },
                '&.Mui-selected, &.Mui-selected:hover': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? alpha('#fff', 0.08)
                      : alpha(theme.palette.primary.main, 0.10),
                  color: theme.palette.primary.main,
                },
              }),
            },
          },
          MuiChip: {
            styleOverrides: {
              root: { height: 36, borderRadius: 10, fontWeight: 600 },
              icon: { fontSize: '1.1rem' },
              colorDefault: ({ theme }: { theme: Theme }) => ({
                ...(theme.palette.mode === 'light' && {
                }),
              }),
              colorPrimary: ({ theme }: { theme: Theme }) => chipSoftColor(theme, 'primary'),
              colorSecondary: ({ theme }: { theme: Theme }) => chipSoftColor(theme, 'secondary'),
              colorSuccess: ({ theme }: { theme: Theme }) => chipSoftColor(theme, 'success'),
              colorInfo: ({ theme }: { theme: Theme }) => chipSoftColor(theme, 'info'),
              colorWarning: ({ theme }: { theme: Theme }) => chipSoftColor(theme, 'warning'),
              colorError: ({ theme }: { theme: Theme }) => chipSoftColor(theme, 'error'),
            },
          },
          MuiTabs: {
            styleOverrides: {
              indicator: ({ theme }: { theme: Theme }) => ({
                height: 3,
                borderRadius: 3,
                backgroundColor: theme.palette.primary.main,
              }),
            },
          },
          MuiTab: {
            styleOverrides: {
              root: ({ theme }: { theme: Theme }) => ({
                textTransform: 'none',
                minHeight: 42,
                fontWeight: 600,
                '&.Mui-selected': { color: theme.palette.primary.main },
              }),
            },
          },

          // Tabla
          MuiTableCell: {
            styleOverrides: {
              head: ({ theme }: { theme: Theme }) => ({
                fontWeight: 700,
                background:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.primary.main, 0.06)
                    : alpha(theme.palette.primary.main, 0.09),
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
              }),
              root: ({ theme }: { theme: Theme }) => ({
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
              }),
            },
          },

          MuiTableRow: {
            styleOverrides: {
              root: ({ theme }: { theme: Theme }) => ({
                transition: 'background-color 0.2s ease',
                '&:nth-of-type(odd)': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.primary.main, 0.03)
                      : alpha(theme.palette.primary.main, 0.04),
                },
                '&:hover': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.primary.main, 0.12)
                      : alpha(theme.palette.primary.main, 0.08),
                },
              }),
            },
          },

          MuiDivider: {
            styleOverrides: {
              root: ({ theme }: { theme: Theme }) => ({
                borderColor: alpha(theme.palette.divider, theme.palette.mode === 'light' ? 0.7 : 0.4),
              }),
            },
          },

          // Dialog opaco en dark
          MuiDialog: {
            defaultProps: {
              PaperProps: { elevation: 0 },
              BackdropProps: { sx: { backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' } },
            },
            styleOverrides: {
              paper: ({ theme }: { theme: Theme }) => ({
                borderRadius: 16,
                backgroundColor: theme.palette.background.paper,
                border:
                  theme.palette.mode === 'light'
                    ? `1px solid ${theme.palette.divider}`
                    : '1px solid rgba(255,255,255,0.06)',
                boxShadow:
                  theme.palette.mode === 'dark'
                    ? '0 12px 40px rgba(0,0,0,0.5)'
                    : '0 12px 32px rgba(0,0,0,0.12)',
              }),
            },
          },

          // Tooltip
          MuiTooltip: {
            styleOverrides: {
              tooltip: ({ theme }: { theme: Theme }) => ({
                fontSize: 12,
                borderRadius: 8,
                background:
                  theme.palette.mode === 'dark'
                    ? alpha('#000', 0.85)
                    : alpha('#1B2B24', 0.95),
              }),
            },
          },
        },
      }),
    [mode]
  );

  useEffect(() => {
    try {
      const html = document.documentElement;
      const body = document.body;
      html.setAttribute('data-theme-mode', mode);
      const bg = theme.palette.background.default;
      const fg = theme.palette.text.primary as unknown as string;
      if (body) {
        body.style.backgroundColor = bg;
        body.style.color = fg;
      }
      html.style.backgroundColor = bg;
    } catch {}
  }, [mode, theme]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {/* Ensure body background/text follow the theme at all times */}
        <GlobalStyles
          styles={(theme) => ({
            'html, body': {
              backgroundColor: theme.palette.background.default,
              backgroundImage:
                theme.palette.mode === 'light'
                  ? 'radial-gradient(circle at 20% 20%, rgba(214,242,228,0.35), transparent 45%), radial-gradient(circle at 80% 0%, rgba(214,239,255,0.25), transparent 40%)'
                  : 'radial-gradient(circle at 15% 15%, rgba(45,90,80,0.24), transparent 45%), radial-gradient(circle at 85% 5%, rgba(26,40,54,0.35), transparent 40%)',
              backgroundAttachment: 'fixed',
              color: theme.palette.text.primary,
              minHeight: '100%'
            },
            '#__next': { minHeight: '100%' },
            'input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, textarea:-webkit-autofill, textarea:-webkit-autofill:hover, textarea:-webkit-autofill:focus, select:-webkit-autofill, select:-webkit-autofill:hover, select:-webkit-autofill:focus': {
              WebkitBoxShadow: `0 0 0px 1000px ${theme.palette.background.paper} inset !important`,
              WebkitTextFillColor: `${theme.palette.text.primary} !important`,
              caretColor: theme.palette.text.primary,
              transition: 'background-color 9999s ease-in-out 0s',
            },
            'input[type="date"], input[type="datetime-local"], input[type="month"], input[type="time"]': {
              color: theme.palette.text.primary,
              colorScheme: theme.palette.mode,
              ...(theme.palette.mode === 'dark'
                ? {
                    backgroundColor: alpha(theme.palette.background.paper, 0.88),
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset',
                  }
                : {}),
            },
            'input[type="date"]::-webkit-calendar-picker-indicator, input[type="datetime-local"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator, input[type="time"]::-webkit-calendar-picker-indicator': {
              ...(theme.palette.mode === 'dark'
                ? { filter: 'invert(0.8) hue-rotate(180deg)', opacity: 0.8 }
                : {}),
            },
            'input[type="date"]::-moz-focus-inner, input[type="datetime-local"]::-moz-focus-inner, input[type="month"]::-moz-focus-inner, input[type="time"]::-moz-focus-inner': {
              border: 0,
            },
          })}
        />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};

export function getPaletteColor(theme: Theme, key?: SemanticColorKey) {
  if (!key) return theme.palette.divider;
  const pal = theme.palette as unknown as Record<string, { main?: string }>;
  return pal[key]?.main ?? theme.palette.divider;
}

export function stripeSx(
  colorKey?: SemanticColorKey,
  side: StripeSide = 'left',
  width = 4
) {
  return (theme: Theme) => ({
    [`border${side.charAt(0).toUpperCase() + side.slice(1)}`]:
      `${width}px solid ${getPaletteColor(theme, colorKey)}`
  });
}

type ColoredPaperProps = React.ComponentProps<typeof Paper> & {
  colorKey?: SemanticColorKey;
  stripeSide?: StripeSide;
  stripeWidth?: number;
  sx?: SxProps<Theme>;
};

// Ensures we always have an array to spread in `sx`
function toSxArray(sx?: SxProps<Theme>): readonly SxProps<Theme>[] {
  return Array.isArray(sx) ? sx : sx ? [sx] : [];
}

// Merge SxProps into a single SystemStyleObject for components
function mergeSx(input: SxProps<Theme>, theme: Theme): SystemStyleObject<Theme> {
  const flatten = (val: SxProps<Theme>): readonly SxProps<Theme>[] =>
    Array.isArray(val) ? val : [val];

  const out: SystemStyleObject<Theme> = {};
  for (const part of flatten(input)) {
    if (!part || typeof part === 'boolean') continue;
    const resolved = typeof part === 'function'
      ? (part as (t: Theme) => SystemStyleObject<Theme>)(theme)
      : part;
    if (!resolved) continue;
    if (Array.isArray(resolved)) {
      for (const sub of resolved) {
        if (!sub || typeof sub === 'boolean') continue;
        const subResolved = typeof sub === 'function'
          ? (sub as (t: Theme) => SystemStyleObject<Theme>)(theme)
          : sub;
        if (subResolved && typeof subResolved === 'object') Object.assign(out, subResolved);
      }
    } else if (typeof resolved === 'object') {
      Object.assign(out, resolved);
    }
  }
  return out;
}

export function ColoredPaper({
  colorKey,
  stripeSide = 'left',
  stripeWidth = 4,
  sx,
  ...props
}: ColoredPaperProps) {
  return (
    <Paper
      {...props}
      sx={(t) =>
        mergeSx(
          ([
            stripeSx(colorKey, stripeSide, stripeWidth),
            { borderRadius: 2 },
            ...toSxArray(sx),
          ] as SxProps<Theme>),
          t
        )
      }
    />
  );
}



export function stripePseudoSx(
  colorKey?: SemanticColorKey,
  side: 'left' | 'right' | 'top' | 'bottom' = 'left',
  width = 4,
  radius = 8
) {
  return (theme: Theme) => {
    const pal = theme.palette as unknown as Record<string, { main?: string }>;
    const color = colorKey ? (pal[colorKey]?.main ?? theme.palette.divider) : theme.palette.divider;

    const pos: Record<string, number> =
      side === 'left'
        ? { left: 0, top: 0, bottom: 0, width }
        : side === 'right'
        ? { right: 0, top: 0, bottom: 0, width }
        : side === 'top'
        ? { left: 0, right: 0, top: 0, height: width }
        : { left: 0, right: 0, bottom: 0, height: width };

    const radiusStyle =
      side === 'left'
        ? { borderTopLeftRadius: radius, borderBottomLeftRadius: radius }
        : side === 'right'
        ? { borderTopRightRadius: radius, borderBottomRightRadius: radius }
        : side === 'top'
        ? { borderTopLeftRadius: radius, borderTopRightRadius: radius }
        : { borderBottomLeftRadius: radius, borderBottomRightRadius: radius };

    return {
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        backgroundColor: color,
        ...pos,
        ...radiusStyle,
        pointerEvents: 'none',
      },
    };
  };
}
