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
exports.ChecklistImage = void 0;
const typeorm_1 = require("typeorm");
const checklist_entity_1 = require("./checklist.entity");
let ChecklistImage = class ChecklistImage {
};
exports.ChecklistImage = ChecklistImage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint' }),
    __metadata("design:type", String)
], ChecklistImage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint' }),
    __metadata("design:type", String)
], ChecklistImage.prototype, "checklist_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => checklist_entity_1.Checklist, checklist => checklist.images, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'checklist_id' }),
    __metadata("design:type", checklist_entity_1.Checklist)
], ChecklistImage.prototype, "checklist", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 512 }),
    __metadata("design:type", String)
], ChecklistImage.prototype, "image_path", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ChecklistImage.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], ChecklistImage.prototype, "check_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], ChecklistImage.prototype, "check_item", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ChecklistImage.prototype, "created_at", void 0);
exports.ChecklistImage = ChecklistImage = __decorate([
    (0, typeorm_1.Entity)('checklist_images')
], ChecklistImage);
//# sourceMappingURL=checklist-image.entity.js.map