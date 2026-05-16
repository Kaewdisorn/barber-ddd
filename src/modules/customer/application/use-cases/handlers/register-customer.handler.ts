import { Inject, Injectable } from '@nestjs/common';
import {
  RegisterCustomerCommand,
  RegisterCustomerResult,
} from '@customerModule/application/use-cases/commands/register-customer.command';
import {
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
} from '@customerModule/application/ports/customer-repository.port';
// import { EmailAlreadyTakenException } from '@customerModule/domain/exceptions/customer.exceptions';
// import {
//   IPasswordHasher,
//   PASSWORD_HASHER,
// } from '@customerModule/application/ports/password-hasher.port';

@Injectable()
export class RegisterCustomerHandler {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}
  // {
  //   @Inject(CUSTOMER_REPOSITORY)
  //   private readonly customerRepository: ICustomerRepository,
  //   // @Inject(PASSWORD_HASHER)
  //   // private readonly passwordHasher: IPasswordHasher,
  // }

  async execute(
    command: RegisterCustomerCommand,
  ): Promise<RegisterCustomerResult> {
    console.log('Executing RegisterCustomerHandler with command:', command);
    const emailTaken = await this.customerRepository.existsByEmail(
      command.email,
    );

    console.log('Email already taken:', emailTaken);

    // if (emailTaken) {
    //   throw new EmailAlreadyTakenException(command.email);
    // }

    // const passwordHash = await this.passwordHasher.hash(command.password);

    return {} as RegisterCustomerResult;
  }
}
