import {
  RegisterCustomerCommand,
  RegisterCustomerResult,
} from '@customerModule/application/use-cases/commands/register-customer.command';

export class RegisterCustomerHandler {
  constructor() {}

  async execute(
    command: RegisterCustomerCommand,
  ): Promise<RegisterCustomerResult> {
    console.log('Registering customer with data:', command);
    return {} as RegisterCustomerResult;
  }
}
