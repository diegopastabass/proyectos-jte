export declare const POZOS: readonly ["pozo_1", "pozo_2"];
export type Pozo = (typeof POZOS)[number];
export declare const EQUIPOS: readonly [{
    readonly id: "pozo_1";
    readonly nombre: "Pozo 1";
    readonly equipo: "UNO_BALSAS";
}, {
    readonly id: "pozo_2";
    readonly nombre: "Pozo 2";
    readonly equipo: "DOS_BALSAS";
}, {
    readonly id: "estanque";
    readonly nombre: "Estanque";
    readonly equipo: "ESTANQUE_BALSAS";
}];
export interface Sensor {
    mtName: string;
    divisor: number;
}
export declare const VARIABLES_VOLTAJE: {
    readonly fase: readonly ["L1N", "L2N", "L3N"];
    readonly linea: readonly ["L1L2", "L2L3", "L3L1"];
};
export declare const VARIABLES_CORRIENTE: readonly ["I1", "I2", "I3"];
export declare const variablePozo: (pozo: Pozo, variable: string) => string;
export declare const SENSORES: Record<string, Sensor>;
export declare const NOMBRE_DE: Record<string, string>;
export declare const UMBRAL_CORRIENTE_A = 1;
