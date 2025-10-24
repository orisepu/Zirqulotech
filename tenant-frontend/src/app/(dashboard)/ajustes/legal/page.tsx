'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import rehypeSanitize from 'rehype-sanitize'
import {
  Box, Paper, Typography, Tabs, Tab, Stack, Button, TextField,
  CircularProgress, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButtonGroup, ToggleButton, Menu, MenuItem, Divider, Tooltip,
  FormControl, InputLabel, Select
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import HistoryIcon from '@mui/icons-material/History'
import api from '@/services/api'
import { PUBLIC_BASE_URL } from '@/shared/config/env'
import { useQuery, useMutation } from '@tanstack/react-query'

// estilos del editor markdown



// --- Dynamic imports (client-only)
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })
const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview'), { ssr: false })
const DiffEditor = dynamic(() => import('@monaco-editor/react').then(m => m.DiffEditor), { ssr: false })
const JsonEditor = dynamic(async () => (await import('json-edit-react')).JsonEditor, { ssr: false })

// --- Profiles (namespace + slug) ---
type Profile = { id: string; label: string; ns: string; slug: string; help?: string }
const PROFILES: Profile[] = [
  { id: 'managed',   label: 'B2C · Gestionados (default)',     ns: 'default', slug: 'b2c-condiciones', help: 'Plantilla usada por tenants gestionados' },
  { id: 'autoadmin', label: 'B2C · Autoadmin (base)',          ns: 'default', slug: 'b2c-condiciones-autoadmin', help: 'Base para autoadministrados' },
  { id: 'mandatory', label: 'Bloques obligatorios (operador)', ns: 'default', slug: 'b2c-mandatorio-operador', help: 'Cláusulas obligatorias que se inyectan' },
]

// --- Helpers ---
const VAR_SUGGESTIONS: Record<string, string[]> = {
  operador: ['nombre','cif','direccion','email','telefono','web','retencion_meses','direccion_logistica'],
  empresa: ['nombre','cif','direccion','email','telefono','web','direccion_logistica'],
  cliente: ['nombre','apellidos','dni_nie','email','telefono','direccion'],
  contrato: ['numero','fecha','otp_hash','kyc_ref','importe_total','validez_dias','comision_pct'],
  dispositivos: ['[].modelo','[].imei_serial','[].capacidad','[].estado_fisico','[].estado_funcional','[].precio'],
  condiciones: ['[]']
}

function sanitizeDjangoTemplate(s: string) {
  return (s || '')
    .replaceAll('{%-', '{%')
    .replaceAll('-%}', '%}')
    .replaceAll('{{-', '{{')
    .replaceAll('-}}', '}}')
    .replace(/\{\%\s*for([^%]+)-\s*\%\}/g, '{% for$1 %}')
    .replace(/\{\%\s*endfor\s*-\s*\%\}/g, '{% endfor %}')
}

function bumpVersion(v?: string) {
  const m = /^v?(\d+)(?:\.(\d+))?$/i.exec(v || '')
  if (!m) return 'v2'
  const maj = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  return `v${maj}.${min + 1}`
}

// --- Data hooks ---
function useB2CTemplate(ns: string, slug: string) {
  return useQuery({
    queryKey: ['b2c-template', ns, slug],
    queryFn: async () => {
      const { data } = await api.get('/api/ajustes/legales/plantilla/', { params: { namespace: ns, slug } })
      return data as { namespace: string; slug: string; title: string; version: string; content: string }
    }
  })
}

type TemplateVersion = {
  namespace: string
  slug: string
  title: string
  version: string
  content: string
  is_active: boolean
  updated_at: string
}

function useTemplateVersions(ns: string, slug: string) {
  return useQuery({
    queryKey: ['b2c-versions', ns, slug],
    queryFn: async () => {
      const { data } = await api.get('/api/ajustes/legales/plantilla/versiones', { params: { namespace: ns, slug } })
      return data as TemplateVersion[]
    }
  })
}

function useNamespaceVars(ns = 'default') {
  return useQuery({
    queryKey: ['legal-vars', ns],
    queryFn: async () => {
      const { data } = await api.get('/api/ajustes/legales/variables/', { params: { namespace: ns } })
      return data as { namespace: string; data: any }
    }
  })
}

