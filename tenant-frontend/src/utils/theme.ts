import type { Theme } from '@mui/material/styles'
import type { ChipProps } from '@mui/material/Chip'

type ChipColor = NonNullable<ChipProps['color']>
type PaletteKey = Exclude<ChipColor, 'default'>

export function chipColorToCss(theme: Theme, color?: ChipColor) {
  if (!color || color === 'default') return theme.palette.divider
  return theme.palette[color as PaletteKey].main
}
