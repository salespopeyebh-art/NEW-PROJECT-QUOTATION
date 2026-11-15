import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Eye,
  FilePlus2,
  MessageCircle,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { DEFAULT_PAYMENT_NOTES } from '../constants';
import {
  AppSettings,
  CustomerInfo,
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  InvoiceStamp,
  LineItem,
  PaymentMethod,
  SavedCustomer,
} from '../types';
import {
  buildWhatsAppUrl,
  calculateGrandTotal,
  createEmptyLineItem,
  ddmmyyyyToInputDate,
  extractYearFromDDMMYYYY,
  formatBHD,
  generateNextDocNumber,
  inputDateToDDMMYYYY,
  numberToBahrainiWords,
  parseDecimal,
  parseQtyNumber,
} from '../utils/formatting';
import { PdfPreview } from './PdfPreview';

interface DocumentEditorProps {
  doc: DocumentRecord;
  allDocuments: DocumentRecord[];
  customers: SavedCustomer[];
  settings: AppSettings;
  onChangeDoc: (updated: DocumentRecord) => void;
  onSaveDoc: (docToSave: DocumentRecord) => DocumentRecord;
  onDownloadPdf: (docToDownload: DocumentRecord) => Promise<void>;
  onNewBlank: (type: DocumentType) => void;
  onQuickSaveCustomer: (customer: CustomerInfo) => void;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  doc,
  allDocuments,
  customers,
  settings,
  onChangeDoc,
  onSaveDoc,
  onDownloadPdf,
  onNewBlank,
  onQuickSaveCustomer,
}) => {
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [customerSavedFlash, setCustomerSavedFlash] = useState(false);
  const companyBoxRef = useRef<HTMLDivElement>(null);

  // Combine saved customers + any unique customer entries from historical documents
  const knownCustomers = useMemo(() => {
    const map = new Map<string, CustomerInfo & { id?: string }>();
    for (const c of customers) {
      if (c.company.trim()) {
        map.set(c.company.trim().toLowerCase(), c);
      }
    }
    for (const d of allDocuments) {
      const key = d.customer.company.trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, d.customer);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.company.localeCompare(b.company));
  }, [customers, allDocuments]);

  const companySuggestions = useMemo(() => {
    const q = doc.customer.company.trim().toLowerCase();
    if (!q) return knownCustomers.slice(0, 6);
    return knownCustomers
      .filter(
        (c) =>
          c.company.toLowerCase().includes(q) ||
          c.attentionTo.toLowerCase().includes(q) ||
          c.mobile.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [doc.customer.company, knownCustomers]);

  const grandTotal = useMemo(() => calculateGrandTotal(doc.items), [doc.items]);
  const inWords = useMemo(() => numberToBahrainiWords(grandTotal), [grandTotal]);
  const whatsappUrl = useMemo(() => buildWhatsAppUrl(doc), [doc]);

  const handleTypeSwitch = (nextType: DocumentType) => {
    if (doc.type === nextType) return;
    const year = extractYearFromDDMMYYYY(doc.date);
    const nextNumber = doc.isManualNumber
      ? doc.number
      : generateNextDocNumber(nextType, year, allDocuments, settings, doc.id);

    // Swap default terms if user hasn't customized them away from the previous type's default
    let nextTerms = doc.terms;
    if (nextType === 'invoice' && doc.terms.trim() === settings.quotationTerms.trim()) {
      nextTerms = settings.invoiceTerms;
    } else if (nextType === 'quotation' && doc.terms.trim() === settings.invoiceTerms.trim()) {
      nextTerms = settings.quotationTerms;
    }

    onChangeDoc({
      ...doc,
      type: nextType,
      number: nextNumber,
      terms: nextTerms,
    });
  };

  const handleDateChange = (inputVal: string) => {
    const formatted = inputDateToDDMMYYYY(inputVal);
    if (!formatted) return;
    const nextYear = extractYearFromDDMMYYYY(formatted);
    const prevYear = extractYearFromDDMMYYYY(doc.date);
    let nextNumber = doc.number;
    if (!doc.isManualNumber && nextYear !== prevYear) {
      nextNumber = generateNextDocNumber(doc.type, nextYear, allDocuments, settings, doc.id);
    }
    onChangeDoc({
      ...doc,
      date: formatted,
      number: nextNumber,
    });
  };

  const handleResetAutoNumber = () => {
    const year = extractYearFromDDMMYYYY(doc.date);
    const autoNum = generateNextDocNumber(doc.type, year, allDocuments, settings, doc.id);
    onChangeDoc({
      ...doc,
      number: autoNum,
      isManualNumber: false,
    });
  };

  const updateCustomerField = (field: keyof CustomerInfo, value: string) => {
    onChangeDoc({
      ...doc,
      customer: {
        ...doc.customer,
        [field]: value,
      },
    });
  };

  const applyCustomer = (cust: CustomerInfo) => {
    onChangeDoc({
      ...doc,
      customer: {
        company: cust.company,
        attentionTo: cust.attentionTo,
        mobile: cust.mobile,
        telephone: cust.telephone,
        email: cust.email,
      },
    });
    setShowCompanySuggestions(false);
  };

  const handleDropdownSelectCustomer = (companyKey: string) => {
    if (!companyKey) return;
    const match = knownCustomers.find(
      (c) => c.company.trim().toLowerCase() === companyKey
    );
    if (match) applyCustomer(match);
  };

  const handleUpdateItem = (itemId: string, patch: Partial<LineItem>) => {
    const nextItems = doc.items.map((item) => {
      if (item.id !== itemId) return item;
      const updated = { ...item, ...patch };

      if (patch.totalPrice !== undefined) {
        // User typed directly into Total Price
        updated.manualTotal = true;
      } else if (patch.unitPrice !== undefined) {
        if (patch.unitPrice.trim() === '') {
          // Cleared unit price -> keep total editable manually
          updated.manualTotal = true;
        } else {
          updated.manualTotal = false;
          const q = parseQtyNumber(updated.qty);
          const u = parseDecimal(updated.unitPrice);
          if (q !== null) {
            updated.totalPrice = formatBHD(q * u);
          }
        }
      } else if (patch.qty !== undefined && !updated.manualTotal) {
        const q = parseQtyNumber(updated.qty);
        if (q !== null && updated.unitPrice.trim() !== '') {
          const u = parseDecimal(updated.unitPrice);
          updated.totalPrice = formatBHD(q * u);
        }
      }

      return updated;
    });

    onChangeDoc({
      ...doc,
      items: nextItems,
      totalAmount: calculateGrandTotal(nextItems),
    });
  };

  const handleAddRow = () => {
    const nextItems = [...doc.items, createEmptyLineItem()];
    onChangeDoc({
      ...doc,
      items: nextItems,
    });
  };

  const handleRemoveRow = (itemId: string) => {
    const filtered = doc.items.filter((i) => i.id !== itemId);
    const nextItems = filtered.length > 0 ? filtered : [createEmptyLineItem()];
    onChangeDoc({
      ...doc,
      items: nextItems,
      totalAmount: calculateGrandTotal(nextItems),
    });
  };

  const handleMoveRow = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= doc.items.length) return;
    const nextItems = [...doc.items];
    const [moved] = nextItems.splice(index, 1);
    nextItems.splice(targetIdx, 0, moved);
    onChangeDoc({
      ...doc,
      items: nextItems,
    });
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    const isDefaultNote = Object.values(DEFAULT_PAYMENT_NOTES).some(
      (n) => n.trim() === doc.paymentNote.trim()
    );
    onChangeDoc({
      ...doc,
      paymentMethod: method,
      paymentNote: isDefaultNote || !doc.paymentNote.trim() ? DEFAULT_PAYMENT_NOTES[method] : doc.paymentNote,
    });
  };

  const handleDownloadClick = async () => {
    setIsDownloading(true);
    try {
      const saved = onSaveDoc(doc);
      await onDownloadPdf(saved);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveCustomerClick = () => {
    if (!doc.customer.company.trim()) return;
    onQuickSaveCustomer(doc.customer);
    setCustomerSavedFlash(true);
    setTimeout(() => setCustomerSavedFlash(false), 1800);
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Quotation / Invoice Toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeSwitch('quotation')}
              className={`px-4 py-2 min-h-[40px] rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                doc.type === 'quotation'
                  ? 'bg-[#1565C0] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#1A1A2E]'
              }`}
            >
              Quotation
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch('invoice')}
              className={`px-4 py-2 min-h-[40px] rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                doc.type === 'invoice'
                  ? 'bg-[#FF5722] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#1A1A2E]'
              }`}
            >
              Invoice
            </button>
          </div>

          {/* Document Status */}
          <div className="flex items-center gap-2">
            <label htmlFor="doc-status" className="text-xs font-semibold text-slate-500 whitespace-nowrap">
              Status
            </label>
            <select
              id="doc-status"
              value={doc.status}
              onChange={(e) => onChangeDoc({ ...doc, status: e.target.value as DocumentStatus })}
              className="px-3 py-2 min-h-[40px] bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
            >
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Accepted">Accepted</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          {/* Mobile Edit / Preview Switcher */}
          <div className="flex lg:hidden p-1 bg-slate-100 rounded-xl ml-auto">
            <button
              type="button"
              onClick={() => setMobileView('edit')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                mobileView === 'edit' ? 'bg-white text-[#1A1A2E] shadow-xs' : 'text-slate-600'
              }`}
            >
              <PencilLine className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setMobileView('preview')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                mobileView === 'preview' ? 'bg-white text-[#1A1A2E] shadow-xs' : 'text-slate-600'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>
        </div>

        {/* Big Clear Primary Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNewBlank(doc.type)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4" />
            New Blank
          </button>

          <button
            type="button"
            onClick={() => onSaveDoc(doc)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#4CAF50] text-white hover:bg-[#43A047] text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save
          </button>

          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#1565C0] text-white hover:bg-[#1254A1] disabled:opacity-60 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? 'Generating...' : 'Download PDF'}
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-[#4CAF50] bg-[#4CAF50]/10 text-[#2E7D32] hover:bg-[#4CAF50]/20 text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4" />
            Share on WhatsApp
          </a>
        </div>
      </div>

      {/* Main Split Workspace: Left Form / Right Live PDF Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Form Column */}
        <div className={`lg:col-span-7 space-y-5 ${mobileView === 'preview' ? 'hidden lg:block' : 'block'}`}>
          {/* Document Details Card */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1A1A2E]">
                {doc.type === 'quotation' ? 'Quotation Details' : 'Invoice Details'}
              </h2>
              {doc.convertedFromQuotationNumber && (
                <span className="text-xs text-slate-500">
                  Converted from {doc.convertedFromQuotationNumber}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Document Number
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={doc.number}
                    onChange={(e) =>
                      onChangeDoc({
                        ...doc,
                        number: e.target.value,
                        isManualNumber: true,
                      })
                    }
                    className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num font-semibold text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                  />
                  {doc.isManualNumber && (
                    <button
                      type="button"
                      onClick={handleResetAutoNumber}
                      title="Reset to automatic number"
                      className="px-3 py-2.5 min-h-[44px] rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Auto
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Date (DD-MM-YYYY: <span className="font-mono-num">{doc.date}</span>)
                </label>
                <input
                  type="date"
                  value={ddmmyyyyToInputDate(doc.date)}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  LPO Number (Optional)
                </label>
                <input
                  type="text"
                  value={doc.lpoNumber}
                  onChange={(e) => onChangeDoc({ ...doc, lpoNumber: e.target.value })}
                  placeholder="Leave blank if none"
                  className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  LPO Date (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={ddmmyyyyToInputDate(doc.lpoDate)}
                    onChange={(e) =>
                      onChangeDoc({
                        ...doc,
                        lpoDate: e.target.value ? inputDateToDDMMYYYY(e.target.value) : '',
                      })
                    }
                    className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                  />
                  {doc.lpoDate && (
                    <button
                      type="button"
                      onClick={() => onChangeDoc({ ...doc, lpoDate: '' })}
                      className="px-2.5 py-2.5 min-h-[44px] rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Customer Details Card */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-base font-bold text-[#1A1A2E]">Customer Information</h2>

              <div className="flex flex-wrap items-center gap-2">
                {knownCustomers.length > 0 && (
                  <select
                    aria-label="Select saved customer"
                    value=""
                    onChange={(e) => handleDropdownSelectCustomer(e.target.value)}
                    className="px-3 py-2 min-h-[40px] bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-[#1A1A2E] max-w-[230px] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
                  >
                    <option value="">Select saved customer...</option>
                    {knownCustomers.map((c) => (
                      <option
                        key={c.company.toLowerCase()}
                        value={c.company.trim().toLowerCase()}
                      >
                        {c.company}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={handleSaveCustomerClick}
                  disabled={!doc.customer.company.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 text-xs font-semibold text-[#1565C0] hover:bg-[#1565C0]/5 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                >
                  {customerSavedFlash ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#4CAF50]" />
                      <span className="text-[#4CAF50]">Saved</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      Save Customer
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Company with Auto-Suggest */}
              <div className="sm:col-span-2 relative" ref={companyBoxRef}>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Company Name
                </label>
                <input
                  type="text"
                  value={doc.customer.company}
                  onFocus={() => setShowCompanySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCompanySuggestions(false), 180)}
                  onChange={(e) => {
                    updateCustomerField('company', e.target.value);
                    setShowCompanySuggestions(true);
                  }}
                  placeholder="Start typing company name to see saved customers..."
                  className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                />

                {showCompanySuggestions && companySuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto divide-y divide-slate-100">
                    {companySuggestions.map((cust) => (
                      <button
                        key={cust.company.toLowerCase()}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyCustomer(cust);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="text-sm font-semibold text-[#1A1A2E]">{cust.company}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-2">
                          {cust.attentionTo && <span>Attn: {cust.attentionTo}</span>}
                          {cust.mobile && <span className="font-mono-num">· {cust.mobile}</span>}
                          {cust.email && <span>· {cust.email}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Attention to
                </label>
                <input
                  type="text"
                  value={doc.customer.attentionTo}
                  onChange={(e) => updateCustomerField('attentionTo', e.target.value)}
                  placeholder="Contact person name"
                  className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mobile
                </label>
                <input
                  type="text"
                  value={doc.customer.mobile}
                  onChange={(e) => updateCustomerField('mobile', e.target.value)}
                  placeholder="e.g. 33123456"
                  className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Telephone (Optional)
                </label>
                <input
                  type="text"
                  value={doc.customer.telephone}
                  onChange={(e) => updateCustomerField('telephone', e.target.value)}
                  placeholder="e.g. 17123456"
                  className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={doc.customer.email}
                  onChange={(e) => updateCustomerField('email', e.target.value)}
                  placeholder="customer@company.bh"
                  className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                />
              </div>
            </div>
          </section>

          {/* Items Table Card */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#1A1A2E]">Items</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Type QTY &amp; Unit Price to auto-calculate, or enter Total Price directly. No VAT applied.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#1565C0] text-white text-sm font-semibold hover:bg-[#1254A1] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {doc.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#1A1A2E] font-mono-num">
                      Item #{idx + 1}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveRow(idx, -1)}
                        disabled={idx === 0}
                        title="Move up"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-[#1A1A2E] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveRow(idx, 1)}
                        disabled={idx === doc.items.length - 1}
                        title="Move down"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-[#1A1A2E] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(item.id)}
                        title="Remove item"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-orange-50 hover:text-[#FF5722] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Items Description (supports multiple lines)
                    </label>
                    <textarea
                      rows={2}
                      value={item.description}
                      onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                      placeholder="e.g. Custom Printed Stickers&#10;Matt Lamination, Die Cut"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25 focus:border-[#1565C0]"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        QTY
                      </label>
                      <input
                        type="text"
                        value={item.qty}
                        onChange={(e) => handleUpdateItem(item.id, { qty: e.target.value })}
                        placeholder="350 pcs"
                        className="w-full px-3 py-2 min-h-[42px] bg-white border border-slate-200 rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        SIZE (Optional)
                      </label>
                      <input
                        type="text"
                        value={item.size}
                        onChange={(e) => handleUpdateItem(item.id, { size: e.target.value })}
                        placeholder="50MM"
                        className="w-full px-3 py-2 min-h-[42px] bg-white border border-slate-200 rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        UNIT PRICE (BD)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(item.id, { unitPrice: e.target.value })}
                        placeholder="0.000"
                        className="w-full px-3 py-2 min-h-[42px] bg-white border border-slate-200 rounded-lg text-sm font-mono-num text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        TOTAL PRICE (BD)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={item.totalPrice}
                        onChange={(e) => handleUpdateItem(item.id, { totalPrice: e.target.value })}
                        placeholder="0.000"
                        className="w-full px-3 py-2 min-h-[42px] bg-white border border-slate-200 rounded-lg text-sm font-mono-num font-semibold text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grand Total & Amount in Words Summary */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-slate-600">
                <span className="font-semibold text-[#1A1A2E]">In words: </span>
                {inWords}
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-semibold text-slate-500">TOTAL AMOUNT</div>
                <div className="text-2xl font-bold text-[#1A1A2E] font-mono-num">
                  {formatBHD(grandTotal)} BD
                </div>
              </div>
            </div>
          </section>

          {/* Invoice Payment & Stamp Options (only for Invoices) */}
          {doc.type === 'invoice' && (
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold text-[#1A1A2E]">Payment &amp; Status Stamp</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={doc.paymentMethod}
                    onChange={(e) => handlePaymentMethodChange(e.target.value as PaymentMethod)}
                    className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-medium text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Optional Status Stamp on PDF
                  </label>
                  <select
                    value={doc.stamp}
                    onChange={(e) => onChangeDoc({ ...doc, stamp: e.target.value as InvoiceStamp })}
                    className="w-full px-3.5 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-medium text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
                  >
                    <option value="">Off (No Stamp)</option>
                    <option value="PAID">PAID</option>
                    <option value="PARTIALLY PAID">PARTIALLY PAID</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Payment Note (Editable for this invoice)
                </label>
                <textarea
                  rows={2}
                  value={doc.paymentNote}
                  onChange={(e) => onChangeDoc({ ...doc, paymentNote: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
                />
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-[#1A1A2E]">Bank Details Box: </span>
                Automatically included on every invoice ({settings.bankDetails.bankName} · IBAN{' '}
                <span className="font-mono-num">{settings.bankDetails.iban}</span>). Edit bank details anytime in Settings.
              </div>
            </section>
          )}

          {/* Terms & Conditions Card */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#1A1A2E]">
                {doc.type === 'quotation' ? 'Quotation Terms & Conditions' : 'Invoice Terms & Conditions'}
              </h2>
              <button
                type="button"
                onClick={() =>
                  onChangeDoc({
                    ...doc,
                    terms: doc.type === 'quotation' ? settings.quotationTerms : settings.invoiceTerms,
                  })
                }
                className="text-xs font-semibold text-[#1565C0] hover:underline cursor-pointer"
              >
                Reset to Saved Default
              </button>
            </div>
            <textarea
              rows={doc.type === 'quotation' ? 8 : 4}
              value={doc.terms}
              onChange={(e) => onChangeDoc({ ...doc, terms: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-xs leading-relaxed text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/25"
            />
          </section>
        </div>

        {/* Live PDF Preview Column */}
        <div
          className={`lg:col-span-5 lg:sticky lg:top-4 lg:h-[calc(100vh-105px)] min-h-[540px] ${
            mobileView === 'edit' ? 'hidden lg:block' : 'block'
          }`}
        >
          <PdfPreview document={doc} bankDetails={settings.bankDetails} />
        </div>
      </div>
    </div>
  );
};
