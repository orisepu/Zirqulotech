'use client'

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentProps } from 'react'
import { useParams } from 'next/navigation'
import api from '@/services/api'
import FormularioValoracionOportunidad from '@/features/opportunities/components/forms/FormularioValoracionOportunidad'
import DatosRecogidaForm from '@/shared/components/DatosRecogida'
import { toast } from "react-toastify";
import { getId, getIdlink } from '@/shared/utils/id'
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight'
import useUsuarioActual from "@/shared/hooks/useUsuarioActual";
import EstadoChipSelector from '@/shared/components/cambiosestadochipselector'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColoredPaper } from '@/context/ThemeContext'
import { ESTADOS_META } from '@/context/estados'
import TabsOportunidad from '@/features/opportunities/components/TabsOportunidad'
import ComentariosPanel from '@/features/opportunities/components/ComentariosPanel'
import HistorialPanel from '@/features/opportunities/components/HistorialPanel'

type TabsOportunidadProps = ComponentProps<typeof TabsOportunidad>
type OportunidadResumen = TabsOportunidadProps['oportunidad']
// Tipos (opcionales, para claridad)
interface Modelo { descripcion: string }
interface Capacidad { tamaño?: string | number }
interface Dispositivo { id: number; modelo: Modelo; capacidad?: Capacidad; imei?: string; estado_fisico: string; estado_funcional: string; cantidad: number; precio_orientativo: number }
interface Comentario { id: number; texto: string; autor_nombre: string; fecha: string }
interface Factura { id: number; archivo: string; tipo: string; fecha_subida: string }
interface Cliente {
  canal?: 'b2b' | 'b2c' | string
  cif?: string
  direccion_calle?: string
  direccion_piso?: string
  direccion_puerta?: string
  direccion_cp?: string
  direccion_poblacion?: string
  direccion_provincia?: string
  contacto?: string
  telefono?: string
  correo?: string
}
interface HistorialEvento {
  id: number
  tipo_evento: string
  descripcion: string
  usuario_nombre: string
  fecha: string
}
interface DispositivoReal {
  modelo?: string
  capacidad?: string
  estado_valoracion?: string
  imei?: string
  numero_serie?: string
  precio_final?: number
  auditado?: boolean
  auditoria?: unknown
  auditado_en?: string
  auditado_por?: string
}
interface Oportunidad {
  id: number
  nombre: string
  estado: string
  fecha_creacion: string
  comentarios: Comentario[]
  facturas?: Factura[]
  plazo_pago_dias?: number | null
  fecha_inicio_pago?: string | null
  numero_seguimiento?: string
  url_seguimiento?: string
  cliente?: Cliente
  tienda?: unknown
  hashid?: string
  calle?: string
  numero?: string
  piso?: string
  puerta?: string
  codigo_postal?: string
  poblacion?: string
  provincia?: string
  persona_contacto?: string
  telefono_contacto?: string
  fecha_recogida?: string
  horario_recogida?: string
  instrucciones?: string
  dispositivos?: Dispositivo[]
}
interface DetalleOportunidadGlobal {
  nombre: string;
  oportunidad: Oportunidad;
  historial: HistorialEvento[];
  dispositivos_reales: DispositivoReal[];
  transiciones_validas?: {
    anteriores: string[];
    siguientes: string[];
    transiciones: string[];
  };
}
type RecogidaForm = {
  calle: string; numero: string; piso: string; puerta: string;
  codigo_postal: string; poblacion: string; provincia: string;
  persona_contacto: string; telefono_contacto: string;
  fecha_recogida: string; horario_recogida: string; instrucciones: string;
  correo_recogida?: string;
};
type CampoRecogida = keyof RecogidaForm;

type ColorKey = 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'

const allowedColorKeys = new Set<ColorKey>(['primary', 'secondary', 'error', 'info', 'success', 'warning'])

const resolveColorKey = (rawColor?: string | null): ColorKey => {
  if (rawColor && allowedColorKeys.has(rawColor as ColorKey)) return rawColor as ColorKey
  return 'primary'
}

