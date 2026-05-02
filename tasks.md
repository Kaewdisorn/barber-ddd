# Smart Barbershop Booking System — Step-by-Step Tasks Breakdown

> Architecture: Clean Architecture · DDD · Hexagonal Architecture  
> Stack: NestJS · TypeScript (strict) · PostgreSQL · Prisma · JWT

---

## Phase 1 — Project Initialization

### Task 1.1 — Initialize NestJS project with strict TypeScript

```bash
npm i -g @nestjs/cli
nest new barber-ddd --package-manager npm --strict
```

**File:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictPropertyInitialization": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "module": "commonjs",
    "target": "ES2021",
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      "@booking/*": ["src/booking/*"],
      "@barber/*": ["src/barber/*"],
      "@customer/*": ["src/customer/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

---

### Task 1.2 — Configure ESLint, Prettier, and kebab-case file naming

```bash
npm install --save-dev eslint-plugin-unicorn prettier eslint-config-prettier
```

**File:** `.eslintrc.js`

```js
module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: { project: "tsconfig.json", sourceType: "module" },
  plugins: ["@typescript-eslint", "unicorn"],
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  rules: {
    "unicorn/filename-case": ["error", { case: "kebabCase" }],
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
  },
};
```

**File:** `.prettierrc`

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "semi": true
}
```

---

### Task 1.3 — Install core dependencies

```bash
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
npm install class-validator class-transformer
npm install @prisma/client bcrypt
npm install @nestjs/throttler helmet
npm install --save-dev prisma @types/bcrypt @types/passport-jwt
```

---

## Phase 2 — Folder Structure & Bounded Contexts

### Task 2.1 — Create bounded context folder structure

```
src/
├── booking/
│   ├── domain/
│   │   ├── aggregates/
│   │   ├── value-objects/
│   │   ├── events/
│   │   └── exceptions/
│   ├── application/
│   │   ├── use-cases/
│   │   ├── ports/
│   │   └── dtos/
│   └── infrastructure/
│       ├── persistence/
│       └── http/
│           └── controllers/
├── barber/
│   ├── domain/
│   │   ├── aggregates/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   └── exceptions/
│   ├── application/
│   │   ├── use-cases/
│   │   ├── ports/
│   │   └── dtos/
│   └── infrastructure/
│       ├── persistence/
│       └── http/
│           └── controllers/
├── customer/
│   ├── domain/
│   │   ├── aggregates/
│   │   ├── value-objects/
│   │   └── exceptions/
│   ├── application/
│   │   ├── use-cases/
│   │   ├── ports/
│   │   └── dtos/
│   └── infrastructure/
│       ├── persistence/
│       └── http/
│           └── controllers/
└── shared/
    ├── domain/
    │   ├── domain-exception.ts
    │   └── aggregate-root.ts
    └── infrastructure/
        └── prisma/
```

```bash
# Create all directories
$contexts = @('booking', 'barber', 'customer')
foreach ($ctx in $contexts) {
  New-Item -ItemType Directory -Force -Path "src/$ctx/domain/aggregates",
    "src/$ctx/domain/value-objects", "src/$ctx/domain/events",
    "src/$ctx/domain/exceptions", "src/$ctx/application/use-cases",
    "src/$ctx/application/ports", "src/$ctx/application/dtos",
    "src/$ctx/infrastructure/persistence",
    "src/$ctx/infrastructure/http/controllers"
}
New-Item -ItemType Directory -Force -Path "src/shared/domain", "src/shared/infrastructure/prisma"
```

---

## Phase 3 — Shared Domain Primitives

### Task 3.1 — Create DomainException base class

**File:** `src/shared/domain/domain-exception.ts`

```ts
export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainException";
    Object.setPrototypeOf(this, DomainException.prototype);
  }
}
```

### Task 3.2 — Create AggregateRoot base class

**File:** `src/shared/domain/aggregate-root.ts`

```ts
import { DomainEvent } from "./domain-event";

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

**File:** `src/shared/domain/domain-event.ts`

```ts
export interface DomainEvent {
  readonly occurredOn: Date;
  readonly eventName: string;
}
```

---

## Phase 4 — Customer Bounded Context

### Task 4.1 — Phone value object

**File:** `src/customer/domain/value-objects/phone.vo.ts`

```ts
import { DomainException } from "../../../shared/domain/domain-exception";

export class Phone {
  private constructor(private readonly value: string) {}

  static create(raw: string): Phone {
    const cleaned = raw.replace(/\s+/g, "");
    if (!/^\+?[1-9]\d{7,14}$/.test(cleaned)) {
      throw new DomainException(`Invalid phone number: ${raw}`);
    }
    return new Phone(cleaned);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }
}
```

