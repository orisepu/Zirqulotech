'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 10,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  box: {
    border: '1pt dashed gray',
    padding: 10,
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
  },
});

export function EtiquetaTerminalPDFDoc({
  tenant,
  oportunidad,
  imei,
  numeroSerie,
  modelo,
  capacidad,
}: {
  tenant: string;
  oportunidad: string;
  imei?: string;
  numeroSerie?: string;
  modelo?: string;
  capacidad?: string;
}) {
  return (
    <Document>
      <Page size="A7" style={styles.page}>
        <View style={styles.box}>
          <Text>RECEPCIÓN DE TERMINAL</Text>
          <Text>──────────────</Text>
          <Text><Text style={styles.label}>Partner:</Text> {tenant}</Text>
          <Text><Text style={styles.label}>Oportunidad:</Text> {oportunidad}</Text>
          <Text><Text style={styles.label}>Modelo:</Text> {modelo}</Text>
          <Text><Text style={styles.label}>Capacidad:</Text> {capacidad}</Text>
          {imei && <Text><Text style={styles.label}>IMEI:</Text> {imei}</Text>}
          {numeroSerie && <Text><Text style={styles.label}>Nº Serie:</Text> {numeroSerie}</Text>}
        </View>
      </Page>
    </Document>
  );
}
