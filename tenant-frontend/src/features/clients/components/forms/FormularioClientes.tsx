"use client";
import { Dialog, DialogTitle, DialogContent, DialogActions, Stepper, Step, StepLabel, Button, Box, Snackbar, Alert } from "@mui/material";
import { useMemo, useState, useEffect, ReactNode } from "react";
import TipoClienteStep from "./TipoClienteStep";
import ComercialStep from "./ComercialStepCliente";
import FinancieroStep from "./FinancieroStepCliente";
import DireccionStep from "./DireccionStep";
import SectorStep from "./SectorStepCliente";
import { validate } from "@/shared/lib/validators";

type Tipo = "empresa" | "autonomo" | "particular";
type Canal = "b2b" | "b2c";

type NuevoCliente = Record<string, unknown>

type FormularioClientesProps = {
  open: boolean
  onClose: () => void
  onCreate: (payload: Record<string, unknown>) => void
  initial?: NuevoCliente
  soloEmpresas?: boolean
}

export default function FormularioClientes({ open, onClose, onCreate, initial, soloEmpresas = false }: FormularioClientesProps) {
  const [nuevo, setNuevo] = useState<NuevoCliente>(initial ?? {});
  const [step, setStep] = useState(0);
  const [snack, setSnack] = useState({ open:false, message:"", type:"error" as "error"|"success" });

  useEffect(() => {
    if (open) {
      setStep(0);
      setNuevo(() => {
        const base = { ...(initial ?? {}) } as Record<string, unknown>
        if (soloEmpresas && base.tipo_cliente === 'particular') {
          base.tipo_cliente = 'empresa'
        }
        if (soloEmpresas && !base.tipo_cliente) {
          base.tipo_cliente = 'empresa'
        }
        return base
      })
    }
  }, [open, initial, soloEmpresas])

  useEffect(() => {
    if (soloEmpresas && nuevo.tipo_cliente === 'particular') {
      setNuevo((prev) => ({ ...prev, tipo_cliente: 'empresa' }))
    }
  }, [soloEmpresas, nuevo.tipo_cliente])

  const tipo: Tipo = (nuevo.tipo_cliente as Tipo) ?? "empresa";
  const canal: Canal = tipo === "particular" ? "b2c" : "b2b";
  const tipoLabel = useMemo(() => {
    switch (tipo) {
      case "autonomo": return "autónomo";
      case "empresa": return "empresa";
      default: return "particular";
    }
  }, [tipo]);
  const steps = useMemo(() => {
    const base = [{ key:"tipo", label:"Tipo de cliente", Comp: TipoClienteStep }];
    const b2c = [
      { key:"comercial", label:"Datos personales", Comp: ComercialStep },
      { key:"direccion", label:"Dirección", Comp: DireccionStep },
      
    ];
    const b2b = [
      { key:"comercial", label:"Comerciales", Comp: ComercialStep },
      { key:"financiero", label:"Financieros", Comp: FinancieroStep },
      { key:"direccion", label:"Dirección", Comp: DireccionStep },
      { key:"sector", label:"Sector", Comp: SectorStep },
    ];
    return canal === "b2c" ? [...base, ...b2c] : [...base, ...b2b];
  }, [canal]);

  const isProd = typeof window !== 'undefined' && process.env.NODE_ENV === 'production'
  const allowInvalidInDev = !isProd

  const validarPaso = (): boolean => {
    const falta = (k: string) => !nuevo[k] || String(nuevo[k]).trim() === "";
    const current = steps[step]?.key;

    if (current === "tipo") {
      if (!nuevo.tipo_cliente) { setSnack({ open:true, message:"Selecciona el tipo de cliente", type:"error" }); return false; }
      if (soloEmpresas && nuevo.tipo_cliente === 'particular') {
        setSnack({ open:true, message:"Este partner solo admite clientes empresa o autónomos.", type:"error" });
        return false;
      }
    }
    if (current === "comercial") {
      if (tipo === "empresa" && (falta("razon_social") || falta("cif"))) return setErr("Razón social y CIF son obligatorios");
      if (tipo === "autonomo" && (falta("nombre") || falta("apellidos") || falta("nif"))) return setErr("Nombre, apellidos y NIF son obligatorios");
      if (tipo === "particular" && (falta("nombre") || falta("apellidos") || falta("dni_nie"))) return setErr("Nombre, apellidos y DNI/NIE son obligatorios");

      // Validaciones de formato: en dev avisa pero no bloquea; en prod bloquea
      const msgs: string[] = []
      const email = String(nuevo.correo || '')
      if (email && !validate('email', email).valid) msgs.push('Correo inválido')
      const tel = String(nuevo.telefono || '')
      if (tel && !validate('telefono', tel).valid) msgs.push('Teléfono inválido (España, 9 dígitos)')
      if (tipo === 'autonomo') {
        const nif = String(nuevo.nif || '')
        if (!validate('dni', nif).valid) msgs.push('NIF inválido')
      }
      if (tipo === 'particular') {
        const dn = String(nuevo.dni_nie || '')
        if (!validate('dni_or_nie', dn).valid) msgs.push('DNI/NIE inválido')
      }
      if (tipo === 'empresa') {
        const cif = String(nuevo.cif || '')
        if (!validate('cif', cif).valid) msgs.push('CIF inválido')
      }
      if (msgs.length) {
        setSnack({ open: true, message: msgs.join(' · '), type: 'error' })
        return allowInvalidInDev
      }
    }
    return true;
  };
  const setErr = (m:string) => { setSnack({ open:true, message:m, type:"error" }); return false; };

  const onNext = () => { if (!validarPaso()) return; setStep((s) => Math.min(s + 1, steps.length - 1)); };
  const onBack = () => setStep((s) => Math.max(s - 1, 0));
  const onSubmit = () => {
    if (soloEmpresas && nuevo.tipo_cliente === 'particular') {
      setSnack({ open:true, message:"Este partner solo admite clientes empresa o autónomos.", type:"error" });
      return;
    }
    if (!validarPaso()) return;
    onCreate({ ...nuevo, tipo_cliente: tipo });
  };

  const PasoActual = steps[step];
  let pasoNode: ReactNode;
  if (PasoActual.key === 'tipo') {
    pasoNode = <TipoClienteStep nuevo={nuevo} setNuevo={setNuevo} soloEmpresas={soloEmpresas} />
  } else {
    const Comp = PasoActual.Comp as any;
    pasoNode = <Comp nuevo={nuevo} setNuevo={setNuevo} />
  }

  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      onClose={(_, reason) => {
        if (reason === 'backdropClick') return
        onClose()
      }}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>Nuevo cliente {tipoLabel}</DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {steps.map((s) => (<Step key={s.key}><StepLabel>{s.label}</StepLabel></Step>))}
        </Stepper>
        <Box>{pasoNode}</Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Cancelar</Button>
        <Box sx={{ flex: 1 }} />
        {step > 0 && <Button onClick={onBack}>Anterior</Button>}
        {step < steps.length - 1
          ? <Button variant="contained" onClick={onNext}>Siguiente</Button>
          : <Button variant="contained" onClick={onSubmit}>Crear</Button>}
      </DialogActions>
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({...s, open:false}))}
        anchorOrigin={{ vertical:"bottom", horizontal:"center" }}>
        <Alert severity={snack.type} variant="filled" onClose={() => setSnack(s => ({...s, open:false}))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
