import { Module } from '@nestjs/common';
import { CustomerController } from '@customerModule/presentation/controllers/customer.controller';
import { RegisterCustomerHandler } from '@customerModule/application/use-cases/handlers/register-customer.handler';
import { PrismaCustomerRepository } from '@customerModule/infrastructure/persistence/prisma-customer.repository';
import { CUSTOMER_REPOSITORY } from '@customerModule/application/ports/customer-repository.port';

@Module({
  imports: [],
  controllers: [CustomerController],
  providers: [
    RegisterCustomerHandler,
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
  ],
})
export class CustomerModule {}
