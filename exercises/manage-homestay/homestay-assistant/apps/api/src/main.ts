import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupSwagger(app);
  const port = Number(process.env.PORT ?? 10000);

  await app.listen(port, "0.0.0.0");
  console.log(`API listening on ${port}`);
}
bootstrap();
