export type PaymentProvider = 'creem' | 'fastspring';

export function getPaymentProvider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER === 'creem' ? 'creem' : 'fastspring';
}
