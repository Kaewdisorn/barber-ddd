# Smart Barbershop Booking System - Implementation Plan

> Goal: build a scalable NestJS backend for barbershop booking using DDD, Clean Architecture, Hexagonal Architecture, PostgreSQL, Prisma, and Kubernetes-ready deployment.

This project is past the "quick MVP" mindset. Each feature should be small enough to ship, but designed so new ideas can be added without rewriting the core.

---

## How To Use This Plan

- Check items as they are completed: `- [x]`
- Keep feature details in separate task files when they become large.
- Do not skip the "Definition of Done" for production-facing work.
- Prefer one bounded context at a time unless a feature truly crosses contexts.

---

## Project Snapshot

| Area | Current State | Target State |
| --- | --- | --- |
| Backend | NestJS starter app | Modular DDD backend |
| Database | Planned PostgreSQL | Prisma migrations and repositories |
| Auth | Planned JWT auth | Customer, barber, admin-safe authentication |
| Architecture | Rules documented | Enforced by folder structure and tests |
| Deployment | Kubernetes files planned/open in IDE | Repeatable local and cluster deployment |
| Testing | Starter Jest tests | Unit, integration, and e2e coverage by context |

---

## Architecture North Star

### Bounded contexts

- [ ] **Customer**: registration, login, profile, preferences, booking history
- [ ] **Barber**: barber profile, offered services, schedule, availability
- [ ] **Booking**: appointment lifecycle, confirmation, cancellation, no-show rules
- [ ] **Shop**: branches, opening hours, chairs, public shop settings
- [ ] **Payment**: payment intent, deposit, refund, receipts
- [ ] **Notification**: email/SMS/push reminders and status updates
- [ ] **Admin**: staff management, reporting, operations dashboard APIs

### Dependency rule

Every context should follow:

```text
Infrastructure -> Application -> Domain
```

- [ ] Domain imports no NestJS, Prisma, HTTP, or external SDKs
- [ ] Application depends on ports/interfaces only
- [ ] Infrastructure owns controllers, Prisma repositories, external adapters
- [ ] Controllers call use cases only
- [ ] Mappers convert persistence models to domain aggregates

---

## Phase 0 - Foundation

Purpose: make the project easy to run, configure, test, and extend.

### Repository setup

- [ ] Replace starter README with project-specific documentation
- [ ] Add `.env.example` with required runtime variables
- [ ] Add `docs/architecture.md` for DDD and dependency rules
- [ ] Add `docs/api.md` for endpoint contracts
- [ ] Add `docs/decisions/` for architecture decision records
- [ ] Add path aliases if they improve imports without hiding boundaries

### Core packages

- [ ] Install Prisma and PostgreSQL client packages
- [ ] Install validation packages: `class-validator`, `class-transformer`
- [ ] Install auth packages: JWT, Passport, bcrypt
- [ ] Install config package and load all env values through `ConfigService`
- [ ] Add Prisma schema and first migration

### Shared kernel

- [ ] Add `DomainException`
- [ ] Add `DomainEvent`
- [ ] Add `AggregateRoot`
- [ ] Add global domain exception filter
- [ ] Add request validation pipe in `main.ts`
- [ ] Add shared Prisma module and service
- [ ] Add health endpoint for runtime checks

### Developer workflow

- [ ] Confirm `npm run build` works
- [ ] Confirm `npm run lint` works
- [ ] Confirm `npm run test` works
- [ ] Add CI workflow for build, lint, and tests
- [ ] Add local database run instructions
- [ ] Add migration commands to documentation

Definition of Done:

- [ ] New developer can run the app from README only
- [ ] Environment variables are documented
- [ ] Tests and build pass in CI
- [ ] Architecture rules are documented before feature work expands

---

## Phase 1 - Customer Identity

Purpose: create the first real bounded context and prove the architecture.

Reference detail: see `task.md` for Customer Register and Login implementation steps.

### Customer registration

- [ ] Create Customer aggregate
- [ ] Create Email value object
- [ ] Create Phone value object
- [ ] Create CustomerRegistered domain event
- [ ] Create customer repository port
- [ ] Create password hasher port
- [ ] Create token generator port
- [ ] Create `RegisterCustomerUseCase`
- [ ] Create Prisma customer repository
- [ ] Create register request DTO
- [ ] Create `POST /customers/register`
- [ ] Add duplicate-email handling
- [ ] Add unit tests for domain rules
- [ ] Add use case tests
- [ ] Add e2e registration test

### Customer login

- [ ] Create `LoginCustomerUseCase`
- [ ] Add bcrypt password hasher adapter
- [ ] Add JWT token generator adapter
- [ ] Create login request DTO
- [ ] Create `POST /customers/login`
- [ ] Add invalid credential handling
- [ ] Add use case tests
- [ ] Add e2e login test

