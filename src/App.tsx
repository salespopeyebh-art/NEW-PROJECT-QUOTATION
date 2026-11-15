import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FilePlus2, HardDrive, X } from 'lucide-react';
import { CustomersView } from './components/CustomersView';
import { DocumentEditor } from './components/DocumentEditor';
import { HistoryView } from './components/HistoryView';
import { ResetNumberingModal, ResetNumberingScope } from './components/ResetNumberingModal';
import { SettingsView } from './components/SettingsView';
import { DEFAULT_PAYMENT_NOTES } from './constants';
import {
  AppSettings,
  CustomerInfo,
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  ExportBackupData,
  SavedCustomer,
} from './types';
import {
  calculateGrandTotal,
  createEmptyLineItem,
  extractYearFromDDMMYYYY,
  formatTodayDDMMYYYY,
  generateNextDocNumber,
} from './utils/formatting';
import { generateDocumentPdf } from './utils/pdfGenerator';
import {
  computeNextNumberFromDocuments,
  deleteAllCustomersStorage,
  deleteAllDocumentsStorage,
  factoryResetStorage,
  loadCustomers,
  loadDocuments,
  loadSettings,
  purgeLegacyCounters,
  resetDocumentsByDateRange,
  saveCustomers,
  saveDocumentRecord,
  saveDocuments,
  saveSettings,
} from './utils/storage';

type ActiveTab = 'create' | 'history' | 'customers' | 'settings';

