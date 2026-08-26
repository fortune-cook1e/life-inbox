import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { getApiPort, loadEnvironment } from "./config/environment";

async function bootstrap() {
  loadEnvironment();

  const port = getApiPort();

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  await app.listen(port);
}

void bootstrap();
