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
exports.Metric = void 0;
const typeorm_1 = require("typeorm");
let Metric = class Metric {
    mt_id;
    mt_name;
    mt_value;
    mt_time_2;
};
exports.Metric = Metric;
__decorate([
    (0, typeorm_1.Column)({ name: 'mt_id', primary: true }),
    __metadata("design:type", Number)
], Metric.prototype, "mt_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mt_name' }),
    __metadata("design:type", String)
], Metric.prototype, "mt_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mt_value', type: 'float' }),
    __metadata("design:type", Number)
], Metric.prototype, "mt_value", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mt_time_2' }),
    __metadata("design:type", Date)
], Metric.prototype, "mt_time_2", void 0);
exports.Metric = Metric = __decorate([
    (0, typeorm_1.Entity)({ name: 'montes' })
], Metric);
//# sourceMappingURL=metric.entity.js.map