### Task 4.2 — Customer aggregate

**File:** `src/customer/domain/aggregates/customer.aggregate.ts`

```ts
import { AggregateRoot } from "../../../shared/domain/aggregate-root";
import { DomainException } from "../../../shared/domain/domain-exception";
import { Phone } from "../value-objects/phone.vo";

export interface CustomerProps {
  id: string;
  name: string;
  phone: Phone;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export class Customer extends AggregateRoot {
  private constructor(private readonly props: CustomerProps) {
    super();
  }

  static create(props: Omit<CustomerProps, "createdAt">): Customer {
    if (!props.name || props.name.trim().length < 2) {
      throw new DomainException("Customer name must be at least 2 characters");
    }
    if (!props.email.includes("@")) {
      throw new DomainException("Invalid email address");
    }
    return new Customer({ ...props, createdAt: new Date() });
  }

  static reconstitute(props: CustomerProps): Customer {
    return new Customer(props);
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get phone(): Phone {
    return this.props.phone;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
```

### Task 4.3 — Customer repository port

**File:** `src/customer/application/ports/customer-repository.port.ts`

```ts
import { Customer } from "../../domain/aggregates/customer.aggregate";

export const CUSTOMER_REPOSITORY = "CUSTOMER_REPOSITORY";

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}
```

### Task 4.4 — Register customer use case

**File:** `src/customer/application/use-cases/register-customer.use-case.ts`

```ts
import { Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import * as bcrypt from "bcrypt";
import { Customer } from "../../domain/aggregates/customer.aggregate";
import { Phone } from "../../domain/value-objects/phone.vo";
import {
  CustomerRepository,
  CUSTOMER_REPOSITORY,
} from "../ports/customer-repository.port";
import { RegisterCustomerCommand } from "../dtos/register-customer.command";
import { DomainException } from "../../../shared/domain/domain-exception";

@Injectable()
export class RegisterCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(command: RegisterCustomerCommand): Promise<{ id: string }> {
    const existing = await this.customerRepository.findByEmail(command.email);
    if (existing) {
      throw new DomainException("Email already registered");
    }

    const passwordHash = await bcrypt.hash(command.password, 12);
    const customer = Customer.create({
      id: uuidv4(),
      name: command.name,
      phone: Phone.create(command.phone),
      email: command.email,
      passwordHash,
    });

    await this.customerRepository.save(customer);
    return { id: customer.id };
  }
}
```

**File:** `src/customer/application/dtos/register-customer.command.ts`

```ts
import { IsEmail, IsString, MinLength, Matches } from "class-validator";

export class RegisterCustomerCommand {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone: string;
}
```

---

## Phase 5 — Barber Bounded Context

### Task 5.1 — Price value object

**File:** `src/barber/domain/value-objects/price.vo.ts`

```ts
import { DomainException } from "../../../shared/domain/domain-exception";

export class Price {
  private constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {}

  static create(amount: number, currency = "USD"): Price {
    if (amount < 0) throw new DomainException("Price cannot be negative");
    if (!currency || currency.length !== 3) {
      throw new DomainException("Currency must be a 3-letter ISO code");
    }
    return new Price(amount, currency.toUpperCase());
  }

  getAmount(): number {
    return this.amount;
  }
  getCurrency(): string {
    return this.currency;
  }

  equals(other: Price): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

### Task 5.2 — Schedule value object

**File:** `src/barber/domain/value-objects/schedule.vo.ts`

```ts
import { DomainException } from "../../../shared/domain/domain-exception";

export interface WorkingHours {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export class Schedule {
  private constructor(
    private readonly workingDays: number[], // 0=Sun … 6=Sat
    private readonly hours: WorkingHours,
  ) {}

  static create(workingDays: number[], hours: WorkingHours): Schedule {
    if (!workingDays.length) {
      throw new DomainException("Schedule must have at least one working day");
    }
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(hours.start) || !timeRegex.test(hours.end)) {
      throw new DomainException("Working hours must be in HH:mm format");
    }
    if (hours.start >= hours.end) {
      throw new DomainException("Start time must be before end time");
    }
    return new Schedule(workingDays, hours);
  }

  isAvailableOn(date: Date): boolean {
    return this.workingDays.includes(date.getDay());
  }

  getWorkingDays(): number[] {
    return [...this.workingDays];
  }
  getHours(): WorkingHours {
    return { ...this.hours };
  }
}
```

### Task 5.3 — Service entity

**File:** `src/barber/domain/entities/service.entity.ts`

```ts
import { DomainException } from "../../../shared/domain/domain-exception";
import { Price } from "../value-objects/price.vo";

export interface ServiceProps {
  id: string;
  name: string;
  durationMinutes: number;
  price: Price;
}

