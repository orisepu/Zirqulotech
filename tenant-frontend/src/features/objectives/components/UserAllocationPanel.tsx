"use client";

import {
  Box,
  Typography,
  TextField,
  Stack,
  Button,
  Divider,
  Alert,
} from "@mui/material";

export type UserAllocation = {
  usuario_id: number;
  nombre: string;
  valorInput: string;
  operacionesInput: string;
};

type UserAllocationPanelProps = {
  users: UserAllocation[];
  totalValor: number;
  totalOperaciones: number;
  onUserChange: (userId: number, field: "valorInput" | "operacionesInput", value: string) => void;
  onDistributeEqually: () => void;
};

function formatEuro(value: number) {
  return (
    value.toLocaleString("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

export function UserAllocationPanel({
  users,
  totalValor,
  totalOperaciones,
  onUserChange,
  onDistributeEqually,
}: UserAllocationPanelProps) {
  const sumValor = users.reduce((acc, user) => acc + Number(user.valorInput || 0), 0);
  const sumOperaciones = users.reduce((acc, user) => acc + Number(user.operacionesInput || 0), 0);

  const valorDifference = totalValor - sumValor;
  const operacionesDifference = totalOperaciones - sumOperaciones;

  const hasErrors = Math.abs(valorDifference) > 0.01 || operacionesDifference !== 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Asignación por usuario</Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={onDistributeEqually}
        >
          Distribuir equitativamente
        </Button>
      </Stack>

      <Stack spacing={2}>
        {users.map((user) => (
          <Stack
            key={user.usuario_id}
            direction="row"
            spacing={2}
            alignItems="center"
          >
            <Typography
              variant="body2"
              sx={{ minWidth: 140, fontWeight: 500 }}
            >
              {user.nombre}
            </Typography>
            <TextField
              size="small"
              type="number"
              label="Objetivo €"
              value={user.valorInput}
              onChange={(e) => onUserChange(user.usuario_id, "valorInput", e.target.value)}
              inputProps={{ min: 0, step: "100" }}
              sx={{ width: 140 }}
            />
            <TextField
              size="small"
              type="number"
              label="Operaciones"
              value={user.operacionesInput}
              onChange={(e) => onUserChange(user.usuario_id, "operacionesInput", e.target.value)}
              inputProps={{ min: 0, step: "1" }}
              sx={{ width: 140 }}
            />
          </Stack>
        ))}
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="textSecondary">
            Suma usuarios:
          </Typography>
          <Typography variant="body2">
            {formatEuro(sumValor)} | {sumOperaciones} ops
          </Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="textSecondary">
            Objetivo tienda:
          </Typography>
          <Typography variant="body2">
            {formatEuro(totalValor)} | {totalOperaciones} ops
          </Typography>
        </Stack>

        {hasErrors && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            <Typography variant="body2">
              Diferencia: {formatEuro(valorDifference)} | {operacionesDifference} ops
            </Typography>
            <Typography variant="body2">
              La suma de usuarios debe coincidir con el objetivo de la tienda.
            </Typography>
          </Alert>
        )}
      </Stack>
    </Box>
  );
}