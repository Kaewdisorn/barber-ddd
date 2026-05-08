# Task 1 — Customer Register & Login

> Bounded context: **Customer**  
> Endpoints: `POST /customers/register`, `POST /customers/login`  
> Architecture: Domain → Application → Infrastructure (inward dependencies only)

---

## Files Overview

```
prisma/
  schema.prisma                                               ← NEW

src/
  shared/
    domain/
      aggregate-root.ts                                       ← NEW
      domain-event.ts                                         ← NEW
      domain-exception.ts                                     ← NEW
    infrastructure/
      prisma/
        prisma.service.ts                                     ← NEW
        prisma.module.ts                                      ← NEW
      filters/
        domain-exception.filter.ts                            ← NEW
      interceptors/
        logging.interceptor.ts                                ← NEW
    shared.module.ts                                          ← NEW

  config/
    env.validation.ts                                         ← NEW
    database.config.ts                                        ← NEW

  customer/
    domain/
      exceptions/
        customer.exceptions.ts                                ← NEW
      value-objects/
        email.vo.ts                                           ← NEW
        phone.vo.ts                                           ← NEW
      events/
        customer-registered.event.ts                          ← NEW
      aggregates/
        customer.aggregate.ts                                 ← NEW
      customer.aggregate.spec.ts                              ← NEW

    application/
      ports/
        customer-repository.port.ts                           ← NEW
        password-hasher.port.ts                               ← NEW
      use-cases/
        commands/
          register-customer.command.ts                        ← NEW
          login-customer.command.ts                           ← NEW
        queries/
          get-customer.query.ts                               ← NEW
        handlers/
          register-customer.handler.ts                        ← NEW
          login-customer.handler.ts                           ← NEW
          get-customer.handler.ts                             ← NEW
      dtos/
        register-customer.dto.ts                              ← NEW
        login-customer.dto.ts                                 ← NEW
        customer-response.dto.ts                              ← NEW

    presentation/
      controllers/
        customer.controller.ts                                ← MOVED from infrastructure/http
      dtos/
        register-customer-request.dto.ts                      ← MOVED from infrastructure/http
        login-customer-request.dto.ts                         ← MOVED from infrastructure/http
        register-customer-response.dto.ts                     ← NEW
      guards/
        auth.guard.ts                                         ← NEW
      decorators/
        current-customer.decorator.ts                         ← NEW

    infrastructure/
      persistence/
        customer.mapper.ts                                    ← NEW
        prisma-customer.repository.ts                         ← NEW
      auth/
        bcrypt-password-hasher.ts                             ← NEW
        jwt-token-generator.ts                                ← MOVED (token concern belongs in auth context)

    customer.module.ts                                        ← NEW

  auth/
    application/
      ports/
        token-generator.port.ts                               ← MOVED from customer/application/ports
      use-cases/
        handlers/
          issue-token.handler.ts                              ← NEW
    infrastructure/
      jwt-token-generator.ts                                  ← NEW
    auth.module.ts                                            ← NEW

  app.module.ts                                               ← MODIFY
  main.ts                                                     ← MODIFY

tests/
  integration/
    customer/
      register-customer.integration.spec.ts                   ← NEW
  e2e/
    customer.e2e-spec.ts                                      ← NEW

.env.example                                                  ← NEW
.env.test.example                                             ← NEW
```

---

## Step 1 — Install Dependencies

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt \
  class-validator class-transformer @prisma/client bcrypt

npm install --save-dev prisma @types/bcrypt @types/passport-jwt
```

---

## Step 2 — Prisma Schema

**File:** `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Customer {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  phone        String
  name         String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([email])
}
```

Run migration:

```bash
npx prisma migrate dev --name init-customer
npx prisma generate
```

---

## Step 3 — Environment Variables

**File:** `.env.example`

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/barber_ddd"
JWT_SECRET="change-me-to-a-long-random-secret-min-32-chars"
JWT_EXPIRES_IN="7d"
PORT=3000
```

Copy to `.env` and fill in real values.

