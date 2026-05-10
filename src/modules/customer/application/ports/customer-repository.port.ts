export const CUSTOMER_REPOSITORY = 'CUSTOMER_REPOSITORY';

export interface ICustomerRepository {
  existsByEmail(email: string): Promise<boolean>;
}
