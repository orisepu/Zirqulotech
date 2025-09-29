import { AlertColor, Theme } from "@mui/material";

export const getFilledAlertStyles = (severity: AlertColor) => (theme: Theme) => {
  const paletteEntry = theme.palette[severity] ?? theme.palette.info;
  const main = paletteEntry.main;
  const contrast = theme.palette.getContrastText(main);

  return {
    backgroundColor: main,
    color: contrast,
    '& .MuiAlert-icon': {
      color: contrast,
    },
    '& .MuiAlert-action': {
      color: contrast,
    },
    '& a': {
      color: contrast,
      fontWeight: 600,
    },
  };
};
