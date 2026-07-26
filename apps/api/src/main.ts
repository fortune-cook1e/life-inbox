import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { loadEnvironment } from "./config/environment.js";

async function bootstrap() {
  loadEnvironment();

  const app = await NestFactory.create(AppModule);
  const port = process.env.API_PORT ?? 3001;

  app.enableShutdownHooks();
  await app.listen(port);
}

void bootstrap();