---

## Step 4 — Shared Domain Primitives

**File:** `src/shared/domain/domain-exception.ts`

```ts
export class DomainException extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = 'DomainException';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, DomainException.prototype);
  }
}
```

**File:** `src/shared/domain/domain-event.ts`

```ts
export interface DomainEvent {
  readonly eventName: string;
  readonly occurredOn: Date;
}
```

**File:** `src/shared/domain/aggregate-root.ts`

```ts
import { DomainEvent } from './domain-event';

export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }
}
```

---

## Step 5 — Shared Infrastructure

**File:** `src/shared/infrastructure/prisma/prisma.service.ts`

```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

**File:** `src/shared/infrastructure/prisma/prisma.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**File:** `src/shared/infrastructure/filters/domain-exception.filter.ts`

```ts
import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from '../../domain/domain-exception';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.warn(
      `DomainException [${exception.name}]: ${exception.message}`,
    );

    response.status(exception.statusCode).json({
      statusCode: exception.statusCode,
      error: exception.name,
      message: exception.message,
    });
  }
}
```

---

## Step 6 — Customer Domain Layer

> No NestJS or Prisma imports in this layer.

**File:** `src/customer/domain/exceptions/customer.exceptions.ts`

```ts
import { DomainException } from '../../../shared/domain/domain-exception';

export class EmailAlreadyTakenException extends DomainException {
  constructor(email: string) {
    super(`Email '${email}' is already registered.`, 409);
    this.name = 'EmailAlreadyTakenException';
  }
}

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('Invalid email or password.', 401);
    this.name = 'InvalidCredentialsException';
  }
}

export class InvalidEmailException extends DomainException {
  constructor(email: string) {
    super(`'${email}' is not a valid email address.`, 422);
    this.name = 'InvalidEmailException';
  }
}

export class InvalidPhoneException extends DomainException {
  constructor(phone: string) {
    super(`'${phone}' is not a valid phone number.`, 422);
    this.name = 'InvalidPhoneException';
  }
}
```

**File:** `src/customer/domain/value-objects/email.vo.ts`

```ts
import { InvalidEmailException } from '../exceptions/customer.exceptions';

export class Email {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): Email {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value || !emailRegex.test(value)) {
      throw new InvalidEmailException(value);
    }
    return new Email(value.toLowerCase().trim());
  }

  static fromPersistence(value: string): Email {
    return new Email(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }
}
```

**File:** `src/customer/domain/value-objects/phone.vo.ts`

```ts
import { InvalidPhoneException } from '../exceptions/customer.exceptions';

export class Phone {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): Phone {
    // Allows digits, +, -, spaces, parentheses; 7–20 characters
    const phoneRegex = /^\+?[\d\s\-().]{7,20}$/;
    if (!value || !phoneRegex.test(value)) {
      throw new InvalidPhoneException(value);
    }
    return new Phone(value.trim());
  }

  static fromPersistence(value: string): Phone {
    return new Phone(value);
  }

  get value(): string {
    return this._value;
  }
}
```

**File:** `src/customer/domain/events/customer-registered.event.ts`

```ts
import { DomainEvent } from '../../../shared/domain/domain-event';

export class CustomerRegisteredEvent implements DomainEvent {
  readonly eventName = 'customer.registered';
  readonly occurredOn: Date;

  constructor(
    readonly customerId: string,
    readonly email: string,
  ) {
    this.occurredOn = new Date();
  }
}
```

**File:** `src/customer/domain/aggregates/customer.aggregate.ts`

