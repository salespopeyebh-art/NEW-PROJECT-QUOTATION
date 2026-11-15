import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Search,
  Trash2,
} from 'lucide-react';
import { DocumentRecord, DocumentStatus, DocumentType } from '../types';
import { calculateGrandTotal, extractYearFromDDMMYYYY, formatBHD } from '../utils/formatting';

interface HistoryViewProps {
  documents: DocumentRecord[];
  onOpenDoc: (doc: DocumentRecord) => void;
  onDuplicateDoc: (doc: DocumentRecord) => void;
  onConvertToInvoice: (quotation: DocumentRecord) => void;
  onDeleteDoc: (id: string) => void;
  onDownloadPdf: (doc: DocumentRecord) => Promise<void>;
  onUpdateStatus: (id: string, status: DocumentStatus) => void;
  onCreateNew: (type: DocumentType) => void;
}

const STATUS_STYLES: Record<DocumentStatus, string> = {
  Draft: 'text-slate-700 bg-slate-100 border-slate-200',
  Sent: 'text-[#1565C0] bg-blue-50 border-blue-200',
  Accepted: 'text-[#2E7D32] bg-green-50 border-green-200',
  Paid: 'text-[#2E7D32] bg-emerald-50 border-emerald-200',
};

export const HistoryView: React.FC<HistoryViewProps> = ({
  documents,
  onOpenDoc,
  onDuplicateDoc,
  onConvertToInvoice,
  onDeleteDoc,
  onDownloadPdf,
  onUpdateStatus,
  onCreateNew,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | DocumentType>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const doc of documents) {
      years.add(extractYearFromDDMMYYYY(doc.date));
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [documents]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...documents]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .filter((doc) => {
        if (typeFilter !== 'all' && doc.type !== typeFilter) return false;
        if (yearFilter !== 'all' && extractYearFromDDMMYYYY(doc.date) !== yearFilter) return false;
        if (!q) return true;
        return (
          doc.number.toLowerCase().includes(q) ||
          doc.customer.company.toLowerCase().includes(q) ||
          doc.customer.attentionTo.toLowerCase().includes(q)
        );
      });
  }, [documents, searchQuery, typeFilter, yearFilter]);

  const handleDownload = async (doc: DocumentRecord) => {
    setDownloadingId(doc.id);
    try {
      await onDownloadPdf(doc);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E] tracking-tight">Document History</h1>
          <p className="text-sm text-slate-600 mt-1">
            Open, duplicate, download PDF, convert quotations to invoices, or update status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onCreateNew('quotation')}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1254A1] transition-colors whitespace-nowrap cursor-pointer"
          >
            + New Quotation
          </button>
          <button
            type="button"
            onClick={() => onCreateNew('invoice')}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#FF5722] text-white text-sm font-semibold hover:bg-[#E64A19] transition-colors whitespace-nowrap cursor-pointer"
          >
            + New Invoice
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name or document number (e.g. QT-2026-001)..."
            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            {(['all', 'quotation', 'invoice'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap cursor-pointer ${
                  typeFilter === t ? 'bg-white text-[#1A1A2E] shadow-xs' : 'text-slate-600'
                }`}
              >
                {t === 'all' ? 'All Types' : `${t}s`}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by year"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3.5 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
          >
            <option value="all">All Years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty State or Documents List */}
      {filteredDocs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#1A1A2E]">
            {documents.length === 0 ? 'No saved quotations or invoices yet' : 'No matching documents'}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {documents.length === 0
              ? 'Create and save your first Quotation or Invoice to see it listed here.'
              : 'Try clearing your search or changing the type/year filters.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3.5 px-4">Number</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4 text-right">Total (BD)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredDocs.map((doc) => {
                  const total = formatBHD(calculateGrandTotal(doc.items));
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono-num font-semibold text-[#1A1A2E] whitespace-nowrap">
                        <div>{doc.number}</div>
                        {doc.convertedFromQuotationNumber && (
                          <div className="text-[11px] font-sans font-normal text-slate-500 mt-0.5">
                            From {doc.convertedFromQuotationNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            doc.type === 'quotation' ? 'text-[#1565C0]' : 'text-[#FF5722]'
                          }`}
                        >
                          {doc.type === 'quotation' ? 'Quotation' : 'Invoice'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                        {doc.date}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#1A1A2E]">
                          {doc.customer.company || 'Unnamed Customer'}
                        </div>
                        {doc.customer.attentionTo && (
                          <div className="text-xs text-slate-500">{doc.customer.attentionTo}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-[#1A1A2E] whitespace-nowrap">
                        {total}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          aria-label={`Status for ${doc.number}`}
                          value={doc.status}
                          onChange={(e) =>
                            onUpdateStatus(doc.id, e.target.value as DocumentStatus)
                          }
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none cursor-pointer ${
                            STATUS_STYLES[doc.status]
                          }`}
                        >
                          <option value="Draft">Draft</option>
                          <option value="Sent">Sent</option>
                          <option value="Accepted">Accepted</option>
                          <option value="Paid">Paid</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenDoc(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#1A1A2E] hover:bg-slate-100 cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            Open
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1565C0]/10 text-[#1565C0] hover:bg-[#1565C0]/20 text-xs font-semibold cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>

                          {doc.type === 'quotation' && (
                            <button
                              type="button"
                              onClick={() => onConvertToInvoice(doc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#4CAF50]/10 text-[#2E7D32] hover:bg-[#4CAF50]/20 text-xs font-semibold cursor-pointer"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              Convert to Invoice
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onDuplicateDoc(doc)}
                            title="Duplicate"
                            className="p-2 rounded-lg text-slate-500 hover:text-[#1A1A2E] hover:bg-slate-100 cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(doc)}
                            title="Delete"
                            className="p-2 rounded-lg text-slate-500 hover:text-[#FF5722] hover:bg-orange-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / Tablet Cards */}
          <div className="lg:hidden space-y-3">
            {filteredDocs.map((doc) => {
              const total = formatBHD(calculateGrandTotal(doc.items));
              return (
                <div
                  key={doc.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`font-bold ${
                            doc.type === 'quotation' ? 'text-[#1565C0]' : 'text-[#FF5722]'
                          }`}
                        >
                          {doc.type === 'quotation' ? 'Quotation' : 'Invoice'}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="font-mono-num text-slate-500">{doc.date}</span>
                      </div>
                      <h3 className="text-base font-bold text-[#1A1A2E] font-mono-num mt-0.5">
                        {doc.number}
                      </h3>
                      <div className="text-sm font-semibold text-slate-800 mt-0.5">
                        {doc.customer.company || 'Unnamed Customer'}
                      </div>
                      {doc.convertedFromQuotationNumber && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Converted from {doc.convertedFromQuotationNumber}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-base font-bold font-mono-num text-[#1A1A2E]">
                        {total} BD
                      </div>
                      <select
                        value={doc.status}
                        onChange={(e) => onUpdateStatus(doc.id, e.target.value as DocumentStatus)}
                        className={`mt-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                          STATUS_STYLES[doc.status]
                        }`}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Sent">Sent</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Paid">Paid</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDoc(doc)}
                      className="flex-1 min-w-[90px] inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[42px] rounded-lg border border-slate-200 text-xs font-semibold text-[#1A1A2E] cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      Open
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="flex-1 min-w-[90px] inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[42px] rounded-lg bg-[#1565C0] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>

                    {doc.type === 'quotation' && (
                      <button
                        type="button"
                        onClick={() => onConvertToInvoice(doc)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[42px] rounded-lg bg-[#4CAF50] text-white text-xs font-semibold cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        Convert to Invoice
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDuplicateDoc(doc)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 min-h-[42px] rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Duplicate
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(doc)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 min-h-[42px] rounded-lg border border-orange-200 text-xs font-semibold text-[#FF5722] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-[#1A1A2E]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#1A1A2E]">Delete Document?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Are you sure you want to delete{' '}
              <strong className="font-mono-num">{deleteTarget.number}</strong>
              {deleteTarget.customer.company ? ` for ${deleteTarget.customer.company}` : ''}? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteDoc(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#FF5722] text-white text-sm font-semibold hover:bg-[#E64A19] cursor-pointer"
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
