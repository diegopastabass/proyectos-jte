"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const express = require("express");
const path_1 = require("path");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ limit: '10mb', extended: true }));
    app.useGlobalPipes(new common_1.ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.use('/uploads', express.static((0, path_1.join)(process.cwd(), 'uploads')));
    const port = process.env.PORT || 3037;
    await app.listen(port);
    console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
//# sourceMappingURL=main.js.map