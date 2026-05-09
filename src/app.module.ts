import { CustomerModule } from '@customerModule/customer.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), CustomerModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
