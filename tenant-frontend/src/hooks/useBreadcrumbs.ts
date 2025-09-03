"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, useQueryClient } from "@tanstack/react-query";

export interface Breadcrumb {
  label: string;
  href?: string;
  isLast: boolean;
}

type EntidadKey = "cliente" | "oportunidad" | "dispositivo" | "oportunidad-global";

// Claves de queries relevantes que fuerzan recomputar
const RELEVANT_KEYS: EntidadKey[] = ["cliente", "oportunidad", "dispositivo", "oportunidad-global"];

// Segmentos a ocultar visualmente (pero los usamos para la lógica)
const HIDDEN_SEGMENTS = new Set(["global", "oportunidades"])

// --- Utilidades ---

/**
 * ¿Parece un ID? (número o uuid). Amplía si usas hashids.
 * // quitar en producción: logs de diagnóstico
 */
const isEntityId = (s: string): boolean => {
  const uuidLike = /^[0-9a-fA-F-]{32,36}$/; // tolerante con/sin guiones
  const numeric = /^\d+$/;
  const ok = numeric.test(s) || uuidLike.test(s);
  // console.debug("[breadcrumbs] isEntityId", s, ok); // quitar en producción
  return ok;
};

/**
 * TitleCase ES sin capitalizar conectores/artículos comunes.
 */
const titleCaseEs = (raw: string): string => {
  const minor = new Set(["de", "del", "la", "las", "el", "los", "y", "o", "u", "en", "con", "por", "para", "a"]);
  const words = raw.replace(/[-_]+/g, " ").trim().split(/\s+/);
  return words
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (i > 0 && minor.has(lw)) return lw;
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(" ");
};

// Especiales de Next (grupos/slots) — tampoco se muestran
const isSpecialSegment = (s: string) => s.startsWith("(") || s.startsWith("@");
const isHiddenSegment = (s: string) => HIDDEN_SEGMENTS.has(s.toLowerCase());

/**
 * Resolvers desde la cache de React Query
 */
const makeResolvers = (qc: QueryClient) => ({
  clientes: (id: string) => (qc.getQueryData<any>(["cliente", id]) as any)?.razon_social,
  oportunidades: (id: string) => (qc.getQueryData<any>(["oportunidad", id]) as any)?.nombre,
  // Global: primero ["oportunidad-global", tenant, id] ; fallback ["oportunidad", id]
  oportunidadesGlobal: (tenant: string, id: string) =>
    (qc.getQueryData<any>(["oportunidad-global", tenant, id]) as any)?.nombre ??
    (qc.getQueryData<any>(["oportunidad", id]) as any)?.nombre,
  dispositivos: (id: string) => (qc.getQueryData<any>(["dispositivo", id]) as any)?.modelo?.descripcion,
});

/**
 * Hook principal
 */
export function useBreadcrumbs(): { breadcrumbs: Breadcrumb[]; isReady: boolean } {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Fuerza recomputar cuando cambian queries relevantes
  const [version, setVersion] = useState(0);
  const resolversRef = useRef(makeResolvers(queryClient));

  useEffect(() => {
    resolversRef.current = makeResolvers(queryClient);
  }, [queryClient]);

  // Suscripción a QueryCache
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type !== "updated") return;
      const k0 = event.query?.queryKey?.[0] as EntidadKey | undefined;
      if (k0 && RELEVANT_KEYS.includes(k0)) {
        // console.debug("[breadcrumbs] cache updated for", event.query?.queryKey); // quitar en producción
        setVersion((v) => v + 1);
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const { breadcrumbs, isReady } = useMemo(() => {
    if (!pathname) return { breadcrumbs: [] as Breadcrumb[], isReady: true };

    // ⚠️ Usamos TODOS los segmentos para la lógica (sin filtrar)
    const rawSegments = pathname.split("/").filter(Boolean);

    const bcs: Breadcrumb[] = [];
    let hrefAcc = "";

    for (let i = 0; i < rawSegments.length; i++) {
      const segmentRaw = rawSegments[i];
      const prevRaw = rawSegments[i - 1]; // puede ser "clientes", "oportunidades", "dispositivos", "global", tenant...
      const isHidden = isHiddenSegment(segmentRaw) || isSpecialSegment(segmentRaw);

      // Construcción del href: no incluimos segmentos ocultos/especiales
      if (!isHidden) {
        hrefAcc += `/${segmentRaw}`;
      }

      const isLastVisible = (() => {
        // último visible: buscamos si hay más segmentos visibles por delante
        for (let j = i + 1; j < rawSegments.length; j++) {
          if (!isHiddenSegment(rawSegments[j]) && !isSpecialSegment(rawSegments[j])) return false;
        }
        return true;
      })();

      const decoded = decodeURIComponent(segmentRaw);
      let label = titleCaseEs(decoded); // por defecto

      // ——— Resolución por secciones "normales" ———
      if (isEntityId(decoded) && prevRaw) {
        const r = resolversRef.current;

        if (prevRaw === "clientes") {
          label = r.clientes(decoded) ?? decoded;

        } else if (prevRaw === "oportunidades") {
          // 1) Resuelve la oportunidad por nombre
          const oportunidad = queryClient.getQueryData<any>(["oportunidad", decoded]);
          label = oportunidad?.nombre ?? r.oportunidades(decoded) ?? decoded;

          // 2) Inyecta crumb del CLIENTE justo antes del de la oportunidad
          const cliente = oportunidad?.cliente;
          if (cliente?.id) {
            const clienteLabel =
              cliente.razon_social ||
              `${cliente.nombre || ""} ${cliente.apellidos || ""}`.trim() ||
              "Cliente";
            const clienteHref = `/clientes/${cliente.id}`;

            // Evita duplicados si ya existiera
            if (!bcs.some(b => b.href === clienteHref)) {
              bcs.push({ label: clienteLabel, href: clienteHref, isLast: false });
            }
          }

        } else if (prevRaw === "dispositivos") {
          label = r.dispositivos(decoded) ?? decoded;
        }
      }


      // ——— Caso GLOBAL: /oportunidades/global/:tenant/:id ———
      // Aquí SÍ existe "global" en rawSegments (no lo quitamos antes).
      if (isEntityId(decoded)) {
        const r = resolversRef.current;
        const tenant = rawSegments[i - 1];     // p.ej. "fnac"
        const maybeGlobal = rawSegments[i - 2]; // "global"
        const maybeOports = rawSegments[i - 3]; // "oportunidades"

        if (maybeOports === "oportunidades" && maybeGlobal?.toLowerCase() === "global" && tenant) {
          const nombre = r.oportunidadesGlobal(tenant, decoded);
          if (nombre) label = nombre;
          // console.debug("[breadcrumbs] resolved global oportunidad", { tenant, id: decoded, label }); // quitar en producción
        }
      }

      // Añadir crumb solo si el segmento es visible (no especial/oculto)
      if (!isHidden) {
        bcs.push({
          label,
          href: isLastVisible ? undefined : hrefAcc,
          isLast: isLastVisible,
        });
      }
    }

    // isReady: si algún crumb visible parece un ID aún sin resolver, seguimos false
    const looksLikeId = (s: string) => /^\d+$/.test(s) || /^[0-9a-fA-F-]{32,36}$/.test(s);
    const ready = bcs.every((crumb) => (looksLikeId(crumb.label) ? false : true));

    return { breadcrumbs: bcs, isReady: ready };
  }, [pathname, version, queryClient]);

  return { breadcrumbs, isReady };
}
