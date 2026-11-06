"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanSensorName = exports.pozoSensor = exports.SENSOR_NAMES = exports.SENSOR_ALIASES = exports.PREFIX_POZO = void 0;
const PREFIX_REGEX = /^.*?--slave\./;
exports.PREFIX_POZO = 'SSR_CUEVAS--slave.';
exports.SENSOR_ALIASES = {
    'ESTANQUE_20M3--slave.AI12': 'nivel_2',
    'ESTANQUE_20M3--slave.AI32': 'voltaje_2',
};
exports.SENSOR_NAMES = {
    estanque: `${exports.PREFIX_POZO}estanque`,
    nivel_2: 'ESTANQUE_20M3--slave.AI12',
    voltaje_2: 'ESTANQUE_20M3--slave.AI32',
    caudal: `${exports.PREFIX_POZO}caudal`,
    freatico: `${exports.PREFIX_POZO}freatico`,
    totalizador: `${exports.PREFIX_POZO}totalizador`,
    horometro: `${exports.PREFIX_POZO}horometro`,
    kwh: `${exports.PREFIX_POZO}kwh`,
};
const pozoSensor = (variable) => `${exports.PREFIX_POZO}${variable}`;
exports.pozoSensor = pozoSensor;
const cleanSensorName = (mtName) => exports.SENSOR_ALIASES[mtName] ?? mtName.replace(PREFIX_REGEX, '');
exports.cleanSensorName = cleanSensorName;
//# sourceMappingURL=sensors.js.map