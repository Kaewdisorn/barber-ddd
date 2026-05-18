# Exception Handling Plan — Production-Grade DDD

## Overview

This document defines the exception handling strategy for the Smart Barbershop Booking System, following Clean Architecture, DDD, and Hexagonal Architecture principles.

**Core rule**: Each layer owns its exceptions. No layer imports HTTP/NestJS concerns inward.

---

## Layer Responsibilities

| Layer              | Owns                                                  | Must NOT                                    |
| ------------------ | ----------------------------------------------------- | ------------------------------------------- |
| **Domain**         | `DomainException`, domain-specific subtypes           | Import NestJS, reference HTTP status codes  |
| **Application**    | `ApplicationException`, app-specific subtypes         | Contain HTTP logic, catch domain exceptions |
| **Infrastructure** | `GlobalExceptionFilter`, status code mapping, logging | Contain business rules                      |

Dependency direction: `Infrastructure → Application → Domain`

---

## 1. Domain Layer

### 1.1 Base Class

**File**: `src/shared/domain/domain-exception.ts`

```ts
export class DomainException extends Error {
  readonly errorCode: string;

  constructor(message: string, errorCode: string) {
    super(message);
    this.name = 'DomainException';
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, DomainException.prototype);
  }
}
```

**Changes from current**:

- Remove `statusCode: number` — HTTP is not a domain concern
- Add `errorCode: string` — stable, screaming-snake-case identifier (e.g. `EMAIL_ALREADY_TAKEN`)

### 1.2 Naming Convention

- `errorCode` must be screaming-snake-case: `INVALID_EMAIL_FORMAT`, `PRICE_MUST_BE_POSITIVE`
- Class name mirrors the code: `InvalidEmailFormatException`, `PriceMustBePositiveException`
- One exception class per business rule violation
- File: `src/modules/<context>/domain/exceptions/<context>.exceptions.ts`

### 1.3 Bounded Context Exceptions

#### Customer Context — `customer.exceptions.ts`

| Class                         | `errorCode`            | Trigger                       |
| ----------------------------- | ---------------------- | ----------------------------- |
| `EmailAlreadyTakenException`  | `EMAIL_ALREADY_TAKEN`  | Email exists in repository    |
| `InvalidEmailFormatException` | `INVALID_EMAIL_FORMAT` | Email VO rejects format       |
| `InvalidPhoneFormatException` | `INVALID_PHONE_FORMAT` | Phone VO rejects format       |
| `WeakPasswordException`       | `WEAK_PASSWORD`        | Password fails strength rules |

#### Barber Context — `barber.exceptions.ts`

| Class                             | `errorCode`                | Trigger                               |
| --------------------------------- | -------------------------- | ------------------------------------- |
| `InvalidPriceException`           | `INVALID_PRICE`            | Price VO receives negative/zero value |
| `ScheduleConflictException`       | `SCHEDULE_CONFLICT`        | Schedule VO detects overlap           |
| `InvalidServiceDurationException` | `INVALID_SERVICE_DURATION` | Duration out of allowed range         |

#### Booking Context — `booking.exceptions.ts`

| Class                               | `errorCode`                  | Trigger                            |
| ----------------------------------- | ---------------------------- | ---------------------------------- |
| `TimeSlotUnavailableException`      | `TIME_SLOT_UNAVAILABLE`      | Slot already booked                |
| `BookingAlreadyCancelledException`  | `BOOKING_ALREADY_CANCELLED`  | Cancel called on cancelled booking |
| `BookingAlreadyConfirmedException`  | `BOOKING_ALREADY_CONFIRMED`  | Re-confirm a confirmed booking     |
| `InvalidBookingTransitionException` | `INVALID_BOOKING_TRANSITION` | Illegal state machine transition   |

---

## 2. Application Layer

### 2.1 Base Class

**File**: `src/shared/application/application-exception.ts`

```ts
export class ApplicationException extends Error {
  readonly errorCode: string;

  constructor(message: string, errorCode: string) {
    super(message);
    this.name = 'ApplicationException';
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, ApplicationException.prototype);
  }
}
```

