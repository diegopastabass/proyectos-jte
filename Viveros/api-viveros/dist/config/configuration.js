"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('app', () => ({
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3005', 10),
}));
//# sourceMappingURL=configuration.js.map