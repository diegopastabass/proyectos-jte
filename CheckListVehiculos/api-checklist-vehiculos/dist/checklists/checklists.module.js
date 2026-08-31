"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChecklistsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const checklists_service_1 = require("./checklists.service");
const checklists_controller_1 = require("./checklists.controller");
const checklist_entity_1 = require("../entities/checklist.entity");
const checklist_image_entity_1 = require("../entities/checklist-image.entity");
const vehicle_entity_1 = require("../entities/vehicle.entity");
let ChecklistsModule = class ChecklistsModule {
};
exports.ChecklistsModule = ChecklistsModule;
exports.ChecklistsModule = ChecklistsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([checklist_entity_1.Checklist, checklist_image_entity_1.ChecklistImage, vehicle_entity_1.Vehicle])],
        controllers: [checklists_controller_1.ChecklistsController],
        providers: [checklists_service_1.ChecklistsService],
        exports: [checklists_service_1.ChecklistsService],
    })
], ChecklistsModule);
//# sourceMappingURL=checklists.module.js.map