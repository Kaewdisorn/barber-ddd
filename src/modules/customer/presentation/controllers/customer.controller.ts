import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RegisterCustomerResult } from '@customerModule/application/use-cases/commands/register-customer.command';
import { RegisterCustomerRequestDto } from '@customerModule/presentation/dtos/register-customer-request.dto';

@Controller('customers')
export class CustomerController {
  constructor() {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterCustomerRequestDto,
  ): Promise<RegisterCustomerResult> {
    return {} as RegisterCustomerResult;
  }
}