export class Service {
  constructor(private readonly props: ServiceProps) {
    if (props.durationMinutes <= 0) {
      throw new DomainException("Service duration must be positive");
    }
    if (!props.name || props.name.trim().length < 2) {
      throw new DomainException("Service name must be at least 2 characters");
    }
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get durationMinutes(): number {
    return this.props.durationMinutes;
  }
  get price(): Price {
    return this.props.price;
  }
}
```

### Task 5.4 — Barber aggregate

**File:** `src/barber/domain/aggregates/barber.aggregate.ts`

```ts
import { AggregateRoot } from "../../../shared/domain/aggregate-root";
import { DomainException } from "../../../shared/domain/domain-exception";
import { Schedule } from "../value-objects/schedule.vo";
import { Service } from "../entities/service.entity";

export interface BarberProps {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  schedule: Schedule;
  services: Service[];
  createdAt: Date;
}

export class Barber extends AggregateRoot {
  private constructor(private readonly props: BarberProps) {
    super();
  }

  static create(props: Omit<BarberProps, "createdAt">): Barber {
    if (!props.name || props.name.trim().length < 2) {
      throw new DomainException("Barber name must be at least 2 characters");
    }
    return new Barber({ ...props, createdAt: new Date() });
  }

  static reconstitute(props: BarberProps): Barber {
    return new Barber(props);
  }

  addService(service: Service): void {
    const duplicate = this.props.services.find((s) => s.id === service.id);
    if (duplicate) throw new DomainException("Service already exists");
    this.props.services.push(service);
  }

