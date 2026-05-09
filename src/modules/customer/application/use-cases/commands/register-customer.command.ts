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
