// main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as compression from 'compression';
import { join } from 'path';



// --- VERCEL HANDLER & CACHING LOGIC ---

// Cache the initialized NestJS application instance
let cachedApp: NestExpressApplication;

async function bootstrap(): Promise<NestExpressApplication> {
    if (!cachedApp) {
        // 1. Create the NestJS application
        const app = await NestFactory.create<NestExpressApplication>(AppModule, {
            logger: ['error', 'warn'], // Optimize logging for production
        });
        app.enableCors({
            origin: true, // ✅ সব domain allow
            credentials: false, // optional: cookie/credential নেই
        });



        // 3. Initialize the app to finalize middleware and routing
        await app.init();
        app.use(compression());
        app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
        app.useWebSocketAdapter(new IoAdapter(app));
        cachedApp = app;
    }
    return cachedApp;
}

// --- LOCAL SERVER START (For Development) ---

// Start server locally if not on Vercel
if (!process.env.VERCEL) {
    async function startLocalServer() {
        // Re-use the bootstrap logic for consistency, but start listening
        const app = await bootstrap();
        const port = process.env.PORT || 5001;
        await app.listen(port, '0.0.0.0');
        console.log(`🚀 Server is running on port: ${port}`);
    }
    // qwiufh9uhf9
    startLocalServer();
}

// --- VERCEL ENTRY POINT ---

// Vercel handler function
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Get the cached application instance
    const app = await bootstrap();

    // Extract the native Express handler and execute the request
    app.getHttpAdapter().getInstance()(req, res);
}