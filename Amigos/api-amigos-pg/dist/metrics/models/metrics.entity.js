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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Telemetria = void 0;
const typeorm_1 = require("typeorm");
let Telemetria = class Telemetria {
    mt_name;
    mt_value;
    mt_time_2;
    mt_time;
    mt_quality;
};
exports.Telemetria = Telemetria;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], Telemetria.prototype, "mt_name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Telemetria.prototype, "mt_value", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)('timestamp'),
    __metadata("design:type", Date)
], Telemetria.prototype, "mt_time_2", void 0);
__decorate([
    (0, typeorm_1.Column)({ select: false, nullable: true }),
    __metadata("design:type", Date)
], Telemetria.prototype, "mt_time", void 0);
__decorate([
    (0, typeorm_1.Column)({ select: false, nullable: true }),
    __metadata("design:type", String)
], Telemetria.prototype, "mt_quality", void 0);
exports.Telemetria = Telemetria = __decorate([
    (0, typeorm_1.Entity)('ssr_amigos')
], Telemetria);
//# sourceMappingURL=metrics.entity.js.map