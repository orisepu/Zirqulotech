import { Box } from '@mui/material'
import React from 'react'

export interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
  sx?: any
}

/**
 * TabPanel Component
 *
 * Wrapper component for tab content that handles visibility
 * based on the active tab index.
 *
 * @example
 * ```tsx
 * <TabPanel value={activeTab} index={0}>
 *   Content for first tab
 * </TabPanel>
 * ```
 */
export function TabPanel({ children, value, index, sx, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2, ...sx }}>{children}</Box>}
    </div>
  )
}