const calcularDiasRestantesPago = (opp?: Oportunidad): number | null => {
  if (!opp?.plazo_pago_dias || !opp?.fecha_inicio_pago) return null
  const inicio = new Date(opp.fecha_inicio_pago)
  const hoy = new Date()
  hoy.setMinutes(hoy.getMinutes() + 1) // evita sumar +1 día por desajustes de hora
  const transcurridos = Math.floor((hoy.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, (opp.plazo_pago_dias ?? 0) - transcurridos)
}

export default function OportunidadDetallePageGlobal() {
  const { tenant, id } = useParams()
  const [tabActivo, setTabActivo] = useState(0)
  const [realesIdx, setRealesIdx] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const [abrirModal, setAbrirModal] = useState(false)
  const [itemAEditar, setItemAEditar] = useState<Dispositivo | null>(null)
  const [modalRecogidaAbierto, setModalRecogidaAbierto] = useState(false)
  const [modalFacturasAbierto, setModalFacturasAbierto] = useState(false)
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<string | null>(null)
  const usuario = useUsuarioActual();  
  const emptyPickupForm: RecogidaForm = {
    calle: '', numero: '', piso: '', puerta: '',
    codigo_postal: '', poblacion: '', provincia: '',
    persona_contacto: '', telefono_contacto: '',
    fecha_recogida: '', horario_recogida: '', instrucciones: '',
    correo_recogida: '',
  }
  const [formEdicion, setFormEdicion] = useState<RecogidaForm>(emptyPickupForm)
  const detalleQueryKey = useMemo(
    () => ['oportunidad-global', String(tenant), String(id)] as const,
    [tenant, id]
  )
  const transicionesQueryKey = useMemo(
    () => ['transiciones-validas', String(id)] as const,
    [id]
  )
  const invalidateDetalle = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: detalleQueryKey })
  }, [detalleQueryKey, queryClient])
  const invalidateTransiciones = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: transicionesQueryKey })
  }, [queryClient, transicionesQueryKey])
  
  // === useQuery: detalle unificado ===
  const { data, isLoading } = useQuery<DetalleOportunidadGlobal>({
    queryKey: ['oportunidad-global', String(tenant), String(id)] as const,
    queryFn: async () => {
      const { data } = await api.get(`/api/oportunidades-globales/${tenant}/${id}/detalle-completo/`)
      const payload: DetalleOportunidadGlobal = {
        nombre: data?.oportunidad?.nombre ?? String(id),
        oportunidad: data?.oportunidad,
        historial: data?.historial ?? [],
        dispositivos_reales: data?.dispositivos_reales ?? [],
        transiciones_validas: data?.transiciones_validas ?? { anteriores: [], siguientes: [], transiciones: [] }
      }
      // Sembra cache compatible para breadcrumbs (ya usamos la misma key)
      // console.debug('[oportunidad-global] nombre para breadcrumb:', payload.nombre) // quitar en producción
      return payload
    },
    staleTime: 60_000,
  })
  const oportunidad = data?.oportunidad
  const transiciones = data?.transiciones_validas ?? { anteriores: [], siguientes: [], transiciones: [] }
  const dispositivosReales = data?.dispositivos_reales ?? []
  const historial = data?.historial ?? []
  const meta = oportunidad?.estado ? ESTADOS_META[oportunidad.estado] : null
  const colorKey = resolveColorKey(meta?.color)
  const comentarios = oportunidad?.comentarios ?? []
  const facturas = oportunidad?.facturas ?? []
  const diasRestantesPago = calcularDiasRestantesPago(oportunidad)
  const isCanalB2B = oportunidad?.cliente?.canal === 'b2b'
  const isCanalB2C = oportunidad?.cliente?.canal === 'b2c'
  const totalFacturas = facturas.length
  const pickupFormValues = useMemo<RecogidaForm>(() => ({
    calle: oportunidad?.calle || '',
    numero: oportunidad?.numero || '',
    piso: oportunidad?.piso || '',
    puerta: oportunidad?.puerta || '',
    codigo_postal: oportunidad?.codigo_postal || '',
    poblacion: oportunidad?.poblacion || '',
    provincia: oportunidad?.provincia || '',
    persona_contacto: oportunidad?.persona_contacto || '',
    telefono_contacto: oportunidad?.telefono_contacto || '',
    fecha_recogida: oportunidad?.fecha_recogida || '',
    horario_recogida: oportunidad?.horario_recogida || '',
    instrucciones: oportunidad?.instrucciones || '',
    correo_recogida: oportunidad?.cliente?.correo || '',
  }), [oportunidad])

  const oportunidadResumen = useMemo(() => {
    if (!oportunidad) return undefined
    return {
      ...oportunidad,
      dispositivos: oportunidad.dispositivos?.map((d) => ({ ...d } as Record<string, unknown>)),
    } as OportunidadResumen
  }, [oportunidad])

  // === Mutations ===
  const mAgregarComentario = useMutation({
    mutationFn: async (texto: string) => {
      await api.post('/api/comentarios-oportunidad/', {
        oportunidad: data?.oportunidad?.id,
        texto,
        schema: tenant
      })
    },
    onSuccess: async () => {
      toast.success('Comentario añadido')
      await invalidateDetalle()
    },
    onError: () => toast.error('❌ Error al añadir comentario')
  })
  const enviarComentario = (texto: string) => {
    const limpio = texto.trim()
    if (!limpio) return
    mAgregarComentario.mutate(limpio)
  }

  const handleGenerarPDF = async () => {
    try {
      const res = await api.get(`/api/oportunidades-globales/${tenant}/${id}/generar-pdf/`, {
        responseType: 'blob',
        // headers: { Authorization: `Bearer ${token}` }, // si hace falta
      });

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');

      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        toast.warning("El navegador bloqueó la ventana emergente");
      }

      // Opcional: revoca el objeto URL tras unos segundos
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);

      toast.success(" PDF generado");
    } catch (err) {
      console.error(err);
      toast.error("❌ Error al generar el PDF");
    }
  };
  // Oferta formal - usa el endpoint seguro del backend con dispositivos auditados
  const verPDFEnNuevaPestana = async () => {
    if (!oportunidad?.id) return
    try {
      const res = await api.get(`/api/oportunidades/${oportunidad.id}/generar-pdf-formal/`, {
        responseType: 'blob',
        headers: {
          'X-Tenant': tenant as string
        }
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => window.URL.revokeObjectURL(url), 10000)
      toast.success('✅ PDF formal generado')
    } catch (error) {
      console.error('Error generando PDF formal:', error)
      toast.error('❌ Error al generar el PDF formal')
    }
  };

  const mCambiarEstado = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return api.patch(`/api/oportunidades-globales/${tenant}/${id}/detalle-completo/`, payload)
    },
    onSuccess: async () => {
      toast.success('Estado actualizado')
      await invalidateTransiciones()
      await invalidateDetalle()
    },
    onError: () => toast.error('❌ Error al cambiar el estado')
  })
  const mGuardarRecogida = useMutation({
    mutationFn: async (body: Partial<Oportunidad>) => {
      return api.patch(`/api/oportunidades-globales/${tenant}/${id}/detalle-completo/`, body)
    },
    onSuccess: async () => {
      toast.success('Datos de recogida actualizados')
      await invalidateDetalle()
    },
    onError: () => toast.error('Error al guardar los datos')
  })
  const handleGuardarDatosRecogida = async () => {
    mGuardarRecogida.mutate({
      calle: formEdicion.calle,
      numero: formEdicion.numero,
      piso: formEdicion.piso,
      puerta: formEdicion.puerta,
      codigo_postal: formEdicion.codigo_postal,
      poblacion: formEdicion.poblacion,
      provincia: formEdicion.provincia,
      persona_contacto: formEdicion.persona_contacto,
      telefono_contacto: formEdicion.telefono_contacto,
      instrucciones: formEdicion.instrucciones,
    })
  }


  const mBorrarDispositivo = useMutation({
    mutationFn: async (dispositivoId: number) => {
      return api.delete(`/api/dispositivos-globales/${tenant}/${dispositivoId}/`)
    },
    onSuccess: async () => {
      toast.success('Dispositivo eliminado')
      await invalidateDetalle()
    },
    onError: () => toast.error('❌ Error al eliminar el dispositivo.')
  })
  const handleDelete = (dispositivoId: number) => {
    mBorrarDispositivo.mutate(dispositivoId)
  }

  const mSubirFactura = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('oportunidad', String(id));
      return api.post(`/api/facturas/${tenant}/subir/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: async () => {
      toast.success('✅ Factura subida correctamente')
      await invalidateDetalle()
    },
    onError: () => toast.error('❌ Error al subir la factura')
  })
  const handleSubirFactura = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) mSubirFactura.mutate(file)
    event.target.value = ''
  }

  const descargarFactura = async (facturaId: number) => {
    try {
      const res = await api.get(`/api/documentos/${tenant}/${facturaId}/descargar/`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      toast.error("❌ Error al descargar la factura");
      console.error(err);
    }
  };
  const verFacturaEnIframe = async (facturaId: number) => {
    try {
      const res = await api.get(`/api/documentos/${tenant}/${facturaId}/descargar/`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setFacturaSeleccionada(url);
    } catch (err) {
      toast.error("❌ Error al cargar la vista previa");
      console.error(err);
    }
  };
  useEffect(() => {
    if (modalRecogidaAbierto) {
      setFormEdicion(pickupFormValues)
    }
  }, [modalRecogidaAbierto, pickupFormValues])


  if (isLoading) return <CircularProgress />
  if (!oportunidad) return <Typography>Oportunidad no encontrada</Typography>

  return (
    <>
      <Box>
        <ColoredPaper
          colorKey={colorKey}
          elevation={3}
          stripeSide="left"
          stripeWidth={4}
          sx={{ p: 2, mb: 3, width: '100%', boxSizing: 'border-box' }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" spacing={2}>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                Oportunidad {oportunidad.nombre}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {getId(oportunidad)}
              </Typography>
            </Box>
            <EstadoChipSelector
              estadoActual={oportunidad.estado}
              anteriores={transiciones.anteriores}
              siguientes={transiciones.siguientes}
              onSelect={(nuevo, extras) => {
                const payload = { estado: nuevo, ...(extras || {}) }
                mCambiarEstado.mutate(payload)
              }}
              disabledItem={() => false}
              getTooltip={(estado: string) =>
                transiciones.siguientes.includes(estado)
                  ? 'Mover a estado siguiente'
                  : transiciones.anteriores.includes(estado)
                  ? 'Volver a estado anterior'
                  : undefined
              }
            />
          </Stack>

          <Grid container spacing={2} mt={2}>
            <Grid size={{ xs: 12, md: 12 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Fecha de creación:</strong> {new Date(oportunidad.fecha_creacion).toLocaleString()}
              </Typography>

              {oportunidad.estado === 'Pendiente de pago' && diasRestantesPago !== null && (
                <Typography
                  variant="body2"
                  color={diasRestantesPago <= 5 ? 'error.main' : 'warning.main'}
                >
                  <strong>Días restantes para el pago:</strong> {diasRestantesPago} días
                </Typography>
              )}

              {oportunidad.numero_seguimiento && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Nº de seguimiento:</strong> {oportunidad.numero_seguimiento}{' '}
                  <a
                    href={oportunidad.url_seguimiento}
                    rel="noopener noreferrer"
                    style={{ fontWeight: 'bold', color: 'inherit', textDecoration: 'underline' }}
                  >
                    Ver enlace
                  </a>
                </Typography>
              )}
            </Grid>
          </Grid>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" mt={3}>
            <Button
              variant="contained"
              color="success"
              onClick={handleGenerarPDF}
              startIcon={<KeyboardDoubleArrowRightIcon />}
            >
              Descargar oferta
            </Button>
            {isCanalB2B && (
              <Button variant="contained" component="label" startIcon={<KeyboardDoubleArrowRightIcon />}>
                Subir factura
                <input hidden type="file" accept="application/pdf" onChange={handleSubirFactura} />
              </Button>
            )}
            <Button
              variant="contained"
              color="secondary"
              onClick={() => window.location.assign(`/auditorias/${getIdlink(oportunidad)}?tenant=${tenant}`)}
            >
              Auditoría
            </Button>
            <Button
              variant="contained"
              color="info"
              onClick={() => window.location.assign(`/recepcion/${getIdlink(oportunidad)}?tenant=${tenant}`)}
            >
              Recepción
            </Button>
            {isCanalB2C && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  const url = `/oportunidades/global/${tenant}/${getIdlink(oportunidad)}/b2c`
                  window.open(url, '_blank')
                }}
              >
                Revisar KYC / Acta
              </Button>
            )}
            {totalFacturas > 0 && (
              <Button variant="outlined" color="warning" onClick={() => setModalFacturasAbierto(true)}>
                Ver facturas ({totalFacturas})
              </Button>
            )}
          </Stack>
        </ColoredPaper>

        <Grid container spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'stretch' }}>
          <Grid
            size={{ xs: 12, md: realesIdx !== null && tabActivo === realesIdx ? 12 : 6 }}
            sx={{ display: 'flex', minWidth: { xs: 0, sm: '22rem', md: '24rem', lg: '25rem' } }}
          >
            <TabsOportunidad
              oportunidad={oportunidadResumen as OportunidadResumen}
              dispositivosReales={dispositivosReales as unknown as Record<string, unknown>[]}
              usuarioId={usuario?.id}
              onEditarItem={(item) => {
                if (item) {
                  const raw = item as Record<string, unknown>
                  const rawId = raw['id']
                  const parsedId =
                    typeof rawId === 'number'
                      ? rawId
                      : typeof rawId === 'string'
                      ? Number(rawId)
                      : null
                  const seleccionado =
                    parsedId !== null && Number.isFinite(parsedId)
                      ? oportunidad?.dispositivos?.find((d) => d.id === parsedId) ?? null
                      : null
                  setItemAEditar(seleccionado)
                } else {
                  setItemAEditar(null)
                }
                setAbrirModal(true)
              }}
              onEliminarItem={handleDelete}
              onAbrirRecogida={() => setModalRecogidaAbierto(true)}
              onTabChange={(index, info) => {
                setTabActivo(index)
                const realesIndex = info && typeof info.realesIdx === 'number' && info.realesIdx >= 0 ? info.realesIdx : null
                setRealesIdx(realesIndex)
              }}
              renderAccionesReales={dispositivosReales.length > 0
                ? () => (
                    <Box mt={2}>
                      <Button variant="outlined" color="primary" onClick={verPDFEnNuevaPestana}>
                        Ver oferta PDF
                      </Button>
                    </Box>
                  )
                : undefined}
              permitirEdicionResumen
            />
          </Grid>

          {(realesIdx === null || tabActivo !== realesIdx) && (
            <Grid size={{ xs: 12, md: 3 }} sx={{ display: 'flex', minWidth: { xs: 0, sm: '18rem', md: '19rem', lg: '20rem' } }}>
              <ComentariosPanel
                comentarios={comentarios}
                onEnviar={enviarComentario}
                _enviando={mAgregarComentario.isPending}
              />
            </Grid>
          )}

          {(realesIdx === null || tabActivo !== realesIdx) && (
            <Grid size={{ xs: 12, md: 3 }} sx={{ display: 'flex', minWidth: { xs: 0, sm: '16rem', md: '17rem', lg: '18rem' } }}>
              <HistorialPanel historial={historial} />
            </Grid>
          )}
        </Grid>
      </Box>

      <Dialog
        open={abrirModal}
        onClose={() => {
          setAbrirModal(false)
          setItemAEditar(null)
        }}
        maxWidth="md"
        fullWidth
      >
        <FormularioValoracionOportunidad
          oportunidadId={oportunidad.id}
          oportunidadUuid={String(id)}
          item={itemAEditar ? {
            id: itemAEditar.id,
            modelo: itemAEditar.modelo ? {
              id: itemAEditar.id,
              descripcion: itemAEditar.modelo.descripcion
            } : undefined,
            capacidad: itemAEditar.capacidad ? {
              id: itemAEditar.capacidad.tamaño || ''
            } : undefined,
            cantidad: itemAEditar.cantidad
          } : undefined}
          onClose={() => {
            setAbrirModal(false)
            setItemAEditar(null)
          }}
          onSuccess={async () => {
            await invalidateDetalle()
            setAbrirModal(false)
            setItemAEditar(null)
          }}
        />
      </Dialog>

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
            oportunidad={oportunidad}
            onChange={(campo: CampoRecogida, valor: string) =>
              setFormEdicion((prev) => ({ ...prev, [campo]: valor }))
            }
            onSave={async () => {
              await handleGuardarDatosRecogida()
              setModalRecogidaAbierto(false)
            }}
            rellenarDesdeOportunidad={(opp: Oportunidad) => {
              setFormEdicion((prev) => ({
                ...prev,
                calle: opp.cliente?.direccion_calle || '',
                piso: opp.cliente?.direccion_piso || '',
                puerta: opp.cliente?.direccion_puerta || '',
                codigo_postal: opp.cliente?.direccion_cp || '',
                poblacion: opp.cliente?.direccion_poblacion || '',
                provincia: opp.cliente?.direccion_provincia || '',
                persona_contacto: opp.cliente?.contacto || '',
                telefono_contacto: opp.cliente?.telefono || '',
                correo_recogida: opp.cliente?.correo || '',
                instrucciones: opp.instrucciones || '',
              }))
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalFacturasAbierto}
        onClose={() => {
          setModalFacturasAbierto(false)
          setFacturaSeleccionada(null)
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Facturas subidas</DialogTitle>
        <DialogContent dividers>
          {facturas.map((factura) => (
            <Paper key={factura.id} sx={{ p: 2, mb: 2 }}>
              <Typography variant="body2">
                Subida el {new Date(factura.fecha_subida).toLocaleString()}
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" onClick={() => verFacturaEnIframe(factura.id)}>
                  Ver
                </Button>
                <Button size="small" variant="outlined" onClick={() => descargarFactura(factura.id)}>
                  Descargar
                </Button>
              </Box>
            </Paper>
          ))}

          {facturaSeleccionada && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Vista previa:
              </Typography>
              <iframe
                src={facturaSeleccionada}
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
