// src/components/formularios/Clientes/FormularioClientes.tsx
"use client";
import { Dialog, DialogTitle, DialogContent, DialogActions, Stepper, Step, StepLabel, Button, Box, Snackbar, Alert } from "@mui/material";
import { useMemo, useState, useEffect } from "react";
import TipoClienteStep from "./TipoClienteStep";
import ComercialStep from "./ComercialStepCliente";
import FinancieroStep from "./FinancieroStepCliente";
import DireccionStep from "./DireccionStep";
import SectorStep from "./SectorStepCliente";

type Tipo = "empresa" | "autonomo" | "particular";
type Canal = "b2b" | "b2c";

export default function FormularioClientes({ open, onClose, onCreate, initial }: {
  open: boolean; onClose: () => void; onCreate: (payload: any) => void; initial?: any;
}) {
  const [nuevo, setNuevo] = useState<any>(initial ?? {});
  const [step, setStep] = useState(0);
  const [snack, setSnack] = useState({ open:false, message:"", type:"error" as "error"|"success" });

  useEffect(() => { if (open) { setNuevo(initial ?? {}); setStep(0); } }, [open, initial]);

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

  const validarPaso = (): boolean => {
    const falta = (k: string) => !nuevo[k] || String(nuevo[k]).trim() === "";
    const current = steps[step]?.key;

    if (current === "tipo") {
      if (!nuevo.tipo_cliente) { setSnack({ open:true, message:"Selecciona el tipo de cliente", type:"error" }); return false; }
    }
    if (current === "comercial") {
      if (falta("correo")) { setSnack({ open:true, message:"El correo es obligatorio", type:"error" }); return false; }
      if (tipo === "empresa" && (falta("razon_social") || falta("cif"))) return setErr("Razón social y CIF son obligatorios");
      if (tipo === "autonomo" && (falta("nombre") || falta("apellidos") || falta("nif"))) return setErr("Nombre, apellidos y NIF son obligatorios");
      if (tipo === "particular" && (falta("nombre") || falta("apellidos") || falta("dni_nie"))) return setErr("Nombre, apellidos y DNI/NIE son obligatorios");
    }
    return true;
  };
  const setErr = (m:string) => { setSnack({ open:true, message:m, type:"error" }); return false; };

  const onNext = () => { if (!validarPaso()) return; setStep((s) => Math.min(s + 1, steps.length - 1)); };
  const onBack = () => setStep((s) => Math.max(s - 1, 0));
  const onSubmit = () => { if (!validarPaso()) return; onCreate({ ...nuevo, tipo_cliente: tipo }); };

  const Paso = steps[step].Comp;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Nuevo cliente {tipoLabel}</DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {steps.map((s) => (<Step key={s.key}><StepLabel>{s.label}</StepLabel></Step>))}
        </Stepper>
        <Box><Paso nuevo={nuevo} setNuevo={setNuevo} /></Box>
      </DialogContent>
      <DialogActions>
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