  isAvailableOn(date: Date): boolean {
    return this.props.schedule.isAvailableOn(date);
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get schedule(): Schedule {
    return this.props.schedule;
  }
  get services(): Service[] {
    return [...this.props.services];
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
```

### Task 5.5 — Barber repository port

**File:** `src/barber/application/ports/barber-repository.port.ts`

```ts
import { Barber } from "../../domain/aggregates/barber.aggregate";

export const BARBER_REPOSITORY = "BARBER_REPOSITORY";

export interface BarberRepository {
  findById(id: string): Promise<Barber | null>;
  findAll(): Promise<Barber[]>;
  save(barber: Barber): Promise<void>;
}
```

---

## Phase 6 — Booking Bounded Context

### Task 6.1 — TimeSlot value object

**File:** `src/booking/domain/value-objects/time-slot.vo.ts`

```ts
import { DomainException } from "../../../shared/domain/domain-exception";

export class TimeSlot {
  private constructor(
    private readonly start: Date,
    private readonly end: Date,
  ) {}

  static create(start: Date, end: Date): TimeSlot {
    if (start >= end) {
      throw new DomainException("TimeSlot start must be before end");
    }
    if (start < new Date()) {
      throw new DomainException("TimeSlot cannot be in the past");
    }
    return new TimeSlot(start, end);
  }

  overlaps(other: TimeSlot): boolean {
    return this.start < other.end && this.end > other.start;
  }

  getStart(): Date {
    return new Date(this.start);
  }
  getEnd(): Date {
    return new Date(this.end);
  }
  getDurationMinutes(): number {
    return (this.end.getTime() - this.start.getTime()) / 60_000;
  }
}
```

### Task 6.2 — Booking domain events

**File:** `src/booking/domain/events/booking-created.event.ts`

```ts
import { DomainEvent } from "../../../shared/domain/domain-event";

export class BookingCreatedEvent implements DomainEvent {
  readonly occurredOn = new Date();
  readonly eventName = "BookingCreated";

  constructor(
    public readonly bookingId: string,
    public readonly customerId: string,
    public readonly barberId: string,
    public readonly serviceId: string,
  ) {}
}
```

**File:** `src/booking/domain/events/booking-confirmed.event.ts`

```ts
import { DomainEvent } from "../../../shared/domain/domain-event";

export class BookingConfirmedEvent implements DomainEvent {
  readonly occurredOn = new Date();
  readonly eventName = "BookingConfirmed";
  constructor(public readonly bookingId: string) {}
}
```

**File:** `src/booking/domain/events/booking-cancelled.event.ts`

```ts
import { DomainEvent } from "../../../shared/domain/domain-event";

export class BookingCancelledEvent implements DomainEvent {
  readonly occurredOn = new Date();
  readonly eventName = "BookingCancelled";
  constructor(
    public readonly bookingId: string,
    public readonly reason: string,
  ) {}
}
```

### Task 6.3 — Booking aggregate

**File:** `src/booking/domain/aggregates/booking.aggregate.ts`

```ts
import { AggregateRoot } from "../../../shared/domain/aggregate-root";
import { DomainException } from "../../../shared/domain/domain-exception";
import { TimeSlot } from "../value-objects/time-slot.vo";
import { BookingCreatedEvent } from "../events/booking-created.event";
import { BookingConfirmedEvent } from "../events/booking-confirmed.event";
import { BookingCancelledEvent } from "../events/booking-cancelled.event";

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export interface BookingProps {
  id: string;
  customerId: string;
  barberId: string;
  serviceId: string;
  timeSlot: TimeSlot;
  status: BookingStatus;
  createdAt: Date;
  version: number; // optimistic concurrency
}

export class Booking extends AggregateRoot {
  private constructor(private props: BookingProps) {
    super();
  }

  static create(
    props: Omit<BookingProps, "status" | "createdAt" | "version">,
  ): Booking {
    const booking = new Booking({
      ...props,
      status: "PENDING",
      createdAt: new Date(),
      version: 0,
    });
    booking.addDomainEvent(
      new BookingCreatedEvent(
        props.id,
        props.customerId,
        props.barberId,
        props.serviceId,
      ),
    );
    return booking;
  }

  static reconstitute(props: BookingProps): Booking {
    return new Booking(props);
  }

  confirm(): void {
    if (this.props.status !== "PENDING") {
      throw new DomainException(
        `Cannot confirm a booking with status ${this.props.status}`,
      );
    }
    this.props.status = "CONFIRMED";
    this.props.version += 1;
    this.addDomainEvent(new BookingConfirmedEvent(this.props.id));
  }

  cancel(reason: string): void {
    if (this.props.status === "CANCELLED") {
      throw new DomainException("Booking is already cancelled");
    }
    this.props.status = "CANCELLED";
    this.props.version += 1;
    this.addDomainEvent(new BookingCancelledEvent(this.props.id, reason));
  }

  get id(): string {
    return this.props.id;
  }
  get customerId(): string {
    return this.props.customerId;
  }
  get barberId(): string {
    return this.props.barberId;
  }
  get serviceId(): string {
    return this.props.serviceId;
  }
  get timeSlot(): TimeSlot {
    return this.props.timeSlot;
  }
  get status(): BookingStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get version(): number {
    return this.props.version;
  }
}
```

### Task 6.4 — Booking repository port

**File:** `src/booking/application/ports/booking-repository.port.ts`

```ts
import { Booking } from "../../domain/aggregates/booking.aggregate";

export const BOOKING_REPOSITORY = "BOOKING_REPOSITORY";

export interface BookingRepository {
  findById(id: string): Promise<Booking | null>;
  findByBarberandTimeRange(
    barberId: string,
    from: Date,
    to: Date,
  ): Promise<Booking[]>;
  save(booking: Booking): Promise<void>;
  findAllByCustomer(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<Booking[]>;
}
```

### Task 6.5 — Create booking use case

**File:** `src/booking/application/use-cases/create-booking.use-case.ts`

```ts
import { Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { Booking } from "../../domain/aggregates/booking.aggregate";
import { TimeSlot } from "../../domain/value-objects/time-slot.vo";
import {
  BookingRepository,
  BOOKING_REPOSITORY,
} from "../ports/booking-repository.port";
import {
  BarberRepository,
  BARBER_REPOSITORY,
} from "../../../barber/application/ports/barber-repository.port";
import { CreateBookingCommand } from "../dtos/create-booking.command";
import { DomainException } from "../../../shared/domain/domain-exception";

@Injectable()
export class CreateBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingRepository: BookingRepository,
    @Inject(BARBER_REPOSITORY)
    private readonly barberRepository: BarberRepository,
  ) {}

  async execute(command: CreateBookingCommand): Promise<{ id: string }> {
    const barber = await this.barberRepository.findById(command.barberId);
    if (!barber) throw new DomainException("Barber not found");

    const service = barber.services.find((s) => s.id === command.serviceId);
    if (!service)
      throw new DomainException("Service not found for this barber");

    const startTime = new Date(command.startTime);
    const endTime = new Date(
      startTime.getTime() + service.durationMinutes * 60_000,
    );
    const timeSlot = TimeSlot.create(startTime, endTime);

    const conflicts = await this.bookingRepository.findByBarberandTimeRange(
      command.barberId,
      timeSlot.getStart(),
      timeSlot.getEnd(),
    );
    if (conflicts.length > 0) {
      throw new DomainException("The selected time slot is already booked");
    }

    const booking = Booking.create({
      id: uuidv4(),
      customerId: command.customerId,
      barberId: command.barberId,
      serviceId: command.serviceId,
      timeSlot,
    });

    await this.bookingRepository.save(booking);
    return { id: booking.id };
  }
}
```

**File:** `src/booking/application/dtos/create-booking.command.ts`

```ts
import { IsUUID, IsISO8601, IsString } from "class-validator";

export class CreateBookingCommand {
  @IsUUID()
  customerId: string;

  @IsUUID()
  barberId: string;

  @IsUUID()
  serviceId: string;

  @IsISO8601()
  startTime: string;
}
```

### Task 6.6 — Confirm and cancel booking use cases

**File:** `src/booking/application/use-cases/confirm-booking.use-case.ts`

```ts
import { Inject, Injectable } from "@nestjs/common";
import {
  BookingRepository,
  BOOKING_REPOSITORY,
} from "../ports/booking-repository.port";
import { DomainException } from "../../../shared/domain/domain-exception";

@Injectable()
export class ConfirmBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingRepository: BookingRepository,
  ) {}

  async execute(bookingId: string): Promise<void> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new DomainException("Booking not found");
    booking.confirm();
    await this.bookingRepository.save(booking);
  }
}
```

**File:** `src/booking/application/use-cases/cancel-booking.use-case.ts`

```ts
import { Inject, Injectable } from "@nestjs/common";
import {
  BookingRepository,
  BOOKING_REPOSITORY,
} from "../ports/booking-repository.port";
import { DomainException } from "../../../shared/domain/domain-exception";

@Injectable()
export class CancelBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingRepository: BookingRepository,
  ) {}

  async execute(bookingId: string, reason: string): Promise<void> {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) throw new DomainException("Booking not found");
    booking.cancel(reason);
    await this.bookingRepository.save(booking);
  }
}
```

---

## Phase 7 — Infrastructure: Prisma & Database

### Task 7.1 — Initialize Prisma and configure PostgreSQL connection

```bash
npx prisma init
```

**File:** `.env`

```env
DATABASE_URL="postgresql://user:password@localhost:5432/barber_db?schema=public"
JWT_SECRET="change-me-in-production"
JWT_EXPIRES_IN="1h"
PORT=3000
NODE_ENV=development
```

### Task 7.2 — Prisma schema

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
  id           String    @id @default(uuid())
  name         String
  email        String    @unique
  phone        String
  passwordHash String    @map("password_hash")
  createdAt    DateTime  @default(now()) @map("created_at")
  bookings     Booking[]

  @@map("customers")
}

model Barber {
  id           String    @id @default(uuid())
  name         String
  email        String    @unique
  passwordHash String    @map("password_hash")
  workingDays  Int[]     @map("working_days")
  hoursStart   String    @map("hours_start")
  hoursEnd     String    @map("hours_end")
  createdAt    DateTime  @default(now()) @map("created_at")
  services     Service[]
  bookings     Booking[]

  @@map("barbers")
}

model Service {
  id              String    @id @default(uuid())
  name            String
  durationMinutes Int       @map("duration_minutes")
  priceAmount     Decimal   @map("price_amount") @db.Decimal(10, 2)
  priceCurrency   String    @default("USD") @map("price_currency")
  barberId        String    @map("barber_id")
  barber          Barber    @relation(fields: [barberId], references: [id], onDelete: Cascade)
  bookings        Booking[]

  @@map("services")
}

model Booking {
  id         String   @id @default(uuid())
  customerId String   @map("customer_id")
  barberId   String   @map("barber_id")
  serviceId  String   @map("service_id")
  startTime  DateTime @map("start_time")
  endTime    DateTime @map("end_time")
  status     String   @default("PENDING")
  version    Int      @default(0)
  createdAt  DateTime @default(now()) @map("created_at")

  customer Customer @relation(fields: [customerId], references: [id])
  barber   Barber   @relation(fields: [barberId], references: [id])
  service  Service  @relation(fields: [serviceId], references: [id])

  @@index([barberId, startTime, endTime], name: "idx_booking_barber_time")
  @@index([customerId], name: "idx_booking_customer")
  @@index([startTime], name: "idx_booking_start_time")
  @@map("bookings")
}
```