Application exceptions model use-case–level failures that are not domain rule violations: resource not found, authorization denied, external system unavailable (wrapped), etc.

### 2.2 Standard Subtypes

**File**: `src/shared/application/application-exception.ts` (same file, exported alongside base)

| Class                         | `errorCode`              | Typical HTTP mapping |
| ----------------------------- | ------------------------ | -------------------- |
| `ResourceNotFoundException`   | `<RESOURCE>_NOT_FOUND`   | 404                  |
| `ForbiddenOperationException` | `FORBIDDEN_OPERATION`    | 403                  |
| `ConflictException`           | `RESOURCE_CONFLICT`      | 409                  |
| `ExternalServiceException`    | `EXTERNAL_SERVICE_ERROR` | 502                  |

Example:

```ts
throw new ResourceNotFoundException('Customer', id);
// errorCode → CUSTOMER_NOT_FOUND
// message   → "Customer with id '…' was not found."
```

### 2.3 Use Case Contract

- Use cases **throw** — they never catch domain or application exceptions
- Use cases **never** import `HttpException` or any NestJS exception
- A use case that calls an external port wraps infrastructure errors into `ExternalServiceException`

---

## 3. Infrastructure Layer

### 3.1 Global Exception Filter

**File**: `src/shared/infrastructure/filters/global-exception.filter.ts`

Single `@Catch()` filter registered globally in `main.ts`. Handles all exception types in priority order:

```
1. DomainException        → DOMAIN_STATUS_MAP[errorCode] ?? 422
2. ApplicationException   → APP_STATUS_MAP[errorCode]    ?? 400
3. HttpException (NestJS) → exception.getStatus()        (covers class-validator 400s)
4. Unknown / Error        → 500, generic message, full stack logged
```

### 3.2 HTTP Status Code Maps

Defined in the filter file — the **only** place HTTP status codes are assigned.

```ts
const DOMAIN_STATUS_MAP: Record<string, HttpStatus> = {
  EMAIL_ALREADY_TAKEN: HttpStatus.CONFLICT, // 409
  INVALID_EMAIL_FORMAT: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  INVALID_PHONE_FORMAT: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  WEAK_PASSWORD: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  INVALID_PRICE: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  SCHEDULE_CONFLICT: HttpStatus.CONFLICT, // 409
  TIME_SLOT_UNAVAILABLE: HttpStatus.CONFLICT, // 409
  BOOKING_ALREADY_CANCELLED: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  BOOKING_ALREADY_CONFIRMED: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  INVALID_BOOKING_TRANSITION: HttpStatus.UNPROCESSABLE_ENTITY, // 422
};

const APP_STATUS_MAP: Record<string, HttpStatus> = {
  CUSTOMER_NOT_FOUND: HttpStatus.NOT_FOUND, // 404
  BARBER_NOT_FOUND: HttpStatus.NOT_FOUND, // 404
  BOOKING_NOT_FOUND: HttpStatus.NOT_FOUND, // 404
  FORBIDDEN_OPERATION: HttpStatus.FORBIDDEN, // 403
  RESOURCE_CONFLICT: HttpStatus.CONFLICT, // 409
  EXTERNAL_SERVICE_ERROR: HttpStatus.BAD_GATEWAY, // 502
};
```

### 3.3 Standardized Error Response Body

Every error response — regardless of origin — returns the same shape:

```json
{
  "statusCode": 409,
  "errorCode": "EMAIL_ALREADY_TAKEN",
  "message": "Email 'john@doe.com' is already registered.",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/customers/register"
}
```

For `class-validator` validation errors (400), `message` is a joined array of all constraint messages:

```json
{
  "statusCode": 400,
  "errorCode": "VALIDATION_ERROR",
  "message": "email must be an email; password must be longer than or equal to 8 characters",
  "timestamp": "2026-05-18T10:00:00.000Z",
  "path": "/customers/register"
}
```

**Never expose**:

- Stack traces in responses
- Internal class names
- Raw Prisma/database error messages

### 3.4 Logging Strategy

