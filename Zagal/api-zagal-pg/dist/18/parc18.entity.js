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
exports.Parc18Zagal = void 0;
const typeorm_1 = require("typeorm");
let Parc18Zagal = class Parc18Zagal {
    mt_id;
    mt_name;
    mt_value;
    mt_time;
    mt_quality;
    mt_time_2;
};
exports.Parc18Zagal = Parc18Zagal;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: 'mt_id' }),
    __metadata("design:type", Number)
], Parc18Zagal.prototype, "mt_id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Parc18Zagal.prototype, "mt_name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Parc18Zagal.prototype, "mt_value", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mt_time', type: 'date', nullable: true }),
    __metadata("design:type", String)
], Parc18Zagal.prototype, "mt_time", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Parc18Zagal.prototype, "mt_quality", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mt_time_2', type: 'timestamp' }),
    __metadata("design:type", Date)
], Parc18Zagal.prototype, "mt_time_2", void 0);
exports.Parc18Zagal = Parc18Zagal = __decorate([
    (0, typeorm_1.Entity)('parc_18_zagal')
], Parc18Zagal);
//# sourceMappingURL=parc18.entity.js.map