### Task 7.3 — Run migration and generate Prisma client

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### Task 7.4 — Prisma service

**File:** `src/shared/infrastructure/prisma/prisma.service.ts`

```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

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
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### Task 7.5 — Booking Prisma repository adapter + mapper

**File:** `src/booking/infrastructure/persistence/booking-prisma.mapper.ts`

```ts
import { Booking as PrismaBooking } from "@prisma/client";
import { Booking } from "../../domain/aggregates/booking.aggregate";
import { TimeSlot } from "../../domain/value-objects/time-slot.vo";

export class BookingPrismaMapper {
  static toDomain(raw: PrismaBooking): Booking {
    const timeSlot = TimeSlot.create(raw.startTime, raw.endTime);
    return Booking.reconstitute({
      id: raw.id,
      customerId: raw.customerId,
      barberId: raw.barberId,
      serviceId: raw.serviceId,
      timeSlot,
      status: raw.status as any,
      createdAt: raw.createdAt,
      version: raw.version,
    });
  }

  static toPersistence(
    booking: Booking,
  ): Omit<PrismaBooking, "customer" | "barber" | "service"> {
    return {
      id: booking.id,
      customerId: booking.customerId,
      barberId: booking.barberId,
      serviceId: booking.serviceId,
      startTime: booking.timeSlot.getStart(),
      endTime: booking.timeSlot.getEnd(),
      status: booking.status,
      version: booking.version,
      createdAt: booking.createdAt,
    };
  }
}
```

**File:** `src/booking/infrastructure/persistence/booking-prisma.repository.ts`

```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../shared/infrastructure/prisma/prisma.service";
import { BookingRepository } from "../../application/ports/booking-repository.port";
import { Booking } from "../../domain/aggregates/booking.aggregate";
import { BookingPrismaMapper } from "./booking-prisma.mapper";
import { DomainException } from "../../../shared/domain/domain-exception";

