import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { DocumentRecord } from '../types';
import {
  getDaysInMonth,
  parseDocumentDateParts,
  previewDateRangeReset,
  ResetNumberingScope,
} from '../utils/storage';

export type { ResetNumberingScope };

interface ResetNumberingModalProps {
  isOpen: boolean;
  defaultScope?: ResetNumberingScope;
  year?: string;
  documents: DocumentRecord[];
  onClose: () => void;
  onConfirm: (
    scope: ResetNumberingScope,
    year: string,
    month: string,
    day: string
  ) => void;
}

const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export const ResetNumberingModal: React.FC<ResetNumberingModalProps> = ({
  isOpen,
  defaultScope = 'both',
  year,
  documents,
  onClose,
  onConfirm,
}) => {
  const currentYearStr = String(new Date().getFullYear());
  const [scope, setScope] = useState<ResetNumberingScope>(defaultScope);
  const [targetYear, setTargetYear] = useState<string>(currentYearStr);
  const [targetMonth, setTargetMonth] = useState<string>('all');
  const [targetDay, setTargetDay] = useState<string>('all');
  const [understood, setUnderstood] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setScope(defaultScope);
      setTargetYear(String(new Date().getFullYear()));
      setTargetMonth('all');
      setTargetDay('all');
      setUnderstood(false);
    }
  }, [isOpen, defaultScope]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearSet = new Set<number>();
    for (let y = currentYear - 5; y <= currentYear + 2; y += 1) {
      yearSet.add(y);
    }
    if (year && /^\d{4}$/.test(year)) {
      yearSet.add(Number(year));
    }
    for (const doc of documents) {
      const parts = parseDocumentDateParts(doc.date);
      if (parts && /^\d{4}$/.test(parts.year)) {
        yearSet.add(Number(parts.year));
      }
    }
    return Array.from(yearSet)
      .sort((a, b) => b - a)
      .map(String);
  }, [documents, year]);

  const dayOptions = useMemo(() => {
    if (targetMonth === 'all') return [];
    const maxDays = getDaysInMonth(Number(targetYear), Number(targetMonth));
    return Array.from({ length: maxDays }, (_, idx) => {
      const dayNum = idx + 1;
      return {
        value: String(dayNum).padStart(2, '0'),
        label: String(dayNum),
      };
    });
  }, [targetYear, targetMonth]);

  const handleYearChange = (nextYear: string) => {
    setTargetYear(nextYear);
    setUnderstood(false);
    if (targetMonth !== 'all' && targetDay !== 'all') {
      const maxDays = getDaysInMonth(Number(nextYear), Number(targetMonth));
      if (Number(targetDay) > maxDays) {
        setTargetDay('all');
      }
    }
  };

  const handleMonthChange = (nextMonth: string) => {
    setTargetMonth(nextMonth);
    setUnderstood(false);
    if (nextMonth === 'all') {
      setTargetDay('all');
    } else if (targetDay !== 'all') {
      const maxDays = getDaysInMonth(Number(targetYear), Number(nextMonth));
      if (Number(targetDay) > maxDays) {
        setTargetDay('all');
      }
    }
  };

  const handleDayChange = (nextDay: string) => {
    setTargetDay(nextDay);
    setUnderstood(false);
  };

  const handleScopeChange = (nextScope: ResetNumberingScope) => {
    setScope(nextScope);
    setUnderstood(false);
  };

  const preview = useMemo(
    () => previewDateRangeReset(documents, scope, targetYear, targetMonth, targetDay),
    [documents, scope, targetYear, targetMonth, targetDay]
  );

  if (!isOpen) return null;

  const matchingCount = preview.matchingDocs.length;
  const canConfirm = matchingCount > 0 && understood;

  const typePluralLabel = (() => {
    if (scope === 'quotation') return matchingCount === 1 ? 'Quotation' : 'Quotations';
    if (scope === 'invoice') return matchingCount === 1 ? 'Invoice' : 'Invoices';
    return matchingCount === 1 ? 'document' : 'documents';
  })();

  const dateRangePhrase = (() => {
    if (targetMonth === 'all') return `in ${targetYear}`;
    const monthName =
      MONTH_OPTIONS.find((m) => m.value === targetMonth)?.label || targetMonth;
    if (targetDay === 'all') return `in ${monthName} ${targetYear}`;
    return `dated ${targetDay}-${targetMonth}-${targetYear}`;
  })();

  const matchingNumbersList = preview.matchingDocs.map((d) => d.number).join(', ');

  return (
    <div className="fixed inset-0 z-50 bg-[#1A1A2E]/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1A1A2E]">Reset Numbering</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600">
          Choose document type and date range to reset numbering:
        </p>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'quotation', label: 'Quotation' },
              { id: 'invoice', label: 'Invoice' },
              { id: 'both', label: 'Both' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleScopeChange(opt.id)}
              className={`py-2.5 px-3 min-h-[42px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                scope === opt.id
                  ? 'bg-[#1565C0] text-white border-[#1565C0]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="reset-year-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Year
            </label>
            <select
              id="reset-year-select"
              value={targetYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="w-full px-3 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num font-semibold text-[#1A1A2E] bg-white"
            >
              {yearOptions.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="reset-month-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Month
            </label>
            <select
              id="reset-month-select"
              value={targetMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-full px-3 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-semibold text-[#1A1A2E] bg-white"
            >
              <option value="all">All months</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="reset-day-select"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Day
            </label>
            <select
              id="reset-day-select"
              value={targetDay}
              disabled={targetMonth === 'all'}
              onChange={(e) => handleDayChange(e.target.value)}
              className="w-full px-3 py-2.5 min-h-[44px] border border-slate-200 rounded-lg text-sm font-mono-num font-semibold text-[#1A1A2E] bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="all">All days</option>
              {dayOptions.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Preview Box */}
        <div
          className={`text-xs rounded-xl p-3.5 border space-y-1.5 ${
            matchingCount === 0
              ? 'bg-slate-50 border-slate-200 text-slate-600'
              : 'bg-red-50/60 border-red-200 text-[#1A1A2E]'
          }`}
        >
          {matchingCount === 0 ? (
            <p className="font-semibold text-slate-700">No documents found for this date.</p>
          ) : (
            <>
              <p className="leading-relaxed">
                This will delete <strong>{matchingCount}</strong> {typePluralLabel}{' '}
                {dateRangePhrase}:{' '}
                <span className="font-mono-num font-semibold break-all">
                  {matchingNumbersList}
                </span>
                .
              </p>
              <p className="text-slate-700">
                Next number{scope === 'both' ? 's' : ''} will be:{' '}
                <strong className="font-mono-num text-[#1A1A2E]">
                  {scope === 'quotation' && preview.nextQuotationNumber}
                  {scope === 'invoice' && preview.nextInvoiceNumber}
                  {scope === 'both' &&
                    `${preview.nextQuotationNumber} & ${preview.nextInvoiceNumber}`}
                </strong>
              </p>
            </>
          )}
        </div>

        {/* Warning if higher numbers remain outside selected date range */}
        {preview.hasHigherOutsideDocs && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">
              Documents outside this date range keep their numbers, so the next number may
              continue after them.
            </p>
          </div>
        )}

        {/* Confirmation Checkbox */}
        <label
          className={`flex items-start gap-2.5 text-xs select-none ${
            matchingCount === 0
              ? 'text-slate-400 cursor-not-allowed'
              : 'text-slate-700 cursor-pointer'
          }`}
        >
          <input
            type="checkbox"
            checked={understood}
            disabled={matchingCount === 0}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#1565C0] focus:ring-[#1565C0] disabled:cursor-not-allowed"
          />
          <span className="font-medium leading-snug">
            I understand these documents will be deleted
          </span>
        </label>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return;
              onConfirm(scope, targetYear, targetMonth, targetDay);
              onClose();
            }}
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[#FF5722] text-white text-sm font-semibold hover:bg-[#E64A19] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Confirm Reset
          </button>
        </div>
      </div>
    </div>
  );
};
