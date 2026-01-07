import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { type ReportData } from '../types';
import logo_jt2 from '../assets/logo_jt2.png';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Times-Roman',
    fontSize: 12,
    lineHeight: 1.5,
  },
  logo: {
    width: 120,
    height: 'auto',
    marginBottom: 15,
  },
  header: {
    marginBottom: 20,
    borderBottom: '1px solid #000',
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    textDecoration: 'underline',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
    width: 100,
  },
  value: {
    flex: 1,
  },
  listItem: {
    marginLeft: 15,
  },
  table: {
    display: "flex",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 10,
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row"
  },
  tableColDesc: {
    width: "60%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
  },
  tableColNum: {
    width: "20%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
  },
  tableCellHeader: {
    fontWeight: 'bold',
    fontSize: 12
  },
  // Estilo para la imagen de la firma
  signatureImage: {
    width: 120,
    height: 60,
    marginTop: 5,
    objectFit: 'contain',
  },
  signatureBox: {
    alignItems: 'center', 
    width: '45%', // Ajustamos el ancho para que quepan bien
  },
  signatureLine: {
    borderBottom: '1px solid #000', 
    width: '100%', 
    alignItems: 'center', 
    marginBottom: 5,
    height: 70, // Altura fija para la caja de firma
    justifyContent: 'flex-end', // Alinear firma al fondo de la línea
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1px solid #000', // Esta línea superior es opcional si ya usamos líneas individuales
    paddingTop: 10,
  }
});

interface Props {
  data: ReportData;
}

export const PDFReport = ({ data }: Props) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      <Image style={styles.logo} src={logo_jt2} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Informe Técnico</Text>
          <Text>{data.type}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text>OT: {data.ticket.number}</Text>
          <Text>Fecha: {data.ticket.date}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Información del Cliente</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Cliente:</Text>
          <Text style={styles.value}>{data.client.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Dirección:</Text>
          <Text style={styles.value}>{data.client.address}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Equipos:</Text>
          <Text style={styles.value}>{data.client.equipment}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Contacto en Sitio</Text>
        <Text>Nombre: {data.contact.name} | Tel: {data.contact.phone} | Email: {data.contact.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Detalle de Atención</Text>
        <Text>Inicio: {new Date(data.startDate).toLocaleString()} - Fin: {new Date(data.endDate).toLocaleString()}</Text>
        <Text style={{ marginTop: 5 }}>Estado Final: {data.status}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Descripción / Diagnóstico</Text>
        <Text>{data.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Desarrollo y Solución</Text>
        {data.solutions.map((sol, index) => (
          <Text key={index} style={styles.listItem}>• {sol}</Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>6. Observaciones Generales</Text>
        {data.observations.map((obs, index) => (
          <Text key={index} style={styles.listItem}>• {obs}</Text>
        ))}
      </View>

      {/* Solo renderiza esta sección si hay materiales */}
      {data.materials.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Repuestos / Materiales Utilizados</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.tableColDesc}><Text style={styles.tableCellHeader}>Descripción</Text></View>
              <View style={styles.tableColNum}><Text style={styles.tableCellHeader}>Cant.</Text></View>
              <View style={styles.tableColNum}><Text style={styles.tableCellHeader}>Costo ($)</Text></View>
            </View>
            {data.materials.map((mat, index) => (
              <View style={styles.tableRow} key={index}>
                <View style={styles.tableColDesc}><Text>{mat.description}</Text></View>
                <View style={styles.tableColNum}><Text>{mat.quantity}</Text></View>
                <View style={styles.tableColNum}><Text>{mat.cost}</Text></View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* FOOTER CON FIRMAS */}
      <View style={styles.footer}>
        {/* Firma Cliente */}
        <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
               {data.clientSignature ? (
                  <Image src={data.clientSignature} style={styles.signatureImage} />
               ) : null}
            </View>
            <Text>{data.clientSigner}</Text>
            <Text style={{ fontSize: 10, color: 'grey' }}>Cliente (Aprobado)</Text>
        </View>

        {/* Firma Técnico */}
        <View style={styles.signatureBox}>
            <View style={styles.signatureLine}>
               {data.techSignature ? (
                  <Image src={data.techSignature} style={styles.signatureImage} />
               ) : null}
            </View>
            <Text>{data.techName}</Text>
            <Text style={{ fontSize: 10, color: 'grey' }}>Técnico Terreno</Text>
        </View>
      </View>
    </Page>
  </Document>
);