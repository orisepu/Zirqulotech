import {
  Document, Page, Text, View, StyleSheet, Image
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  logo: { width: 100, marginBottom: 4, alignSelf: 'flex-start' },
  badge: {
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'right',
    marginBottom: 8,
    fontFamily: 'Helvetica'
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0B3D3A',
    fontFamily: 'Helvetica-Bold',
  },
  headerMeta: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 2,
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
    marginBottom: 8,
  },
  subinfo: { fontSize: 10, marginBottom: 2 },
  sectionHeader: { fontSize: 12, fontWeight: 'bold', marginTop: 20, marginBottom: 6 },
  twoColumns: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 0.8,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.25,
    borderBottomColor: '#E5E7EB',
    borderBottomStyle: 'solid',
    paddingVertical: 4,
  },
  cellModelo: { flex: 9, paddingRight: 15 },
  cellCapacidad: { flex: 2, paddingRight: 5 },
  cellImei: { flex: 4, paddingRight: 5 },
  cellPrecio: { flex: 2, textAlign: 'right', paddingRight: 5 },
  total: {
    marginTop: 10,
    fontSize: 11,
    textAlign: 'right',
    fontWeight: 'bold',
    backgroundColor: '#F5F7FA',
    padding: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 8,
    textAlign: 'left',
  },
});

type OfertaDeviceRow = { modelo: string; capacidad: string; imei?: string; numero_serie?: string; precio?: number }
type OportunidadSlim = { cliente?: { razon_social?: string; cif?: string }; calle?: string; piso?: string; puerta?: string; poblacion?: string; provincia?: string; codigo_postal?: string; persona_contacto?: string; correo_recogida?: string }

export default function OfertaPDFDocument({
  dispositivos,
  total,
  nombre,
  oportunidad,
  tienda: _tienda,
  fecha = new Date(),
  logoUrl,
}: {
  dispositivos: OfertaDeviceRow[],
  total: number,
  nombre: string,
  oportunidad?: OportunidadSlim,
  tienda?: unknown,
  cif?: string,
  calle?: string,
  fecha?: Date,
  logoUrl?: string,
}) {
  const fechaTexto = fecha.toLocaleDateString('es-ES');
  const cliente = oportunidad?.cliente;
  const contacto = oportunidad?.persona_contacto;
  const correo = oportunidad?.correo_recogida;
  const direccion = [
    oportunidad?.calle,
    oportunidad?.piso && `Piso ${oportunidad.piso}`,
    oportunidad?.puerta && `Puerta ${oportunidad.puerta}`,
    oportunidad?.poblacion,
    oportunidad?.provincia,
    oportunidad?.codigo_postal
  ].filter(Boolean).join(', ');

  const renderTableHeader = () => (
    <View style={styles.tableHeader} wrap={false}>
      <Text style={styles.cellModelo}>Modelo</Text>
      <Text style={styles.cellCapacidad}>Capacidad</Text>
      <Text style={styles.cellImei}>IMEI / SN</Text>
      <Text style={styles.cellPrecio}>Precio (€)</Text>
    </View>
  );

  const renderTableRows = (items: OfertaDeviceRow[]) =>
    items.map((d, i) => (
      <View style={styles.tableRow} key={i}>
        <Text style={styles.cellModelo}>{d.modelo}</Text>
        <Text style={styles.cellCapacidad}>{d.capacidad}</Text>
        <Text style={styles.cellImei}>{d.imei || d.numero_serie || '—'}</Text>
        <Text style={styles.cellPrecio}>
          {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0 }).format(d.precio || 0)} €
        </Text>
      </View>
    ));

  // --- Lógica para calcular bloques dinámicos ---
  const MAX_LINEAS_POR_PAGINA = 20;

  const bloques: OfertaDeviceRow[][] = [];
  let paginaActual: OfertaDeviceRow[] = [];
  let lineasActuales = 0;

  dispositivos.forEach((d) => {
    const lineas = d.modelo.length > 50 ? 2 : 1;

    if (lineasActuales + lineas > MAX_LINEAS_POR_PAGINA) {
      bloques.push(paginaActual);
      paginaActual = [];
      lineasActuales = 0;
    }

    paginaActual.push(d);
    lineasActuales += lineas;
  });

  if (paginaActual.length > 0) {
    bloques.push(paginaActual);
  }

  return (
    <Document>
      {bloques.map((bloque, idx) => (
        <Page key={idx} style={styles.page}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}

          {/* Badge sutil de Zirqulo */}
          <Text style={styles.badge}>Trade-in powered by Zirqulo</Text>

          {/* Encabezado compacto en una línea */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>OFERTA DE RECOMPRA</Text>
            <View>
              <Text style={styles.headerMeta}>📅 {fechaTexto}</Text>
              {nombre && <Text style={styles.headerMeta}>📄 {nombre}</Text>}
            </View>
          </View>

          {/* Separador visual sutil */}
          <View style={styles.separator} />

          <View style={styles.twoColumns}>
            <View>
              <Text style={styles.sectionHeader}>Datos del cliente</Text>
              <Text style={styles.subinfo}>Razón social: {cliente?.razon_social || '—'}</Text>
              <Text style={styles.subinfo}>CIF: {cliente?.cif || '—'}</Text>
              <Text style={styles.subinfo}>Dirección: {direccion || '—'}</Text>
              <Text style={styles.subinfo}>Contacto: {contacto || '—'}</Text>
              <Text style={styles.subinfo}>Email: {correo || '—'}</Text>
            </View>
            <View>
              <Text style={styles.sectionHeader}>Nuestros datos</Text>
              <Text style={styles.subinfo}>Zirqular S.L.</Text>
              <Text style={styles.subinfo}>CIF: B12345678</Text>
              <Text style={styles.subinfo}>Santa María, 153, 5º 4ª</Text>
              <Text style={styles.subinfo}>08340 Vilassar de Mar</Text>
              <Text style={styles.subinfo}>info@zirqular.com</Text>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Resumen de dispositivos</Text>
          {renderTableHeader()}
          {renderTableRows(bloque)}

          {idx === bloques.length - 1 && (
            <>
              <Text style={styles.total}>Total: {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0 }).format(total || 0)} €*</Text>
              <Text style={{ fontSize: 8, marginTop: 4 }}>* Precios válidos durante 15 días naturales desde la fecha de emisión.</Text>
            </>
          )}

          <View style={styles.footer} fixed>
            <View>
              <Text><Text style={{ fontWeight: 'bold' }}>Excelente:</Text> Sin marcas visibles, 100% funcional.</Text>
              <Text><Text style={{ fontWeight: 'bold' }}>Muy bueno:</Text> Pequeños signos de uso, totalmente funcional.</Text>
              <Text><Text style={{ fontWeight: 'bold' }}>Bueno:</Text> Signos visibles de uso, pero funcional.</Text>
            </View>
            <Text style={{ marginTop: 4, textAlign: "center" }}>Página {idx + 1} de {bloques.length}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
