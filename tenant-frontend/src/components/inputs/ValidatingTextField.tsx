// src/components/inputs/ValidatingTextField.tsx
"use client";
import { useMemo, useState, useEffect } from 'react'
import { TextField, TextFieldProps } from '@mui/material'
import { toast } from 'react-toastify'
import { validate, ValidatorKind } from '@/lib/validators'

type Props = Omit<TextFieldProps, 'onChange'> & {
  kind: ValidatorKind
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
  validateOnChange?: boolean
  onValidChange?: (isValid: boolean) => void
  enforceInProd?: boolean // default true: en producción, exige válido
}

export default function ValidatingTextField({
  kind,
  value,
  onChange,
  required,
  validateOnChange,
  onValidChange,
  enforceInProd = true,
  helperText,
  ...rest
}: Props) {
  const isProd = useMemo(() => typeof window !== 'undefined' && process.env.NODE_ENV === 'production', [])
  const [error, setError] = useState(false)
  const [help, setHelp] = useState<string | undefined>(undefined)

  const runValidation = (val: string, opts?: { silentDev?: boolean }) => {
    const v = String(val || '').trim()
    if (!v) {
      if (required) {
        const msg = 'Campo obligatorio'
        setError(isProd && enforceInProd)
        setHelp(isProd && enforceInProd ? msg : undefined)
        if (!isProd && !opts?.silentDev) toast.warn(msg)
        onValidChange?.(!isProd || !enforceInProd ? true : false)
        return !isProd || !enforceInProd
      } else {
        setError(false)
        setHelp(undefined)
        onValidChange?.(true)
        return true
      }
    }
    const { valid, message } = validate(kind, v)
    const isValid = valid || (!isProd || !enforceInProd)
    setError(!valid && isProd && enforceInProd)
    setHelp(!valid && isProd && enforceInProd ? (message || 'Valor inválido') : undefined)
    if (!valid && !isProd && !opts?.silentDev) toast.warn(message || 'Valor inválido')
    onValidChange?.(isValid)
    return isValid
  }

  useEffect(() => {
    // Validar cuando cambia el valor si se solicita
    if (validateOnChange) runValidation(value, { silentDev: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, kind, required])

  return (
    <TextField
      {...rest}
      value={value}
      onChange={onChange}
      onBlur={() => runValidation(value)}
      error={error || rest.error === true}
      helperText={help ?? helperText}
    />
  )
}

