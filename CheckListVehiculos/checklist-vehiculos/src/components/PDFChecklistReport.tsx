import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, PDFViewer } from '@react-pdf/renderer';
import { format } from 'date-fns';
import logo from '../assets/logoJte.png';

const COLORS = {
  primary: '#0d6efd',
  secondary: '#6c757d',
  lightGray: '#f8f9fa',
  border: '#dee2e6',
  success: '#198754',
  danger: '#dc3545',
  warning: '#ffc107',
};

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica', fontSize: 10, color: '#212529' },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: COLORS.primary, paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, textTransform: 'uppercase', marginTop: 10 },
  subTitle: { fontSize: 10, color: COLORS.secondary, marginTop: 4 },
  
  // Tabla
  table: { width: '100%', borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.lightGray, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, minHeight: 25, alignItems: 'center' },
  colType: { width: '15%', padding: 5, borderRightWidth: 1, borderRightColor: COLORS.border },
  colItem: { width: '35%', padding: 5, borderRightWidth: 1, borderRightColor: COLORS.border },
  colStatus: { width: '15%', padding: 5, borderRightWidth: 1, borderRightColor: COLORS.border },
  colObs: { width: '35%', padding: 5 },
  headerText: { fontWeight: 'bold', fontSize: 9 },

  badgeOk: { color: COLORS.success, fontWeight: 'bold' },
  badgeBad: { color: COLORS.danger, fontWeight: 'bold' },

  obsTitle: { fontSize: 12, fontWeight: 'bold', color: COLORS.primary, marginBottom: 5 },
  obsBox: { padding: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, backgroundColor: COLORS.lightGray, minHeight: 40, marginBottom: 20 },

  // Fotos
  photosTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 15, color: COLORS.primary, textTransform: 'uppercase' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '48%', marginBottom: 15, borderWidth: 1, borderColor: COLORS.border, padding: 5, borderRadius: 4 },
  image: { width: '100%', height: 180, objectFit: 'contain', marginBottom: 5 },
  photoLabel: { fontSize: 10, textAlign: 'center', color: COLORS.secondary, fontWeight: 'bold' },

  footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', fontSize: 8, color: 'grey' }
});

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy HH:mm');
  } catch {
    return dateStr;
  }
};

const BASE_IMAGE_URL = import.meta.env.VITE_API_URL || 'https://app.jteanalytics.cl/checklist-vehiculos/';

export const ReportDocument = ({ data }: { data: any }) => {
  const getChecksArray = (checksObj: any, typeName: string) => {
    if (!checksObj) return [];
    return Object.values(checksObj).map((check: any) => ({
      ...check,
      type: typeName
    }));
  };

  const allChecks = [
    ...getChecksArray(data.visual_checks, 'Visual'),
    ...getChecksArray(data.mechanical_checks, 'Mecánico')
  ];

  const hasImages = data.images && data.images.length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={logo} style={{ width: 100 }} />
          <Text style={styles.title}>Reporte de Checklist Vehicular</Text>
          <Text style={styles.subTitle}>ID Checklist: #{data.id || '-'}</Text>
          <Text style={styles.subTitle}>Fecha: {data.created_at ? formatDate(data.created_at) : (data.fecha || '-')}</Text>
          <Text style={styles.subTitle}>Patente: {data.vehicle?.patente || data.patente || '-'}</Text>
          <Text style={styles.subTitle}>Modelo: {data.vehicle?.model || '-'}</Text>
          <Text style={styles.subTitle}>Operador: {data.user?.name || data.usuario || '-'}</Text>
          <Text style={styles.subTitle}>Kilometraje: {data.kilometraje_actual ? `${data.kilometraje_actual.toLocaleString()} km` : '-'}</Text>
          <Text style={styles.subTitle}>
            Estado General: {data.has_issues ? 'CON PROBLEMAS' : 'OK'}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colType}><Text style={styles.headerText}>TIPO</Text></View>
            <View style={styles.colItem}><Text style={styles.headerText}>ÍTEM</Text></View>
            <View style={styles.colStatus}><Text style={styles.headerText}>ESTADO</Text></View>
            <View style={styles.colObs}><Text style={styles.headerText}>OBSERVACIÓN</Text></View>
          </View>
          {allChecks.map((check, idx) => (
            <View key={idx} style={styles.tableRow} wrap={false}>
              <View style={styles.colType}><Text>{check.type}</Text></View>
              <View style={styles.colItem}><Text>{check.label || check.id}</Text></View>
              <View style={styles.colStatus}>
                <Text style={check.isGood ? styles.badgeOk : styles.badgeBad}>
                  {check.isGood ? 'OK' : 'MALO'}
                </Text>
              </View>
              <View style={styles.colObs}>
                <Text>{check.observation || '-'}</Text>
              </View>
            </View>
          ))}
        </View>

        {data.observaciones_generales && (
          <View wrap={false}>
            <Text style={styles.obsTitle}>OBSERVACIONES GENERALES</Text>
            <View style={styles.obsBox}>
              <Text>{data.observaciones_generales}</Text>
            </View>
          </View>
        )}

        {hasImages && (
          <View break>
            <Text style={styles.photosTitle}>REGISTRO FOTOGRÁFICO</Text>
            <View style={styles.photoGrid}>
              {data.images.map((img: any, idx: number) => (
                <View key={idx} style={styles.photoCard} wrap={false}>
                  <Image src={`${BASE_IMAGE_URL.replace(/\/$/, '')}/uploads/${img.image_path}`} style={styles.image} />
                  <Text style={styles.photoLabel}>{img.description || `Foto ${idx + 1}`}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};

const PDFChecklistReport: React.FC<{ data: any }> = ({ data }) => {
  return (
    <PDFViewer width="100%" height="100%" className="rounded border-0">
      <ReportDocument data={data} />
    </PDFViewer>
  );
};

export default PDFChecklistReport;
