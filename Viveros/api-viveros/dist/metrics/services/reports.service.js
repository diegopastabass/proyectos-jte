"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ReportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const metric_entity_1 = require("../models/metric.entity");
const metrics_service_1 = require("./metrics.service");
const PdfPrinter = require("pdfmake");
const VPD_LOW_THRESHOLD = 0.8;
const VPD_HIGH_THRESHOLD = 1.2;
let ReportsService = ReportsService_1 = class ReportsService {
    constructor(metricRepository) {
        this.metricRepository = metricRepository;
        this.logger = new common_1.Logger(ReportsService_1.name);
    }
    async generateWeeklyReport() {
        try {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 + 7;
            const lastMonday = new Date(now);
            lastMonday.setDate(now.getDate() - daysToLastMonday);
            lastMonday.setHours(0, 0, 0, 0);
            const lastSunday = new Date(lastMonday);
            lastSunday.setDate(lastMonday.getDate() + 6);
            lastSunday.setHours(23, 59, 59, 999);
            this.logger.log(`Generando reporte semanal: ${lastMonday.toISOString()} → ${lastSunday.toISOString()}`);
            const sensorIds = ['3', '4', '5', '6', '7', '8'];
            const rawData = await this.metricRepository
                .createQueryBuilder('m')
                .where('m.sensor_id IN (:...sensorIds)', { sensorIds })
                .andWhere('m.time BETWEEN :start AND :end', {
                start: lastMonday,
                end: lastSunday,
            })
                .orderBy('m.time', 'ASC')
                .getMany();
            const grouped = {};
            sensorIds.forEach((id) => (grouped[id] = []));
            rawData.forEach((row) => {
                grouped[row.sensor_id]?.push({ value: row.value, time: row.time });
            });
            const zones = [
                { name: 'Calor', tempId: '5', humId: '3' },
                { name: 'Frío', tempId: '6', humId: '4' },
                { name: 'Ambiente', tempId: '7', humId: '8' },
            ];
            const alerts = [];
            const zoneStats = [];
            for (const zone of zones) {
                const tempData = grouped[zone.tempId];
                const humData = grouped[zone.humId];
                if (!tempData.length || !humData.length) {
                    zoneStats.push({
                        name: zone.name,
                        tempSensorId: zone.tempId,
                        humSensorId: zone.humId,
                        tempMin: 0,
                        tempMax: 0,
                        tempAvg: 0,
                        humMin: 0,
                        humMax: 0,
                        humAvg: 0,
                        vpdAvg: 0,
                        vpdStatus: 'Sin datos',
                        timeOutOfRange: 0,
                    });
                    continue;
                }
                const tempVals = tempData.map((d) => d.value);
                const humVals = humData.map((d) => d.value);
                const tempMin = Math.min(...tempVals);
                const tempMax = Math.max(...tempVals);
                const tempAvg = tempVals.reduce((a, b) => a + b, 0) / tempVals.length;
                const humMin = Math.min(...humVals);
                const humMax = Math.max(...humVals);
                const humAvg = humVals.reduce((a, b) => a + b, 0) / humVals.length;
                const minLen = Math.min(tempData.length, humData.length);
                let vpdSum = 0;
                let outOfRangeCount = 0;
                for (let i = 0; i < minLen; i++) {
                    const vpd = metrics_service_1.MetricsService.calculateVPD(tempData[i].value, humData[i].value);
                    vpdSum += vpd;
                    const isOutOfRange = vpd < VPD_LOW_THRESHOLD || vpd > VPD_HIGH_THRESHOLD;
                    if (isOutOfRange) {
                        outOfRangeCount++;
                        alerts.push({
                            timestamp: tempData[i].time,
                            zone: zone.name,
                            vpd,
                            status: this.getVpdStatus(vpd),
                        });
                    }
                }
                const vpdAvg = Math.round((vpdSum / minLen) * 100) / 100;
                const timeOutOfRange = outOfRangeCount * 2;
                zoneStats.push({
                    name: zone.name,
                    tempSensorId: zone.tempId,
                    humSensorId: zone.humId,
                    tempMin: Math.round(tempMin * 10) / 10,
                    tempMax: Math.round(tempMax * 10) / 10,
                    tempAvg: Math.round(tempAvg * 10) / 10,
                    humMin: Math.round(humMin * 10) / 10,
                    humMax: Math.round(humMax * 10) / 10,
                    humAvg: Math.round(humAvg * 10) / 10,
                    vpdAvg,
                    vpdStatus: this.getVpdStatus(vpdAvg),
                    timeOutOfRange,
                });
            }
            const recentAlerts = alerts
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, 50);
            return this.buildPdf(zoneStats, recentAlerts, lastMonday, lastSunday);
        }
        catch (error) {
            this.logger.error('Error generando reporte semanal', error);
            throw new common_1.InternalServerErrorException('Error generando reporte semanal');
        }
    }
    getVpdStatus(vpd) {
        if (vpd < VPD_LOW_THRESHOLD)
            return 'Baja Transpiración';
        if (vpd > VPD_HIGH_THRESHOLD)
            return 'Estrés Hídrico';
        return 'Óptimo';
    }
    getVpdColor(vpd) {
        if (vpd < VPD_LOW_THRESHOLD)
            return '#0d6efd';
        if (vpd > VPD_HIGH_THRESHOLD)
            return '#dc3545';
        return '#198754';
    }
    formatDate(d) {
        return d.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'America/Santiago',
        });
    }
    formatDateTime(d) {
        return d.toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Santiago',
        });
    }
    buildPdf(stats, alerts, from, to) {
        const fonts = {
            Roboto: {
                normal: 'Helvetica',
                bold: 'Helvetica-Bold',
                italics: 'Helvetica-Oblique',
                bolditalics: 'Helvetica-BoldOblique',
            },
        };
        const printer = new PdfPrinter(fonts);
        const statsHeader = [
            { text: 'Zona', style: 'tableHeader' },
            { text: 'T Min (°C)', style: 'tableHeader' },
            { text: 'T Max (°C)', style: 'tableHeader' },
            { text: 'T Prom (°C)', style: 'tableHeader' },
            { text: 'HR Min (%)', style: 'tableHeader' },
            { text: 'HR Max (%)', style: 'tableHeader' },
            { text: 'HR Prom (%)', style: 'tableHeader' },
            { text: 'VPD Prom (kPa)', style: 'tableHeader' },
            { text: 'Estado VPD', style: 'tableHeader' },
            { text: 'Tiempo Fuera\nRango (min)', style: 'tableHeader' },
        ];
        const statsRows = stats.map((z) => [
            { text: z.name, style: 'tableCell' },
            { text: String(z.tempMin), style: 'tableCell' },
            { text: String(z.tempMax), style: 'tableCell' },
            { text: String(z.tempAvg), style: 'tableCell' },
            { text: String(z.humMin), style: 'tableCell' },
            { text: String(z.humMax), style: 'tableCell' },
            { text: String(z.humAvg), style: 'tableCell' },
            {
                text: String(z.vpdAvg),
                style: 'tableCell',
                color: this.getVpdColor(z.vpdAvg),
                bold: true,
            },
            {
                text: z.vpdStatus,
                style: 'tableCell',
                color: this.getVpdColor(z.vpdAvg),
            },
            { text: String(z.timeOutOfRange), style: 'tableCell' },
        ]);
        const alertHeader = [
            { text: 'Fecha / Hora', style: 'tableHeader' },
            { text: 'Zona', style: 'tableHeader' },
            { text: 'VPD (kPa)', style: 'tableHeader' },
            { text: 'Clasificación', style: 'tableHeader' },
        ];
        const alertRows = alerts.length > 0
            ? alerts.map((a) => [
                { text: this.formatDateTime(a.timestamp), style: 'tableCell' },
                { text: a.zone, style: 'tableCell' },
                {
                    text: String(a.vpd),
                    style: 'tableCell',
                    color: this.getVpdColor(a.vpd),
                    bold: true,
                },
                {
                    text: a.status,
                    style: 'tableCell',
                    color: this.getVpdColor(a.vpd),
                },
            ])
            : [
                [
                    {
                        text: 'Sin alertas en el período. Todas las zonas operaron dentro del rango óptimo.',
                        colSpan: 4,
                        style: 'tableCell',
                        alignment: 'center',
                        color: '#198754',
                    },
                    {},
                    {},
                    {},
                ],
            ];
        const docDefinition = {
            pageSize: 'A4',
            pageOrientation: 'landscape',
            pageMargins: [30, 40, 30, 40],
            content: [
                {
                    columns: [
                        {
                            stack: [
                                { text: 'INFORME SEMANAL', style: 'title' },
                                { text: 'Viveros Tambo — Monitoreo de Cámaras', style: 'subtitle' },
                                {
                                    text: `Período: ${this.formatDate(from)}  →  ${this.formatDate(to)}`,
                                    style: 'dateRange',
                                },
                            ],
                        },
                        {
                            text: 'JTE Analytics',
                            style: 'brandName',
                            alignment: 'right',
                            margin: [0, 10, 0, 0],
                        },
                    ],
                    margin: [0, 0, 0, 20],
                },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 781, y2: 0, lineWidth: 2, lineColor: '#2e7d32' }], margin: [0, 0, 0, 16] },
                { text: 'Resumen por Zona', style: 'sectionTitle' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['10%', '9%', '9%', '9%', '9%', '9%', '9%', '10%', '12%', '14%'],
                        body: [statsHeader, ...statsRows],
                    },
                    layout: {
                        fillColor: (rowIndex) => rowIndex === 0 ? '#f1f8e9' : rowIndex % 2 === 0 ? '#fafafa' : null,
                        hLineColor: () => '#c8e6c9',
                        vLineColor: () => '#c8e6c9',
                    },
                    margin: [0, 0, 0, 20],
                },
                {
                    columns: [
                        {
                            stack: [
                                { text: 'Referencia VPD:', style: 'refTitle' },
                                { text: '🔵  < 0.8 kPa  →  Baja Transpiración', style: 'refBlue' },
                                { text: '🟢  0.8 – 1.2 kPa  →  Óptimo', style: 'refGreen' },
                                { text: '🔴  > 1.2 kPa  →  Estrés Hídrico', style: 'refRed' },
                            ],
                            margin: [0, 0, 0, 16],
                        },
                    ],
                },
                { text: 'Historial de Alertas VPD (últimas 50)', style: 'sectionTitle' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['30%', '20%', '20%', '30%'],
                        body: [alertHeader, ...alertRows],
                    },
                    layout: {
                        fillColor: (rowIndex) => rowIndex === 0 ? '#f1f8e9' : rowIndex % 2 === 0 ? '#fafafa' : null,
                        hLineColor: () => '#c8e6c9',
                        vLineColor: () => '#c8e6c9',
                    },
                },
            ],
            styles: {
                title: {
                    fontSize: 20,
                    bold: true,
                    color: '#1b5e20',
                },
                subtitle: {
                    fontSize: 11,
                    color: '#555',
                    margin: [0, 4, 0, 2],
                },
                dateRange: {
                    fontSize: 10,
                    color: '#777',
                    italics: true,
                },
                brandName: {
                    fontSize: 14,
                    bold: true,
                    color: '#2e7d32',
                },
                sectionTitle: {
                    fontSize: 12,
                    bold: true,
                    color: '#1b5e20',
                    margin: [0, 0, 0, 6],
                },
                tableHeader: {
                    bold: true,
                    fontSize: 8,
                    color: '#1b5e20',
                    fillColor: '#f1f8e9',
                },
                tableCell: {
                    fontSize: 8,
                    color: '#333',
                },
                refTitle: {
                    fontSize: 9,
                    bold: true,
                    color: '#333',
                    margin: [0, 0, 0, 3],
                },
                refBlue: { fontSize: 9, color: '#0d6efd' },
                refGreen: { fontSize: 9, color: '#198754' },
                refRed: { fontSize: 9, color: '#dc3545' },
            },
            footer: (currentPage, pageCount) => ({
                text: `Página ${currentPage} de ${pageCount}  |  Generado por JTE Analytics  |  ${new Date().toLocaleDateString('es-CL')}`,
                alignment: 'center',
                fontSize: 7,
                color: '#aaa',
                margin: [0, 10, 0, 0],
            }),
        };
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks = [];
        return new Promise((resolve, reject) => {
            pdfDoc.on('data', (chunk) => chunks.push(chunk));
            pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
            pdfDoc.on('error', reject);
            pdfDoc.end();
        });
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = ReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metric_entity_1.Metric)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ReportsService);
//# sourceMappingURL=reports.service.js.map