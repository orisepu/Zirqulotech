"use client";
import { createContext, useContext } from "react";
// import { CircularProgress, Box } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";

type RolActual = { rol?: string; tienda_id?: number | string } | null

interface Usuario {
  id: string;
  name: string;
  email: string;
  rol_actual: RolActual; // <- ajusta si conoces la forma exacta
  es_superadmin: boolean;
  es_empleado_interno: boolean;
}

const UsuarioContext = createContext<Usuario | null | undefined>(undefined);

export const UsuarioProvider = ({ children }: { children: React.ReactNode }) => {
  const { data } = useQuery<Usuario, Error, Usuario, ["usuario-actual"]>({
    queryKey: ["usuario-actual"],
    queryFn: async (): Promise<Usuario> => {
      const res = await api.get("/api/yo/");
      const global = res.data.global || {};
      return {
        id: res.data.id,
        name: res.data.name,
        email: res.data.email,
        rol_actual: global.rol_actual ?? null,
        es_superadmin: !!global.es_superadmin,
        es_empleado_interno: !!global.es_empleado_interno,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <UsuarioContext.Provider value={data ?? null}>
      {children}
    </UsuarioContext.Provider>
  );
};

export const useUsuario = (): Usuario | null => {
  const context = useContext(UsuarioContext);
  if (context === undefined) {
    throw new Error("useUsuario debe usarse dentro de <UsuarioProvider>");
  }
  return context;
};
