import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';

@Injectable()
export class EnvManagerService {
  private readonly envPath = 'C:\\AutomatizationServices\\Viveros\\env.txt';
  private readonly allowedKeys = [
    'MONITOR_INTERVAL',
    'TEMP_MONITOREO',
    'HUM_MONITOREO',
    'TEMP_AMB',
  ];

  readEnv(): Record<string, string> {
    try {
      const content = fs.readFileSync(this.envPath, 'utf-8');
      const lines = content.split('\n');
      const env: Record<string, string> = {};

      for (const line of lines) {
        const [key, ...rest] = line.split('=');
        const value = rest.join('=').trim();
        if (this.allowedKeys.includes(key)) {
          env[key] = value;
        }
      }

      return env;
    } catch (error) {
      throw new InternalServerErrorException('Unable to read .env file');
    }
  }

  updateEnv(
    updates: Partial<
      Record<
        'MONITOR_INTERVAL' | 'TEMP_MONITOREO' | 'HUM_MONITOREO' | 'TEMP_AMB',
        string
      >
    >,
  ): void {
    try {
      const current = this.readEnv();
      const newValues = { ...current, ...updates };

      let content = fs.readFileSync(this.envPath, 'utf-8');
      for (const key of this.allowedKeys) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
          content = content.replace(regex, `${key}=${newValues[key]}`);
        } else {
          content += `\n${key}=${newValues[key]}`;
        }
      }

      fs.writeFileSync(this.envPath, content, 'utf-8');
    } catch (error) {
      throw new InternalServerErrorException('Failed to update .env file');
    }
  }
}
