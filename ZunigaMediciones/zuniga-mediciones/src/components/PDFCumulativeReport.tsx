import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import logo from "../assets/logoZuniga.png";

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: "Helvetica",
    fontSize: 8,
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#103E84",
  },
  subtitle: { fontSize: 10, color: "#666" },

  table: { width: "100%", borderWidth: 1, borderColor: "#eee" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    alignItems: "center",
    height: 24,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    height: 24,
    alignItems: "center",
  },

  cellDate: { width: "12%", padding: 4 },
  cellVal: { width: "11%", padding: 4, textAlign: "center" },

  headerText: { fontWeight: "bold", color: "#333" },
  cellText: { color: "#555" },

  balanceSection: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 4,
  },
  balanceTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#103E84",
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    textAlign: "center",
    fontSize: 8,
    color: "#aaa",
  },
});

interface Props {
  data: any[];
  stats: any;
  range: { start: string; end: string };
}

export const PDFCumulativeReport = ({ data, stats, range }: Props) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Informe Acumulado de Producción</Text>
          <Text style={styles.subtitle}>
            Desde: {range.start} Hasta: {range.end}
          </Text>
        </View>
        <Image src={logo} style={{ width: 100, height: "auto" }} />
      </View>

      {/* Tabla */}
      <View style={styles.table}>
        {/* Cabecera */}
        <View style={styles.headerRow}>
          <Text style={[styles.cellDate, styles.headerText]}>Fecha/Hora</Text>
          <Text style={[styles.cellVal, styles.headerText]}>Horómetro</Text>
          <Text style={[styles.cellVal, styles.headerText]}>Caudal (m³)</Text>
          <Text style={[styles.cellVal, styles.headerText]}>Energía</Text>
          <Text style={[styles.cellVal, styles.headerText]}>N. Estático</Text>
          <Text style={[styles.cellVal, styles.headerText]}>N. Dinámico</Text>
          <Text style={[styles.cellVal, styles.headerText]}>Cloro Caseta</Text>
          <Text style={[styles.cellVal, styles.headerText]}>Cloro Red 1</Text>
          <Text style={[styles.cellVal, styles.headerText]}>Cloro Red 2</Text>
        </View>

        {/* Filas */}
        {data.map((row, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.cellDate, styles.cellText]}>
              {new Date(row.time).toLocaleString()}
            </Text>
            <Text style={[styles.cellVal, styles.cellText]}>
              {row.horometro || "-"}
            </Text>
            <Text style={[styles.cellVal, styles.cellText]}>
              {row.caudalimetro || "-"}
            </Text>
            <Text style={[styles.cellVal, styles.cellText]}>
              {row.energia || "-"}
            </Text>
            <Text style={[styles.cellVal, styles.cellText]}>
              {row.estatico || "-"}
            </Text>
            <Text style={[styles.cellVal, styles.cellText]}>
              {row.dinamico || "-"}
            </Text>
            <Text style={[styles.cellVal, styles.cellText]}>
              {row.cloroBomba || "-"}
            </Text>
            <Text style={[styles.cellVal, styles.cellText]}>
              {row.cloroRed1 || "-"}
            </Text>
            <Text style={[styles.cellVal, styles.cellText]}>
              {row.cloroRed2 || "-"}
            </Text>
          </View>
        ))}
      </View>

      {/* Balances */}
      <View style={styles.balanceSection}>
        <Text style={styles.balanceTitle}>Resumen del Período</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          <View style={{ width: "33%" }}>
            <Text>Horómetro Total: {stats.horometroTotal}</Text>
          </View>
          <View style={{ width: "33%" }}>
            <Text>Caudalímetro (Último): {stats.caudalimetroFin}</Text>
          </View>
          <View style={{ width: "33%" }}>
            <Text>Energía Promedio: {stats.energiaProm}</Text>
          </View>
          <View style={{ width: "33%", marginTop: 5 }}>
            <Text>Nivel Est. Prom: {stats.estaticoProm}</Text>
          </View>
          <View style={{ width: "33%", marginTop: 5 }}>
            <Text>Nivel Din. Prom: {stats.dinamicoProm}</Text>
          </View>
          <View style={{ width: "33%", marginTop: 5 }}>
            <Text>Cloro Caseta Prom: {stats.cloroBombaProm}</Text>
          </View>
          <View style={{ width: "33%", marginTop: 5 }}>
            <Text>Cloro Red 1 Prom: {stats.cloroRed1Prom}</Text>
          </View>
          <View style={{ width: "33%", marginTop: 5 }}>
            <Text>Cloro Red 2 Prom: {stats.cloroRed2Prom}</Text>
          </View>
        </View>
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