// --- Page component ---
export default function AjustesLegalesPage() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  // Perfil de plantilla seleccionado
  const [profileId, setProfileId] = useState<string>('managed')
  const profile = useMemo(
    () => PROFILES.find(p => p.id === profileId)!,
    [profileId]
  )
  const NS = profile.ns
  const SLUG = profile.slug

  const [tab, setTab] = useState(0)
  const [toast, setToast] = useState<{open: boolean; msg: string; sev: 'success'|'error'}>({open:false, msg:'', sev:'success'})
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')

  // plantilla (dependiente de perfil)
  const { data: tpl, isLoading: loadTpl, refetch: refetchTpl } = useB2CTemplate(NS, SLUG)
  const [tplTitle, setTplTitle] = useState('')
  const [tplVersion, setTplVersion] = useState('')
  const [tplContent, setTplContent] = useState('')

  useEffect(() => {
    if (tpl) {
      setTplTitle(tpl.title || '')
      setTplVersion(tpl.version || 'v1')
      setTplContent(tpl.content || '')
    }
  }, [tpl])

  // versiones (dependiente de perfil)
  const { data: versions, refetch: refetchVersions, isLoading: loadingVersions } = useTemplateVersions(NS, SLUG)
  const [versionsOpen, setVersionsOpen] = useState(false)

  // diff dialog
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffOld, setDiffOld] = useState('')
  const [diffNew, setDiffNew] = useState('')

  const saveTpl = useMutation({
    mutationFn: async (payload: { title: string; version: string; content: string }) => {
      const content = sanitizeDjangoTemplate(payload.content)
      const { data } = await api.put(
        '/api/ajustes/legales/plantilla/',
        { ...payload, content },
        { params: { namespace: NS, slug: SLUG } }
      )
      return data
    },
    onSuccess: () => { setToast({open:true, msg:'Plantilla guardada', sev:'success'}); refetchTpl(); refetchVersions() },
    onError: (e: any) => setToast({open:true, msg: e?.response?.data?.detail || 'Error al guardar plantilla', sev:'error'})
  })

  const renderPreview = useMutation({
    mutationFn: async (content: string) => {
      const { data } = await api.post('/api/ajustes/legales/render-preview/', {
        content: sanitizeDjangoTemplate(content),
      })
      return data as { rendered: string }
    },
    onSuccess: (data) => { setPreviewText(data.rendered); setPreviewOpen(true) },
    onError: (e: any) => setToast({open:true, msg: e?.response?.data?.detail || 'Error al previsualizar', sev:'error'})
  })

  const publishTpl = useMutation({
    mutationFn: async (payload: { title: string; version: string; content: string }) =>
      (await api.post('/api/ajustes/legales/plantilla/publicar', {
        ...payload,
        content: sanitizeDjangoTemplate(payload.content),
        namespace: NS,
        slug: SLUG
      })).data,
    onSuccess: () => { setToast({open:true, msg:'Nueva versión publicada', sev:'success'}) ; refetchTpl(); refetchVersions() },
    onError: (e: any) => setToast({open:true, msg: e?.response?.data?.detail || 'Error al publicar versión', sev:'error'})
  })

  // overrides (variables)
  const [varsNs, setVarsNs] = useState('default') // escribe 'tenant:<uuid>' si quieres editar por-tenant
  const { data: defaults, isLoading: loadDef, refetch: refetchDef } = useNamespaceVars(varsNs)
  const [ovMode, setOvMode] = useState<'visual'|'json'>('visual')
  const [ovJson, setOvJson] = useState<any>({})
  const [ovText, setOvText] = useState('')

  useEffect(() => {
    if (defaults?.data != null) {
      setOvJson(defaults.data)
      setOvText(JSON.stringify(defaults.data, null, 2))
    }
  }, [defaults?.data])

  const saveOv = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.put(`/api/ajustes/legales/variables/?namespace=${encodeURIComponent(varsNs)}`, { data: payload })
      return data
    },
    onSuccess: () => { setToast({open:true, msg:'Variables guardadas', sev:'success'}); refetchDef() },
    onError: (e: any) => setToast({open:true, msg: e?.response?.data?.detail || 'Error al guardar variables', sev:'error'})
  })

  // insertar en el editor (append al final)
  const insertAtEnd = (text: string) =>
    setTplContent((c) => `${c}${c && !c.endsWith('\n') ? '\n' : ''}${text}\n`)

  // sincroniza modos visual/json
  const handleChangeMode = (_: any, value: 'visual'|'json'|null) => {
    if (!value) return
    if (value === 'json') {
      setOvText(JSON.stringify(ovJson, null, 2))
    } else {
      try {
        const parsed = ovText.trim() ? JSON.parse(ovText) : {}
        setOvJson(parsed)
      } catch {
        setToast({ open: true, msg: 'JSON inválido — mantengo el modo JSON', sev: 'error' })
        return
      }
    }
    setOvMode(value)
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Ajustes · Legales</Typography>

      <Paper sx={{ p: 2 }}>
        <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Plantillas" />
          <Tab label="Variables" />
        </Tabs>

        {tab === 0 && (
          <Stack spacing={2}>
            {/* Selector de perfil */}
            <FormControl size="small" sx={{ maxWidth: 520 }}>
              <InputLabel id="tpl-profile-label">Perfil de plantilla</InputLabel>
              <Select
                labelId="tpl-profile-label"
                label="Perfil de plantilla"
                native={false}
                value={profileId}
                onChange={(e:any)=>setProfileId(e.target.value)}
              >
                {PROFILES.map(p => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary">
              Namespace: <strong>{NS}</strong> · Slug: <strong>{SLUG}</strong>{profile.help ? ` — ${profile.help}` : ''}
            </Typography>

            {loadTpl ? (
              <Box display="flex" justifyContent="center" my={3}><CircularProgress /></Box>
            ) : (
              <>
                <Stack direction={{ xs:'column', sm:'row' }} spacing={2}>
                  <TextField label="Título" value={tplTitle} onChange={e=>setTplTitle(e.target.value)} fullWidth />
                  <TextField label="Versión" value={tplVersion} onChange={e=>setTplVersion(e.target.value)} sx={{ maxWidth: { sm: 200 } }} />
                </Stack>

                <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.paper', borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      disabled={saveTpl.isPending}
                      onClick={()=>saveTpl.mutate({ title: tplTitle, version: tplVersion, content: tplContent })}
                    >
                      {saveTpl.isPending ? 'Guardando…' : 'Guardar'}
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={renderPreview.isPending}
                      onClick={()=>renderPreview.mutate(tplContent)}
                    >
                      {renderPreview.isPending ? 'Generando…' : 'Previsualizar'}
                    </Button>
                    <Button
                      variant="outlined"
                      color="secondary"
                      disabled={publishTpl.isPending}
                      onClick={()=>publishTpl.mutate({ title: tplTitle, version: tplVersion, content: tplContent })}
                    >
                      {publishTpl.isPending ? 'Publicando…' : 'Publicar nueva versión'}
                    </Button>

                    <Button startIcon={<HistoryIcon />} variant="outlined" onClick={()=>setVersionsOpen(true)} sx={{ ml: { xs: 0, sm: 1 } }}>
                      Historial
                    </Button>

                    <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                    <VarInsertMenu onInsert={insertAtEnd} />
                  </Stack>

                  {/* Editor Markdown */}
                  <Box data-color-mode={isDark ? 'dark' : 'light'}>
                    <MDEditor
                      value={tplContent}
                      onChange={(v) => setTplContent(v || '')}
                      height={520}
                      preview="edit" // o "live" si quieres vista en tiempo real
                      previewOptions={{ rehypePlugins: [rehypeSanitize] }}
                    />
                  </Box>
                </Paper>
              </>
            )}
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={2}>
            {/* Selector de namespace para variables */}
            <FormControl size="small" sx={{ maxWidth: 360 }}>
              <InputLabel id="vars-ns-label">Namespace de variables</InputLabel>
              <Select
                labelId="vars-ns-label"
                label="Namespace de variables"
                native={false}
                value={varsNs}
                onChange={(e:any)=>setVarsNs(e.target.value)}
              >
                <MenuItem value="default">default (gestionados)</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Namespace personalizado (ej. tenant:3a0c-...)"
              value={varsNs}
              onChange={(e)=>setVarsNs(e.target.value)}
              helperText="Escribe un namespace para editar sus variables. Ej.: tenant:<uuid>"
            />

            {loadDef ? (
              <Box display="flex" justifyContent="center" my={3}><CircularProgress /></Box>
            ) : (
              <>
                <ToggleButtonGroup
                  exclusive
                  value={ovMode}
                  onChange={handleChangeMode}
                  size="small"
                  sx={{ alignSelf: 'flex-start' }}
                >
                  <ToggleButton value="visual">Visual</ToggleButton>
                  <ToggleButton value="json">JSON</ToggleButton>
                </ToggleButtonGroup>

                {ovMode === 'visual' ? (
                  <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.paper', borderColor: 'divider' }}>
                    <JsonEditor data={ovJson} setData={setOvJson} />
                    <Box mt={1} display="flex" gap={1} flexWrap="wrap">
                      <Button variant="contained" disabled={saveOv.isPending} onClick={()=>saveOv.mutate(ovJson)}>
                        {saveOv.isPending ? 'Guardando…' : 'Guardar'}
                      </Button>
                      <Tooltip title='Autocompleta operador.* típico'>
                        <Button variant="outlined" onClick={()=>{
                          setOvJson((prev:any)=>({
                            ...prev,
                            operador: {
                              nombre: prev?.operador?.nombre || 'Progeek Solutions S.L.',
                              cif: prev?.operador?.cif || 'B00X00000',
                              direccion: prev?.operador?.direccion || 'C/ Ejemplo 123, 08000 Barcelona, España',
                              email: prev?.operador?.email || 'legal@progeek.es',
                              telefono: prev?.operador?.telefono || '+34 600 000 000',
                              web: prev?.operador?.web || PUBLIC_BASE_URL
                            }
                          }))
                        }}>
                          Autocompletar operador
                        </Button>
                      </Tooltip>
                    </Box>
                  </Paper>
                ) : (
                  <Stack spacing={1}>
                    <TextField
                      label="variables (JSON)"
                      value={ovText}
                      onChange={(e)=>setOvText(e.target.value)}
                      fullWidth
                      multiline
                      minRows={14}
                      inputProps={{ style: { fontFamily: 'monospace' } }}
                    />
                    <Box display="flex" gap={1} flexWrap="wrap">
                      <Button
                        variant="outlined"
                        onClick={()=>{
                          try {
                            setOvText(JSON.stringify(JSON.parse(ovText || '{}'), null, 2))
                          } catch {
                            setToast({open:true, msg:'JSON inválido', sev:'error'})
                          }
                        }}
                      >
                        Formatear
                      </Button>
                      <Button
                        variant="contained"
                        disabled={saveOv.isPending}
                        onClick={()=>{
                          try {
                            const parsed = ovText.trim() ? JSON.parse(ovText) : {}
                            setOvJson(parsed)
                            saveOv.mutate(parsed)
                          } catch {
                            setToast({open:true, msg:'JSON inválido', sev:'error'})
                          }
                        }}
                      >
                        {saveOv.isPending ? 'Guardando…' : 'Guardar'}
                      </Button>
                    </Box>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        )}
      </Paper>

      {/* Toast */}
      <Snackbar open={toast.open} autoHideDuration={3000} onClose={()=>setToast(s=>({...s, open:false}))}>
        <Alert severity={toast.sev} onClose={()=>setToast(s=>({...s, open:false}))}>{toast.msg}</Alert>
      </Snackbar>

      {/* Preview: Markdown → HTML seguro */}
      <Dialog open={previewOpen} onClose={()=>setPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Previsualización</DialogTitle>
        <DialogContent dividers>
          <Box data-color-mode={isDark ? 'dark' : 'light'}>
            <MarkdownPreview
              source={previewText}
              rehypePlugins={[rehypeSanitize]}
              style={{ padding: 8 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setPreviewOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Historial de versiones */}
      <Dialog open={versionsOpen} onClose={()=>setVersionsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Historial de versiones</DialogTitle>
        <DialogContent dividers>
          {loadingVersions ? (
            <Box display="flex" justifyContent="center" my={3}><CircularProgress /></Box>
          ) : (
            <Stack spacing={1}>
              {(!versions || versions.length === 0) && (
                <Typography variant="body2" color="text.secondary">No hay versiones aún.</Typography>
              )}
              {versions?.map((v, idx) => (
                <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs:'column', sm:'row' }} justifyContent="space-between" alignItems={{ xs:'flex-start', sm:'center' }} gap={1}>
                    <Box>
                      <Typography fontWeight={600}>
                        {v.title || 'Sin título'} · {v.version || 'v1'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {v.is_active ? 'Activa' : 'Histórica'} · {new Date(v.updated_at).toLocaleString()}
                      </Typography>
                    </Box>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                      <Button size="small" variant="outlined" onClick={()=>renderPreview.mutate(v.content)}>
                        Previsualizar
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={()=>{
                          setDiffOld(v.content || '')
                          setDiffNew(tplContent || '')
                          setDiffOpen(true)
                        }}
                      >
                        Comparar con actual
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={()=>{
                          setTplTitle(v.title || '')
                          setTplVersion(v.version || 'v1')
                          setTplContent(v.content || '')
                          setToast({open:true, msg:'Versión cargada en el editor', sev:'success'})
                          setVersionsOpen(false)
                        }}
                      >
                        Cargar en editor
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="secondary"
                        disabled={publishTpl.isPending}
                        onClick={()=>{
                          publishTpl.mutate({
                            title: v.title || (tplTitle || 'Plantilla'),
                            version: bumpVersion(v.version || 'v1'),
                            content: v.content || ''
                          })
                        }}
                      >
                        {publishTpl.isPending ? 'Publicando…' : 'Activar esta versión'}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>{ refetchVersions(); setVersionsOpen(false) }}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* Diff */}
      <Dialog open={diffOpen} onClose={()=>setDiffOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Comparar versión vs actual</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <DiffEditor
            height="70vh"
            original={diffOld}
            modified={diffNew}
            language="markdown"
            theme={isDark ? 'vs-dark' : 'light'}
            options={{
              readOnly: true,
              renderSideBySide: true,
              wordWrap: 'on',
              minimap: { enabled: false }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setDiffOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// --- Insertar variables/snippets ---
function VarInsertMenu({ onInsert }: { onInsert: (text: string)=>void }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  return (
    <>
      <Button variant="outlined" endIcon={<MoreVertIcon />} onClick={(e)=>setAnchorEl(e.currentTarget)}>
        Insertar variable
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={()=>setAnchorEl(null)}>
        {Object.entries(VAR_SUGGESTIONS).map(([ns, fields]) => (
          <Box key={ns}>
            <MenuItem disabled sx={{ opacity: 0.7, fontWeight: 600 }}>{ns}</MenuItem>
            {fields.map(f => {
              const token =
                f === '[]'
                  ? `{{ ${ns} }}`
                  : f.startsWith('[]')
                    ? `{{ ${ns}[0].${f.slice(3)} }}`
                    : `{{ ${ns}.${f} }}`
              return (
                <MenuItem key={`${ns}.${f}`} onClick={() => { onInsert(token); setAnchorEl(null) }}>
                  <code style={{ fontFamily: 'monospace' }}>{token}</code>
                </MenuItem>
              )
            })}
            <Divider sx={{ my: 0.5 }} />
          </Box>
        ))}
        <MenuItem onClick={()=>{ onInsert('{% for d in dispositivos %}\n- {{ forloop.counter }}. {{ d.modelo }} | IMEI: {{ d.imei_serial }} | Precio: {{ d.precio }} €\n{% endfor %}'); setAnchorEl(null) }}>
          Snippet: bucle dispositivos
        </MenuItem>
        <MenuItem onClick={()=>{ onInsert('{% if operador.web %}Web: {{ operador.web }}{% endif %}'); setAnchorEl(null) }}>
          Snippet: condicional web operador
        </MenuItem>
      </Menu>
    </>
  )
}