@Injectable()
export class BookingPrismaRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Booking | null> {
    const raw = await this.prisma.booking.findUnique({ where: { id } });
    return raw ? BookingPrismaMapper.toDomain(raw) : null;
  }

  async findByBarberandTimeRange(
    barberId: string,
    from: Date,
    to: Date,
  ): Promise<Booking[]> {
    const rows = await this.prisma.booking.findMany({
      where: {
        barberId,
        status: { not: "CANCELLED" },
        startTime: { lt: to },
        endTime: { gt: from },
      },
    });
    return rows.map(BookingPrismaMapper.toDomain);
  }

  async findAllByCustomer(
    customerId: string,
    page: number,
    limit: number,
  ): Promise<Booking[]> {
    const rows = await this.prisma.booking.findMany({
      where: { customerId },
      orderBy: { startTime: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return rows.map(BookingPrismaMapper.toDomain);
  }

  async save(booking: Booking): Promise<void> {
    const data = BookingPrismaMapper.toPersistence(booking);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({ where: { id: data.id } });
      if (existing && existing.version !== data.version - 1) {
        throw new DomainException(
          "Booking was modified by another request (optimistic lock)",
        );
      }
      await tx.booking.upsert({
        where: { id: data.id },
        create: data,
        update: data,
      });
    });
  }
}
```

---

## Phase 8 — Infrastructure: HTTP Controllers

### Task 8.1 — Booking controller

**File:** `src/booking/infrastructure/http/controllers/booking.controller.ts`

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../../shared/infrastructure/auth/jwt-auth.guard";
import { CurrentUser } from "../../../../shared/infrastructure/auth/current-user.decorator";
import { CreateBookingUseCase } from "../../../application/use-cases/create-booking.use-case";
import { ConfirmBookingUseCase } from "../../../application/use-cases/confirm-booking.use-case";
import { CancelBookingUseCase } from "../../../application/use-cases/cancel-booking.use-case";
import { CreateBookingCommand } from "../../../application/dtos/create-booking.command";

@UseGuards(JwtAuthGuard)
@Controller("bookings")
export class BookingController {
  constructor(
    private readonly createBooking: CreateBookingUseCase,
    private readonly confirmBooking: ConfirmBookingUseCase,
    private readonly cancelBooking: CancelBookingUseCase,
  ) {}

  @Post()
  create(
    @Body() body: CreateBookingCommand,
    @CurrentUser("sub") customerId: string,
  ) {
    return this.createBooking.execute({ ...body, customerId });
  }

  @Patch(":id/confirm")
  confirm(@Param("id", ParseUUIDPipe) id: string) {
    return this.confirmBooking.execute(id);
  }

  @Patch(":id/cancel")
  cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("reason") reason: string,
  ) {
    return this.cancelBooking.execute(id, reason);
  }
}
```

---

## Phase 9 — Authentication & Authorization

### Task 9.1 — JWT auth module

**File:** `src/shared/infrastructure/auth/auth.module.ts`

```ts
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: config.getOrThrow<string>("JWT_EXPIRES_IN") },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
```

### Task 9.2 — JWT strategy and guard

**File:** `src/shared/infrastructure/auth/jwt.strategy.ts`

```ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

export interface JwtPayload {
  sub: string;
  email: string;
  role: "customer" | "barber" | "admin";
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
```

**File:** `src/shared/infrastructure/auth/jwt-auth.guard.ts`

```ts
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
```

**File:** `src/shared/infrastructure/auth/current-user.decorator.ts`

```ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return field ? request.user?.[field] : request.user;
  },
);
```

