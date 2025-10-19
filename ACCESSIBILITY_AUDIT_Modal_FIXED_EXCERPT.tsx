// EXTRACTO DE CORRECCIONES CRÍTICAS PARA DispositivoPersonalizadoModal.tsx
// Este archivo muestra las secciones clave mejoradas para accesibilidad WCAG 2.1 AA

// VALIDACIÓN MEJORADA CON SUGERENCIAS ESPECÍFICAS (WCAG 3.3.3)
const validateField = (field: keyof FormData, value: string | boolean): string | null => {
  if (field === 'precio_base_b2b' || field === 'precio_base_b2c') {
    const numValue = parseFloat(value as string)

    if (value === '' || value === null || value === undefined) {
      return 'Este campo es obligatorio. Ingrese el precio en euros.'
    }

    if (isNaN(numValue)) {
      return 'Ingrese un número válido. Ejemplo: 250.50'
    }

    if (numValue < 0) {
      return 'El precio no puede ser negativo. Ingrese un valor mayor o igual a 0'
    }

    if (numValue > 100000) {
      return 'El precio parece demasiado alto. Verifique el valor (máximo recomendado: 100.000€)'
    }

    if (numValue > 0 && numValue < 1) {
      return 'El precio es muy bajo. ¿Quiso decir €' + (numValue * 100).toFixed(2) + '?'
    }
  }

  if (field === 'ajuste_excelente' || field === 'ajuste_bueno' || field === 'ajuste_malo') {
    const numValue = parseFloat(value as string)

    if (value === '' || value === null || value === undefined) {
      return 'Este campo es obligatorio. Ingrese un porcentaje entre 0 y 100.'
    }

    if (isNaN(numValue)) {
      return 'Ingrese un porcentaje válido. Ejemplo: 80'
    }

    if (numValue < 0) {
      return 'El porcentaje no puede ser negativo. Ingrese un valor entre 0 y 100'
    }

    if (numValue > 100) {
      return 'El porcentaje no puede superar 100. Ingrese un valor entre 0 y 100'
    }
  }

  if (field === 'marca' || field === 'modelo') {
    if (typeof value === 'string' && value.trim() === '') {
      return 'Este campo es obligatorio. Ingrese el ' + (field === 'marca' ? 'nombre de la marca' : 'modelo del dispositivo')
    }
  }

  return null
}

