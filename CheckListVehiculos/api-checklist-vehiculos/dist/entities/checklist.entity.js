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
exports.Checklist = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
const vehicle_entity_1 = require("./vehicle.entity");
const checklist_image_entity_1 = require("./checklist-image.entity");
let Checklist = class Checklist {
};
exports.Checklist = Checklist;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint' }),
    __metadata("design:type", String)
], Checklist.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Checklist.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Checklist.prototype, "vehicle_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], Checklist.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => vehicle_entity_1.Vehicle),
    (0, typeorm_1.JoinColumn)({ name: 'vehicle_id' }),
    __metadata("design:type", vehicle_entity_1.Vehicle)
], Checklist.prototype, "vehicle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], Checklist.prototype, "kilometraje_actual", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], Checklist.prototype, "visual_checks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], Checklist.prototype, "mechanical_checks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Checklist.prototype, "observaciones_generales", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Checklist.prototype, "has_issues", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => checklist_image_entity_1.ChecklistImage, image => image.checklist, { cascade: true }),
    __metadata("design:type", Array)
], Checklist.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Checklist.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Checklist.prototype, "updated_at", void 0);
exports.Checklist = Checklist = __decorate([
    (0, typeorm_1.Entity)('checklists')
], Checklist);
//# sourceMappingURL=checklist.entity.js.map