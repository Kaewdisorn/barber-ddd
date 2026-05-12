# Production-Grade Logging Plan

Architecture: follows project rules — no NestJS imports in Domain, all config via `ConfigService`.

---

## Step 1 — Install Dependencies

```bash
npm install nest-winston winston
npm install --save-dev @types/winston
```

---

## Step 2 — Environment Variable

**File:** `.env.example` — add one line:

```env
LOG_LEVEL=info
```

Allowed values: `error` | `warn` | `info` | `verbose` | `debug`  
Recommended: `info` in production, `debug` in development.

---

## Step 3 — Logger Module

**File:** `src/shared/infrastructure/logger/logger.module.ts`

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        level: config.get<string>('LOG_LEVEL', 'info'),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
        transports: [
          new winston.transports.Console({
            silent: config.get<string>('NODE_ENV') === 'test',
          }),
        ],
      }),
    }),
  ],
})
export class LoggerModule {}
```

> `@Global()` makes `WINSTON_MODULE_PROVIDER` available everywhere without re-importing.  
> `silent: true` in test env keeps Jest output clean.

---

## Step 4 — Request ID Middleware

Generates or forwards a `X-Request-ID` header so every log line for one request shares the same ID.

**File:** `src/shared/infrastructure/middleware/request-id.middleware.ts`

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare module 'express' {
  interface Request {
    requestId: string;
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    req.requestId =
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    next();
  }
}
```

---

## Step 5 — Logging Interceptor

Logs every inbound request and its response with method, path, status, duration, and request ID.

**File:** `src/shared/infrastructure/interceptors/logging.interceptor.ts`

```ts
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { Logger } from 'winston';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const startMs = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.info('http_request', {
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Date.now() - startMs,
        });
      }),
    );
  }
}
```

---

## Step 6 — Update DomainExceptionFilter

Replace NestJS `Logger` with the injected Winston logger so domain errors emit structured JSON.

**File:** `src/shared/infrastructure/filters/domain-exception.filter.ts`

```ts
import { ArgumentsHost, Catch, ExceptionFilter, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Response, Request } from 'express';
import { Logger } from 'winston';
import { DomainException } from '../../domain/domain-exception';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  catch(exception: DomainException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    this.logger.warn('domain_exception', {
      requestId: request.requestId,
      exceptionName: exception.name,
      message: exception.message,
      statusCode: exception.statusCode,
    });

    response.status(exception.statusCode).json({
      statusCode: exception.statusCode,
      error: exception.name,
      message: exception.message,
    });
  }
}
```

---

## Step 7 — Shared Module

Expose `LoggerModule`, `RequestIdMiddleware`, and `LoggingInterceptor` from a barrel module.

**File:** `src/shared/shared.module.ts`

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { LoggerModule } from './infrastructure/logger/logger.module';
import { RequestIdMiddleware } from './infrastructure/middleware/request-id.middleware';
import { LoggingInterceptor } from './infrastructure/interceptors/logging.interceptor';
import { DomainExceptionFilter } from './infrastructure/filters/domain-exception.filter';

@Module({
  imports: [LoggerModule],
  providers: [
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class SharedModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

---

## Step 8 — Update AppModule

**File:** `src/app.module.ts` (replace entire file)

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { CustomerModule } from './customer/customer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedModule,
    CustomerModule,
  ],
})
export class AppModule {}
```

> `APP_FILTER`, `APP_INTERCEPTOR`, and `APP_PIPE` are now all owned by `SharedModule`.

---

## Step 9 — Update main.ts

Replace the bootstrap `console.log` with the Winston instance so startup logs are also structured JSON.

**File:** `src/main.ts` (replace entire file)

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');

  await app.listen(port);
}

bootstrap();
```

> `bufferLogs: true` holds NestJS bootstrap logs in memory until the Winston logger is ready, so no messages are lost and all use structured JSON.

---

## Final File Tree (new/modified files only)

```
src/
  shared/
    infrastructure/
      logger/
        logger.module.ts              ← NEW  (Step 3)
      middleware/
        request-id.middleware.ts      ← NEW  (Step 4)
      interceptors/
        logging.interceptor.ts        ← NEW  (Step 5)
      filters/
        domain-exception.filter.ts    ← MODIFY  (Step 6)
    shared.module.ts                  ← NEW  (Step 7)
  app.module.ts                       ← MODIFY  (Step 8)
  main.ts                             ← MODIFY  (Step 9)
.env.example                          ← MODIFY  (Step 2)
```

---

## Log Output Examples

**Successful request (JSON, production):**

```json
{
  "level": "info",
  "message": "http_request",
  "requestId": "b3d2e1f0-...",
  "method": "POST",
  "path": "/customers/register",
  "statusCode": 201,
  "durationMs": 43,
  "timestamp": "2026-05-13T10:00:00.000Z"
}
```

**Domain exception (JSON, production):**

```json
{
  "level": "warn",
  "message": "domain_exception",
  "requestId": "b3d2e1f0-...",
  "exceptionName": "EmailAlreadyTakenException",
  "statusCode": 409,
  "timestamp": "2026-05-13T10:00:01.000Z"
}
```
