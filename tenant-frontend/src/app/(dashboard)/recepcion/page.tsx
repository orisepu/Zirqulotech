"use client";

import {
  Box, Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, Typography, Button,
  TablePagination, TextField, CircularProgress
} from '@mui/material';
import { useRouter } from "next/navigation";
import api from '@/services/api';
import debounce from 'lodash.debounce';
import React, { useEffect, useState, useCallback } from 'react';
import { getIdlink } from '@/shared/utils/id';
type Order = 'asc' | 'desc';

export default function ListaOportunidadesEnTransito() {
  const router = useRouter();
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchRaw, setSearchRaw] = useState('');
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  const [search, setSearch] = useState('');
  const [orderBy, setOrderBy] = useState('fecha_creacion');
  const [order, setOrder] = useState<Order>('desc');
  const [searchAnnouncement, setSearchAnnouncement] = useState('');
  const [pageAnnouncement, setPageAnnouncement] = useState('');
  // función debounced
  const debouncedSearch = useCallback(
    debounce((value: string) => {
        setSearch(value);
    }, 800),
    [] // se crea solo una vez
  );

  // manejar cambio de input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchRaw(value);
    debouncedSearch(value);
  };
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/oportunidades-globales/', {
        params: {
          estado: 'En tránsito',
          cliente: search,
          limit,
          offset,
        }
      });
      setOportunidades(res.data.results || []);
      setTotal(res.data.total || 0);
    } catch (error) {
      console.error("Error cargando oportunidades:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [limit, offset, search]);

  useEffect(() => {
    if (!loading && search) {
      setSearchAnnouncement(`${total} oportunidades encontradas para "${search}"`);
    } else if (!loading) {
      setSearchAnnouncement(`${total} oportunidades en tránsito`);
    }
  }, [total, search, loading]);

  const handleSort = (column: string) => {
    const isAsc = orderBy === column && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(column);
    // Aquí puedes implementar orden real en backend si lo soporta
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setOffset(newPage * limit);
    setPageAnnouncement(`Página ${newPage + 1} de ${Math.ceil(total / limit)}`);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLimit(parseInt(event.target.value, 10));
    setOffset(0);
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Recepción de terminales en tránsito</Typography>

      <TextField
        label="Buscar por cliente"
        variant="outlined"
        size="small"
        fullWidth
        sx={{ my: 2 }}
        value={searchRaw}
        onChange={handleSearchChange}
        aria-describedby="search-results-status"
        aria-controls="opportunities-table"
      />

      <Typography
        id="search-results-status"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0
        }}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {searchAnnouncement}
      </Typography>

      {loading ? (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={4} role="status" aria-live="polite" aria-busy="true">
          <CircularProgress aria-label="Cargando oportunidades" />
          <Typography sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0
          }}>Cargando datos...</Typography>
        </Box>
      ) : (
        <>
          <Table id="opportunities-table" aria-labelledby="opportunities-table-label" size="small">
            <caption id="opportunities-table-label" style={{
              position: 'absolute',
              left: '-10000px',
              top: 'auto',
              width: '1px',
              height: '1px',
              overflow: 'hidden'
            }}>
              Oportunidades en tránsito para recepción
            </caption>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>
                    <TableSortLabel
                    active={orderBy === 'Tienda'}
                    direction={orderBy === 'Tienda' ? order : 'asc'}
                    onClick={() => handleSort('Tienda')}
                    >
                   Tienda </TableSortLabel>
                </TableCell>
                <TableCell>
                    <TableSortLabel
                    active={orderBy === 'Partner'}
                    direction={orderBy === 'Partner' ? order : 'asc'}
                    onClick={() => handleSort('Partner')}
                    >
                   Partner </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'cliente'}
                    direction={orderBy === 'cliente' ? order : 'asc'}
                    onClick={() => handleSort('cliente')}
                  >
                    Cliente
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'fecha_creacion'}
                    direction={orderBy === 'fecha_creacion' ? order : 'asc'}
                    onClick={() => handleSort('fecha_creacion')}
                  >
                    Fecha
                  </TableSortLabel>
                </TableCell>
                <TableCell>Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {oportunidades.map(op => (
                <TableRow key={op.id}>
                  <TableCell>{op.hashid}</TableCell>
                  <TableCell>{op.tienda|| '—'}</TableCell>
                  <TableCell>{op.tenant_nombre || op.tenant || '—'}</TableCell>
                  <TableCell>{op.cliente?.razon_social || '—'}</TableCell>
                  <TableCell>{new Date(op.fecha_creacion).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => router.push(`/recepcion/${getIdlink(op)}?tenant=${op.schema}`)}
                    >
                      Gestionar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={total}
            page={Math.floor(offset / limit)}
            onPageChange={handleChangePage}
            rowsPerPage={limit}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            aria-label="Paginación de tabla"
          />
          <Typography
            sx={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0
            }}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {pageAnnouncement}
          </Typography>
        </>
      )}
    </Box>
  );
}
