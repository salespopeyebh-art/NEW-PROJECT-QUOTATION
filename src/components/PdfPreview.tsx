import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { LETTERHEAD_IMAGE_PATH, QUOTATION_CLOSING_TEXT } from '../constants';
import { BankDetails, DocumentRecord } from '../types';
import {
  calculateGrandTotal,
  calculateRowTotal,
  formatBHD,
  numberToBahrainiWords,
  parseDecimal,
} from '../utils/formatting';

interface PdfPreviewProps {
  document: DocumentRecord;
  bankDetails: BankDetails;
}

// Virtual A4 portrait canvas at 96 DPI (210mm x 297mm)
const A4_PX_W = 794;
const A4_PX_H = 1123;
// Safe area: 55mm top (~208px), 30mm bottom (~113px), 14mm horizontal (~53px)
const SAFE_TOP_PX = 208;
const SAFE_BOTTOM_PX = 113;
const SAFE_SIDE_PX = 53;

export const PdfPreview: React.FC<PdfPreviewProps> = ({ document: doc, bankDetails }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.65);
  const [zoomMode, setZoomMode] = useState<'fit' | '75' | '100'>('fit');
  const [overflowsPageOne, setOverflowsPageOne] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateScale = () => {
      const availableW = Math.max(260, el.clientWidth - 24);
      setFitScale(Math.min(1, availableW / A4_PX_W));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const grandTotal = calculateGrandTotal(doc.items);
  const formattedTotal = formatBHD(grandTotal);
  const inWords = numberToBahrainiWords(grandTotal);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;
    const maxSafeContentHeight = A4_PX_H - SAFE_TOP_PX - SAFE_BOTTOM_PX;
    setOverflowsPageOne(contentEl.scrollHeight > maxSafeContentHeight + 6);
  }, [doc, bankDetails, grandTotal]);

  const activeScale = zoomMode === 'fit' ? fitScale : zoomMode === '75' ? 0.75 : 1;
  const scaledW = Math.round(A4_PX_W * activeScale);
  const scaledH = Math.round(A4_PX_H * activeScale);

  const hasLpo = Boolean(doc.lpoNumber.trim() || doc.lpoDate.trim());

  return (
    <div className="flex flex-col h-full bg-slate-100 border border-slate-200 rounded-xl overflow-hidden">
      {/* Preview Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-[#1A1A2E] whitespace-nowrap">
            Live A4 PDF Preview
          </span>
          <span className="text-xs text-slate-400" aria-hidden="true">·</span>
          <span className="text-xs text-slate-500 truncate">
            {doc.number || 'Draft'}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setZoomMode('fit')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1 ${
              zoomMode === 'fit'
                ? 'bg-white text-[#1A1A2E] shadow-xs'
                : 'text-slate-600 hover:text-[#1A1A2E]'
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            Fit
          </button>
          <button
            type="button"
            onClick={() => setZoomMode('75')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1 ${
              zoomMode === '75'
                ? 'bg-white text-[#1A1A2E] shadow-xs'
                : 'text-slate-600 hover:text-[#1A1A2E]'
            }`}
          >
            <ZoomOut className="w-3 h-3" />
            75%
          </button>
          <button
            type="button"
            onClick={() => setZoomMode('100')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1 ${
              zoomMode === '100'
                ? 'bg-white text-[#1A1A2E] shadow-xs'
                : 'text-slate-600 hover:text-[#1A1A2E]'
            }`}
          >
            <ZoomIn className="w-3 h-3" />
            100%
          </button>
        </div>
      </div>

      {overflowsPageOne && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
          Content exceeds Page 1 safe area. The downloaded PDF will automatically continue onto Page 2 with the full letterhead.
        </div>
      )}

      {/* Scrollable Preview Viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-3 flex justify-center items-start bg-[#E9EEF5]"
      >
        <div
          style={{
            width: `${scaledW}px`,
            height: `${scaledH}px`,
            minWidth: `${scaledW}px`,
          }}
          className="relative shadow-md bg-white shrink-0"
        >
          {/* Unscaled Virtual A4 Sheet */}
          <div
            style={{
              width: `${A4_PX_W}px`,
              height: `${A4_PX_H}px`,
              transform: `scale(${activeScale})`,
              transformOrigin: 'top left',
            }}
            className="relative bg-white overflow-hidden pdf-times text-black select-none"
          >
            {/* Full-page Letterhead Background */}
            <img
              src={LETTERHEAD_IMAGE_PATH}
              alt="Popeyee Stationery W.L.L Letterhead"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none"
            />

            {/* Safe Area Container (55mm top, 30mm bottom, 14mm sides) */}
            <div
              ref={contentRef}
              style={{
                paddingTop: `${SAFE_TOP_PX}px`,
                paddingBottom: `${SAFE_BOTTOM_PX}px`,
                paddingLeft: `${SAFE_SIDE_PX}px`,
                paddingRight: `${SAFE_SIDE_PX}px`,
              }}
              className="relative z-10 w-full"
            >
              {/* Title Row + Optional Invoice Stamp */}
              <div className="relative flex justify-center items-center mb-4">
                <h2 className="text-[20px] font-bold underline underline-offset-4 tracking-wide text-black">
                  {doc.type === 'quotation' ? 'Quotation' : 'INVOICE'}
                </h2>

                {doc.type === 'invoice' && doc.stamp && (
                  <div
                    className={`absolute right-0 top-0 px-3 py-1 border-2 text-[13px] font-bold tracking-wider uppercase ${
                      doc.stamp === 'PAID'
                        ? 'border-[#16A34A] text-[#16A34A]'
                        : 'border-[#D97706] text-[#D97706]'
                    }`}
                  >
                    {doc.stamp}
                  </div>
                )}
              </div>

              {/* Left & Right Metadata Grid */}
              <div className="grid grid-cols-12 gap-x-4 text-[12.5px] leading-[1.45] mb-3.5">
                {/* Left Column */}
                <div className="col-span-7 space-y-0.5">
                  <div className="flex">
                    <span className="font-bold w-[92px] shrink-0">Date:</span>
                    <span className="break-words">{doc.date || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="font-bold w-[92px] shrink-0">Company:</span>
                    <span className="break-words">{doc.customer.company || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="font-bold w-[92px] shrink-0">Mobile:</span>
                    <span className="break-words">{doc.customer.mobile || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="font-bold w-[92px] shrink-0">Email:</span>
                    <span className="break-all">{doc.customer.email || '-'}</span>
                  </div>
                  {hasLpo && doc.lpoNumber.trim() && (
                    <div className="flex">
                      <span className="font-bold w-[92px] shrink-0">LPO No:</span>
                      <span className="break-words">{doc.lpoNumber.trim()}</span>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="col-span-5 space-y-0.5">
                  <div className="flex">
                    <span className="font-bold w-[106px] shrink-0">
                      {doc.type === 'quotation' ? 'Quotation No:' : 'Invoice No:'}
                    </span>
                    <span className="break-words">{doc.number || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="font-bold w-[106px] shrink-0">Attention to:</span>
                    <span className="break-words">{doc.customer.attentionTo || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="font-bold w-[106px] shrink-0">Telephone:</span>
                    <span className="break-words">{doc.customer.telephone || '-'}</span>
                  </div>
                  {hasLpo && doc.lpoDate.trim() && (
                    <div className="flex">
                      <span className="font-bold w-[106px] shrink-0">LPO Date:</span>
                      <span className="break-words">{doc.lpoDate.trim()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full border-collapse border border-black text-[12px] leading-[1.35]">
                <thead>
                  <tr className="font-bold text-center">
                    <th className="border border-black py-1.5 px-1 w-[6%]">S/N</th>
                    <th className="border border-black py-1.5 px-2 w-[43.5%]">
                      Items Description
                    </th>
                    <th className="border border-black py-1.5 px-1 w-[13%]">QTY</th>
                    <th className="border border-black py-1.5 px-1 w-[10%]">SIZE</th>
                    <th className="border border-black py-1.5 px-1 w-[13.2%]">UNIT PRICE</th>
                    <th className="border border-black py-1.5 px-1 w-[14.3%]">TOTAL PRICE</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="border border-black py-3 px-2 text-center text-slate-500 italic"
                      >
                        No items added yet
                      </td>
                    </tr>
                  ) : (
                    doc.items.map((item, idx) => {
                      const unitNum =
                        item.unitPrice.trim() !== '' ? parseDecimal(item.unitPrice) : null;
                      const unitDisplay = unitNum !== null ? formatBHD(unitNum) : '-';
                      const rowTot = calculateRowTotal(item);
                      const totalDisplay =
                        rowTot > 0 || item.totalPrice.trim() !== '' ? formatBHD(rowTot) : '0.000';

                      return (
                        <tr key={item.id} className="align-top">
                          <td className="border border-black py-1.5 px-1 text-center">
                            {idx + 1}
                          </td>
                          <td className="border border-black py-1.5 px-2 whitespace-pre-wrap break-words">
                            {item.description.trim() || '-'}
                          </td>
                          <td className="border border-black py-1.5 px-1 text-center break-words">
                            {item.qty.trim() || '-'}
                          </td>
                          <td className="border border-black py-1.5 px-1 text-center break-words">
                            {item.size.trim() || '-'}
                          </td>
                          <td className="border border-black py-1.5 px-1 text-center tabular-nums">
                            {unitDisplay}
                          </td>
                          <td className="border border-black py-1.5 px-1 text-center tabular-nums">
                            {totalDisplay}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Total Amount Row */}
                  <tr className="font-bold text-[12.5px]">
                    <td colSpan={5} className="border border-black py-1.5 px-3 text-right">
                      TOTAL AMOUNT
                    </td>
                    <td className="border border-black py-1.5 px-1 text-center tabular-nums">
                      {formattedTotal} BD
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* In Words */}
              <div className="mt-2.5 text-[12px] font-bold">
                <span>In words: </span>
                <span>{inWords}</span>
              </div>

              {/* Quotation-specific Footer */}
              {doc.type === 'quotation' ? (
                <div className="mt-3 text-[10.8px] leading-[1.35]">
                  <div className="font-bold text-[11.3px] mb-1">Terms &amp; Conditions:</div>
                  <div className="whitespace-pre-wrap">{doc.terms}</div>
                  <p className="mt-2.5 text-[11.2px] leading-[1.38]">{QUOTATION_CLOSING_TEXT}</p>
                </div>
              ) : (
                /* Invoice-specific Footer */
                <div className="mt-3 space-y-2.5 text-[11.5px] leading-[1.38]">
                  <div>
                    <div className="font-bold">Payment Method: {doc.paymentMethod}</div>
                    {doc.paymentNote.trim() && (
                      <div className="whitespace-pre-wrap mt-0.5">{doc.paymentNote.trim()}</div>
                    )}
                    {hasLpo && (
                      <div className="font-bold mt-1">
                        Reference:{' '}
                        {[
                          doc.lpoNumber.trim() ? `LPO No: ${doc.lpoNumber.trim()}` : '',
                          doc.lpoDate.trim() ? `LPO Date: ${doc.lpoDate.trim()}` : '',
                        ]
                          .filter(Boolean)
                          .join('   |   ')}
                      </div>
                    )}
                  </div>

                  {/* Always-shown Bank Details Box */}
                  <div className="border border-black p-2 text-[11.2px] leading-[1.4]">
                    <div className="font-bold mb-1">Bank Details:</div>
                    <div className="grid grid-cols-[115px_1fr] gap-y-0.5">
                      <span className="font-bold">Account Name:</span>
                      <span>{bankDetails.accountName}</span>
                      <span className="font-bold">Bank:</span>
                      <span>{bankDetails.bankName}</span>
                      <span className="font-bold">Account No:</span>
                      <span>{bankDetails.accountNo}</span>
                      <span className="font-bold">IBAN:</span>
                      <span>{bankDetails.iban}</span>
                      <span className="font-bold">SWIFT:</span>
                      <span>{bankDetails.swift}</span>
                      <span className="font-bold">Currency:</span>
                      <span>{bankDetails.currency}</span>
                    </div>
                  </div>

                  {/* Editable Invoice Terms */}
                  {doc.terms.trim() && (
                    <div className="text-[10.8px] leading-[1.35]">
                      <div className="font-bold text-[11.3px] mb-1">Terms &amp; Conditions:</div>
                      <div className="whitespace-pre-wrap">{doc.terms}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
