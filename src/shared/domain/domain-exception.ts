export class DomainException extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 422) {
    super(message);
    this.name = 'DomainException';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, DomainException.prototype);
  }
}
