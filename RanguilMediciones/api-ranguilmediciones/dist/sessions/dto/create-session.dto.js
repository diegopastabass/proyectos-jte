"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSessionDto = exports.CreateMeasurementDto = void 0;
class CreateMeasurementDto {
    name;
    value;
    time;
    location;
}
exports.CreateMeasurementDto = CreateMeasurementDto;
class CreateSessionDto {
    userId;
    measurements;
    reportMetadata;
}
exports.CreateSessionDto = CreateSessionDto;
//# sourceMappingURL=create-session.dto.js.map