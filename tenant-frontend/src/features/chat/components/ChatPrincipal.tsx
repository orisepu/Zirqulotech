"use client";

import ChatConSoporteContextual from "@/features/chat/components/ChatConSoporteContextual";
import ChatConTenants from "@/features/chat/components/ChatConTenants";
import { useUsuario } from "@/context/UsuarioContext";

export default function ChatPrincipal() {
  const usuario = useUsuario();

  if (!usuario) return null;

  if (
    usuario.es_empleado_interno ||
    usuario.es_superadmin ||
    usuario.rol_actual?.rol === "interno"
  ) {
    return <ChatConTenants />;
  }

  if (!usuario.rol_actual?.rol) return null;

  return <ChatConSoporteContextual />;
}
