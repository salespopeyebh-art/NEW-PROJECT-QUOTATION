import React, { useRef, useState } from 'react';
import { Check, Download, HardDrive, RotateCcw, Save, Upload } from 'lucide-react';
import {
  DEFAULT_BANK_DETAILS,
  DEFAULT_INVOICE_TERMS,
  DEFAULT_QUOTATION_TERMS,
} from '../constants';
import { AppSettings, DocumentRecord, ExportBackupData, SavedCustomer } from '../types';
import { buildExportData, parseImportData } from '../utils/storage';

interface SettingsViewProps {
  settings: AppSettings;
  documents: DocumentRecord[];
  customers: SavedCustomer[];
  onSaveSettings: (next: AppSettings) => void;
  onImportBackup: (data: ExportBackupData) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  documents,
  customers,
  onSaveSettings,
  onImportBackup,
}) => {
  const currentYear = String(new Date().getFullYear());
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [savedToast, setSavedToast] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    </div>
  );
};
