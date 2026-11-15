import { AppSettings, BankDetails, PaymentMethod } from './types';

export const LETTERHEAD_IMAGE_PATH = '/assets/aistudio/letterhead_updated_6f2c2306.jpg';

export const DEFAULT_QUOTATION_TERMS = `1. Validity: This quotation is valid for 7 days from the date of issue.
2. Order confirmation: We proceed once we receive the LPO (or written confirmation) against this quotation.
3. Payment: By bank transfer to Popeyee Stationery W.L.L. 50% advance with the LPO and the balance 50% after delivery.
4. Design approval: Production starts only after the client approves the design in writing. Changes after approval may affect price and delivery time.
5. Production & delivery: 2-3 working days after design approval and advance payment. Delivery is arranged on completion.
6. Cancellation & returns: All items are custom-made, so orders cannot be cancelled or returned after printing starts, except for a printing error on our side, which we will reprint or refund. Please report it within 48 hours of delivery.
7. Colors: Minor color differences between screen and print are normal and not a defect.
8. Prices: Prices are in BHD. Delivery charges, if applicable, are shown separately. Prices may change if the quantity or specifications change.`;

export const DEFAULT_INVOICE_TERMS = `1. Production starts after the LPO is received and the design is approved in writing.
2. Delivery will be arranged as soon as production is complete (4-5 working days after design approval).
3. Items are custom-made, so they cannot be returned or cancelled after printing starts, except for a printing error on our side.`;

export const QUOTATION_CLOSING_TEXT =
  'Hope the above information will fall in line with your requirements and if in case require any assistance please do mail or call us. Thanking you and look forward for your favorable order at the earliest.';

export const DEFAULT_BANK_DETAILS: BankDetails = {
  accountName: 'POPEYEE STATIONERY W.L.L',
  bankName: 'Al Salam Bank B.S.C.',
  accountNo: '276882100100',
  iban: 'BH70ALSA00276882100100',
  swift: 'ALSABHBM',
  currency: 'Bahraini Dinar',
};

export const DEFAULT_PAYMENT_NOTES: Record<PaymentMethod, string> = {
  'Bank Transfer': 'Please transfer the invoice amount to Popeyee Stationery W.L.L bank account below.',
  Cheque: 'Please issue cheque payable to Popeyee Stationery W.L.L.',
  Cash: 'Payment received / payable in cash in Bahraini Dinars (BHD).',
};

export function getDefaultSettings(): AppSettings {
  const currentYear = String(new Date().getFullYear());
  return {
    quotationTerms: DEFAULT_QUOTATION_TERMS,
    invoiceTerms: DEFAULT_INVOICE_TERMS,
    bankDetails: { ...DEFAULT_BANK_DETAILS },
    startingNumbers: {
      [currentYear]: {
        quotationStart: 1,
        invoiceStart: 1,
      },
    },
  };
}