```ts
import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { Email } from '../value-objects/email.vo';
import { Phone } from '../value-objects/phone.vo';
import { CustomerRegisteredEvent } from '../events/customer-registered.event';

interface CustomerProps {
  id: string;
  email: Email;
  passwordHash: string;
  phone: Phone;
  name: string;
  createdAt: Date;
}

export interface CreateCustomerProps {
  id: string;
  email: string;
  passwordHash: string;
  phone: string;
  name: string;
}

export class Customer extends AggregateRoot {
  private readonly _id: string;
  private readonly _email: Email;
  private readonly _passwordHash: string;
  private readonly _phone: Phone;
  private readonly _name: string;
  private readonly _createdAt: Date;

  private constructor(props: CustomerProps) {
    super();
    this._id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._phone = props.phone;
    this._name = props.name;
    this._createdAt = props.createdAt;
  }

  static create(props: CreateCustomerProps): Customer {
    const customer = new Customer({
      id: props.id,
      email: Email.create(props.email),
      passwordHash: props.passwordHash,
      phone: Phone.create(props.phone),
      name: props.name.trim(),
      createdAt: new Date(),
    });
    customer.addDomainEvent(new CustomerRegisteredEvent(props.id, props.email));
    return customer;
  }

  static reconstitute(props: CustomerProps): Customer {
    return new Customer(props);
  }

  get id(): string {
    return this._id;
  }
  get email(): Email {
    return this._email;
  }
  get passwordHash(): string {
    return this._passwordHash;
  }
  get phone(): Phone {
    return this._phone;
  }
  get name(): string {
    return this._name;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
```

---

## Step 7 — Customer Application Layer

**File:** `src/customer/application/ports/customer-repository.port.ts`

```ts
import { Customer } from '../../domain/aggregates/customer.aggregate';

export const CUSTOMER_REPOSITORY = 'CUSTOMER_REPOSITORY';

export interface ICustomerRepository {
  save(customer: Customer): Promise<void>;
  findByEmail(email: string): Promise<Customer | null>;
  findById(id: string): Promise<Customer | null>;
  existsByEmail(email: string): Promise<boolean>;
}
```

**File:** `src/customer/application/ports/password-hasher.port.ts`

```ts
export const PASSWORD_HASHER = 'PASSWORD_HASHER';

export interface IPasswordHasher {
  hash(plainText: string): Promise<string>;
  compare(plainText: string, hash: string): Promise<boolean>;
}
```

**File:** `src/auth/application/ports/token-generator.port.ts`

```ts
export const TOKEN_GENERATOR = 'TOKEN_GENERATOR';

export interface TokenPayload {
  sub: string;
  email: string;
}

export interface ITokenGenerator {
  generate(payload: TokenPayload): string;
}
```

**File:** `src/customer/application/use-cases/commands/register-customer.command.ts`

```ts
export interface RegisterCustomerCommand {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly password: string;
}

export interface RegisterCustomerResult {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}
```

**File:** `src/customer/application/use-cases/commands/login-customer.command.ts`

```ts
export interface LoginCustomerCommand {
  readonly email: string;
  readonly password: string;
}

export interface LoginCustomerResult {
  readonly accessToken: string;
  readonly customerId: string;
}
```

**File:** `src/customer/application/use-cases/handlers/register-customer.handler.ts`

```ts
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
} from '../../ports/customer-repository.port';
import {
  PASSWORD_HASHER,
  IPasswordHasher,
} from '../../ports/password-hasher.port';
import {
  RegisterCustomerCommand,
  RegisterCustomerResult,
} from '../commands/register-customer.command';
import { Customer } from '../../../domain/aggregates/customer.aggregate';
import { EmailAlreadyTakenException } from '../../../domain/exceptions/customer.exceptions';

export class RegisterCustomerHandler {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(
    command: RegisterCustomerCommand,
  ): Promise<RegisterCustomerResult> {
    const emailTaken = await this.customerRepository.existsByEmail(
      command.email,
    );
    if (emailTaken) {
      throw new EmailAlreadyTakenException(command.email);
    }

    const passwordHash = await this.passwordHasher.hash(command.password);

    const customer = Customer.create({
      id: randomUUID(),
      email: command.email,
      passwordHash,
      phone: command.phone,
      name: command.name,
    });

    await this.customerRepository.save(customer);

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email.value,
    };
  }
}
```

**File:** `src/customer/application/use-cases/handlers/login-customer.handler.ts`

