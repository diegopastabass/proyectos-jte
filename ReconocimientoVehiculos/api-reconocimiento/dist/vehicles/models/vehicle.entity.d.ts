import { Persona } from '../../owners/models/owner.entity.js';
export declare class Vehiculo {
    id: number;
    patente: string;
    personaId: number;
    persona: Persona;
}
