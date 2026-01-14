import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { type ReportData } from "../types";
import logo_jt2 from "../assets/logo_jt2.png";

const COLORS = {
  primary: "#103E84",
  secondary: "#666666",
  lightGray: "#F3F4F6",
  border: "#E5E7EB",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
    color: "#333",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 10,
  },
  logo: {
    width: 100,
    height: "auto",
  },
  headerTextContainer: {
    alignItems: "flex-end",
  },
  reportTitle: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  otNumber: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 4,
  },

  infoGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  infoBox: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    padding: 10,
    borderRadius: 4,
  },
  infoBoxTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 2,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  infoLabel: {
    fontWeight: "bold",
    width: 60,
    fontSize: 9,
    color: COLORS.secondary,
  },
  infoValue: {
    flex: 1,
    fontSize: 9,
  },

  section: {
    marginBottom: 15,
  },
  sectionHeader: {
    backgroundColor: COLORS.primary,
    color: "white",
    padding: 5,
    paddingLeft: 10,
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 8,
    borderRadius: 2,
  },
  contentBlock: {
    marginLeft: 5,
    marginRight: 5,
    textAlign: "justify",
  },

  listItem: {
    flexDirection: "row",
    marginBottom: 4,
    marginLeft: 5,
  },
  bullet: {
    width: 10,
    fontSize: 14,
    color: COLORS.primary,
  },

  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 5,
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
  },
  colDesc: {
    width: "85%",
    padding: 5,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  colQty: {
    width: "15%",
    padding: 5,
    borderRightColor: COLORS.border,
    textAlign: "center",
  },
  tableHeaderText: { fontWeight: "bold", fontSize: 9, color: COLORS.primary },

  signatureSection: {
    marginTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  signatureBlock: {
    width: "40%",
    alignItems: "center",
  },
  signatureLine: {
    width: "100%",
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    marginBottom: 5,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  signatureImage: {
    width: 100,
    height: 50,
    objectFit: "contain",
  },
  signerName: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  signerRole: {
    fontSize: 9,
    color: COLORS.secondary,
    textAlign: "center",
  },

  pageFooter: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    color: "grey",
  },
});

interface Props {
  data: ReportData;
}

export const PDFReport = ({ data }: Props) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      <View style={styles.headerContainer}>
        <Image style={styles.logo} src={logo_jt2} />
        <View style={styles.headerTextContainer}>
          <Text style={styles.reportTitle}>Informe Técnico</Text>
          <Text style={styles.otNumber}>OT N°: {data.ticket.number}</Text>
          <Text style={{ fontSize: 10, color: COLORS.secondary }}>
            {data.ticket.date}
          </Text>
        </View>
      </View>

      {/* Info Grid: Cliente + Contacto/Detalles */}
      <View style={styles.infoGrid}>
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxTitle}>INFORMACIÓN DEL CLIENTE</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Empresa:</Text>
            <Text style={styles.infoValue}>{data.client.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dirección:</Text>
            <Text style={styles.infoValue}>{data.client.address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Equipos:</Text>
            <Text style={styles.infoValue}>{data.client.equipment}</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoBoxTitle}>DETALLE DE ATENCIÓN</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Contacto:</Text>
            <Text style={styles.infoValue}>{data.contact.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tipo:</Text>
            <Text style={styles.infoValue}>{data.type}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estado:</Text>
            <Text style={{ ...styles.infoValue, fontWeight: "bold" }}>
              {data.status}
            </Text>
          </View>
        </View>
      </View>

      {/* Diagnóstico */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>1. DIAGNÓSTICO / DESCRIPCIÓN</Text>
        <View style={styles.contentBlock}>
          <Text>{data.description}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>2. DESARROLLO DE ACTIVIDADES</Text>
        <View style={styles.contentBlock}>
          {data.developments && data.developments.length > 0 ? (
            data.developments.map((dev, index) => (
              <View key={index} style={styles.listItem}>
                {/* Usamos guión o bullet diferente para diferenciar */}
                <Text style={styles.bullet}>-</Text>
                <Text style={{ flex: 1 }}>{dev}</Text>
              </View>
            ))
          ) : (
            <Text style={{ fontStyle: "italic", color: "#666" }}>
              Sin detalles de desarrollo registrados.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>3. SOLUCIÓN TÉCNICA</Text>
        <View style={styles.contentBlock}>
          {data.solutions.map((sol, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={{ flex: 1 }}>{sol}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Materiales (Si existen) */}
      {data.materials.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>4. REPUESTOS E INSUMOS</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={styles.colDesc}>
                <Text style={styles.tableHeaderText}>DESCRIPCIÓN</Text>
              </View>
              <View style={styles.colQty}>
                <Text style={styles.tableHeaderText}>CANT.</Text>
              </View>
            </View>
            {data.materials.map((mat, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={styles.colDesc}>
                  <Text>{mat.description}</Text>
                </View>
                <View style={styles.colQty}>
                  <Text>{mat.quantity}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text
        style={styles.pageFooter}
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
      />
    </Page>

    {/* ================= PÁGINA 2: OBS Y FIRMAS ================= */}
    <Page size="LETTER" style={styles.page}>
      {/* Header Simplificado para Pág 2 */}
      <View style={{ ...styles.headerContainer, marginBottom: 40 }}>
        <View>
          <Text style={{ fontSize: 10, color: COLORS.secondary }}>
            ANEXO DE CIERRE
          </Text>
          <Text style={{ ...styles.reportTitle, fontSize: 14 }}>
            OT N°: {data.ticket.number}
          </Text>
        </View>
        <Text style={{ fontSize: 10, color: COLORS.secondary }}>
          Fecha: {data.ticket.date}
        </Text>
      </View>

      {/* Observaciones (Condicional) */}
      {data.observations.length > 0 && (
        <View style={{ ...styles.section, marginBottom: 60 }}>
          <Text style={styles.sectionHeader}>OBSERVACIONES GENERALES</Text>
          <View style={styles.contentBlock}>
            {data.observations.map((obs, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={{ flex: 1 }}>{obs}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Sección de Firmas (Siempre aquí) */}
      <View style={styles.signatureSection}>
        {/* Firma Técnico */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine}>
            {data.techSignature && (
              <Image src={data.techSignature} style={styles.signatureImage} />
            )}
          </View>
          <Text style={styles.signerName}>{data.techName}</Text>
          <Text style={styles.signerRole}>Técnico Especialista</Text>
        </View>

        {/* Firma Cliente */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine}>
            {data.clientSignature && (
              <Image src={data.clientSignature} style={styles.signatureImage} />
            )}
          </View>
          <Text style={styles.signerName}>{data.clientSigner}</Text>
          <Text style={styles.signerRole}>Recepción Cliente</Text>
        </View>
      </View>

      <Text
        style={styles.pageFooter}
        render={({ pageNumber, totalPages }) =>
          `Página ${pageNumber} de ${totalPages}`
        }
      />
    </Page>
  </Document>
);