| Exception type         | Log level | What is logged                             |
| ---------------------- | --------- | ------------------------------------------ |
| `DomainException`      | `warn`    | `errorCode`, `message`, `path`             |
| `ApplicationException` | `warn`    | `errorCode`, `message`, `path`             |
| `HttpException` (4xx)  | `warn`    | `status`, `message`, `path`                |
| Unknown / 5xx          | `error`   | full stack trace, `path`, request metadata |

Use NestJS `Logger` scoped to `GlobalExceptionFilter`. Do **not** use `console.log` / `console.error`.

### 3.5 Registration in `main.ts`

```ts
app.useGlobalFilters(new GlobalExceptionFilter());
```

Registered via `useGlobalFilters` (not as a provider) so it catches exceptions outside the NestJS DI context (bootstrap errors, etc.).

---

## 4. File Structure

```
src/
  shared/
    domain/
      domain-exception.ts              ← updated: remove statusCode, add errorCode
    application/
      application-exception.ts         ← new: ApplicationException + standard subtypes
    infrastructure/
      filters/
        global-exception.filter.ts     ← new: GlobalExceptionFilter
        index.ts                       ← new: barrel export

  modules/
    customer/
      domain/
        exceptions/
          customer.exceptions.ts       ← updated: use errorCode string, no statusCode
    barber/
      domain/
        exceptions/
          barber.exceptions.ts         ← new
    booking/
      domain/
        exceptions/
          booking.exceptions.ts        ← new
```

---

## 5. Implementation Checklist

- [ ] Remove `statusCode` from `DomainException`; add `errorCode: string`
- [ ] Create `src/shared/application/application-exception.ts` with base + standard subtypes
- [ ] Update `EmailAlreadyTakenException` to pass `errorCode` string instead of HTTP status
- [ ] Create domain exception files for `barber` and `booking` contexts
- [ ] Create `GlobalExceptionFilter` with priority-ordered catch branches
- [ ] Add `DOMAIN_STATUS_MAP` and `APP_STATUS_MAP` inside the filter
- [ ] Register filter in `main.ts` via `useGlobalFilters`
- [ ] Remove all `console.log` / `console.error` calls; replace with `Logger`
- [ ] Verify `class-validator` 400 errors are formatted correctly through the filter
- [ ] Add unit tests for `GlobalExceptionFilter` covering all four branches
- [ ] Add e2e tests asserting the standard error response shape

---

## 6. Testing Requirements

### Unit Tests — `GlobalExceptionFilter`

| Scenario                                    | Expected `statusCode` | Expected `errorCode`    |
| ------------------------------------------- | --------------------- | ----------------------- |
| `EmailAlreadyTakenException`                | 409                   | `EMAIL_ALREADY_TAKEN`   |
| `ResourceNotFoundException('Customer', id)` | 404                   | `CUSTOMER_NOT_FOUND`    |
| `BadRequestException` (class-validator)     | 400                   | `VALIDATION_ERROR`      |
| Unknown `Error`                             | 500                   | `INTERNAL_SERVER_ERROR` |
| `DomainException` with unmapped code        | 422                   | the provided code       |
| `ApplicationException` with unmapped code   | 400                   | the provided code       |

### E2E Tests

- POST `/customers/register` with duplicate email → 409 + `EMAIL_ALREADY_TAKEN`
- POST `/customers/register` with invalid body → 400 + `VALIDATION_ERROR`
- GET `/customers/:id` with unknown id → 404 + `CUSTOMER_NOT_FOUND`

---

## 7. Anti-Patterns to Avoid

| Anti-pattern                                     | Why                                                  |
| ------------------------------------------------ | ---------------------------------------------------- |
| `throw new HttpException(...)` inside a use case | Couples application to HTTP transport                |
| `statusCode` inside `DomainException`            | Domain must not know about HTTP                      |
| Catching exceptions in controllers               | Breaks the filter's single responsibility            |
| Returning `null` from use cases on not-found     | Caller must guess; throw `ResourceNotFoundException` |
| Swallowing exceptions with empty `catch {}`      | Silent failures in production                        |
| Logging inside domain or application layers      | Logging is infrastructure; use the filter            |
| Exposing Prisma errors directly                  | Leaks internal schema, potential info disclosure     |
