import { DomainException } from '@shared/domain/domain-exception';

export class EmailAlreadyTakenException extends DomainException {
  constructor(email: string) {
    super(`Email '${email}' is already registered.`, 409);
    this.name = 'EmailAlreadyTakenException';
  }
}
