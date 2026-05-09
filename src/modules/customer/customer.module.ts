import { Module } from '@nestjs/common';
import { CustomerController } from '@customerModule/presentation/controllers/customer.controller';
import { RegisterCustomerHandler } from '@customerModule/application/use-cases/handlers/register-customer.handler';

@Module({
  imports: [],
  controllers: [CustomerController],
  providers: [RegisterCustomerHandler],
})
export class CustomerModule {}
