import { Inject, Injectable } from '@nestjs/common';
import {
  RegisterCustomerCommand,
  RegisterCustomerResult,
} from '@customerModule/application/use-cases/commands/register-customer.command';
import {
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
} from '@customerModule/application/ports/customer-repository.port';

@Injectable()
export class RegisterCustomerHandler {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(
    command: RegisterCustomerCommand,
  ): Promise<RegisterCustomerResult> {
    const emailTaken = await this.customerRepository.existsByEmail(
      command.email,
    );

    console.log('Registering customer with data:', command);
    return {} as RegisterCustomerResult;
  }
}
