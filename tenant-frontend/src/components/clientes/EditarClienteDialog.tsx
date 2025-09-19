"use client";

import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stepper, Step, StepLabel,
  Button, Box, Snackbar, Alert
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import ComercialStep from "@/components/formularios/Clientes/ComercialStepCliente";
import FinancieroStep from "@/components/formularios/Clientes/FinancieroStepCliente";
import DireccionStep from "@/components/formularios/Clientes/DireccionStep";
import SectorStep from "@/components/formularios/Clientes/SectorStepCliente";

type Tipo = "empresa" | "autonomo" | "particular";
type Canal = "b2b" | "b2c";

export type ClienteEditable = {
  id?: number;
  tipo_cliente?: Tipo;
  canal?: Canal;
  // Empresa
  razon_social?: string; cif?: string; contacto?: string; posicion?: string;
  // Autónomo / Particular
  nombre?: string; apellidos?: string; dni_nie?: string; nif?: string; nombre_comercial?: string;
  // Comunes
  telefono?: string; correo?: string;
  // Financieros
  contacto_financiero?: string; telefono_financiero?: string; correo_financiero?: string;
  // Dirección
  direccion_calle?: string; direccion_piso?: string; direccion_puerta?: string;
  direccion_cp?: string; direccion_poblacion?: string; direccion_provincia?: string; direccion_pais?: string;
  // Sector
  vertical?: string; vertical_secundaria?: string;
  [k: string]: unknown;
};

export default function EditarClienteDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: Partial<ClienteEditable>;
  onClose: () => void;
  onSave: (payload: Partial<ClienteEditable>) => Promise<void> | void;
}) {
  const [form, setForm] = useState<Partial<ClienteEditable>>(initial ?? {});
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{open:boolean; message:string; type:"success"|"error"}>({
    open:false, message:"", type:"success"
  });

  useEffect(() => {
    if (open) {
      setForm(initial ?? {});
      setStep(0);
    }
  }, [open, initial]);

  const tipo: Tipo = (form.tipo_cliente as Tipo) ?? "empresa";
  const canal: Canal = tipo === "particular" ? "b2c" : "b2b";
  const esParticular = tipo === "particular";

  const steps = useMemo(() => (
    esParticular
      ? [
          { key: "comercial",  label: "Datos personales", Comp: ComercialStep },
          { key: "direccion",  label: "Dirección",        Comp: DireccionStep },
        ]
      : [
          { key: "comercial",  label: "Comerciales", Comp: ComercialStep },
          { key: "financiero", label: "Financieros", Comp: FinancieroStep },
          { key: "direccion",  label: "Dirección",   Comp: DireccionStep },
          { key: "sector",     label: "Sector",      Comp: SectorStep },
        ]
  ), [esParticular]);

  const setErr = (m:string) => { setSnack({ open:true, message:m, type:"error" }); return false; };
  const falta = (k: keyof ClienteEditable) => !form[k] || String(form[k]).trim() === "";

  const validarPaso = (): boolean => {
    const currentKey = steps[step]?.key;

    if (currentKey === "comercial") {
      if (tipo === "empresa"   && (falta("razon_social") || falta("cif"))) return setErr("Razón social y CIF son obligatorios");
      if (tipo === "autonomo"  && (falta("nombre") || falta("apellidos") || falta("nif"))) return setErr("Nombre, apellidos y NIF son obligatorios");
      if (tipo === "particular"&& (falta("nombre") || falta("apellidos") || falta("dni_nie"))) return setErr("Nombre, apellidos y DNI/NIE son obligatorios");
    }

    return true;
  };

  const onNext = () => { if (!validarPaso()) return; setStep(s => Math.min(s + 1, steps.length - 1)); };
  const onBack = () => setStep(s => Math.max(s - 1, 0));

  // fijamos el tipo/canal a lo que venía, para no permitir cambiar el "perfil" en este diálogo
  const fixedTipo = (initial?.tipo_cliente as Tipo) ?? "empresa";

  const buildPayload = (f: Partial<ClienteEditable>) => {
    const p: Partial<ClienteEditable> & Record<string, unknown> = {
      ...f,
      tipo_cliente: fixedTipo,
      canal: fixedTipo === "particular" ? "b2c" : "b2b",
    };

    // Limpieza por tipo (opcional)
    if (fixedTipo === "empresa") {
      p.nombre = ""; p.apellidos = ""; p.dni_nie = ""; p.nif = ""; p.nombre_comercial = "";
    } else if (fixedTipo === "autonomo") {
      p.razon_social = ""; p.cif = ""; p.dni_nie = "";
    } else if (fixedTipo === "particular") {
      p.razon_social = ""; p.cif = ""; p.nif = ""; p.nombre_comercial = "";
      p.vertical = ""; p.vertical_secundaria = "";
      p.contacto_financiero = ""; p.telefono_financiero = ""; p.correo_financiero = "";
    }

    return p;
  };

  const handleSave = async () => {
    if (!validarPaso()) return;
    const payload = buildPayload(form);
    try {
      setSaving(true);
      await onSave(payload); // idealmente PATCH
      setSnack({ open: true, message: "Cliente actualizado", type: "success" });
      onClose();
    } catch (e: unknown) {
      const data = (e as { response?: { data?: unknown } })?.response?.data;
      const msg = data && typeof data === "object"
        ? Object.entries(data as Record<string, unknown>).map(([k, v]) => `${k}: ${Array.isArray(v) ? String(v[0]) : String(v)}`).join(" · ")
        : "Error al guardar";
      setSnack({ open: true, message: msg, type: "error" });
    } finally {
      setSaving(false);
    }
  }; // ← ESTA llave faltaba

  const Paso = steps[step]?.Comp;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Editar cliente {canal.toUpperCase()}</DialogTitle>
        <DialogContent dividers>
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 2 }}>
            {steps.map((s) => (
              <Step key={s.key}><StepLabel>{s.label}</StepLabel></Step>
            ))}
          </Stepper>
          <Box>
            {Paso ? <Paso nuevo={form} setNuevo={setForm} /> : null}
          </Box>
        </DialogContent>
        <DialogActions>
          {step > 0 && <Button onClick={onBack}>Anterior</Button>}
          {step < steps.length - 1 ? (
            <Button variant="contained" onClick={onNext}>Siguiente</Button>
          ) : (
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack(s => ({...s, open:false}))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.type}
          variant="filled"
          onClose={() => setSnack(s => ({...s, open:false}))}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </>
  );
}
