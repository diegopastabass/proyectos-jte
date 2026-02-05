import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { type Quote } from "../types";
import logo_jt2 from "../assets/logo_jt2.png";
import firma_img from "../assets/fff.jpeg";

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
    paddingBottom: 80, // Damos espacio para que el footer absoluto no tape contenido
  },
  // ... (Tus estilos anteriores de header, infoGrid, table, etc. se mantienen igual) ...
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 10,
  },
  logo: { width: 100, height: "auto" },
  headerTextContainer: { alignItems: "flex-end" },
  reportTitle: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  metaData: { fontSize: 10, color: COLORS.secondary, marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.primary,
    marginTop: 10,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 15 },
  infoCol: { width: "50%", marginBottom: 4 },
  label: { fontWeight: "bold", fontSize: 9, color: COLORS.secondary },
  value: { fontSize: 10 },
  tableContainer: {
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    padding: 6,
  },
  tableHeaderCell: { color: "#FFF", fontSize: 9, fontWeight: "bold" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    padding: 6,
    alignItems: "center",
  },
  col1: { width: "10%" },
  col2: { width: "50%" },
  col3: { width: "10%", textAlign: "center" },
  col4: { width: "15%", textAlign: "right" },
  col5: { width: "15%", textAlign: "right" },
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  totalsBox: { width: "40%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: { fontWeight: "bold" },
  finalTotal: {
    fontWeight: "bold",
    fontSize: 12,
    color: COLORS.primary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 4,
  },
  conditionsContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: COLORS.lightGray,
    borderRadius: 4,
  },
  conditionRow: { marginBottom: 5 },
  conditionLabel: { fontWeight: "bold", fontSize: 9, color: COLORS.primary },
  conditionText: { fontSize: 9 },

  closingSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 50,
    marginBottom: 20,
  },
  contactArea: {
    width: "50%",
    textAlign: "left",
  },

  signatureArea: {
    width: "20%",
    height: "70%",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  signatureImage: {
    width: 120,
    height: "auto",
  },

  atentamente: {
    marginBottom: 15,
    fontSize: 10,
    color: COLORS.secondary,
  },
  contactName: {
    fontWeight: "bold",
    fontSize: 11,
    color: COLORS.primary,
  },
  contactRole: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 2,
    marginTop: 2,
  },
  contactDetail: {
    fontSize: 9,
    color: COLORS.secondary,
  },

  pageFooter: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    textAlign: "center",
    color: COLORS.secondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
});

interface Props {
  quote: Quote;
}

const formatCurrency = (amount: number) => {
  return amount.toLocaleString("es-CL", { style: "currency", currency: "CLP" });
};

export default function PDFQuote({ quote }: Props) {
  const { data, folio, created_at } = quote;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerContainer}>
          <Image src={logo_jt2} style={styles.logo} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.reportTitle}>Cotización de Servicios</Text>
            <Text style={styles.metaData}>JT Automatización</Text>
            <Text style={styles.metaData}>Rancagua, VI Región</Text>
            <Text
              style={[styles.metaData, { marginTop: 5, fontWeight: "bold" }]}
            >
              Folio: {folio}
            </Text>
            <Text style={styles.metaData}>
              Fecha: {new Date(created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Información del Proyecto</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.label}>Proyecto:</Text>
            <Text style={styles.value}>{data.project}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.label}>Empresa / Cliente:</Text>
            <Text style={styles.value}>
              {data.clientName} {data.company ? `(${data.company})` : ""}
            </Text>
          </View>
          <View style={[styles.infoCol, { marginTop: 5 }]}>
            <Text style={styles.label}>Contacto:</Text>
            <Text style={styles.value}>{data.contact || "-"}</Text>
          </View>
          <View style={[styles.infoCol, { marginTop: 5 }]}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{data.email || "-"}</Text>
          </View>
        </View>

        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.col1]}>#</Text>
            <Text style={[styles.tableHeaderCell, styles.col2]}>Detalle</Text>
            <Text style={[styles.tableHeaderCell, styles.col3]}>Cant.</Text>
            <Text style={[styles.tableHeaderCell, styles.col4]}>Unitario</Text>
            <Text style={[styles.tableHeaderCell, styles.col5]}>Total</Text>
          </View>
          {data.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.value, styles.col1]}>{index + 1}</Text>
              <Text style={[styles.value, styles.col2]}>{item.detail}</Text>
              <Text style={[styles.value, styles.col3]}>{item.qty}</Text>
              <Text style={[styles.value, styles.col4]}>
                {formatCurrency(item.unitPrice)}
              </Text>
              <Text style={[styles.value, styles.col5]}>
                {formatCurrency(item.qty * item.unitPrice)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Neto:</Text>
              <Text style={styles.value}>{formatCurrency(data.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IVA (19%):</Text>
              <Text style={styles.value}>{formatCurrency(data.iva)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.finalTotal}>Total IVA Incl.:</Text>
              <Text style={styles.finalTotal}>
                {formatCurrency(data.total)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.conditionsContainer}>
          {data.generalDesc && (
            <View style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>
                Descripciones Generales:
              </Text>
              <Text style={styles.conditionText}>{data.generalDesc}</Text>
            </View>
          )}
          {data.deliveryTime && (
            <View style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>Plazos de Entrega:</Text>
              <Text style={styles.conditionText}>{data.deliveryTime}</Text>
            </View>
          )}
          {data.paymentTerms && (
            <View style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>Facturación / Pagos:</Text>
              <Text style={styles.conditionText}>{data.paymentTerms}</Text>
            </View>
          )}
          {data.considerations && (
            <View style={styles.conditionRow}>
              <Text style={styles.conditionLabel}>Consideraciones:</Text>
              <Text style={styles.conditionText}>{data.considerations}</Text>
            </View>
          )}
        </View>

        <View style={styles.closingSection} wrap={false}>
          {/* Lado Izquierdo: Texto y Datos (Ahora alineados a la izquierda) */}
          <View style={styles.contactArea}>
            {/* Movimos el Atentamente aquí dentro para que se alinee con el resto */}
            <Text style={styles.atentamente}>Atentamente,</Text>

            <Text style={styles.contactName}>Eduardo Martínez Espina</Text>
            <Text style={styles.contactRole}>Gerente General</Text>
            <Text style={styles.contactDetail}>
              Ingeniero en Automatización y Control Industrial
            </Text>
            <Text style={styles.contactDetail}>972065712</Text>
            <Text style={styles.contactDetail}>
              emartinez@jtautomatizacion.cl
            </Text>
          </View>

          {/* Lado Derecho: Firma PNG */}
          <View style={styles.signatureArea}>
            <Image src={firma_img} style={styles.signatureImage} />
            <View
              style={{
                borderBottomWidth: 1,
                borderColor: "#000",
                width: "100%",
                marginTop: 5,
              }}
            />
          </View>
        </View>

        {/* FOOTER DE PÁGINA */}
        <Text
          style={styles.pageFooter}
          render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages} - Emitido por JT Automatización`
          }
        />
      </Page>
    </Document>
  );
}
