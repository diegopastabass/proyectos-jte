"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvManagerService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
let EnvManagerService = class EnvManagerService {
    constructor() {
        this.envPath = 'C:\\AutomatizationServices\\Viveros\\env.txt';
        this.allowedKeys = [
            'MONITOR_INTERVAL',
            'TEMP_MONITOREO',
            'HUM_MONITOREO',
            'TEMP_AMB',
        ];
    }
    readEnv() {
        try {
            const content = fs.readFileSync(this.envPath, 'utf-8');
            const lines = content.split('\n');
            const env = {};
            for (const line of lines) {
                const [key, ...rest] = line.split('=');
                const value = rest.join('=').trim();
                if (this.allowedKeys.includes(key)) {
                    env[key] = value;
                }
            }
            return env;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException('Unable to read .env file');
        }
    }
    updateEnv(updates) {
        try {
            const current = this.readEnv();
            const newValues = { ...current, ...updates };
            let content = fs.readFileSync(this.envPath, 'utf-8');
            for (const key of this.allowedKeys) {
                const regex = new RegExp(`^${key}=.*$`, 'm');
                if (regex.test(content)) {
                    content = content.replace(regex, `${key}=${newValues[key]}`);
                }
                else {
                    content += `\n${key}=${newValues[key]}`;
                }
            }
            fs.writeFileSync(this.envPath, content, 'utf-8');
        }
        catch (error) {
            throw new common_1.InternalServerErrorException('Failed to update .env file');
        }
    }
};
exports.EnvManagerService = EnvManagerService;
exports.EnvManagerService = EnvManagerService = __decorate([
    (0, common_1.Injectable)()
], EnvManagerService);
//# sourceMappingURL=env-manager.service.js.map