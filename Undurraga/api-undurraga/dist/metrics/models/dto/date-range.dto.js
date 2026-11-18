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
exports.MesesDto = exports.LegacyDateRangeDto = exports.DateRangeDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;
class DateRangeDto {
}
exports.DateRangeDto = DateRangeDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(FORMATO_DIA, { message: 'start debe tener formato AAAA-MM-DD' }),
    (0, class_validator_1.IsDateString)({ strict: true }, { message: 'start no es una fecha válida' }),
    __metadata("design:type", String)
], DateRangeDto.prototype, "start", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(FORMATO_DIA, { message: 'end debe tener formato AAAA-MM-DD' }),
    (0, class_validator_1.IsDateString)({ strict: true }, { message: 'end no es una fecha válida' }),
    __metadata("design:type", String)
], DateRangeDto.prototype, "end", void 0);
class LegacyDateRangeDto {
}
exports.LegacyDateRangeDto = LegacyDateRangeDto;
__decorate([
    (0, class_validator_1.Matches)(FORMATO_DIA, { message: 'startDate debe tener formato AAAA-MM-DD' }),
    (0, class_validator_1.IsDateString)({ strict: true }, { message: 'startDate no es una fecha válida' }),
    __metadata("design:type", String)
], LegacyDateRangeDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.Matches)(FORMATO_DIA, { message: 'endDate debe tener formato AAAA-MM-DD' }),
    (0, class_validator_1.IsDateString)({ strict: true }, { message: 'endDate no es una fecha válida' }),
    __metadata("design:type", String)
], LegacyDateRangeDto.prototype, "endDate", void 0);
class MesesDto {
}
exports.MesesDto = MesesDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(36),
    __metadata("design:type", Number)
], MesesDto.prototype, "meses", void 0);
//# sourceMappingURL=date-range.dto.js.map