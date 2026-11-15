import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  HardDrive,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DEFAULT_BANK_DETAILS,
  DEFAULT_INVOICE_TERMS,
  DEFAULT_QUOTATION_TERMS,
} from '../constants';
import {
  AppSettings,
  DocumentRecord,
  DocumentType,
  ExportBackupData,
  SavedCustomer,
} from '../types';
import { buildExportData, parseImportData } from '../utils/storage';

interface SettingsViewProps {
  settings: AppSettings;
  documents: DocumentRecord[];
  customers: SavedCustomer[];
  onSaveSettings: (next: AppSettings) => void;
  onImportBackup: (data: ExportBackupData) => void;
  onResetNumbering: (type: DocumentType, year: string, nextNumber: number) => void;
  onDeleteAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  documents,
  customers,
  onSaveSettings,
  onImportBackup,
  onResetNumbering,
  onDeleteAllData,
}) => {
  const currentYear = String(new Date().getFullYear());
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [savedToast, setSavedToast] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset Numbering state
  const [resetType, setResetType] = useState<DocumentType>('quotation');
  const [resetYear, setResetYear] = useState<string>(currentYear);
  const [resetNextNum, setResetNextNum] = useState<number>(1);
  const [showResetNumberModal, setShowResetNumberModal] = useState(false);

  // Delete All Data state
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const conflictingDocs = useMemo(() => {
    const prefix = resetType === 'quotation' ? 'QT' : 'INV';
    const pattern = new RegExp(`^${prefix}-${resetYear}-(\\d+)$`, 'i');
    return documents.filter((d) => {
      if (d.type !== resetType) return false;
      const match = pattern.exec(d.number.trim());
      if (!match) return false;
      const seq = parseInt(match[1], 10);
      return Number.isFinite(seq) && seq >= resetNextNum;
    });
  }, [documents, resetType, resetYear, resetNextNum]);

  const resetPreviewCode = `${resetType === 'quotation' ? 'QT' : 'INV'}-${resetYear}-${String(
    Math.max(1, resetNextNum)
  ).padStart(3, '0')}`;

  const yearConfig = draft.startingNumbers[selectedYear] || {
    quotationStart: 1,
    invoiceStart: 1,
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(draft);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleExport = () => {
    const payload = buildExportData(documents, customers, settings);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `Popeyee_Stationery_Backup_${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseImportData(text);
      onImportBackup(parsed);
      setDraft(parsed.settings);
      setImportMessage({
        type: 'ok',
        text: `Imported ${parsed.documents.length} documents and ${parsed.customers.length} customers.`,
      });
    } catch (err) {
      setImportMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to import backup JSON.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A2E] tracking-tight">Settings &amp; Backup</h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure default terms, starting document numbers, bank details, and JSON backups.
        </p>
      </div>

      {/* Clear Storage Status Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <HardDrive className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-950 space-y-1">
          <div className="font-bold">Temporary Browser Storage (localStorage) Active</div>
          <p className="text-xs leading-relaxed text-amber-900">
            Firebase cloud sync is not configured yet, so your quotations, invoices, customers, and settings are currently saved safely inside this browser&apos;s localStorage. Use <strong>Export All Data</strong> below regularly to keep a backup or transfer data to another computer or phone.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Starting Numbers */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#1A1A2E]">Document Starting Numbers</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Counters automatically restart at 001 each new year, or start from your number below.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">Year:</label>
              <input
                type="number"
                min={2020}
                max={2099}
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono-num font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Quotation Starting Number ({selectedYear})
              </label>
              <input
                type="number"
                min={1}
                value={yearConfig.quotationStart}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    startingNumbers: {
                      ...draft.startingNumbers,
                      [selectedYear]: {
                        ...yearConfig,
                        quotationStart: Math.max(1, parseInt(e.target.value || '1', 10)),
                      },
                    },
                  })
                }
                className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num"
              />
              <div className="text-[11px] text-slate-500 mt-1">
                Example: QT-{selectedYear}-{String(yearConfig.quotationStart).padStart(3, '0')}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Invoice Starting Number ({selectedYear})
              </label>
              <input
                type="number"
                min={1}
                value={yearConfig.invoiceStart}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    startingNumbers: {
                      ...draft.startingNumbers,
                      [selectedYear]: {
                        ...yearConfig,
                        invoiceStart: Math.max(1, parseInt(e.target.value || '1', 10)),
                      },
                    },
                  })
                }
                className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num"
              />
              <div className="text-[11px] text-slate-500 mt-1">
                Example: INV-{selectedYear}-{String(yearConfig.invoiceStart).padStart(3, '0')}
              </div>
            </div>
          </div>
        </section>

        {/* Bank Details */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#1A1A2E]">Invoice Bank Details</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Printed inside the Bank Details box on every Invoice PDF.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, bankDetails: { ...DEFAULT_BANK_DETAILS } })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#1565C0] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Default
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Account Name
              </label>
              <input
                type="text"
                value={draft.bankDetails.accountName}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    bankDetails: { ...draft.bankDetails, accountName: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bank</label>
              <input
                type="text"
                value={draft.bankDetails.bankName}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    bankDetails: { ...draft.bankDetails, bankName: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Account No
              </label>
              <input
                type="text"
                value={draft.bankDetails.accountNo}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    bankDetails: { ...draft.bankDetails, accountNo: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">IBAN</label>
              <input
                type="text"
                value={draft.bankDetails.iban}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    bankDetails: { ...draft.bankDetails, iban: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">SWIFT</label>
              <input
                type="text"
                value={draft.bankDetails.swift}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    bankDetails: { ...draft.bankDetails, swift: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Currency</label>
              <input
                type="text"
                value={draft.bankDetails.currency}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    bankDetails: { ...draft.bankDetails, currency: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </section>

        {/* Default Terms */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-bold text-[#1A1A2E]">
                Default Quotation Terms &amp; Conditions
              </label>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, quotationTerms: DEFAULT_QUOTATION_TERMS })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#1565C0] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Default
              </button>
            </div>
            <textarea
              rows={9}
              value={draft.quotationTerms}
              onChange={(e) => setDraft({ ...draft, quotationTerms: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-xs leading-relaxed"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-bold text-[#1A1A2E]">
                Default Invoice Terms &amp; Conditions
              </label>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, invoiceTerms: DEFAULT_INVOICE_TERMS })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#1565C0] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Default
              </button>
            </div>
            <textarea
              rows={5}
              value={draft.invoiceTerms}
              onChange={(e) => setDraft({ ...draft, invoiceTerms: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-xs leading-relaxed"
            />
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-[#4CAF50] text-white text-sm font-semibold hover:bg-[#43A047] transition-colors cursor-pointer"
          >
            {savedToast ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedToast ? 'Settings Saved' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Backup Export & Import */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#1A1A2E]">Backup &amp; Restore</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Download all quotations, invoices, customers, and settings as a single JSON file, or restore from a previous backup.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1254A1] transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export All Data (JSON)
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl border border-slate-300 bg-white text-[#1A1A2E] text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Import Data (JSON)
          </button>
        </div>

        {importMessage && (
          <div
            className={`p-3 rounded-lg text-xs font-medium ${
              importMessage.type === 'ok'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {importMessage.text}
          </div>
        )}
      </section>

      {/* Reset Data Section */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
        <div>
          <h2 className="text-base font-bold text-[#1A1A2E]">Reset Data</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Reset quotation/invoice counters or clear all saved records. Your saved Terms &amp; Conditions, Bank Details, and Letterhead are never removed.
          </p>
        </div>

        {/* 1. Reset Numbering */}
        <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-[#1A1A2E]">1. Reset Numbering</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Choose Quotation or Invoice, the year, and the next number to start from.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Document Type
              </label>
              <select
                value={resetType}
                onChange={(e) => setResetType(e.target.value as DocumentType)}
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-slate-200 rounded-lg text-sm font-medium text-[#1A1A2E]"
              >
                <option value="quotation">Quotation</option>
                <option value="invoice">Invoice</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Year</label>
              <input
                type="number"
                min={2020}
                max={2099}
                value={resetYear}
                onChange={(e) => setResetYear(e.target.value)}
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-slate-200 rounded-lg text-sm font-mono-num font-semibold text-[#1A1A2E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Next Number to Start From
              </label>
              <input
                type="number"
                min={1}
                value={resetNextNum}
                onChange={(e) =>
                  setResetNextNum(Math.max(1, parseInt(e.target.value || '1', 10)))
                }
                className="w-full px-3.5 py-2.5 min-h-[44px] bg-white border border-slate-200 rounded-lg text-sm font-mono-num font-semibold text-[#1A1A2E]"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <div className="text-xs text-slate-600">
              Next new document will be:{' '}
              <strong className="font-mono-num text-[#1A1A2E]">{resetPreviewCode}</strong>
            </div>

            <button
              type="button"
              onClick={() => setShowResetNumberModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1254A1] transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Numbering
            </button>
          </div>
        </div>

        {/* 2. Delete All Data */}
        <div className="border border-orange-200 rounded-xl p-4 bg-orange-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#1A1A2E]">2. Delete All Data</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Permanently deletes all saved quotations, invoices, and customers, and resets both counters back to zero (QT-{currentYear}-001 and INV-{currentYear}-001). Keeps your saved Terms &amp; Conditions, Bank Details, and Letterhead.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setDeleteConfirmText('');
              setShowDeleteAllModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#FF5722] text-white text-sm font-semibold hover:bg-[#E64A19] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete All Data
          </button>
        </div>
      </section>

      {/* Reset Numbering Confirmation Modal */}
      {showResetNumberModal && (
        <div className="fixed inset-0 z-50 bg-[#1A1A2E]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1A1A2E]">Confirm Reset Numbering</h3>
              <button
                type="button"
                onClick={() => setShowResetNumberModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-700">
              Set the <strong>{resetType === 'quotation' ? 'Quotation' : 'Invoice'}</strong> counter for{' '}
              <strong className="font-mono-num">{resetYear}</strong> so the next new document starts at{' '}
              <strong className="font-mono-num text-[#1565C0]">{resetPreviewCode}</strong>?
            </p>

            {conflictingDocs.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Warning: Higher or matching documents exist</div>
                  <p className="mt-1 leading-relaxed">
                    You still have {conflictingDocs.length} saved{' '}
                    {resetType === 'quotation' ? 'quotation' : 'invoice'}
                    {conflictingDocs.length === 1 ? '' : 's'} in {resetYear} with number{' '}
                    <span className="font-mono-num font-semibold">{resetPreviewCode}</span> or higher.
                    Document numbers may repeat unless you delete those old documents first.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetNumberModal(false)}
                className="px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetNumbering(resetType, resetYear, resetNextNum);
                  setShowResetNumberModal(false);
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1254A1] cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Data Confirmation Modal (type DELETE) */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-[#1A1A2E]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1A1A2E]">Delete All Data?</h3>
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-950 space-y-1">
              <div className="font-bold">This action cannot be undone.</div>
              <p>
                This will permanently delete <strong>{documents.length}</strong> saved document
                {documents.length === 1 ? '' : 's'} and <strong>{customers.length}</strong> saved customer
                {customers.length === 1 ? '' : 's'}, and reset both counters back to zero. Your saved Terms &amp; Conditions, Bank Details, and Letterhead will NOT be changed.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Type <strong className="font-mono-num text-[#FF5722]">DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-300 rounded-lg text-sm font-mono-num font-semibold text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#FF5722]/25 focus:border-[#FF5722]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText.trim() !== 'DELETE'}
                onClick={() => {
                  onDeleteAllData();
                  setShowDeleteAllModal(false);
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#FF5722] text-white text-sm font-semibold hover:bg-[#E64A19] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Delete All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
