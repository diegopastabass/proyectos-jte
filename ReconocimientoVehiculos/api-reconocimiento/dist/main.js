"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_js_1 = require("./app.module.js");
const common_1 = require("@nestjs/common");
const http_exception_filter_js_1 = require("./filters/http-exception.filter.js");
const express_1 = require("express");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_js_1.AppModule, {
        logger: ['log', 'error', 'warn'],
        bodyParser: false,
    });
    app.useGlobalFilters(new http_exception_filter_js_1.HttpExceptionFilter());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.use((0, express_1.json)({ limit: '10mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '10mb' }));
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Accept, Authorization',
        credentials: true,
    });
    const port = process.env.PORT || 3000;
    await app.listen(port);
    common_1.Logger.log(`Server running on http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map