```ts
import { Inject } from '@nestjs/common';
import {
  CUSTOMER_REPOSITORY,
  ICustomerRepository,
} from '../../ports/customer-repository.port';
import {
  PASSWORD_HASHER,
  IPasswordHasher,
} from '../../ports/password-hasher.port';
import {
  TOKEN_GENERATOR,
  ITokenGenerator,
} from '../../../../auth/application/ports/token-generator.port';
import {
  LoginCustomerCommand,
  LoginCustomerResult,
} from '../commands/login-customer.command';
import { InvalidCredentialsException } from '../../../domain/exceptions/customer.exceptions';

export class LoginCustomerHandler {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: ITokenGenerator,
  ) {}

  async execute(command: LoginCustomerCommand): Promise<LoginCustomerResult> {
    const customer = await this.customerRepository.findByEmail(command.email);
    if (!customer) {
      throw new InvalidCredentialsException();
    }

    const passwordValid = await this.passwordHasher.compare(
      command.password,
      customer.passwordHash,
    );
    if (!passwordValid) {
      throw new InvalidCredentialsException();
    }

    const accessToken = this.tokenGenerator.generate({
      sub: customer.id,
      email: customer.email.value,
    });

    return {
      accessToken,
      customerId: customer.id,
    };
  }
}
```

---

## Step 8 — Customer Infrastructure Layer

**File:** `src/customer/infrastructure/persistence/customer.mapper.ts`

```ts
import { Customer as PrismaCustomer } from '@prisma/client';
import { Customer } from '../../domain/aggregates/customer.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { Phone } from '../../domain/value-objects/phone.vo';

export class CustomerMapper {
  static toDomain(record: PrismaCustomer): Customer {
    return Customer.reconstitute({
      id: record.id,
      email: Email.fromPersistence(record.email),
      passwordHash: record.passwordHash,
      phone: Phone.fromPersistence(record.phone),
      name: record.name,
      createdAt: record.createdAt,
    });
  }

  static toPersistence(customer: Customer): {
    id: string;
    email: string;
    passwordHash: string;
    phone: string;
    name: string;
    createdAt: Date;
  } {
    return {
      id: customer.id,
      email: customer.email.value,
      passwordHash: customer.passwordHash,
      phone: customer.phone.value,
      name: customer.name,
      createdAt: customer.createdAt,
    };
  }
}
```

**File:** `src/customer/infrastructure/persistence/prisma-customer.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ICustomerRepository } from '../../application/ports/customer-repository.port';
import { Customer } from '../../domain/aggregates/customer.aggregate';
import { CustomerMapper } from './customer.mapper';

@Injectable()
export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(customer: Customer): Promise<void> {
    const data = CustomerMapper.toPersistence(customer);
    await this.prisma.customer.upsert({
      where: { id: data.id },
      create: data,
      update: {
        passwordHash: data.passwordHash,
        phone: data.phone,
        name: data.name,
      },
    });
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const record = await this.prisma.customer.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    return record ? CustomerMapper.toDomain(record) : null;
  }

  async findById(id: string): Promise<Customer | null> {
    const record = await this.prisma.customer.findUnique({ where: { id } });
    return record ? CustomerMapper.toDomain(record) : null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.customer.count({
      where: { email: email.toLowerCase().trim() },
    });
    return count > 0;
  }
}
```

**File:** `src/customer/infrastructure/auth/bcrypt-password-hasher.ts`

```ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IPasswordHasher } from '../../application/ports/password-hasher.port';

const SALT_ROUNDS = 12;

@Injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, SALT_ROUNDS);
  }

  async compare(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }
}
```

**File:** `src/auth/infrastructure/jwt-token-generator.ts`

```ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ITokenGenerator,
  TokenPayload,
} from '../application/ports/token-generator.port';

@Injectable()
export class JwtTokenGenerator implements ITokenGenerator {
  constructor(private readonly jwtService: JwtService) {}

  generate(payload: TokenPayload): string {
    return this.jwtService.sign(payload);
  }
}
```

**File:** `src/customer/presentation/dtos/register-customer-request.dto.ts`

