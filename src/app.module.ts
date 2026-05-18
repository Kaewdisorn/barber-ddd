import { CustomerModule } from '@customerModule/customer.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CustomerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
