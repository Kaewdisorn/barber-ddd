import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  RegisterCustomerResult,
  RegisterCustomerCommand,
} from '@customerModule/application/use-cases/commands/register-customer.command';
import { RegisterCustomerRequestDto } from '@customerModule/presentation/dtos/register-customer-request.dto';
import { RegisterCustomerHandler } from '@customerModule/application/use-cases/handlers/register-customer.handler';

@Controller('customers')
export class CustomerController {
  constructor(private readonly registerCustomer: RegisterCustomerHandler) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterCustomerRequestDto,
  ): Promise<RegisterCustomerResult> {
    const registerCmd: RegisterCustomerCommand = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
    };

    return this.registerCustomer.execute(registerCmd);
  }
}
