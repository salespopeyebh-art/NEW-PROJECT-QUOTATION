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

export function getCounterKey(type: DocumentType, year: string): string {
  return `counters/${type}-${year}`;
}

export function hasCounterKey(type: DocumentType, year: string): boolean {
  return localStorage.getItem(getCounterKey(type, year)) !== null;
}

function getCounterRecord(
  type: DocumentType,
  year: string
): { lastNumber: number; allowRepeatFromReset: boolean } {
  try {
    const raw = localStorage.getItem(getCounterKey(type, year));
    if (!raw) return { lastNumber: 0, allowRepeatFromReset: false };
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'number' && Number.isFinite(parsed)) {
      return { lastNumber: Math.max(0, Math.floor(parsed)), allowRepeatFromReset: false };
    }
    if (parsed && typeof parsed.lastNumber === 'number' && Number.isFinite(parsed.lastNumber)) {
      return {
        lastNumber: Math.max(0, Math.floor(parsed.lastNumber)),
        allowRepeatFromReset: Boolean(parsed.allowRepeatFromReset),
      };
    }
    return { lastNumber: 0, allowRepeatFromReset: false };
  } catch {
    return { lastNumber: 0, allowRepeatFromReset: false };
  }
}

export function getCounterValue(type: DocumentType, year: string): number {
  return getCounterRecord(type, year).lastNumber;
}

export function setCounterValue(
  type: DocumentType,
  year: string,
  lastNumber: number,
  allowRepeatFromReset = false
): void {
  const safeVal = Math.max(0, Math.floor(lastNumber));
  localStorage.setItem(
    getCounterKey(type, year),
    JSON.stringify({ lastNumber: safeVal, allowRepeatFromReset })
  );
}

export function getAllCounters(): Record<string, number> {
  const result: Record<string, number> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('counters/')) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (typeof parsed?.lastNumber === 'number') {
          result[key] = parsed.lastNumber;
        }
      } catch {
        // ignore malformed counter entries
      }
    }
  }
  return result;
}

