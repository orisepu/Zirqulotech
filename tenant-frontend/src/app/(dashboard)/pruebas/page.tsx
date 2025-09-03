'use client'
import { useState } from 'react'
import CameraDNI from '../../../components/contratos/cameraDNI'

export default function DemoCam() {
  const [open, setOpen] = useState(true)
  const [imgUrl, setImgUrl] = useState<string | null>(null)

  return (
    <>
      <CameraDNI
        open={open}
        onClose={() => setOpen(false)}
        lado="anverso"
        onCapture={(file) => {
          if (imgUrl) URL.revokeObjectURL(imgUrl)
          setImgUrl(URL.createObjectURL(file))
        }}
        minSharpness={60}
        minEdgeDensity={0.12}
        autoCapture={true}
      />
      {imgUrl && (
        <div style={{ padding: 16 }}>
          <p>Última captura:</p>
          <img src={imgUrl} alt="resultado" style={{ maxWidth: 360, width: '100%' }} />
        </div>
      )}
    </>
  )
}
