"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const sessions_service_1 = require("./sessions.service");
const multer_1 = require("multer");
const pdfmake_1 = __importDefault(require("pdfmake"));
const path = __importStar(require("path"));
let SessionsController = class SessionsController {
    sessionsService;
    constructor(sessionsService) {
        this.sessionsService = sessionsService;
    }
    async create(files, dataString) {
        if (!dataString)
            throw new common_1.BadRequestException('Faltan datos de la sesión');
        const sessionData = JSON.parse(dataString);
        return this.sessionsService.createFullSession(sessionData, files);
    }
    async downloadReport(id, res) {
        const reportData = await this.sessionsService.getReportData(id);
        const fonts = {
            Roboto: {
                normal: path.join(__dirname, '../../assets/fonts/Roboto-Regular.ttf'),
                bold: path.join(__dirname, '../../assets/fonts/Roboto-Medium.ttf'),
                italics: path.join(__dirname, '../../assets/fonts/Roboto-Italic.ttf'),
                bolditalics: path.join(__dirname, '../../assets/fonts/Roboto-MediumItalic.ttf'),
            },
        };
        const printer = new pdfmake_1.default({
            Roboto: {
                normal: 'Helvetica',
                bold: 'Helvetica-Bold',
                italics: 'Helvetica-Oblique',
                bolditalics: 'Helvetica-BoldOblique',
            },
        });
        const docDefinition = {
            content: [
                { text: 'Informe de Medición - Ranguil', style: 'header' },
                {
                    columns: [
                        {
                            width: '*',
                            text: `Técnico: ${reportData.header.technicianName}`,
                            style: 'subheader',
                        },
                        {
                            width: '*',
                            text: `Fecha: ${new Date(reportData.header.date).toLocaleDateString()}`,
                            style: 'subheader',
                            alignment: 'right',
                        },
                    ],
                },
                { text: '\n\n' },
                {
                    table: {
                        headerRows: 1,
                        widths: ['*', 'auto', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'Ítem', style: 'tableHeader' },
                                { text: 'Valor', style: 'tableHeader' },
                                { text: 'Ubicación', style: 'tableHeader' },
                                { text: 'Evidencia', style: 'tableHeader' },
                            ],
                            ...reportData.items.map((item) => {
                                return [
                                    item.label,
                                    `${item.value} ${item.unit || ''}`,
                                    item.location || '-',
                                    item.image
                                        ? {
                                            text: 'Ver Foto',
                                            link: `https://app.jteanalytics.cl/ranguil-mediciones/uploads/${item.image}`,
                                            color: 'blue',
                                            decoration: 'underline',
                                        }
                                        : 'Sin foto',
                                ];
                            }),
                        ],
                    },
                },
            ],
            styles: {
                header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
                subheader: { fontSize: 12, bold: true, margin: [0, 10, 0, 5] },
                tableHeader: { bold: true, fontSize: 13, color: 'black' },
            },
        };
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=reporte_${id}.pdf`);
        pdfDoc.pipe(res);
        pdfDoc.end();
    }
    findAll() {
        return this.sessionsService.findAll();
    }
    findOne(id) {
        return this.sessionsService.findOne(id);
    }
    remove(id) {
        return this.sessionsService.remove(id);
    }
};
exports.SessionsController = SessionsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 10, {
        storage: (0, multer_1.diskStorage)({
            destination: './uploads',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
            },
        }),
    })),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)('data')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, String]),
    __metadata("design:returntype", Promise)
], SessionsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('report/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SessionsController.prototype, "downloadReport", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "remove", null);
exports.SessionsController = SessionsController = __decorate([
    (0, common_1.Controller)('sessions/app/'),
    __metadata("design:paramtypes", [sessions_service_1.SessionsService])
], SessionsController);
//# sourceMappingURL=sessions.controller.js.map