### Customer profile

- [ ] Create authenticated current-customer endpoint
- [ ] Create update profile use case
- [ ] Add change phone/name rules
- [ ] Add customer deletion or deactivation decision
- [ ] Add profile tests

Definition of Done:

- [ ] Customer can register, login, and receive a JWT
- [ ] Passwords are never stored in plain text
- [ ] Domain layer stays framework-free
- [ ] Auth behavior is covered by unit and e2e tests

---

## Phase 2 - Barber And Service Catalog

Purpose: model what can be booked.

### Barber context

- [ ] Create Barber aggregate
- [ ] Create Service entity
- [ ] Create Price value object
- [ ] Create Schedule value object
- [ ] Create repository ports
- [ ] Create Prisma models for barbers and services
- [ ] Add create barber use case
- [ ] Add update barber profile use case
- [ ] Add activate/deactivate barber use case
- [ ] Add admin-only HTTP endpoints
- [ ] Add unit and e2e tests

### Service catalog

- [ ] Add create service use case
- [ ] Add update service use case
- [ ] Add service duration validation
- [ ] Add service price validation
- [ ] Add public list services endpoint
- [ ] Add public list barbers endpoint
- [ ] Add tests for catalog rules

Definition of Done:

- [ ] Customers can see available barbers and services
- [ ] Admin can manage barbers and services
- [ ] Invalid pricing/duration cannot enter the domain

---

## Phase 3 - Booking Core

Purpose: make the main business workflow reliable.

### Booking lifecycle

- [ ] Create Booking aggregate
- [ ] Create TimeSlot value object
- [ ] Create BookingStatus enum/value object
- [ ] Create BookingCreated event
- [ ] Create BookingConfirmed event
- [ ] Create BookingCancelled event
- [ ] Add create booking use case
- [ ] Add confirm booking use case
- [ ] Add cancel booking use case
- [ ] Add reschedule booking use case
- [ ] Add customer booking history endpoint
- [ ] Add barber daily schedule endpoint

### Availability

- [ ] Define shop opening hours rules
- [ ] Define barber schedule rules
- [ ] Define service duration slot rules
- [ ] Prevent overlapping bookings
- [ ] Handle booking race conditions with database constraints or transactions
- [ ] Add availability query endpoint
- [ ] Add tests for conflicts and edge cases

Definition of Done:

- [ ] Customer can book a valid time slot
- [ ] Double booking is prevented
- [ ] Booking state transitions are explicit and tested
- [ ] Race conditions are handled intentionally

---

## Phase 4 - Operations And Admin

Purpose: make the system useful for real shop operations.

### Admin access

- [ ] Decide admin identity model
- [ ] Add roles and permissions
- [ ] Add guards for admin endpoints
- [ ] Add staff invitation or creation workflow
- [ ] Add audit log model for sensitive actions

### Shop operations

- [ ] Add shop profile settings
- [ ] Add branch support decision
- [ ] Add opening hours management
- [ ] Add holiday/closed day management
- [ ] Add manual booking creation by admin
- [ ] Add no-show marking
- [ ] Add daily schedule summary endpoint

Definition of Done:

- [ ] Admin endpoints are protected
- [ ] Shop can manage real-world schedule exceptions
- [ ] Sensitive admin actions are traceable

---

## Phase 5 - Notifications

Purpose: keep customers and barbers informed without coupling business logic to providers.

### Notification context

- [ ] Create notification port
- [ ] Create notification templates
- [ ] Add booking confirmation notification
- [ ] Add booking cancellation notification
- [ ] Add booking reminder notification
- [ ] Add retry strategy for failed sends
- [ ] Add provider adapter, such as email or SMS
- [ ] Add notification delivery log

### Event integration

- [ ] Decide synchronous vs async domain event dispatch
- [ ] Add outbox table if async events are needed
- [ ] Process events without losing messages
- [ ] Add tests for event-to-notification behavior

Definition of Done:

- [ ] Notifications are triggered by application events
- [ ] Business use cases do not import provider SDKs
- [ ] Failed sends are visible and retryable

---

## Phase 6 - Payments

Purpose: support deposits, prepayment, or cancellation fees when the business needs it.

### Payment context

- [ ] Decide payment provider
- [ ] Create payment intent use case
- [ ] Connect payment intent to booking
- [ ] Add payment status tracking
- [ ] Add webhook endpoint
- [ ] Verify webhook signatures
- [ ] Add refund use case
- [ ] Add receipt metadata
- [ ] Add tests for webhook idempotency

Definition of Done:

- [ ] Booking payment state is explicit
- [ ] Webhooks are secure and idempotent
- [ ] Payment provider details stay in infrastructure

---

