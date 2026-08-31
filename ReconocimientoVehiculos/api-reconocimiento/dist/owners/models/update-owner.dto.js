"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePersonaDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_owner_dto_js_1 = require("./create-owner.dto.js");
class UpdatePersonaDto extends (0, mapped_types_1.PartialType)(create_owner_dto_js_1.CreatePersonaDto) {
}
exports.UpdatePersonaDto = UpdatePersonaDto;
//# sourceMappingURL=update-owner.dto.js.map