// ESTRUCTURA DEL DIALOG MEJORADA (WCAG 4.1.2, 2.4.3)
return (
  <Dialog
    open={open}
    onClose={isSaving ? undefined : handleCancel}
    disableEscapeKeyDown={isSaving}
    maxWidth="md"
    fullWidth
    aria-labelledby="modal-title"
    aria-describedby="modal-description"
  >
    <DialogTitle id="modal-title">
      {isEditMode ? 'Editar dispositivo personalizado' : 'Crear dispositivo personalizado'}
    </DialogTitle>

    <DialogContent>
      {/* Descripción accesible - visualmente oculta pero leída por screen readers */}
      <Typography
        id="modal-description"
        sx={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}
      >
        Formulario para {isEditMode ? 'editar' : 'crear'} un dispositivo personalizado.
        Complete todos los campos marcados como obligatorios. Los campos numéricos aceptan decimales
        con punto o coma como separador. Presione Tab para navegar entre campos y Enter para guardar.
      </Typography>

      <Stack spacing={3} sx={{ mt: 2 }}>
        {/* Marca */}
        <TextField
          label="Marca"
          value={formData.marca}
          onChange={(e) => handleChange('marca', e.target.value)}
          onBlur={() => handleBlur('marca')}
          required
          fullWidth
          error={!!errors.marca}
          helperText={errors.marca || 'Nombre del fabricante del dispositivo (ej: Samsung, HP, Dell)'}
          disabled={isSaving}
          inputProps={{
            'aria-required': 'true',
            'aria-invalid': !!errors.marca,
            'aria-describedby': errors.marca ? 'marca-error' : 'marca-help',
          }}
          autoComplete="organization"
        />

        {/* Modelo */}
        <TextField
          label="Modelo"
          value={formData.modelo}
          onChange={(e) => handleChange('modelo', e.target.value)}
          onBlur={() => handleBlur('modelo')}
          required
          fullWidth
          error={!!errors.modelo}
          helperText={errors.modelo || 'Modelo específico del dispositivo (ej: Galaxy S23, ThinkPad X1)'}
          disabled={isSaving}
          inputProps={{
            'aria-required': 'true',
            'aria-invalid': !!errors.modelo,
          }}
          autoComplete="off"
        />

        {/* Capacidad */}
        <TextField
          label="Capacidad"
          value={formData.capacidad}
          onChange={(e) => handleChange('capacidad', e.target.value)}
          onBlur={() => handleBlur('capacidad')}
          required
          fullWidth
          error={!!errors.capacidad}
          helperText={errors.capacidad || 'Capacidad de almacenamiento (ej: 256GB, 512GB, 1TB SSD)'}
          placeholder="Ej: 256GB, 512GB, 1TB SSD"
          disabled={isSaving}
          inputProps={{
            'aria-required': 'true',
          }}
        />

        {/* Precios con helperText mejorado (WCAG 3.3.2) */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Precio B2B"
            value={formData.precio_base_b2b}
            onChange={(e) => handleChange('precio_base_b2b', e.target.value)}
            onBlur={() => handleBlur('precio_base_b2b')}
            required
            fullWidth
            type="number"
            error={!!errors.precio_base_b2b}
            helperText={
              errors.precio_base_b2b ||
              'Precio de compra para clientes B2B en euros. Use punto para decimales (ej: 350.00)'
            }
            InputProps={{
              startAdornment: <InputAdornment position="start">€</InputAdornment>,
              inputProps: {
                min: 0,
                max: 100000,
                step: 0.01,
                'aria-required': 'true',
                'aria-invalid': !!errors.precio_base_b2b,
                'aria-describedby': 'precio-b2b-help',
              }
            }}
            disabled={isSaving}
          />

          <TextField
            label="Precio B2C"
            value={formData.precio_base_b2c}
            onChange={(e) => handleChange('precio_base_b2c', e.target.value)}
            onBlur={() => handleBlur('precio_base_b2c')}
            required
            fullWidth
            type="number"
            error={!!errors.precio_base_b2c}
            helperText={
              errors.precio_base_b2c ||
              'Precio de venta para clientes B2C en euros. Use punto para decimales (ej: 450.00)'
            }
            InputProps={{
              startAdornment: <InputAdornment position="start">€</InputAdornment>,
              inputProps: {
                min: 0,
                max: 100000,
                step: 0.01,
                'aria-required': 'true',
                'aria-invalid': !!errors.precio_base_b2c,
              }
            }}
            disabled={isSaving}
          />
        </Stack>

        {/* Ajustes de estado con mejor descripción */}
        <Typography variant="subtitle2" gutterBottom>
          Ajustes de precio por estado del dispositivo (%)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Configure qué porcentaje del precio base se aplicará según el estado del dispositivo.
          100% = precio completo, 50% = mitad del precio.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Ajuste Excelente (%)"
            value={formData.ajuste_excelente}
            onChange={(e) => handleChange('ajuste_excelente', e.target.value)}
            onBlur={() => handleBlur('ajuste_excelente')}
            fullWidth
            type="number"
            error={!!errors.ajuste_excelente}
            helperText={errors.ajuste_excelente || 'Dispositivo como nuevo (recomendado: 100)'}
            InputProps={{
              inputProps: {
                min: 0,
                max: 100,
                step: 1,
                'aria-describedby': 'ajuste-excelente-help',
              }
            }}
            disabled={isSaving}
          />

          <TextField
            label="Ajuste Bueno (%)"
            value={formData.ajuste_bueno}
            onChange={(e) => handleChange('ajuste_bueno', e.target.value)}
            onBlur={() => handleBlur('ajuste_bueno')}
            fullWidth
            type="number"
            error={!!errors.ajuste_bueno}
            helperText={errors.ajuste_bueno || 'Ligeros signos de uso (recomendado: 70-85)'}
            InputProps={{
              inputProps: {
                min: 0,
                max: 100,
                step: 1,
              }
            }}
            disabled={isSaving}
          />

          <TextField
            label="Ajuste Malo (%)"
            value={formData.ajuste_malo}
            onChange={(e) => handleChange('ajuste_malo', e.target.value)}
            onBlur={() => handleBlur('ajuste_malo')}
            fullWidth
            type="number"
            error={!!errors.ajuste_malo}
            helperText={errors.ajuste_malo || 'Desgaste visible (recomendado: 40-60)'}
            InputProps={{
              inputProps: {
                min: 0,
                max: 100,
                step: 1,
              }
            }}
            disabled={isSaving}
          />
        </Stack>

        {/* Checkbox con mejor contexto */}
        <FormControlLabel
          control={
            <Checkbox
              checked={formData.activo}
              onChange={(e) => handleChange('activo', e.target.checked)}
              disabled={isSaving}
              inputProps={{
                'aria-label': 'Marcar dispositivo como activo',
              }}
            />
          }
          label="Dispositivo activo (visible para valoraciones)"
        />
      </Stack>
    </DialogContent>

    <DialogActions>
      <Button
        onClick={handleCancel}
        disabled={isSaving}
        sx={{
          '&:focus-visible': {
            outline: '2px solid #1976d2',
            outlineOffset: '2px',
          }
        }}
      >
        Cancelar
      </Button>
      <Button
        onClick={handleSave}
        variant="contained"
        disabled={!isFormValid() || isSaving}
        startIcon={isSaving ? <CircularProgress size={16} aria-hidden="true" /> : null}
        aria-label={isSaving ? 'Guardando dispositivo, por favor espere' : 'Guardar dispositivo'}
      >
        {isSaving ? 'Guardando...' : 'Guardar'}
      </Button>
    </DialogActions>
  </Dialog>
)
