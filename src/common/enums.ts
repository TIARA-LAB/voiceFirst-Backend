import {
  PaymentMethod,
  StockMovementKind,
  TransactionIntent,
  TransactionSource,
} from '@prisma/client';

export type ApiIntent = 'sale' | 'purchase' | 'expense' | 'stock_in' | 'debt' | 'payment';
export type ApiPaymentMethod =
  | 'cash'
  | 'transfer'
  | 'pos'
  | 'credit'
  | 'partial'
  | 'unknown'
  | null;
export type ApiSource = 'voice' | 'manual' | 'whatsapp';

const INTENT_TO_DB: Record<ApiIntent, TransactionIntent> = {
  sale: TransactionIntent.SALE,
  purchase: TransactionIntent.PURCHASE,
  expense: TransactionIntent.EXPENSE,
  stock_in: TransactionIntent.STOCK_IN,
  debt: TransactionIntent.DEBT,
  payment: TransactionIntent.PAYMENT,
};

const INTENT_FROM_DB: Record<TransactionIntent, ApiIntent> = {
  SALE: 'sale',
  PURCHASE: 'purchase',
  EXPENSE: 'expense',
  STOCK_IN: 'stock_in',
  DEBT: 'debt',
  PAYMENT: 'payment',
};

const PAYMENT_TO_DB: Record<NonNullable<ApiPaymentMethod>, PaymentMethod> = {
  cash: PaymentMethod.CASH,
  transfer: PaymentMethod.TRANSFER,
  pos: PaymentMethod.POS,
  credit: PaymentMethod.CREDIT,
  partial: PaymentMethod.PARTIAL,
  unknown: PaymentMethod.UNKNOWN,
};

const PAYMENT_FROM_DB: Record<PaymentMethod, NonNullable<ApiPaymentMethod>> = {
  CASH: 'cash',
  TRANSFER: 'transfer',
  POS: 'pos',
  CREDIT: 'credit',
  PARTIAL: 'partial',
  UNKNOWN: 'unknown',
};

const SOURCE_TO_DB: Record<ApiSource, TransactionSource> = {
  voice: TransactionSource.VOICE,
  manual: TransactionSource.MANUAL,
  whatsapp: TransactionSource.WHATSAPP,
};

const SOURCE_FROM_DB: Record<TransactionSource, ApiSource> = {
  VOICE: 'voice',
  MANUAL: 'manual',
  WHATSAPP: 'whatsapp',
};

export const enumMap = {
  intentToDb: (value: ApiIntent): TransactionIntent => INTENT_TO_DB[value],
  intentFromDb: (value: TransactionIntent): ApiIntent => INTENT_FROM_DB[value],
  paymentToDb: (value: ApiPaymentMethod): PaymentMethod | null =>
    value ? PAYMENT_TO_DB[value] : null,
  paymentFromDb: (value: PaymentMethod | null): ApiPaymentMethod =>
    value ? PAYMENT_FROM_DB[value] : null,
  sourceToDb: (value: ApiSource): TransactionSource => SOURCE_TO_DB[value],
  sourceFromDb: (value: TransactionSource): ApiSource => SOURCE_FROM_DB[value],
};

export const STOCK_MOVEMENT_FOR_INTENT: Record<ApiIntent, StockMovementKind | null> = {
  sale: StockMovementKind.SALE,
  purchase: StockMovementKind.PURCHASE,
  stock_in: StockMovementKind.STOCK_IN,
  expense: null,
  debt: null,
  payment: null,
};

export const API_INTENT_VALUES = [
  'sale',
  'purchase',
  'expense',
  'stock_in',
  'debt',
  'payment',
] as const satisfies readonly ApiIntent[];

export const API_PAYMENT_VALUES = [
  'cash',
  'transfer',
  'pos',
  'credit',
  'partial',
  'unknown',
] as const satisfies readonly NonNullable<ApiPaymentMethod>[];