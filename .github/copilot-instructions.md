# Smart Barbershop Booking System

NestJS + PostgreSQL + Prisma backend for booking barber appointments. Architecture goals: **Clean Architecture**, **DDD**, **Hexagonal Architecture**.

## Tech Stack

- **Framework**: NestJS, TypeScript (strict mode)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: JWT (`@nestjs/jwt` + Passport)
- **Config**: `ConfigService` — never hardcode env values, always use `useFactory`
- **Validation**: `class-validator` + `class-transformer`
- **Testing**: Jest + Supertest

## Architecture Rules

**Layer dependency: Infrastructure → Application → Domain (inward only)**

- **Domain**: zero NestJS/Prisma imports. Aggregates, Value Objects, Domain Events, pure TypeScript only. Throw `DomainException` for business rule violations.
- **Application**: Use cases (`execute(command): Promise<result>`), depends on port interfaces only.
- **Infrastructure**: NestJS modules, Prisma queries, HTTP controllers, external adapters. Mappers convert Prisma model ↔ domain aggregate.

## Coding Conventions

- One use case per file, one public `execute()` method
- Controllers only validate input and call a use case — no business logic
- Repository ports are interfaces in `application/ports/`; Prisma implementations in `infrastructure/persistence/`
- Injection tokens are string constants defined next to the port: `export const BOOKING_REPOSITORY = 'BOOKING_REPOSITORY'`
- File naming: `kebab-case.type.ts` (e.g. `booking.aggregate.ts`, `create-booking.use-case.ts`)

## Bounded Contexts

- **Booking** — Booking aggregate, TimeSlot VO, BookingCreated/Confirmed/Cancelled events
- **Barber** — Barber aggregate, Service entity, Schedule VO, Price VO
- **Customer** — Customer aggregate, Phone VO
