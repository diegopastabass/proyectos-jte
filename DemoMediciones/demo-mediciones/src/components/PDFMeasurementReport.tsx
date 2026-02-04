import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import logo from "../assets/lgo.jpeg";

export interface ReportItem {
  label: string;
  value: number;
  unit: string;
  location: string;
  time: string;
  image?: string;
}

export interface ReportHeader {
  sessionId: string;
  date: string;
  technicianName: string;
  technicianEmail: string;
}

export interface ReportJson {
  header: ReportHeader;
  items: ReportItem[];
  metadata?: any;
}

const COLORS = {
  primary: "#0d6efd",
  secondary: "#6c757d",
  lightGray: "#f8f9fa",
  border: "#dee2e6",
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#212529",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.primary,
    textTransform: "uppercase",
  },
  subTitle: { fontSize: 10, color: COLORS.secondary, marginTop: 4 },

  // Tabla
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 25,
    alignItems: "center",
  },
  colItem: {
    width: "35%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  colVal: {
    width: "20%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  colLoc: {
    width: "25%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  colTime: { width: "20%", padding: 5 },
  headerText: { fontWeight: "bold", fontSize: 9 },

  // Sección Fotos
  photosTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
    marginTop: 10,
    color: COLORS.primary,
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoCard: {
    width: "48%",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 5,
    borderRadius: 4,
  },
  image: { width: "100%", height: 150, objectFit: "contain", marginBottom: 5 },
  photoLabel: { fontSize: 9, textAlign: "center", color: COLORS.secondary },

  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 8,
    color: "grey",
  },
});

const BASE_IMAGE_URL =
  "https://app.jteanalytics.cl/demo-mediciones/sessions/app/uploads/";

export const PDFMeasurementReport = ({ data }: { data: ReportJson }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Image src={logo} style={{ width: 100, height: 50 }} />
        <Text style={styles.title}>Informe Diarío de Producción</Text>
        <Text style={styles.subTitle}>
          Fecha: {new Date(data.header.date).toLocaleString()}
        </Text>
        <Text style={styles.subTitle}>
          Responsable Medición: {data.header.technicianName} (
          {data.header.technicianEmail})
        </Text>
      </View>

      {/* Tabla de Datos */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={styles.colItem}>
            <Text style={styles.headerText}>ÍTEM / MEDICIÓN</Text>
          </View>
          <View style={styles.colVal}>
            <Text style={styles.headerText}>VALOR</Text>
          </View>
          <View style={styles.colLoc}>
            <Text style={styles.headerText}>UBICACIÓN</Text>
          </View>
          <View style={styles.colTime}>
            <Text style={styles.headerText}>HORA</Text>
          </View>
        </View>

        {data.items.map((item, index) => (
          <View key={index} style={styles.tableRow}>
            <View style={styles.colItem}>
              <Text>{item.label}</Text>
            </View>
            <View style={styles.colVal}>
              <Text>
                {item.value} {item.unit}
              </Text>
            </View>
            <View style={styles.colLoc}>
              <Text>{item.location || "-"}</Text>
            </View>
            <View style={styles.colTime}>
              <Text>
                {new Date(item.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Anexo Fotográfico */}
      <Text style={styles.photosTitle} break>
        REGISTRO FOTOGRÁFICO
      </Text>
      <View style={styles.photoGrid}>
        {data.items
          .filter((i) => i.image)
          .map((item, index) => (
            <View key={index} style={styles.photoCard} wrap={false}>
              <Image
                src={`${BASE_IMAGE_URL}${item.image}`}
                style={styles.image}
              />
              <Text style={styles.photoLabel}>{item.label}</Text>
              <Text style={{ ...styles.photoLabel, fontSize: 8 }}>
                {new Date(item.time).toLocaleString()}
              </Text>
            </View>
          ))}
      </View>

      <Text
        style={styles.footer}
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
      />
    </Page>
  </Document>
);
