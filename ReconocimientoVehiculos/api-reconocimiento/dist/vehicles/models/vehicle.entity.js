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
exports.Vehiculo = void 0;
const typeorm_1 = require("typeorm");
const owner_entity_js_1 = require("../../owners/models/owner.entity.js");
let Vehiculo = class Vehiculo {
    id;
    patente;
    personaId;
    persona;
};
exports.Vehiculo = Vehiculo;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Vehiculo.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true, length: 10 }),
    __metadata("design:type", String)
], Vehiculo.prototype, "patente", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'persona_id' }),
    __metadata("design:type", Number)
], Vehiculo.prototype, "personaId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => owner_entity_js_1.Persona, (persona) => persona.vehiculos, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'persona_id' }),
    __metadata("design:type", owner_entity_js_1.Persona)
], Vehiculo.prototype, "persona", void 0);
exports.Vehiculo = Vehiculo = __decorate([
    (0, typeorm_1.Entity)('vehiculo')
], Vehiculo);
//# sourceMappingURL=vehicle.entity.js.map