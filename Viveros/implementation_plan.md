# Adding High-Value Features for Viveros AgTech

This plan outlines the addition of advanced agricultural metrics and reporting to the Viveros project to provide more value to the client beyond simple monitoring.

## User Review Required

> [!IMPORTANT]
> **VPD Calculation**: We will implement Vapor Pressure Deficit (VPD) calculation. This requires both Temperature and Humidity from the same zone.
> **Reporting**: We propose adding an automated weekly PDF report. You can guide by the design of the cumulative and measurement reports from another client, but customize it for this client, only use the same style/design principles, the report should include Min/Max/Avg, time out of optimal range, and alert history. You can find the example reports components in the path /home/diego/Documentos/proyectoEduardo/Proyectos/Viveros/PDFCumulativeReport.tsx, /home/diego/Documentos/proyectoEduardo/Proyectos/Viveros/PDFMeasurementReport.tsx.

## Proposed Changes

### [Backend] api-viveros

#### [MODIFY] [metrics.service.ts](file:///home/diego/Documentos/proyectoEduardo/Proyectos/Viveros/api-viveros/src/metrics/services/metrics.service.ts)

- Implement `calculateVPD(temp, humidity)` utility.
- Update `findLatestForEachSensor` to include calculated VPD for each zone (Calor, Frio, Ambiente).
- Update `findChartData` to optionally include VPD series.

#### [NEW] [reports.service.ts](file:///home/diego/Documentos/proyectoEduardo/Proyectos/Viveros/api-viveros/src/metrics/services/reports.service.ts)

- Create a service to generate PDF reports using a library like `pdfkit` or `puppeteer`.
- Include weekly summaries: Min/Max/Avg, time out of optimal range, and alert history.

#### [NEW] [reports.controller.ts](file:///home/diego/Documentos/proyectoEduardo/Proyectos/Viveros/api-viveros/src/metrics/controllers/reports.controller.ts)

- Add endpoint `GET /reports/weekly` to download the generated report.

---

### [Frontend] viverosDashboard

#### [MODIFY] [Home.tsx](file:///home/diego/Documentos/proyectoEduardo/Proyectos/Viveros/viverosDashboard/src/pages/Home.tsx)

- Add VPD display to each zone card (Ambiente, Frio, Calor).
- Add a "VPD Status" indicator (Optimal, High Stress, Low Transpiration) based on standard agricultural ranges.
- Add a button to download the Weekly Report.

#### [NEW] [VpdChart.tsx](file:///home/diego/Documentos/proyectoEduardo/Proyectos/Viveros/viverosDashboard/src/components/VpdChart.tsx)

- A component to visualize VPD trends over time.

---

## Verification Plan

### Automated Tests

- Unit tests for `calculateVPD` to ensure accuracy against known standard tables.
- Integration test for the PDF generation endpoint.

### Manual Verification

- Verify the dashboard displays VPD correctly for all three zones.
- Test the "Download Report" button.
