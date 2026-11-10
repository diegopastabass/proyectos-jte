"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UMBRAL_CORRIENTE_A = exports.NOMBRE_DE = exports.SENSORES = exports.variablePozo = exports.VARIABLES_CORRIENTE = exports.VARIABLES_VOLTAJE = exports.EQUIPOS = exports.POZOS = void 0;
exports.POZOS = ['pozo_1', 'pozo_2'];
exports.EQUIPOS = [
    { id: 'pozo_1', nombre: 'Pozo 1', equipo: 'UNO_BALSAS' },
    { id: 'pozo_2', nombre: 'Pozo 2', equipo: 'DOS_BALSAS' },
    { id: 'estanque', nombre: 'Estanque', equipo: 'ESTANQUE_BALSAS' },
];
const FASES = ['L1N', 'L2N', 'L3N'];
const LINEAS = ['L1L2', 'L2L3', 'L3L1'];
const CORRIENTES = ['I1', 'I2', 'I3'];
exports.VARIABLES_VOLTAJE = { fase: FASES, linea: LINEAS };
exports.VARIABLES_CORRIENTE = CORRIENTES;
const prefijoPozo = (pozo) => `${exports.EQUIPOS.find((e) => e.id === pozo).equipo}--slave.`;
const variablePozo = (pozo, variable) => `${pozo}_${variable}`;
exports.variablePozo = variablePozo;
const electricas = Object.fromEntries(exports.POZOS.flatMap((pozo) => [...FASES, ...LINEAS, ...CORRIENTES].map((variable) => [
    (0, exports.variablePozo)(pozo, variable),
    { mtName: `${prefijoPozo(pozo)}${variable}`, divisor: 100 },
])));
exports.SENSORES = {
    ...electricas,
    pozo_1_caudal: { mtName: 'UNO_BALSAS--slave.caudal', divisor: 10 },
    pozo_2_bomba: { mtName: 'DOS_BALSAS--slave.bomba', divisor: 1 },
    pozo_2_automatico: { mtName: 'DOS_BALSAS--slave.automatico', divisor: 1 },
    pozo_2_manual: { mtName: 'DOS_BALSAS--slave.manual', divisor: 1 },
    caudal: { mtName: 'DOS_BALSAS--slave.caudal', divisor: 10 },
    presion: { mtName: 'DOS_BALSAS--slave.presion', divisor: 10 },
    totalizador: { mtName: 'DOS_BALSAS--slave.totalizador', divisor: 10 },
    estanque: { mtName: 'ESTANQUE_BALSAS--slave.estanque', divisor: 100 },
    solar: { mtName: 'ESTANQUE_BALSAS--slave.solar_estanque', divisor: 1000 },
    caudal_descarga: {
        mtName: 'ESTANQUE_BALSAS--slave.caudal_estanque',
        divisor: 10,
    },
    totalizador_descarga: {
        mtName: 'ESTANQUE_BALSAS--slave.totalizador_descarga',
        divisor: 10,
    },
};
exports.NOMBRE_DE = Object.fromEntries(Object.entries(exports.SENSORES).map(([nombre, s]) => [s.mtName, nombre]));
exports.UMBRAL_CORRIENTE_A = 1;
//# sourceMappingURL=sensores.config.js.map