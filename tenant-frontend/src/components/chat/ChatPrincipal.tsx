"use client";

import ChatConSoporteContextual from "@/components/chat/ChatConSoporteContextual";
import ChatConTenants from "@/components/chat/ChatConTenants";
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
