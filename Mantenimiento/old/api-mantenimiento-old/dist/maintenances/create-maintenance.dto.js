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
exports.CreateMaintenanceDto = void 0;
const class_validator_1 = require("class-validator");
class CreateMaintenanceDto {
    client_id;
    maintainer_id;
    maintenance_type;
    scheduled_date;
    admin_id;
}
exports.CreateMaintenanceDto = CreateMaintenanceDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Client ID is required' }),
    (0, class_validator_1.IsNumber)({}, { message: 'Client ID must be a number' }),
    __metadata("design:type", Number)
], CreateMaintenanceDto.prototype, "client_id", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Maintainer ID is required' }),
    (0, class_validator_1.IsNumber)({}, { message: 'Maintainer ID must be a number' }),
    __metadata("design:type", Number)
], CreateMaintenanceDto.prototype, "maintainer_id", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Maintenance type is required' }),
    (0, class_validator_1.IsString)({ message: 'Maintenance type must be a string' }),
    __metadata("design:type", String)
], CreateMaintenanceDto.prototype, "maintenance_type", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'Scheduled date is required' }),
    __metadata("design:type", Date)
], CreateMaintenanceDto.prototype, "scheduled_date", void 0);
__decorate([
    (0, class_validator_1.IsInt)({ message: 'Admin id must be a int number' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'Admin id is required' }),
    __metadata("design:type", Number)
], CreateMaintenanceDto.prototype, "admin_id", void 0);
//# sourceMappingURL=create-maintenance.dto.js.map