import { useQuery } from "@tanstack/react-query";
import { fetchDashboardManager } from "@/services/api";

type ApiFilters = {
  fecha_inicio: string;
  fecha_fin: string;
  granularidad?: "dia" | "semana" | "mes";
  tienda_id?: string | number;
  usuario_id?: string | number;
  comparar?: boolean;
  tenant?: string;
  estado_minimo?: number;
};

type HookFilters = {
  fecha_inicio?: string;
  fecha_fin?: string;
  estado_minimo?: number;
  granularidad?: string; // aceptamos libre y normalizamos
  tienda_id?: string | number;
  usuario_id?: string | number;
  comparar?: boolean;
  tenant?: string;
};

const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const normalizeGranularidad = (g?: string): ApiFilters["granularidad"] => {
  if (!g) return "mes";
  const v = g.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""); // quita acentos
  return (["dia", "semana", "mes"] as const).includes(v as any)
    ? (v as ApiFilters["granularidad"])
    : "mes";
};

export function useDashboardManager(filters: HookFilters) {
  const today = new Date();
  const startDefault = new Date(today.getFullYear(), today.getMonth(), 1);
  const endDefault = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const safeFilters: ApiFilters = {
    fecha_inicio: filters.fecha_inicio ?? toYMD(startDefault),
    fecha_fin: filters.fecha_fin ?? toYMD(endDefault),
    granularidad: normalizeGranularidad(filters.granularidad),
    tienda_id: filters.tienda_id,
    usuario_id: filters.usuario_id,
    comparar: filters.comparar,
    tenant: filters.tenant,
    estado_minimo: filters.estado_minimo,
  };

  return useQuery({
    queryKey: ["dashboard-manager", safeFilters],
    queryFn: () => fetchDashboardManager(safeFilters),
    staleTime: 5 * 60 * 1000,
  });
}