## Phase 7 - Deployment And Scalability

Purpose: make the app reliable beyond local development.

### Docker and Kubernetes

- [ ] Add production Dockerfile
- [ ] Add local `docker-compose.yml` for app and PostgreSQL
- [ ] Add Kubernetes namespace
- [ ] Add PostgreSQL Secret
- [ ] Add PostgreSQL PVC
- [ ] Add PostgreSQL Deployment
- [ ] Add PostgreSQL Service
- [ ] Add API Deployment
- [ ] Add API Service
- [ ] Add ConfigMap for non-secret runtime config
- [ ] Add migration job or release process
- [ ] Document commands in `k8s/cmd_guide.md`

### Runtime readiness

- [ ] Add `/health/live`
- [ ] Add `/health/ready`
- [ ] Configure liveness probe
- [ ] Configure readiness probe
- [ ] Add structured logging
- [ ] Add request correlation ID
- [ ] Add error response format standard

### Scale path

- [ ] Keep backend stateless
- [ ] Store sessions in JWT or external store
- [ ] Use database indexes for common queries
- [ ] Add pagination for list endpoints
- [ ] Add rate limiting to auth endpoints
- [ ] Add caching only after measuring bottlenecks
- [ ] Add background worker only when async workload grows

Definition of Done:

- [ ] App can be deployed repeatedly from documented commands
- [ ] Health checks represent real runtime health
- [ ] Scaling does not depend on local process memory

---

## Phase 8 - Product Growth Backlog

Purpose: keep future ideas organized without disturbing current implementation.

### Customer experience

- [ ] Favorite barber
- [ ] Favorite services
- [ ] Booking notes
- [ ] Cancellation reason
- [ ] Loyalty points
- [ ] Customer reviews
- [ ] Waitlist for fully booked days

### Shop growth

- [ ] Multi-branch shops
- [ ] Multiple chairs per barber
- [ ] Barber commissions
- [ ] Inventory for products
- [ ] Staff time-off approval
- [ ] Promotions and coupons
- [ ] Analytics dashboard APIs

### Platform growth

- [ ] Public booking page API
- [ ] Multi-tenant shop accounts
- [ ] Webhook integrations
- [ ] External calendar sync
- [ ] Mobile push notifications
- [ ] Search and filtering
- [ ] Read model/reporting database if query load grows

---

## Testing Strategy

| Test Type | Use For | Required Before Done |
| --- | --- | --- |
| Domain unit tests | Value objects, aggregates, business rules | Yes |
| Application tests | Use cases and ports | Yes |
| Infrastructure tests | Prisma repositories, adapters | For risky persistence logic |
| E2E tests | HTTP contracts and main workflows | Yes for public APIs |
| Migration tests | Database schema safety | Before production releases |

Checklist:

- [ ] Test every value object rule
- [ ] Test every aggregate state transition
- [ ] Test every use case success path
- [ ] Test important failure paths
- [ ] Test public endpoint validation
- [ ] Test auth-protected endpoint access
- [ ] Test database uniqueness and conflict behavior

---

## API Standards

- [ ] Use DTOs for every request body
- [ ] Validate every input at the HTTP boundary
- [ ] Keep controllers thin
- [ ] Return stable response shapes
- [ ] Use consistent error format
- [ ] Version APIs before breaking changes
- [ ] Add pagination to collection endpoints
- [ ] Avoid leaking internal IDs from other contexts unless intentional

---

## Security Checklist

- [ ] Hash passwords with bcrypt or stronger approved strategy
- [ ] Store secrets only in env/Kubernetes Secrets
- [ ] Use JWT expiration
- [ ] Add refresh token decision before long-lived sessions
- [ ] Rate limit login and registration
- [ ] Validate all request bodies
- [ ] Protect admin endpoints with roles
- [ ] Log security-sensitive events
- [ ] Never log passwords, tokens, or secrets
- [ ] Verify payment webhooks when payments are added

---

## Release Checklist

Run before merging or deploying:

- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run test:e2e`
- [ ] Prisma migration reviewed
- [ ] `.env.example` updated
- [ ] API docs updated
- [ ] Kubernetes or deployment config updated if needed
- [ ] Rollback plan written for risky changes

---

## Current Recommended Next Steps

1. [ ] Finish Phase 0 foundation.
2. [ ] Implement Phase 1 Customer Identity using `task.md`.
3. [ ] Replace starter README with project-specific run and architecture instructions.
4. [ ] Add Docker/PostgreSQL local setup before deeper Booking work.
5. [ ] Start Booking only after Customer and Barber contexts have tested repositories.

---

## Parking Lot

Use this area for ideas that are interesting but not ready for implementation.

- [ ] Idea:
- [ ] Idea:
- [ ] Idea:

