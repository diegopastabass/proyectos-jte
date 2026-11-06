export declare const PREFIX_POZO = "SSR_CUEVAS--slave.";
export declare const SENSOR_ALIASES: Record<string, string>;
export declare const SENSOR_NAMES: {
    readonly estanque: "SSR_CUEVAS--slave.estanque";
    readonly nivel_2: "ESTANQUE_20M3--slave.AI12";
    readonly voltaje_2: "ESTANQUE_20M3--slave.AI32";
    readonly caudal: "SSR_CUEVAS--slave.caudal";
    readonly freatico: "SSR_CUEVAS--slave.freatico";
    readonly totalizador: "SSR_CUEVAS--slave.totalizador";
    readonly horometro: "SSR_CUEVAS--slave.horometro";
    readonly kwh: "SSR_CUEVAS--slave.kwh";
};
export declare const pozoSensor: (variable: string) => string;
export declare const cleanSensorName: (mtName: string) => string;