### Task 9.3 — Login use case (authentication)

**File:** `src/customer/application/use-cases/login-customer.use-case.ts`

```ts
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import {
  CustomerRepository,
  CUSTOMER_REPOSITORY,
} from "../ports/customer-repository.port";

@Injectable()
export class LoginCustomerUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const customer = await this.customerRepository.findByEmail(email);
    if (!customer) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const token = this.jwtService.sign({
      sub: customer.id,
      email: customer.email,
      role: "customer",
    });
    return { accessToken: token };
  }
}
```

---

## Phase 10 — Configuration & Environment Validation

### Task 10.1 — Environment validation schema

```bash
npm install joi
```

**File:** `src/config/env.validation.ts`

```ts
import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default("1h"),
});
```

**File:** `src/app.module.ts`

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { envValidationSchema } from "./config/env.validation";
import { PrismaModule } from "./shared/infrastructure/prisma/prisma.module";
import { AuthModule } from "./shared/infrastructure/auth/auth.module";
import { BookingModule } from "./booking/booking.module";
import { BarberModule } from "./barber/barber.module";
import { CustomerModule } from "./customer/customer.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    PrismaModule,
    AuthModule,
    BookingModule,
    BarberModule,
    CustomerModule,
  ],
})
export class AppModule {}
```

---

## Phase 11 — Security & Middleware

### Task 11.1 — Global security middleware

**File:** `src/main.ts`

```ts
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { DomainExceptionFilter } from "./shared/infrastructure/filters/domain-exception.filter";
import { PrismaService } from "./shared/infrastructure/prisma/prisma.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DomainExceptionFilter());

  const prisma = app.get(PrismaService);
  const shutdown = async (): Promise<void> => {
    await app.close();
    await prisma.$disconnect();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen(config.getOrThrow<number>("PORT"));
}

bootstrap();
```

### Task 11.2 — Rate limiting

**File:** `src/app.module.ts` (add ThrottlerModule)

```ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Inside @Module imports:
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),

// Inside @Module providers:
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```

### Task 11.3 — DomainException filter

**File:** `src/shared/infrastructure/filters/domain-exception.filter.ts`

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { DomainException } from "../../domain/domain-exception";

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.warn(exception.message);

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: "Domain Rule Violation",
      message: exception.message,
    });
  }
}
```

---

## Phase 12 — Health Checks

### Task 12.1 — Health check endpoint

```bash
npm install @nestjs/terminus
```

**File:** `src/shared/infrastructure/health/health.controller.ts`

```ts
import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from "@nestjs/terminus";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck("database", this.prisma),
    ]);
  }
}
```

---

## Phase 13 — Testing

### Task 13.1 — Domain unit tests

**File:** `src/booking/domain/aggregates/booking.aggregate.spec.ts`

```ts
import { Booking } from "./booking.aggregate";
import { TimeSlot } from "../value-objects/time-slot.vo";
import { DomainException } from "../../../shared/domain/domain-exception";

describe("Booking", () => {
  const futureStart = new Date(Date.now() + 3_600_000);
  const futureEnd = new Date(Date.now() + 7_200_000);

  it("should create a PENDING booking", () => {
    const booking = Booking.create({
      id: "uuid-1",
      customerId: "c-1",
      barberId: "b-1",
      serviceId: "s-1",
      timeSlot: TimeSlot.create(futureStart, futureEnd),
    });
    expect(booking.status).toBe("PENDING");
    expect(booking.pullDomainEvents()).toHaveLength(1);
  });

  it("should confirm a PENDING booking", () => {
    const booking = Booking.create({
      id: "uuid-1",
      customerId: "c-1",
      barberId: "b-1",
      serviceId: "s-1",
      timeSlot: TimeSlot.create(futureStart, futureEnd),
    });
    booking.confirm();
    expect(booking.status).toBe("CONFIRMED");
  });

  it("should throw when confirming a CANCELLED booking", () => {
    const booking = Booking.create({
      id: "uuid-1",
      customerId: "c-1",
      barberId: "b-1",
      serviceId: "s-1",
      timeSlot: TimeSlot.create(futureStart, futureEnd),
    });
    booking.cancel("test");
    expect(() => booking.confirm()).toThrow(DomainException);
  });
});
```

### Task 13.2 — Use case tests with mocked ports

**File:** `src/booking/application/use-cases/create-booking.use-case.spec.ts`

