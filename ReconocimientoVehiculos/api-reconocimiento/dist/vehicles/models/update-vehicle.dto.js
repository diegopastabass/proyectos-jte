"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateVehiculoDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_vehicle_dto_js_1 = require("./create-vehicle.dto.js");
class UpdateVehiculoDto extends (0, mapped_types_1.PartialType)(create_vehicle_dto_js_1.CreateVehiculoDto) {
}
exports.UpdateVehiculoDto = UpdateVehiculoDto;
//# sourceMappingURL=update-vehicle.dto.js.map