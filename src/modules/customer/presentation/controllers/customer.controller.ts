import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RegisterCustomerRequestDto } from '../dtos/register-customer-request.dto';

@Controller('customers')
export class CustomerController {
  constructor() {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterCustomerRequestDto) {}
}
