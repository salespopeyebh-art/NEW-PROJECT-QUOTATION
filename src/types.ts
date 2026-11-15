export type DocumentType = 'quotation' | 'invoice';

export type DocumentStatus = 'Draft' | 'Sent' | 'Accepted' | 'Paid';

export type PaymentMethod = 'Bank Transfer' | 'Cheque' | 'Cash';

export type InvoiceStamp = '' | 'PAID' | 'PARTIALLY PAID';

export interface CustomerInfo {
  company: string;
  attentionTo: string;
  mobile: string;
  telephone: string;
  email: string;
}

export interface SavedCustomer extends CustomerInfo {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  id: string;
  description: string;
  qty: string;
  size: string;
  unitPrice: string;
  totalPrice: string;
  manualTotal: boolean;
}

export interface DocumentRecord {
  id: string;
  type: DocumentType;
  number: string;
  isManualNumber: boolean;
  date: string; // DD-MM-YYYY
  customer: CustomerInfo;
  lpoNumber: string;
  lpoDate: string; // DD-MM-YYYY or empty
  items: LineItem[];
  totalAmount: number;
  terms: string;
  paymentMethod: PaymentMethod;
  paymentNote: string;
  stamp: InvoiceStamp;
  status: DocumentStatus;
  convertedFromQuotationNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankDetails {
  accountName: string;
  bankName: string;
  iban: string;
  currency: string;
}

export interface YearStartingNumbers {
  [year: string]: {
    quotationStart: number;
    invoiceStart: number;
  };
}

export interface AppSettings {
  quotationTerms: string;
  invoiceTerms: string;
  bankDetails: BankDetails;
  startingNumbers: YearStartingNumbers;
}

export interface ExportBackupData {
  version: number;
  exportedAt: string;
  documents: DocumentRecord[];
  customers: SavedCustomer[];
  settings: AppSettings;
  counters?: Record<string, number>;
}
