import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PetService } from './src/modules/pet/pet.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const petService = app.get(PetService);
  try {
    const user = { userId: 'admin', role: 'ADMIN' as any, permissions: ['branch.access.all'], branchId: null, authorizedBranchIds: [] };
    const res = await petService.findOne('PET000031', user);
    console.log('SUCCESS:', res);
  } catch(e) {
    console.error('ERROR:', e);
  }
  await app.close();
}
bootstrap();
