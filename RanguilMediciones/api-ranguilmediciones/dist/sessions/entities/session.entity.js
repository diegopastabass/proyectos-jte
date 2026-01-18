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
exports.Session = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../users/entities/user.entity");
const measurement_entity_1 = require("./measurement.entity");
let Session = class Session {
    id;
    user;
    measures_number;
    report_json;
    createdAt;
    measurements;
};
exports.Session = Session;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint' }),
    __metadata("design:type", String)
], Session.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], Session.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'measures_number', type: 'int' }),
    __metadata("design:type", Number)
], Session.prototype, "measures_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_json', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Session.prototype, "report_json", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Session.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => measurement_entity_1.Measurement, (measurement) => measurement.session, {
        cascade: true,
    }),
    __metadata("design:type", Array)
], Session.prototype, "measurements", void 0);
exports.Session = Session = __decorate([
    (0, typeorm_1.Entity)('sesion')
], Session);
//# sourceMappingURL=session.entity.js.map