function createFreshDocument(
  type: DocumentType,
  documents: DocumentRecord[],
  settings: AppSettings,
  customer?: CustomerInfo
): DocumentRecord {
  const date = formatTodayDDMMYYYY();
  const year = extractYearFromDDMMYYYY(date);
  const nowIso = new Date().toISOString();

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    number: generateNextDocNumber(type, year, documents, settings),
    isManualNumber: false,
    date,
    customer: customer
      ? {
          company: customer.company,
          attentionTo: customer.attentionTo,
          mobile: customer.mobile,
          telephone: customer.telephone,
          email: customer.email,
        }
      : {
          company: '',
          attentionTo: '',
          mobile: '',
          telephone: '',
          email: '',
        },
    lpoNumber: '',
    lpoDate: '',
    items: [createEmptyLineItem()],
    totalAmount: 0,
    terms: type === 'quotation' ? settings.quotationTerms : settings.invoiceTerms,
    paymentMethod: 'Bank Transfer',
    paymentNote: DEFAULT_PAYMENT_NOTES['Bank Transfer'],
    stamp: '',
    status: 'Draft',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    purgeLegacyCounters();
    return loadSettings();
  });
  const [documents, setDocuments] = useState<DocumentRecord[]>(() => {
    purgeLegacyCounters();
    return loadDocuments();
  });
  const [customers, setCustomers] = useState<SavedCustomer[]>(() => loadCustomers());
  const [activeTab, setActiveTab] = useState<ActiveTab>('create');
  const [activeDoc, setActiveDoc] = useState<DocumentRecord>(() => {
    purgeLegacyCounters();
    const docs = loadDocuments();
    const cfg = loadSettings();
    return createFreshDocument('quotation', docs, cfg);
  });
  const [toast, setToast] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const [showStorageBanner, setShowStorageBanner] = useState(true);
  const [resetNumberingModalOpen, setResetNumberingModalOpen] = useState(false);

  const showToast = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    setToast({ text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const upsertCustomerFromInfo = useCallback(
    (info: CustomerInfo) => {
      const companyKey = info.company.trim().toLowerCase();
      if (!companyKey) return;
      const nowIso = new Date().toISOString();
      setCustomers((prev) => {
        const existingIdx = prev.findIndex((c) => c.company.trim().toLowerCase() === companyKey);
        let next: SavedCustomer[];
        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          const merged: SavedCustomer = {
            ...existing,
            company: info.company.trim(),
            attentionTo: info.attentionTo.trim() || existing.attentionTo,
            mobile: info.mobile.trim() || existing.mobile,
            telephone: info.telephone.trim() || existing.telephone,
            email: info.email.trim() || existing.email,
            updatedAt: nowIso,
          };
          next = [...prev];
          next[existingIdx] = merged;
        } else {
          const created: SavedCustomer = {
            id: crypto.randomUUID ? crypto.randomUUID() : `cust-${Date.now()}`,
            company: info.company.trim(),
            attentionTo: info.attentionTo.trim(),
            mobile: info.mobile.trim(),
            telephone: info.telephone.trim(),
            email: info.email.trim(),
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          next = [created, ...prev];
        }
        saveCustomers(next);
        return next;
      });
    },
    []
  );

  const handleSaveDoc = useCallback(
    (docToSave: DocumentRecord): DocumentRecord => {
      const nowIso = new Date().toISOString();
      const computedTotal = calculateGrandTotal(docToSave.items);
      const normalized: DocumentRecord = {
        ...docToSave,
        totalAmount: computedTotal,
        updatedAt: nowIso,
      };

      const { savedDoc, allDocuments, numberAdjustedFrom } = saveDocumentRecord(normalized);

      setDocuments(allDocuments);
      setActiveDoc(savedDoc);

      if (savedDoc.customer.company.trim()) {
        upsertCustomerFromInfo(savedDoc.customer);
      }

      if (numberAdjustedFrom) {
        showToast(
          `Number ${numberAdjustedFrom} already existed — saved as ${savedDoc.number}.`
        );
      } else {
        showToast(
          `${savedDoc.type === 'quotation' ? 'Quotation' : 'Invoice'} ${savedDoc.number} saved.`
        );
      }
      return savedDoc;
    },
    [showToast, upsertCustomerFromInfo]
  );

  const handleDownloadPdf = useCallback(
    async (docToDownload: DocumentRecord) => {
      try {
        await generateDocumentPdf(docToDownload, settings.bankDetails);
        showToast(`PDF downloaded for ${docToDownload.number}.`);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Failed to generate PDF.',
          'error'
        );
      }
    },
    [settings.bankDetails, showToast]
  );

  const handleNewBlank = useCallback(
    (type: DocumentType) => {
      const latestDocs = loadDocuments();
      const latestSettings = loadSettings();
      const fresh = createFreshDocument(type, latestDocs, latestSettings);
      setActiveDoc(fresh);
      setActiveTab('create');
    },
    []
  );

  const handleOpenDoc = useCallback((doc: DocumentRecord) => {
    setActiveDoc({ ...doc, items: doc.items.map((i) => ({ ...i })) });
    setActiveTab('create');
  }, []);

  const handleDuplicateDoc = useCallback(
    (source: DocumentRecord) => {
      const latestDocs = loadDocuments();
      const latestSettings = loadSettings();
      const date = formatTodayDDMMYYYY();
      const year = extractYearFromDDMMYYYY(date);
      const nowIso = new Date().toISOString();
      const cloned: DocumentRecord = {
        ...source,
        id: crypto.randomUUID ? crypto.randomUUID() : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        number: generateNextDocNumber(source.type, year, latestDocs, latestSettings),
        isManualNumber: false,
        date,
        status: 'Draft',
        stamp: '',
        convertedFromQuotationNumber: undefined,
        items: source.items.map((item) => ({
          ...item,
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        })),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setActiveDoc(cloned);
      setActiveTab('create');
      showToast(`Duplicated as ${cloned.number}. Review and save when ready.`);
    },
    [showToast]
  );

  const handleConvertToInvoice = useCallback(
    (quotation: DocumentRecord) => {
      const latestDocs = loadDocuments();
      const latestSettings = loadSettings();
      const date = formatTodayDDMMYYYY();
      const year = extractYearFromDDMMYYYY(date);
      const nowIso = new Date().toISOString();
      const nextInvNum = generateNextDocNumber('invoice', year, latestDocs, latestSettings);

      const draftInvoice: DocumentRecord = {
        id: crypto.randomUUID ? crypto.randomUUID() : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'invoice',
        number: nextInvNum,
        isManualNumber: false,
        date,
        customer: {
          company: quotation.customer.company,
          attentionTo: quotation.customer.attentionTo,
          mobile: quotation.customer.mobile,
          telephone: quotation.customer.telephone,
          email: quotation.customer.email,
        },
        lpoNumber: quotation.lpoNumber,
        lpoDate: quotation.lpoDate,
        items: quotation.items.map((item) => ({
          ...item,
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        })),
        totalAmount: calculateGrandTotal(quotation.items),
        terms: latestSettings.invoiceTerms,
        paymentMethod: 'Bank Transfer',
        paymentNote: DEFAULT_PAYMENT_NOTES['Bank Transfer'],
        stamp: '',
        status: 'Draft',
        convertedFromQuotationNumber: quotation.number,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const { savedDoc, allDocuments } = saveDocumentRecord(draftInvoice);
      setDocuments(allDocuments);
      setActiveDoc(savedDoc);
      setActiveTab('create');
      showToast(`Converted ${quotation.number} to Invoice ${savedDoc.number}.`);
    },
    [showToast]
  );

  const handleDeleteDoc = useCallback(
    (id: string) => {
      const latestDocs = loadDocuments().filter((d) => d.id !== id);
      saveDocuments(latestDocs);
      setDocuments(latestDocs);

      // Refresh unsaved draft number immediately when a document is deleted
      setActiveDoc((prev) => {
        const isStillSaved = latestDocs.some((d) => d.id === prev.id);
        if (isStillSaved || prev.isManualNumber) return prev;
        const year = extractYearFromDDMMYYYY(prev.date);
        return {
          ...prev,
          number: generateNextDocNumber(prev.type, year, latestDocs),
        };
      });

      showToast('Document deleted.');
    },
    [showToast]
  );

  const handleUpdateDocStatus = useCallback(
    (id: string, status: DocumentStatus) => {
      setDocuments((prev) => {
        const next = prev.map((d) =>
          d.id === id ? { ...d, status, updatedAt: new Date().toISOString() } : d
        );
        saveDocuments(next);
        return next;
      });
      if (activeDoc.id === id) {
        setActiveDoc((prev) => ({ ...prev, status }));
      }
      showToast(`Status updated to ${status}.`);
    },
    [activeDoc.id, showToast]
  );

  const handleSaveCustomer = useCallback(
    (custData: Omit<SavedCustomer, 'createdAt' | 'updatedAt'>) => {
      const nowIso = new Date().toISOString();
      setCustomers((prev) => {
        const idx = prev.findIndex((c) => c.id === custData.id);
        let next: SavedCustomer[];
        if (idx >= 0) {
          next = [...prev];
          next[idx] = { ...prev[idx], ...custData, updatedAt: nowIso };
        } else {
          next = [{ ...custData, createdAt: nowIso, updatedAt: nowIso }, ...prev];
        }
        saveCustomers(next);
        return next;
      });
      showToast(`Customer "${custData.company}" saved.`);
    },
    [showToast]
  );

  const handleDeleteCustomer = useCallback(
    (id: string) => {
      setCustomers((prev) => {
        const next = prev.filter((c) => c.id !== id);
        saveCustomers(next);
        return next;
      });
      showToast('Customer deleted.');
    },
    [showToast]
  );

  const handleCreateDocForCustomer = useCallback(
    (customer: CustomerInfo, type: DocumentType) => {
      const latestDocs = loadDocuments();
      const latestSettings = loadSettings();
      const fresh = createFreshDocument(type, latestDocs, latestSettings, customer);
      setActiveDoc(fresh);
      setActiveTab('create');
    },
    []
  );

  const handleSaveSettings = useCallback(
    (nextSettings: AppSettings) => {
      setSettings(nextSettings);
      saveSettings(nextSettings);
      showToast('Settings saved.');
    },
    [showToast]
  );

  const handleImportBackup = useCallback(
    (data: ExportBackupData) => {
      purgeLegacyCounters();
      setDocuments(data.documents);
      setCustomers(data.customers);
      setSettings(data.settings);
      saveDocuments(data.documents);
      saveCustomers(data.customers);
      saveSettings(data.settings);
      setActiveDoc((prev) => {
        const isExisting = data.documents.some((d) => d.id === prev.id);
        if (isExisting) return prev;
        return createFreshDocument(prev.type, data.documents, data.settings);
      });
      showToast('Backup restored successfully.');
    },
    [showToast]
  );

  const handleConfirmResetNumbering = useCallback(
    (scope: ResetNumberingScope, year: string, month: string, day: string) => {
      const { deletedDocs, remainingDocs, nextQuotationNumber, nextInvoiceNumber } =
        resetDocumentsByDateRange(scope, year, month, day);

      const latestSettings = loadSettings();
      const prevYearCfg = latestSettings.startingNumbers[year] || {
        quotationStart: 1,
        invoiceStart: 1,
      };
      const updatedSettings: AppSettings = {
        ...latestSettings,
        startingNumbers: {
          ...latestSettings.startingNumbers,
          [year]: {
            quotationStart:
              scope === 'quotation' || scope === 'both' ? 1 : prevYearCfg.quotationStart,
            invoiceStart:
              scope === 'invoice' || scope === 'both' ? 1 : prevYearCfg.invoiceStart,
          },
        },
      };
      saveSettings(updatedSettings);
      setSettings(updatedSettings);
      setDocuments(remainingDocs);
      setCustomers(loadCustomers());

      const deletedIds = new Set(deletedDocs.map((d) => d.id));
      setActiveDoc((prev) => {
        if (deletedIds.has(prev.id)) {
          return createFreshDocument(prev.type, remainingDocs, updatedSettings);
        }
        const isStillSaved = remainingDocs.some((d) => d.id === prev.id);
        if (!isStillSaved && !prev.isManualNumber) {
          const prevYear = extractYearFromDDMMYYYY(prev.date);
          return {
            ...prev,
            number: computeNextNumberFromDocuments(prev.type, prevYear, remainingDocs),
          };
        }
        return prev;
      });

      const nextLabel =
        scope === 'both'
          ? `${nextQuotationNumber} and ${nextInvoiceNumber}`
          : scope === 'quotation'
          ? nextQuotationNumber
          : nextInvoiceNumber;
      showToast(
        `Deleted ${deletedDocs.length} document${deletedDocs.length === 1 ? '' : 's'}. Next number: ${nextLabel}.`
      );
    },
    [showToast]
  );

  const handleDeleteAllDocuments = useCallback(() => {
    deleteAllDocumentsStorage();
    setDocuments([]);
    const latestSettings = loadSettings();
    setActiveDoc((prev) => createFreshDocument(prev.type, [], latestSettings));
    showToast('All saved quotations and invoices deleted. Numbering reset to 001.');
  }, [showToast]);

  const handleDeleteAllCustomers = useCallback(() => {
    deleteAllCustomersStorage();
    setCustomers([]);
    showToast('All saved customers deleted.');
  }, [showToast]);

  const handleFactoryReset = useCallback(() => {
    const latestSettings = loadSettings();
    const updatedSettings = factoryResetStorage(latestSettings);
    setDocuments([]);
    setCustomers([]);
    setSettings(updatedSettings);
    setActiveDoc((prev) => createFreshDocument(prev.type, [], updatedSettings));
    showToast('Factory reset complete. Documents and customers cleared; terms and bank details preserved.');
  }, [showToast]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FB] text-[#1A1A2E]">
      {/* Top Navigation Bar (3-zone contract) */}
      <header className="bg-[#1A1A2E] text-white border-b border-white/10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Title (single line) */}
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Popeyee Stationery
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'create'
                  ? 'text-white border-[#4CAF50]'
                  : 'text-slate-300 border-transparent hover:text-white'
              }`}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'history'
                  ? 'text-white border-[#4CAF50]'
                  : 'text-slate-300 border-transparent hover:text-white'
              }`}
            >
              History ({documents.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'customers'
                  ? 'text-white border-[#4CAF50]'
                  : 'text-slate-300 border-transparent hover:text-white'
              }`}
            >
              Customers ({customers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                activeTab === 'settings'
                  ? 'text-white border-[#4CAF50]'
                  : 'text-slate-300 border-transparent hover:text-white'
              }`}
            >
              Settings
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handleNewBlank(activeDoc.type)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#4CAF50] text-white text-xs sm:text-sm font-semibold hover:bg-[#43A047] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4" />
              New Document
            </button>
          </div>
        </div>

        {/* Mobile Compact Nav Row */}
        <nav className="flex md:hidden border-t border-white/10 px-2 overflow-x-auto">
          {(
            [
              { id: 'create', label: 'Create' },
              { id: 'history', label: `History (${documents.length})` },
              { id: 'customers', label: `Customers (${customers.length})` },
              { id: 'settings', label: 'Settings' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'text-white border-[#4CAF50]'
                  : 'text-slate-300 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Clear Storage Status Banner (LocalStorage notice until Firebase is configured) */}
      {showStorageBanner && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-center gap-2 min-w-0">
              <HardDrive className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="truncate sm:whitespace-normal">
                <strong>Local Browser Storage Active:</strong> Firebase cloud sync is not configured yet, so data is saved in this browser&apos;s localStorage. Export JSON backups in{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="underline font-semibold text-[#1565C0] cursor-pointer"
                >
                  Settings
                </button>
                .
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowStorageBanner(false)}
              aria-label="Dismiss storage notice"
              className="p-1 text-amber-700 hover:text-amber-950 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 sm:py-6">
        {activeTab === 'create' && (
          <DocumentEditor
            doc={activeDoc}
            allDocuments={documents}
            customers={customers}
            settings={settings}
            onChangeDoc={setActiveDoc}
            onSaveDoc={handleSaveDoc}
            onDownloadPdf={handleDownloadPdf}
            onNewBlank={handleNewBlank}
            onQuickSaveCustomer={upsertCustomerFromInfo}
            onOpenResetNumbering={() => setResetNumberingModalOpen(true)}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            documents={documents}
            onOpenDoc={handleOpenDoc}
            onDuplicateDoc={handleDuplicateDoc}
            onConvertToInvoice={handleConvertToInvoice}
            onDeleteDoc={handleDeleteDoc}
            onDownloadPdf={handleDownloadPdf}
            onUpdateStatus={handleUpdateDocStatus}
            onCreateNew={handleNewBlank}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            customers={customers}
            documents={documents}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onCreateDocumentForCustomer={handleCreateDocForCustomer}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            documents={documents}
            customers={customers}
            onSaveSettings={handleSaveSettings}
            onImportBackup={handleImportBackup}
            onOpenResetNumbering={() => setResetNumberingModalOpen(true)}
            onDeleteAllDocuments={handleDeleteAllDocuments}
            onDeleteAllCustomers={handleDeleteAllCustomers}
            onFactoryReset={handleFactoryReset}
          />
        )}
      </main>

      <ResetNumberingModal
        isOpen={resetNumberingModalOpen}
        defaultScope={activeTab === 'create' ? activeDoc.type : 'both'}
        year={extractYearFromDDMMYYYY(activeDoc.date)}
        documents={documents}
        onClose={() => setResetNumberingModalOpen(false)}
        onConfirm={handleConfirmResetNumbering}
      />

      {/* Non-blocking Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${
              toast.tone === 'error' ? 'bg-[#FF5722]' : 'bg-[#1A1A2E]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-[#4CAF50] shrink-0" />
            <span>{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
