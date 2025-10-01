import { Box, Tooltip, Typography, type TooltipProps } from '@mui/material'
import { useEffect, useRef, useState } from 'react'

export function EllipsisTooltip({
  text,
  maxWidth = '100%',
  typographyProps = {},
  tooltipProps,          // <- props del Tooltip (no del DOM)
  disablePortal = false, // <- comodidad
}: {
  text: string
  maxWidth?: number | string
  typographyProps?: React.ComponentProps<typeof Typography>
  tooltipProps?: Omit<TooltipProps, 'title' | 'children'>
  disablePortal?: boolean
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [overflow, setOverflow] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setOverflow(el.scrollWidth > el.clientWidth)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [text])

  const content = (
    <Typography
      ref={ref}
      component="span"
      noWrap
      sx={{ maxWidth, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'middle' }}
      {...typographyProps}
    >
      {text}
    </Typography>
  )

  if (!overflow) return content

  return (
    <Tooltip
      title={text}
      // v5:
      PopperProps={disablePortal ? { disablePortal: true } : undefined}
      // v6:
      slotProps={disablePortal ? { popper: { disablePortal: true } } : undefined}
      {...tooltipProps}
    >
      <Box component="span" sx={{ display: 'inline-block', maxWidth: 'inherit' }}>
        {content}
      </Box>
    </Tooltip>
  )
}