```ts
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterCustomerRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\+?[\d\s\-().]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password!: string;
}
```

**File:** `src/customer/presentation/dtos/login-customer-request.dto.ts`

```ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginCustomerRequestDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
```

**File:** `src/customer/presentation/controllers/customer.controller.ts`

```ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RegisterCustomerHandler } from '../../../application/use-cases/handlers/register-customer.handler';
import { LoginCustomerHandler } from '../../../application/use-cases/handlers/login-customer.handler';
import { RegisterCustomerRequestDto } from '../dtos/register-customer-request.dto';
import { LoginCustomerRequestDto } from '../dtos/login-customer-request.dto';
import { RegisterCustomerResult } from '../../../application/use-cases/commands/register-customer.command';
import { LoginCustomerResult } from '../../../application/use-cases/commands/login-customer.command';

@Controller('customers')
export class CustomerController {
  constructor(
    private readonly registerCustomer: RegisterCustomerHandler,
    private readonly loginCustomer: LoginCustomerHandler,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterCustomerRequestDto,
  ): Promise<RegisterCustomerResult> {
    return this.registerCustomer.execute({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginCustomerRequestDto,
  ): Promise<LoginCustomerResult> {
    return this.loginCustomer.execute({
      email: dto.email,
      password: dto.password,
    });
  }
}
```

---

## Step 9 — Customer Module

**File:** `src/customer/customer.module.ts`

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CustomerController } from './presentation/controllers/customer.controller';
import { RegisterCustomerHandler } from './application/use-cases/handlers/register-customer.handler';
import { LoginCustomerHandler } from './application/use-cases/handlers/login-customer.handler';
import { CUSTOMER_REPOSITORY } from './application/ports/customer-repository.port';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { TOKEN_GENERATOR } from '../auth/application/ports/token-generator.port';
import { PrismaCustomerRepository } from './infrastructure/persistence/prisma-customer.repository';
import { BcryptPasswordHasher } from './infrastructure/auth/bcrypt-password-hasher';
import { JwtTokenGenerator } from '../auth/infrastructure/jwt-token-generator';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [CustomerController],
  providers: [
    RegisterCustomerHandler,
    LoginCustomerHandler,
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_GENERATOR, useClass: JwtTokenGenerator },
  ],
})
export class CustomerModule {}
```

---

## Step 10 — Update App Module

**File:** `src/app.module.ts` (replace entire file)

```ts
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { DomainExceptionFilter } from './shared/infrastructure/filters/domain-exception.filter';
import { CustomerModule } from './customer/customer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CustomerModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class AppModule {}
```

---

## Step 11 — Update main.ts

**File:** `src/main.ts` (replace entire file)

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}
bootstrap();
```

---

## API Contract

### `POST /customers/register`

**Request body:**

```json
{
  "name": "Alice Smith",
  "email": "alice@example.com",
  "phone": "+1 555 123 4567",
  "password": "Secur3Pass!"
}
```

**201 Response:**

```json
{
  "id": "uuid",
  "name": "Alice Smith",
  "email": "alice@example.com"
}
```

**409 Conflict** — email already taken  
**400 Bad Request** — validation failure

---

### `POST /customers/login`

**Request body:**

```json
{
  "email": "alice@example.com",
  "password": "Secur3Pass!"
}
```

**200 Response:**

```json
{
  "accessToken": "eyJhbGci...",
  "customerId": "uuid"
}
```

**401 Unauthorized** — invalid credentials

---

## Architecture Notes

- **Domain** has zero NestJS/Prisma imports — pure TypeScript
- **Application use cases** depend only on port interfaces (`CUSTOMER_REPOSITORY`, `PASSWORD_HASHER`, `TOKEN_GENERATOR`)
- **Infrastructure** wires concrete implementations via NestJS DI tokens
- `DomainException.statusCode` drives HTTP status mapping in the global filter — no coupling per exception type
- Password is never returned in any response; `passwordHash` lives only inside the aggregate and persistence layer