```ts
import { CreateBookingUseCase } from "./create-booking.use-case";
import { BookingRepository } from "../ports/booking-repository.port";
import { BarberRepository } from "../../../barber/application/ports/barber-repository.port";

describe("CreateBookingUseCase", () => {
  let useCase: CreateBookingUseCase;
  let bookingRepo: jest.Mocked<BookingRepository>;
  let barberRepo: jest.Mocked<BarberRepository>;

  beforeEach(() => {
    bookingRepo = {
      findById: jest.fn(),
      findByBarberandTimeRange: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      findAllByCustomer: jest.fn(),
    };
    barberRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
    };
    useCase = new CreateBookingUseCase(bookingRepo, barberRepo);
  });

  it("should throw when barber not found", async () => {
    barberRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({
        customerId: "c-1",
        barberId: "b-1",
        serviceId: "s-1",
        startTime: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    ).rejects.toThrow("Barber not found");
  });
});
```

### Task 13.3 — E2E test example

**File:** `test/booking.e2e-spec.ts`

```ts
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Booking (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  it("POST /bookings — rejects unauthenticated request", () => {
    return request(app.getHttpServer()).post("/bookings").send({}).expect(401);
  });
});
```

---

## Phase 14 — CI Pipeline

### Task 14.1 — GitHub Actions workflow

**File:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: barber_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run build

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/barber_test
        run: npx prisma migrate deploy

      - name: Run tests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/barber_test
          JWT_SECRET: "test-secret-that-is-at-least-32-chars-long"
          JWT_EXPIRES_IN: "1h"
        run: npm run test:cov

      - name: Dependency vulnerability scan
        run: npm audit --audit-level=high
```

---

## Phase 15 — Documentation & Seed Data

### Task 15.1 — README

**File:** `README.md` — document sections:

- Architecture overview (Clean Architecture layers diagram)
- Bounded contexts: Booking, Barber, Customer
- Local development setup
- Environment variables table
- Database bootstrap commands (`prisma migrate dev`)
- Running tests (`npm test`, `npm run test:e2e`)

### Task 15.2 — Seed data

**File:** `prisma/seed.ts`

```ts
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const hash = await bcrypt.hash("Password123!", 12);

  const barber = await prisma.barber.upsert({
    where: { email: "demo-barber@example.com" },
    update: {},
    create: {
      name: "Demo Barber",
      email: "demo-barber@example.com",
      passwordHash: hash,
      workingDays: [1, 2, 3, 4, 5],
      hoursStart: "09:00",
      hoursEnd: "18:00",
      services: {
        create: [
          {
            name: "Haircut",
            durationMinutes: 30,
            priceAmount: 25,
            priceCurrency: "USD",
          },
          {
            name: "Beard Trim",
            durationMinutes: 20,
            priceAmount: 15,
            priceCurrency: "USD",
          },
        ],
      },
    },
  });

  await prisma.customer.upsert({
    where: { email: "demo-customer@example.com" },
    update: {},
    create: {
      name: "Demo Customer",
      email: "demo-customer@example.com",
      phone: "+10000000001",
      passwordHash: hash,
    },
  });

  console.log("Seed complete. Barber id:", barber.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**File:** `package.json` — add seed script:

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

---

## Summary Checklist

| Phase             | Tasks     | Key Files                                                   |
| ----------------- | --------- | ----------------------------------------------------------- |
| 1 — Init          | 1.1–1.3   | `tsconfig.json`, `.eslintrc.js`, `.prettierrc`              |
| 2 — Structure     | 2.1       | `src/*/domain`, `src/*/application`, `src/*/infrastructure` |
| 3 — Shared Domain | 3.1–3.2   | `shared/domain/domain-exception.ts`, `aggregate-root.ts`    |
| 4 — Customer      | 4.1–4.4   | `customer/domain/`, `customer/application/`                 |
| 5 — Barber        | 5.1–5.5   | `barber/domain/`, `barber/application/`                     |
| 6 — Booking       | 6.1–6.6   | `booking/domain/`, `booking/application/`                   |
| 7 — Prisma        | 7.1–7.5   | `prisma/schema.prisma`, `*-prisma.repository.ts`            |
| 8 — HTTP          | 8.1       | `*/infrastructure/http/controllers/*.controller.ts`         |
| 9 — Auth          | 9.1–9.3   | `shared/infrastructure/auth/`                               |
| 10 — Config       | 10.1      | `config/env.validation.ts`, `app.module.ts`                 |
| 11 — Security     | 11.1–11.3 | `main.ts`, `domain-exception.filter.ts`                     |
| 12 — Health       | 12.1      | `health/health.controller.ts`                               |
| 13 — Tests        | 13.1–13.3 | `*.spec.ts`, `test/*.e2e-spec.ts`                           |
| 14 — CI           | 14.1      | `.github/workflows/ci.yml`                                  |
| 15 — Docs & Seed  | 15.1–15.2 | `README.md`, `prisma/seed.ts`                               |
