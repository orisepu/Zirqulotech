'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box, Grid, Paper, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material'
import { pdf } from '@react-pdf/renderer'

import { useOportunidadData, toastApiError } from '@/hooks/useOportunidadData'
import useUsuarioActual from '@/hooks/useUsuarioActual'

import CabeceraOportunidad from '@/components/oportunidades/CabeceraOportunidad'
import ComentariosPanel from '@/components/oportunidades/ComentariosPanel'
import HistorialPanel from '@/components/oportunidades/HistorialPanel'
import TabsOportunidad from '@/components/oportunidades/TabsOportunidad'

import FormularioValoracionOportunidad from '@/components/formularios/dispositivos/FormularioValoracionOportunidad'
import DatosRecogidaForm from '@/components/DatosRecogida'
import OfertaPDFDocument from '@/components/pdf/OfertaPDFDocument'
import { toast } from 'react-toastify'

type Oportunidad = any
type DatosRecogida = {
  calle: string
  numero?: string
  piso?: string
  puerta?: string
  codigo_postal?: string
  poblacion?: string
  provincia?: string
  persona_contacto?: string
  telefono_contacto?: string
  correo_recogida?: string
  instrucciones?: string
}
type CampoRecogida = keyof DatosRecogida
export default function OportunidadDetallePage() {
  const { id } = useParams()
  const router = useRouter()
  const usuario = useUsuarioActual()
  const [tabActivo, setTabActivo] = useState(0)
  const [realesIdx, setRealesIdx] = useState<number | null>(null)
  // UI state (solo diálogos y pequeñas ayudas)
  const [abrirModalItem, setAbrirModalItem] = useState(false)
  const [itemAEditar, setItemAEditar] = useState<any | null>(null)
  const { refetchTodo } = useOportunidadData(String(id))
  const [modalRecogidaAbierto, setModalRecogidaAbierto] = useState(false)
  const [formEdicion, setFormEdicion] = useState<Partial<DatosRecogida>>({})

  const [modalFacturasAbierto, setModalFacturasAbierto] = useState(false)
  const [facturaSeleccionadaURL, setFacturaSeleccionadaURL] = useState<string | null>(null)

  // Datos y mutations centralizados
  const {
    oportunidad, transiciones, historial, reales,
    guardarEstado, enviarComentario, eliminarDispositivo, guardarRecogida,
    generarPDF, subirFactura, descargarDocumento, verDocumentoURL,
  } = useOportunidadData(String(id))

  const cargando =
    oportunidad.isLoading ||
    transiciones.isLoading ||
    historial.isLoading ||
    reales.isLoading

  const opp: Oportunidad | undefined = oportunidad.data

  // Derivados
  const dispositivosReales = reales.data ?? []
  const hayReales = (dispositivosReales?.length ?? 0) > 0
  const hayAuditados = (dispositivosReales ?? []).some(
    (d: any) => d?.auditado === true || !!d?.auditoria || !!d?.auditado_en || !!d?.auditado_por
  )
  const auditoriaFinalizada =
    hayReales &&
    (dispositivosReales ?? []).every(
      (d: any) => d?.auditado === true || !!d?.auditoria || !!d?.auditado_en || !!d?.auditado_por
    )

  const transDisp = transiciones.data?.disponibles || { anteriores: [], siguientes: [] }

  // Al abrir el modal de recogida, precargar form desde la oportunidad
  useEffect(() => {
    if (modalRecogidaAbierto && opp) {
      setFormEdicion({
        calle: opp.calle || '',
        numero: opp.numero || '',
        piso: opp.piso || '',
        puerta: opp.puerta || '',
        codigo_postal: opp.codigo_postal || '',
        poblacion: opp.poblacion || '',
        provincia: opp.provincia || '',
        persona_contacto: opp.persona_contacto || '',
        telefono_contacto: opp.telefono_contacto || '',
        correo_recogida: opp.correo_recogida || '',
        instrucciones: opp.instrucciones || '',
      })
    }
  }, [modalRecogidaAbierto, opp])

  // Oferta formal (React-PDF en nueva pestaña) — usa los reales auditados
  const verPDFEnNuevaPestana = async () => {
    if (!opp) return
    const blob = await pdf(
      <OfertaPDFDocument
dispositivos={dispositivosReales.map((d: any) => ({
          modelo: d.modelo || '',
          capacidad: d.capacidad || '',
          estado: d.estado_valoracion || '',
          imei: d.imei || '',
          numero_serie: d.numero_serie || '',
          precio: Number(d.precio_final) || 0,
        }))}
        total={dispositivosReales.reduce((acc: number, d: any) => acc + (Number(d.precio_final) || 0), 0)}
        nombre={String(opp?.hashid ?? opp?.id)}
        oportunidad={opp}                 // ✅ nombre de prop correcto
        cif={opp?.cliente?.cif}
        calle={opp?.calle ?? opp?.cliente?.direccion_calle ?? ''}  // ✅ string
        tienda={opp?.tienda}
        logoUrl="/logo-progeek.png"
      />
    ).toBlob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  // Handlers simples
  const onCambiarEstado = (nuevo: string, extras?: any) =>
    guardarEstado.mutate({ estado: nuevo, ...(extras || {}) })

  const onGenerarTemporal = () => generarPDF.mutate()

  const onSubirFactura = (file: File) => subirFactura.mutate(file)

  const onAbrirFacturas = () => setModalFacturasAbierto(true)

  const onIrRecepcion = () => router.push(`/clientes/oportunidades/${id}/recepcion`)
  const onIrAuditoria = () => router.push(`/clientes/oportunidades/${id}/auditoria`)

  const onEditarItem = (item: any | null) => {
    setItemAEditar(item)
    setAbrirModalItem(true)
  }
  const onEliminarItem = (dispositivoId: number) => {
    eliminarDispositivo.mutate(dispositivoId)
  }
  const onAbrirRecogida = () => setModalRecogidaAbierto(true)

  const onGuardarRecogida = async () => {
    try {
      await guardarRecogida.mutateAsync({ ...formEdicion })
      setModalRecogidaAbierto(false)
    } catch {
      
    }
  }

  const generarOrdenRecogida = async () => {
    try {
      await guardarRecogida.mutateAsync({ ...formEdicion })
      await guardarEstado.mutateAsync({ estado: 'Recogida solicitada' })
      toast.success('Orden de recogida generada')
      setModalRecogidaAbierto(false)
    } catch {
      toast.error('❌ No se pudo generar la orden de recogida')
    }
  }

  const onVerFactura = async (docId: number) => {
    try {
      const data = await verDocumentoURL.mutateAsync(docId)
      const blob = new Blob([data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setFacturaSeleccionadaURL(url)
    } catch {
      toast.error('❌ Error al cargar la vista previa')
    }
  }

  if (cargando || !opp) return <Typography sx={{ p: 2 }}>Cargando...</Typography>

  return (
    <>
      <Box>
        {/* Cabecera + acciones */}
        <CabeceraOportunidad
          oportunidad={opp}
          transiciones={transDisp}
          hayReales={hayReales}
          hayAuditados={hayAuditados}
          auditoriaFinalizada={auditoriaFinalizada}
          onCambiarEstado={onCambiarEstado}
          onGenerarTemporal={onGenerarTemporal}
          onGenerarFormal={verPDFEnNuevaPestana}
          onIrRecepcion={onIrRecepcion}
          onIrAuditoria={onIrAuditoria}
          onSubirFactura={onSubirFactura}
          onAbrirFacturas={onAbrirFacturas}
        />



        {/* Cuerpo */}
        <Grid container spacing={1}  sx={{ justifyContent: "space-between", alignItems: "stretch" }}>
          {/* IZQ: Tabs */}
          <Grid size={{xs:12, md: (realesIdx !== null && tabActivo === realesIdx) ? 12 : 6 }}  sx={{ display: 'flex', minWidth: 400 }}>
            <TabsOportunidad
              oportunidad={opp}
              dispositivosReales={dispositivosReales}
              usuarioId={usuario?.id}
              onEditarItem={onEditarItem}
              onEliminarItem={onEliminarItem}
              onAbrirRecogida={onAbrirRecogida}
              onTabChange={(i, info) => {
                setTabActivo(i)
                if (info && typeof info.realesIdx === 'number') setRealesIdx(info.realesIdx)
              }}
            />
          </Grid>

          {/* CENTRO-DERECHA: Comentarios */}
          {(realesIdx === null || tabActivo !== realesIdx) && (
          <Grid size={{xs:12, md:3}} sx={{ display: 'flex', minWidth: 400 }}>
            <ComentariosPanel
              comentarios={opp?.comentarios || []}
              onEnviar={(t) => enviarComentario.mutate(t)}
              _enviando={enviarComentario.isPending}
            />
          </Grid>)}

          {/* DERECHA: Historial */}
          {(realesIdx === null || tabActivo !== realesIdx) && (
          <Grid size={{xs:12, md:3}} sx={{ display: 'flex', minWidth: 300 }}>
            <HistorialPanel historial={historial.data || []} />
          </Grid>)}
        </Grid>
      </Box>

      {/* DIALOG: Añadir/editar dispositivo */}
      <Dialog
        open={abrirModalItem}
        onClose={() => { setAbrirModalItem(false); setItemAEditar(null) }}
        maxWidth="lg"
        fullWidth
      >
        <FormularioValoracionOportunidad
          oportunidadId={opp.id}
          oportunidadUuid={opp.uuid}
          oportunidad={opp}
          
          item={itemAEditar}
          onClose={() => { setAbrirModalItem(false); setItemAEditar(null) }}
          onSuccess={() => { setAbrirModalItem(false); setItemAEditar(null) ; refetchTodo() /* refetch desde hook */ }}
        />
      </Dialog>

      {/* DIALOG: Datos de recogida */}
      <Dialog
        open={modalRecogidaAbierto}
        onClose={() => setModalRecogidaAbierto(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Datos de recogida</DialogTitle>
        <DialogContent>
          <DatosRecogidaForm
            id={id}
            datos={formEdicion}
            oportunidad={opp}
            onChange={(campo: CampoRecogida, valor: string) =>
              setFormEdicion((p) => ({ ...p, [campo]: valor }))}
            onSave={onGuardarRecogida}
            generarOrden={generarOrdenRecogida}
            rellenarDesdeOportunidad={(o: any) => {
              setFormEdicion((prev: any) => ({
                ...prev,
                calle: o?.cliente?.direccion_calle || '',
                piso: o?.cliente?.direccion_piso || '',
                puerta: o?.cliente?.direccion_puerta || '',
                codigo_postal: o?.cliente?.direccion_cp || '',
                poblacion: o?.cliente?.direccion_poblacion || '',
                provincia: o?.cliente?.direccion_provincia || '',
                persona_contacto: o?.cliente?.contacto || '',
                telefono_contacto: o?.cliente?.telefono || '',
                correo_recogida: o?.cliente?.correo || '',
                instrucciones: o?.instrucciones || '',
              }))
            }}
          />
        </DialogContent>
      </Dialog>

      {/* DIALOG: Facturas */}
      <Dialog
        open={modalFacturasAbierto}
        onClose={() => { setModalFacturasAbierto(false); setFacturaSeleccionadaURL(null) }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Facturas subidas</DialogTitle>
        <DialogContent dividers>
          {(opp?.facturas || []).map((f: any) => (
            <Paper key={f.id} sx={{ p: 2, mb: 2 }}>
              <Typography variant="body2">
                Subida el {new Date(f.fecha_subida).toLocaleString()}
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" onClick={() => onVerFactura(f.id)}>Ver</Button>
                <Button size="small" variant="outlined" onClick={() => descargarDocumento(f.id)}>Descargar</Button>
              </Box>
            </Paper>
          ))}

          {facturaSeleccionadaURL && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>Vista previa:</Typography>
              <iframe
                src={facturaSeleccionadaURL}
                width="100%"
                height="500px"
                style={{ border: '1px solid #ccc' }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalFacturasAbierto(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
