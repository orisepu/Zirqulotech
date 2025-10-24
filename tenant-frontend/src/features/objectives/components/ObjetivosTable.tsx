"use client";

import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  Button,
} from "@mui/material";
import { type ObjetivoResumenItem, type ObjetivoScope } from "@/services/api";

function formatEuro(value: number) {
  return (
    value.toLocaleString("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

type ObjetivosTableProps = {
  data: ObjetivoResumenItem[];
  scope: ObjetivoScope;
  isLoading?: boolean;
  onEdit: (item: ObjetivoResumenItem) => void;
};

export function ObjetivosTable({
  data,
  scope,
  isLoading = false,
  onEdit,
}: ObjetivosTableProps) {
  if (data.length === 0 && !isLoading) {
    return (
      <Paper sx={{ p: 4, textAlign: "center" }}>
        <Typography color="textSecondary">
          No hay registros para el período seleccionado.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ position: "relative", overflow: "hidden" }}>
      {isLoading && (
        <LinearProgress sx={{ position: "absolute", inset: 0, borderRadius: 1 }} />
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{scope === "tienda" ? "Tienda" : "Usuario"}</TableCell>
              <TableCell align="right">Objetivo €</TableCell>
              <TableCell align="right">Objetivo operaciones</TableCell>
              <TableCell align="right">Progreso €</TableCell>
              <TableCell align="right">Progreso operaciones</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row) => {
              const valorObjetivo = row.objetivo_valor || 0;
              const valorPercent =
                valorObjetivo > 0
                  ? Math.min(100, (row.progreso_valor / valorObjetivo) * 100)
                  : null;
              const opsObjetivo = row.objetivo_operaciones || 0;
              const opsPercent =
                opsObjetivo > 0
                  ? Math.min(100, (row.progreso_operaciones / opsObjetivo) * 100)
                  : null;

              return (
                <TableRow key={row.target_id} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">{row.target_name}</Typography>
                      {row.email && (
                        <Typography variant="body2" color="text.secondary">
                          {row.email}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {valorObjetivo > 0 ? formatEuro(valorObjetivo) : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {opsObjetivo > 0 ? opsObjetivo.toLocaleString() : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack spacing={0.5} alignItems="flex-end">
                      <Typography variant="body2">
                        {formatEuro(row.progreso_valor)}
                      </Typography>
                      {valorPercent !== null && (
                        <Chip
                          size="small"
                          color={valorPercent >= 100 ? "success" : "default"}
                          label={`${valorPercent.toFixed(0)}%`}
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Stack spacing={0.5} alignItems="flex-end">
                      <Typography variant="body2">
                        {row.progreso_operaciones.toLocaleString()}
                      </Typography>
                      {opsPercent !== null && (
                        <Chip
                          size="small"
                          color={opsPercent >= 100 ? "success" : "default"}
                          label={`${opsPercent.toFixed(0)}%`}
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onEdit(row)}
                    >
                      Editar objetivos
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}