export function restoreCounters(counters?: Record<string, number>): void {
  if (!counters || typeof counters !== 'object') return;
  for (const [key, value] of Object.entries(counters)) {
    if (key.startsWith('counters/') && typeof value === 'number' && Number.isFinite(value)) {
      localStorage.setItem(key, JSON.stringify({ lastNumber: Math.max(0, Math.floor(value)) }));
    }
  }
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

// Re-sync counters from existing documents on boot if counters haven't been initialized yet
export function syncCountersWithDocuments(documents: DocumentRecord[]): void {
  for (const doc of documents) {
    const match = /^(QT|INV)-(\d{4})-(\d+)$/i.exec(doc.number.trim());
    if (!match) continue;
    const prefix = match[1].toUpperCase();
    const year = match[2];
    const seq = parseInt(match[3], 10);
    const type: DocumentType = prefix === 'QT' ? 'quotation' : 'invoice';
    if (Number.isFinite(seq)) {
      const current = getCounterValue(type, year);
      if (seq > current) {
        setCounterValue(type, year, seq);
      }
    }
  }
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

export function computeNextFreeDocNumber(
  type: DocumentType,
  year: string,
  documents: DocumentRecord[],
  settings: AppSettings,
  excludeDocId?: string
): { number: string; seq: number } {
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

  const counterRec = getCounterRecord(type, year);
  const yearConfig = settings.startingNumbers[year];
  const configuredStart =
    type === 'quotation'
      ? yearConfig?.quotationStart ?? 1
      : yearConfig?.invoiceStart ?? 1;

  if (counterRec.allowRepeatFromReset) {
    const nextSeq = Math.max(counterRec.lastNumber + 1, 1);
    return {
      number: `${prefix}-${year}-${String(nextSeq).padStart(3, '0')}`,
      seq: nextSeq,
    };
  }

  let nextSeq = Math.max(counterRec.lastNumber + 1, maxInHistory + 1, configuredStart, 1);
  let candidate = `${prefix}-${year}-${String(nextSeq).padStart(3, '0')}`;

  // Guarantee candidate never collides with any existing document in history
  while (isNumberInUse(candidate, documents, excludeDocId)) {
    nextSeq += 1;
    candidate = `${prefix}-${year}-${String(nextSeq).padStart(3, '0')}`;
  }

  return { number: candidate, seq: nextSeq };
}

let transactionLock = false;

/**
 * Atomic transaction to save a document and advance counters/{type}-{year}
 * only when a document is saved for the first time.
 */
export function saveDocumentTransaction(
  docToSave: DocumentRecord,
  settings: AppSettings
): {
  savedDoc: DocumentRecord;
  allDocuments: DocumentRecord[];
  numberAdjustedFrom?: string;
} {
  if (transactionLock) {
    throw new Error('Another save is currently in progress. Please try again.');
  }
  transactionLock = true;

  try {
    // Always read the latest persisted documents and counters inside the transaction
    const currentDocs = loadDocuments();
    const existingIndex = currentDocs.findIndex((d) => d.id === docToSave.id);
    const isNewDocument = existingIndex === -1;

    const year = extractYearFromDate(docToSave.date);
    const prefix = getPrefix(docToSave.type);
    const seqPattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');

    let finalNumber = docToSave.number.trim();
    let numberAdjustedFrom: string | undefined;

    const counterRec = getCounterRecord(docToSave.type, year);
    const duplicate = isNumberInUse(finalNumber, currentDocs, docToSave.id);

    if (isNewDocument) {
      if (counterRec.allowRepeatFromReset && !docToSave.isManualNumber) {
        // Explicit counter reset was requested: use the reset counter sequence directly
        const { number: resetNext } = computeNextFreeDocNumber(
          docToSave.type,
          year,
          currentDocs,
          settings,
          docToSave.id
        );
        finalNumber = resetNext;
      } else if (!finalNumber || duplicate || !docToSave.isManualNumber) {
        const { number: nextFree } = computeNextFreeDocNumber(
          docToSave.type,
          year,
          currentDocs,
          settings,
          docToSave.id
        );
        if (duplicate || (finalNumber && finalNumber !== nextFree && !docToSave.isManualNumber)) {
          if (duplicate) {
            numberAdjustedFrom = finalNumber;
          }
          finalNumber = nextFree;
        } else if (!finalNumber) {
          finalNumber = nextFree;
        }
      }

      // Final safety check when not in explicit reset-repeat mode
      if (!counterRec.allowRepeatFromReset && isNumberInUse(finalNumber, currentDocs, docToSave.id)) {
        const { number: nextFree } = computeNextFreeDocNumber(
          docToSave.type,
          year,
          currentDocs,
          settings,
          docToSave.id
        );
        numberAdjustedFrom = finalNumber;
        finalNumber = nextFree;
      }

      // Advance the counter atomically in storage for this type and year
      const currentCounter = counterRec.lastNumber;
      const match = seqPattern.exec(finalNumber);
      if (match) {
        const parsedSeq = parseInt(match[1], 10);
        if (Number.isFinite(parsedSeq) && parsedSeq > currentCounter) {
          setCounterValue(docToSave.type, year, parsedSeq, counterRec.allowRepeatFromReset);
        }
      } else {
        setCounterValue(docToSave.type, year, currentCounter + 1, counterRec.allowRepeatFromReset);
      }
    } else {
      // Editing an existing document: keep its own number unless it collides with another doc
      if (!finalNumber || (!counterRec.allowRepeatFromReset && duplicate)) {
        const { number: nextFree } = computeNextFreeDocNumber(
          docToSave.type,
          year,
          currentDocs,
          settings,
          docToSave.id
        );
        if (duplicate) numberAdjustedFrom = finalNumber;
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
  } finally {
    transactionLock = false;
  }
}

export function resetCounterTransaction(
  type: DocumentType,
  year: string,
  nextStartNumber: number,
  currentSettings: AppSettings
): AppSettings {
  const safeNext = Math.max(1, Math.floor(nextStartNumber));
  setCounterValue(type, year, safeNext - 1, true);

  const prevYearCfg = currentSettings.startingNumbers[year] || {
    quotationStart: 1,
    invoiceStart: 1,
  };
  const nextSettings: AppSettings = {
    ...currentSettings,
    startingNumbers: {
      ...currentSettings.startingNumbers,
      [year]: {
        ...prevYearCfg,
        ...(type === 'quotation' ? { quotationStart: safeNext } : { invoiceStart: safeNext }),
      },
    },
  };
  saveSettings(nextSettings);
  return nextSettings;
}

export function deleteAllDataTransaction(currentSettings: AppSettings): AppSettings {
  saveDocuments([]);
  saveCustomers([]);

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('counters/')) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  const currentYear = String(new Date().getFullYear());
  setCounterValue('quotation', currentYear, 0, false);
  setCounterValue('invoice', currentYear, 0, false);

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
    version: 2,
    exportedAt: new Date().toISOString(),
    documents,
    customers,
    settings,
    counters: getAllCounters(),
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
  const counters: Record<string, number> | undefined =
    parsed.counters && typeof parsed.counters === 'object' ? parsed.counters : undefined;
  return {
    version: Number(parsed.version) || 1,
    exportedAt: String(parsed.exportedAt || new Date().toISOString()),
    documents,
    customers,
    settings,
    counters,
  };
}
