'use client'
import { Box, Paper, Stack, Typography, Button } from '@mui/material'
import { getId } from '@/utils/id'
import EstadoChipSelector from '@/components/cambiosestadochipselector'
import { ESTADOS_META } from '@/context/estados'
import PartnerCreateMarcoPanel from '../contratos/PartnerCreateMarcoPanel'

type Props = {
  oportunidad: any
  transiciones: { anteriores: string[]; siguientes: string[] }
  onCambiarEstado: (nuevo: string, extras?: any) => void
  onGenerarTemporal: () => void
  onGenerarFormal: () => void
  onIrRecepcion?: () => void
  onIrAuditoria?: () => void
  onSubirFactura?: (file: File) => void
  onAbrirFacturas?: () => void
  hayReales: boolean
  hayAuditados: boolean
  auditoriaFinalizada: boolean
}

export default function CabeceraOportunidad({
  oportunidad, transiciones, onCambiarEstado,
  onGenerarTemporal, onGenerarFormal, onIrRecepcion, onIrAuditoria,
  onSubirFactura, onAbrirFacturas, hayReales, hayAuditados, auditoriaFinalizada,
}: Props) {
  const meta = oportunidad?.estado ? ESTADOS_META[oportunidad.estado] : null

  return (
    <Paper elevation={3} sx={{ p: 2, mb: 3, borderLeft: (t) =>
      `4px solid ${meta?.color ? (t.palette as any)[meta.color].main : t.palette.divider}` }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Oportunidad {oportunidad.nombre}</Typography>
          <Typography variant="subtitle1" color="text.secondary">ID: {getId(oportunidad)}</Typography>
          <Typography variant="body2" color="text.secondary">
                <strong>Fecha de creación:</strong> {new Date(oportunidad.fecha_creacion).toLocaleString()}
          </Typography>
           {!!oportunidad.numero_seguimiento && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Nº de seguimiento:</strong> {oportunidad.numero_seguimiento}{' '}
                  <a
                    href={oportunidad.url_seguimiento}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontWeight: 'bold', color: 'inherit', textDecoration: 'underline' }}
                  >
                    Ver enlace
                  </a>
                </Typography>
              )}
        </Box>

        <EstadoChipSelector
          estadoActual={oportunidad.estado}
          anteriores={transiciones.anteriores}
          siguientes={transiciones.siguientes}
          onSelect={(nuevo, extras) => onCambiarEstado(nuevo, extras)}
          disabledItem={() => false}
          getTooltip={(estado) =>
            transiciones.siguientes.includes(estado)
              ? 'Mover a estado siguiente'
              : transiciones.anteriores.includes(estado)
              ? 'Volver a estado anterior'
              : undefined
          }
        />
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" mt={3}>
        {!hayAuditados && <Button variant="outlined" onClick={onGenerarTemporal}>Oferta temporal</Button>}
        {auditoriaFinalizada && <Button variant="outlined" onClick={onGenerarFormal}>Oferta formal</Button>}
        {hayReales && onIrRecepcion && <Button variant="outlined" onClick={onIrRecepcion}>Ver recepción</Button>}
        {hayAuditados && onIrAuditoria && <Button variant="outlined" onClick={onIrAuditoria}>Ver auditoría</Button>}
        {oportunidad.estado === 'Pendiente factura' && onSubirFactura && (
          <Button variant="outlined" component="label">
            Subir factura
            <input hidden type="file" accept="application/pdf" onChange={(e) => {
              const f = e.target.files?.[0]; if (f) onSubirFactura(f)
            }} />
          </Button>
          
        )}
        {oportunidad.cliente.canal === 'b2c' && oportunidad.estado === "Aceptado" || oportunidad.estado === "Contrato firmado" && <PartnerCreateMarcoPanel oportunidadUUID={oportunidad.uuid}/>}
        {!!oportunidad?.facturas?.length && onAbrirFacturas && (
          <Button variant="outlined" onClick={onAbrirFacturas}>
            Ver facturas ({oportunidad.facturas.length})
          </Button>
        )}
      </Stack>
    </Paper>
  )
}
