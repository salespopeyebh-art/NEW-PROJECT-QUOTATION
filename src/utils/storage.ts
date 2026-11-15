import { getDefaultSettings } from '../constants';
import {
  AppSettings,
  DocumentRecord,
  DocumentType,
  ExportBackupData,
  SavedCustomer,
} from '../types';

const KEYS = {
  DOCUMENTS: 'popeyee_documents_v1',
  CUSTOMERS: 'popeyee_customers_v1',
  SETTINGS: 'popeyee_settings_v1',
};

/**
 * Deletes any legacy separately saved counters from localStorage.
 * Document numbers are always calculated directly from real saved documents.
 */
export function purgeLegacyCounters(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('counters/') || key.includes('counter'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

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

function extractYearFromDate(ddmmyyyy: string): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(ddmmyyyy.trim());
  if (match) return match[3];
  return String(new Date().getFullYear());
}

function getPrefix(type: DocumentType): string {
  return type === 'quotation' ? 'QT' : 'INV';
}

export function isNumberInUse(
  candidateNumber: string,
  documents: DocumentRecord[],
  excludeDocId?: string
): DocumentRecord | undefined {
  const normalized = candidateNumber.trim().toLowerCase();
  if (!normalized) return undefined;
  return documents.find(
    (d) => d.id !== excludeDocId && d.number.trim().toLowerCase() === normalized
  );
}

/**
 * Calculates the next document number directly from real saved documents:
 * highest existing sequence number for (type, year) + 1, or 001 if none exists.
 */
export function computeNextNumberFromDocuments(
  type: DocumentType,
  year: string,
  documents: DocumentRecord[],
  excludeDocId?: string
): string {
  const prefix = getPrefix(type);
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');

  let maxInHistory = 0;
  for (const doc of documents) {
    if (excludeDocId && doc.id === excludeDocId) continue;
    if (doc.type !== type) continue;
    const match = pattern.exec(doc.number.trim());
    if (match) {
      const seq = parseInt(match[1], 10);
      if (Number.isFinite(seq) && seq > maxInHistory) {
        maxInHistory = seq;
      }
    }
  }

  let nextSeq = maxInHistory + 1; // 001 when maxInHistory === 0
  let candidate = `${prefix}-${year}-${String(nextSeq).padStart(3, '0')}`;

  while (isNumberInUse(candidate, documents, excludeDocId)) {
    nextSeq += 1;
    candidate = `${prefix}-${year}-${String(nextSeq).padStart(3, '0')}`;
  }

  return candidate;
}

/**
 * Saves a document and guarantees no two saved documents ever share the same number.
 */
export function saveDocumentRecord(docToSave: DocumentRecord): {
  savedDoc: DocumentRecord;
  allDocuments: DocumentRecord[];
  numberAdjustedFrom?: string;
} {
  purgeLegacyCounters();
  const currentDocs = loadDocuments();
  const existingIndex = currentDocs.findIndex((d) => d.id === docToSave.id);
  const isNewDocument = existingIndex === -1;

  const year = extractYearFromDate(docToSave.date);
  let finalNumber = docToSave.number.trim();
  let numberAdjustedFrom: string | undefined;

  const duplicate = isNumberInUse(finalNumber, currentDocs, docToSave.id);

  if (isNewDocument) {
    if (!finalNumber || duplicate || !docToSave.isManualNumber) {
      const nextFree = computeNextNumberFromDocuments(docToSave.type, year, currentDocs, docToSave.id);
      if (duplicate) {
        numberAdjustedFrom = finalNumber;
      }
      finalNumber = nextFree;
    }
  } else {
    if (!finalNumber || duplicate) {
      const nextFree = computeNextNumberFromDocuments(docToSave.type, year, currentDocs, docToSave.id);
      if (duplicate) {
        numberAdjustedFrom = finalNumber;
      }
      finalNumber = nextFree;
    }
  }

  const savedDoc: DocumentRecord = {
    ...docToSave,
    number: finalNumber,
  };

  const nextDocs =
    existingIndex >= 0
      ? currentDocs.map((d, idx) => (idx === existingIndex ? savedDoc : d))
      : [savedDoc, ...currentDocs];

  saveDocuments(nextDocs);

  return {
    savedDoc,
    allDocuments: nextDocs,
    numberAdjustedFrom,
  };
}

export type ResetNumberingScope = 'quotation' | 'invoice' | 'both';

export function parseDocumentDateParts(
  dateStr: string
): { day: string; month: string; year: string } | null {
  const trimmed = (dateStr || '').trim();
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (dmy) {
    return { day: dmy[1], month: dmy[2], year: dmy[3] };
  }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymd) {
    return { day: ymd[3], month: ymd[2], year: ymd[1] };
  }
  return null;
}

