'use client'

import { Box, Alert, Stack, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material'
import { useState, useMemo, useEffect } from 'react'
import { Refresh } from '@mui/icons-material'
import { ValidationTable, ValidationItem } from './ValidationTable'
import { CorrectionModal } from './CorrectionModal'
import { CreateDeviceModal } from './CreateDeviceModal'
import { useDeviceMappingEnhanced } from '@/shared/hooks/useDeviceMappingEnhanced'

interface ValidationTabPanelProps {
  tareaId: string | null
}

export function ValidationTabPanel({ tareaId }: ValidationTabPanelProps) {
  const {
    useValidationItems,
    useValidateMapping,
    useCorrectMapping,
    useCreateFromUnmapped
  } = useDeviceMappingEnhanced()

  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [confirmValidationOpen, setConfirmValidationOpen] = useState(false)
  const [pendingValidationIds, setPendingValidationIds] = useState<(string | number)[]>([])
  const [selectedItem, setSelectedItem] = useState<ValidationItem | null>(null)
  const [isTransitioningToCreate, setIsTransitioningToCreate] = useState(false)
  const [createSuccessMessage, setCreateSuccessMessage] = useState<string | null>(null)

  // Resetear flag de transición cuando el modal de creación se abre
  useEffect(() => {
    if (createModalOpen && isTransitioningToCreate) {
      setIsTransitioningToCreate(false)
    }
  }, [createModalOpen, isTransitioningToCreate])

  // Queries
  const {
    data: validationItems = [],
    isLoading: isLoadingItems,
    error: itemsError,
    refetch: refetchItems
  } = useValidationItems(tareaId || '')

  // Mutations
  const validateMutation = useValidateMapping()
  const correctMutation = useCorrectMapping()
  const createMutation = useCreateFromUnmapped()

  // Handlers
  const handleValidate = (itemIds: (string | number)[]) => {
    if (!tareaId) return

    // Mostrar diálogo de confirmación
    setPendingValidationIds(itemIds)
    setConfirmValidationOpen(true)
  }

  const handleConfirmValidation = (applyPrices: boolean) => {
    if (!tareaId) return

    validateMutation.mutate({
      tarea_id: tareaId,
      staging_item_ids: pendingValidationIds,
      apply_prices: applyPrices
    }, {
      onSuccess: (data) => {
        setSelectedIds(new Set())
        setConfirmValidationOpen(false)
        setPendingValidationIds([])
        refetchItems()
      }
    })
  }

  const handleCorrect = (item: ValidationItem) => {
    setSelectedItem(item)
    setCreateModalOpen(false) // Asegurar que modal de creación está cerrado
    setCorrectionModalOpen(true)
  }

  const handleApplyCorrection = (capacidad: any) => {
    if (!selectedItem || !tareaId) return

    correctMutation.mutate({
      tarea_id: tareaId,
      staging_item_id: selectedItem.staging_item_id || selectedItem.id,
      new_capacidad_id: capacidad.id,
      reason: `Corrección manual: ${selectedItem.likewize_info.modelo_norm} → ${capacidad.modelo?.descripcion}`
    }, {
      onSuccess: () => {
        setCorrectionModalOpen(false)
        setSelectedItem(null)
        refetchItems()
      }
    })
  }

  const handleCreate = (item: ValidationItem) => {
    setSelectedItem(item)
    setCreateModalOpen(true)
  }

  const handleApplyCreate = (deviceData: any) => {
    if (!tareaId) return

    createMutation.mutate({
      tarea_id: tareaId,
      ...deviceData
    }, {
      onSuccess: (data) => {
        setCreateModalOpen(false)
        setSelectedItem(null)
        refetchItems()

        // Mostrar mensaje de éxito con detalles
        if (data.auto_mapped_count > 0) {
          setCreateSuccessMessage(
            `📦 ${data.capacidades_creadas || 'Capacidades'} creadas automáticamente • ` +
            `🔗 ${data.auto_mapped_count} items adicionales mapeados automáticamente`
          )
        }
      }
    })
  }

  // Estados de carga
  const isAnyMutationLoading = validateMutation.isPending || correctMutation.isPending || createMutation.isPending

  if (!tareaId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Selecciona o crea una tarea de actualización primero
        </Alert>
      </Box>
    )
  }

  if (itemsError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Error al cargar items de validación: {(itemsError as any).message}
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header con acciones */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={isLoadingItems ? <CircularProgress size={16} /> : <Refresh />}
          onClick={() => refetchItems()}
          disabled={isLoadingItems}
        >
          Actualizar
        </Button>

        {/* Mensajes de estado */}
        {validateMutation.isSuccess && validateMutation.data && (
          <Alert severity="success" onClose={() => validateMutation.reset()}>
            {validateMutation.data.message || '✓ Mapeos validados correctamente'}
            {validateMutation.data.prices_applied !== undefined && validateMutation.data.prices_applied > 0 && (
              <> ({validateMutation.data.prices_applied} precios actualizados en BD)</>
            )}
          </Alert>
        )}

        {correctMutation.isSuccess && (
          <Alert severity="success" onClose={() => correctMutation.reset()}>
            ✓ Corrección aplicada correctamente
          </Alert>
        )}

        {createMutation.isSuccess && (
          <Alert
            severity="success"
            onClose={() => {
              createMutation.reset()
              setCreateSuccessMessage(null)
            }}
          >
            <Stack spacing={0.5}>
              <div>✓ Dispositivo creado correctamente</div>
              {createSuccessMessage && (
                <div style={{ fontSize: '0.875rem' }}>{createSuccessMessage}</div>
              )}
            </Stack>
          </Alert>
        )}
      </Stack>

      {/* Tabla de Validación */}
      {isLoadingItems ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <ValidationTable
          items={validationItems}
          onValidate={handleValidate}
          onCorrect={handleCorrect}
          onCreate={handleCreate}
          isLoading={isAnyMutationLoading}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      {/* Modal de Corrección */}
      <CorrectionModal
        open={correctionModalOpen}
        onClose={() => {
          setCorrectionModalOpen(false)
          // Solo resetear si no estamos transicionando al modal de creación
          if (!isTransitioningToCreate) {
            setSelectedItem(null)
          }
        }}
        item={selectedItem}
        onApply={handleApplyCorrection}
        onCreateNew={() => {
          // Marcar que estamos transicionando para evitar reset de selectedItem
          setIsTransitioningToCreate(true)
          setCorrectionModalOpen(false)
          setCreateModalOpen(true)
        }}
        isLoading={correctMutation.isPending}
      />

      {/* Modal de Creación */}
      <CreateDeviceModal
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false)
          setSelectedItem(null)
          setIsTransitioningToCreate(false) // Resetear flag
        }}
        item={selectedItem}
        allLikewizeItems={validationItems}
        onCreate={handleApplyCreate}
        isLoading={createMutation.isPending}
      />

      {/* Diálogo de Confirmación para Validar Mapeos */}
      <Dialog
        open={confirmValidationOpen}
        onClose={() => !validateMutation.isPending && setConfirmValidationOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          ¿Validar {pendingValidationIds.length} {pendingValidationIds.length === 1 ? 'mapeo' : 'mapeos'}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Estás a punto de validar {pendingValidationIds.length} {pendingValidationIds.length === 1 ? 'dispositivo mapeado' : 'dispositivos mapeados'}.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, fontWeight: 'bold' }}>
            ¿Quieres aplicar automáticamente los nuevos precios de Likewize a la base de datos?
          </DialogContentText>
          <DialogContentText sx={{ mt: 1, fontSize: '0.9rem', color: 'text.secondary' }}>
            • <strong>Validar y Aplicar Precios:</strong> Los precios se actualizarán inmediatamente en PrecioRecompra (recomendado)
            <br />
            • <strong>Solo Validar:</strong> Los mapeos se marcarán como correctos pero los precios NO se actualizarán
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setConfirmValidationOpen(false)
              setPendingValidationIds([])
            }}
            disabled={validateMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => handleConfirmValidation(false)}
            disabled={validateMutation.isPending}
            color="secondary"
          >
            Solo Validar
          </Button>
          <Button
            onClick={() => handleConfirmValidation(true)}
            disabled={validateMutation.isPending}
            variant="contained"
            color="primary"
            autoFocus
          >
            {validateMutation.isPending ? <CircularProgress size={20} /> : 'Validar y Aplicar Precios'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
