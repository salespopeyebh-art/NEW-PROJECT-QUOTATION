import { getDefaultSettings } from '../constants';
import { AppSettings, DocumentRecord, ExportBackupData, SavedCustomer } from '../types';

const KEYS = {
  DOCUMENTS: 'popeyee_documents_v1',
  CUSTOMERS: 'popeyee_customers_v1',
  SETTINGS: 'popeyee_settings_v1',
};

export function loadDocuments(): DocumentRecord[] {
  try {
    const raw = localStorage.getItem(KEYS.DOCUMENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDocuments(docs: DocumentRecord[]): void {
  localStorage.setItem(KEYS.DOCUMENTS, JSON.stringify(docs));
}

export function loadCustomers(): SavedCustomer[] {
  try {
    const raw = localStorage.getItem(KEYS.CUSTOMERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomers(customers: SavedCustomer[]): void {
  localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
}

export function loadSettings(): AppSettings {
  const defaults = getDefaultSettings();
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      quotationTerms:
        typeof parsed.quotationTerms === 'string' && parsed.quotationTerms.trim()
          ? parsed.quotationTerms
          : defaults.quotationTerms,
      invoiceTerms:
        typeof parsed.invoiceTerms === 'string' && parsed.invoiceTerms.trim()
          ? parsed.invoiceTerms
          : defaults.invoiceTerms,
      bankDetails: {
        ...defaults.bankDetails,
        ...(parsed.bankDetails || {}),
      },
      startingNumbers: {
        ...defaults.startingNumbers,
        ...(parsed.startingNumbers || {}),
      },
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export function buildExportData(
  documents: DocumentRecord[],
  customers: SavedCustomer[],
  settings: AppSettings
): ExportBackupData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    documents,
    customers,
    settings,
  };
}

export function parseImportData(jsonText: string): ExportBackupData {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup file format.');
  }
  const defaults = getDefaultSettings();
  const documents: DocumentRecord[] = Array.isArray(parsed.documents) ? parsed.documents : [];
  const customers: SavedCustomer[] = Array.isArray(parsed.customers) ? parsed.customers : [];
  const settings: AppSettings = {
    quotationTerms: parsed.settings?.quotationTerms || defaults.quotationTerms,
    invoiceTerms: parsed.settings?.invoiceTerms || defaults.invoiceTerms,
    bankDetails: {
      ...defaults.bankDetails,
      ...(parsed.settings?.bankDetails || {}),
    },
    startingNumbers: {
      ...defaults.startingNumbers,
      ...(parsed.settings?.startingNumbers || {}),
    },
  };
  return {
    version: Number(parsed.version) || 1,
    exportedAt: String(parsed.exportedAt || new Date().toISOString()),
    documents,
    customers,
    settings,
  };
}