export function getDaysInMonth(year: number, month: number): number {
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return 31;
  }
  return new Date(year, month, 0).getDate();
}

function extractSequenceForTypeAndYear(
  doc: DocumentRecord,
  type: DocumentType,
  year: string
): number {
  if (doc.type !== type) return 0;
  const prefix = getPrefix(type);
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
  const match = pattern.exec(doc.number.trim());
  if (!match) return 0;
  const seq = parseInt(match[1], 10);
  return Number.isFinite(seq) ? seq : 0;
}

export function doesDocumentMatchDateRange(
  doc: DocumentRecord,
  scope: ResetNumberingScope,
  year: string,
  month: string,
  day: string
): boolean {
  const matchesType = scope === 'both' || doc.type === scope;
  if (!matchesType) return false;

  const parts = parseDocumentDateParts(doc.date);
  if (!parts) return false;

  if (parts.year !== year) return false;
  if (month !== 'all' && parts.month !== month) return false;
  if (month !== 'all' && day !== 'all' && parts.day !== day) return false;
  return true;
}

export interface DateRangeResetPreview {
  matchingDocs: DocumentRecord[];
  remainingDocs: DocumentRecord[];
  nextQuotationNumber: string;
  nextInvoiceNumber: string;
  hasHigherOutsideDocs: boolean;
}

export function previewDateRangeReset(
  documents: DocumentRecord[],
  scope: ResetNumberingScope,
  year: string,
  month: string,
  day: string
): DateRangeResetPreview {
  const matchingDocs: DocumentRecord[] = [];
  const remainingDocs: DocumentRecord[] = [];

  for (const doc of documents) {
    if (doesDocumentMatchDateRange(doc, scope, year, month, day)) {
      matchingDocs.push(doc);
    } else {
      remainingDocs.push(doc);
    }
  }

  const nextQuotationNumber = computeNextNumberFromDocuments('quotation', year, remainingDocs);
  const nextInvoiceNumber = computeNextNumberFromDocuments('invoice', year, remainingDocs);

  const targetTypes: DocumentType[] =
    scope === 'both' ? ['quotation', 'invoice'] : [scope];

  let hasHigherOutsideDocs = false;
  for (const t of targetTypes) {
    const deletedOfType = matchingDocs.filter((d) => d.type === t);
    if (deletedOfType.length === 0) continue;

    const maxDeletedSeq = Math.max(
      ...deletedOfType.map((d) => extractSequenceForTypeAndYear(d, t, year))
    );
    const maxRemainingSeq = remainingDocs.reduce((max, d) => {
      const seq = extractSequenceForTypeAndYear(d, t, year);
      return seq > max ? seq : max;
    }, 0);

    if (maxRemainingSeq > maxDeletedSeq) {
      hasHigherOutsideDocs = true;
      break;
    }
  }

  return {
    matchingDocs,
    remainingDocs,
    nextQuotationNumber,
    nextInvoiceNumber,
    hasHigherOutsideDocs,
  };
}

export function resetDocumentsByDateRange(
  scope: ResetNumberingScope,
  year: string,
  month: string,
  day: string
): {
  deletedDocs: DocumentRecord[];
  remainingDocs: DocumentRecord[];
  nextQuotationNumber: string;
  nextInvoiceNumber: string;
} {
  purgeLegacyCounters();
  const currentDocs = loadDocuments();
  const preview = previewDateRangeReset(currentDocs, scope, year, month, day);
  saveDocuments(preview.remainingDocs);
  return {
    deletedDocs: preview.matchingDocs,
    remainingDocs: preview.remainingDocs,
    nextQuotationNumber: preview.nextQuotationNumber,
    nextInvoiceNumber: preview.nextInvoiceNumber,
  };
}

export function deleteAllDocumentsStorage(): void {
  saveDocuments([]);
  purgeLegacyCounters();
}

export function deleteAllCustomersStorage(): void {
  saveCustomers([]);
}

export function factoryResetStorage(currentSettings: AppSettings): AppSettings {
  saveDocuments([]);
  saveCustomers([]);
  purgeLegacyCounters();

  const currentYear = String(new Date().getFullYear());
  // Preserve saved terms and bank details; reset starting numbers to 1
  const nextSettings: AppSettings = {
    ...currentSettings,
    startingNumbers: {
      [currentYear]: {
        quotationStart: 1,
        invoiceStart: 1,
      },
    },
  };
  saveSettings(nextSettings);
  return nextSettings;
}

export function buildExportData(
  documents: DocumentRecord[],
  customers: SavedCustomer[],
  settings: AppSettings
): ExportBackupData {
  return {
    version: 3,
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
