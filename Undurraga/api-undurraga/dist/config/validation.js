"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationSchema = void 0;
const Joi = require("joi");
exports.validationSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test', 'staging')
        .default('development'),
    PORT: Joi.number().default(3002),
    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().default(5432),
    DB_USER: Joi.string().required(),
    DB_PASS: Joi.string().allow('').required(),
    DB_NAME: Joi.string().required(),
    TOTALIZADOR_MAX_M3H: Joi.number().positive().default(500),
    INTERVALO_MAX_MINUTOS: Joi.number().positive().default(15),
});
//# sourceMappingURL=validation.js.map