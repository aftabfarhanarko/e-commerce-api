"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const compression = require("compression");
const path_1 = require("path");
let cachedApp;
async function bootstrap() {
    if (!cachedApp) {
        const app = await core_1.NestFactory.create(app_module_1.AppModule, {
            logger: ['error', 'warn'],
        });
        app.enableCors({
            origin: true,
            credentials: false,
        });
        await app.init();
        app.use(compression());
        app.useStaticAssets((0, path_1.join)(process.cwd(), 'uploads'), { prefix: '/uploads/' });
        app.useWebSocketAdapter(new platform_socket_io_1.IoAdapter(app));
        cachedApp = app;
    }
    return cachedApp;
}
if (!process.env.VERCEL) {
    async function startLocalServer() {
        const app = await bootstrap();
        const port = process.env.PORT || 5001;
        await app.listen(port, '0.0.0.0');
        console.log(`🚀 Server is running on port: ${port}`);
    }
    startLocalServer();
}
async function handler(req, res) {
    const app = await bootstrap();
    app.getHttpAdapter().getInstance()(req, res);
}
//# sourceMappingURL=main.js.map