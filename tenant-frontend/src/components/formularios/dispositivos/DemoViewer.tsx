'use client'
import { Dialog, DialogTitle, DialogContent, Box } from '@mui/material'
import Image from 'next/image'

export default function DemoViewer({ open, demo, onClose }: { open: boolean, demo: { src: string, title: string } | null, onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{demo?.title}</DialogTitle>
      <DialogContent>
        {demo && (
          <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', bgcolor: '#000', borderRadius: 1, overflow: 'hidden' }}>
            <Image src={demo.src} alt={demo.title} fill style={{ objectFit: 'contain' }} sizes="(max-width: 900px) 100vw, 900px" />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
