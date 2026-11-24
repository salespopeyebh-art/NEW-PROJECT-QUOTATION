import { AppSettings, DocumentRecord, DocumentType, LineItem } from '../types';
import { computeNextNumberFromDocuments } from './storage';

export function formatTodayDDMMYYYY(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function ddmmyyyyToInputDate(ddmmyyyy: string): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(ddmmyyyy.trim());
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function inputDateToDDMMYYYY(inputDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inputDate.trim());
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function extractYearFromDDMMYYYY(ddmmyyyy: string): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(ddmmyyyy.trim());
  if (match) return match[3];
  return String(new Date().getFullYear());
}

export function parseQtyNumber(qtyStr: string): number | null {
  if (!qtyStr) return null;
  const cleaned = qtyStr.replace(/,/g, '').trim();
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return Number.isFinite(val) ? val : null;
}

export function parseDecimal(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function formatBHD(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe.toFixed(3);
}

export function calculateRowTotal(item: LineItem): number {
  if (item.manualTotal) {
    return parseDecimal(item.totalPrice);
  }
  const qtyNum = parseQtyNumber(item.qty);
  const unitNum = item.unitPrice.trim() !== '' ? parseDecimal(item.unitPrice) : null;
  if (qtyNum !== null && unitNum !== null) {
    return Number((qtyNum * unitNum).toFixed(3));
  }
  return parseDecimal(item.totalPrice);
}

export function calculateGrandTotal(items: LineItem[]): number {
  const sum = items.reduce((acc, item) => acc + calculateRowTotal(item), 0);
  return Number(sum.toFixed(3));
}

export function calculateAdvanceAmount(
  doc: Pick<DocumentRecord, 'type' | 'hasAdvance' | 'advanceAmount'>
): number {
  if (doc.type !== 'invoice' || !doc.hasAdvance) return 0;
  const val = parseDecimal(doc.advanceAmount || '');
  return Math.max(0, Number(val.toFixed(3)));
}

export function calculateBalanceAmount(
  grandTotal: number,
  doc: Pick<DocumentRecord, 'type' | 'hasAdvance' | 'advanceAmount'>
): number {
  if (doc.type !== 'invoice' || !doc.hasAdvance) {
    return Number(grandTotal.toFixed(3));
  }
  const advance = calculateAdvanceAmount(doc);
  return Number((grandTotal - advance).toFixed(3));
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertHundreds(num: number): string {
  const parts: string[] = [];
  const hundred = Math.floor(num / 100);
  const rem = num % 100;
  if (hundred > 0) {
    parts.push(`${ONES[hundred]} Hundred`);
  }
  if (rem > 0) {
    if (rem < 20) {
      parts.push(ONES[rem]);
    } else {
      const ten = Math.floor(rem / 10);
      const one = rem % 10;
      parts.push(one > 0 ? `${TENS[ten]} ${ONES[one]}` : TENS[ten]);
    }
  }
  return parts.join(' ');
}

function integerToWords(n: number): string {
  if (n === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion'];
  let num = Math.floor(n);
  let scaleIdx = 0;
  const words: string[] = [];

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      const chunkWords = convertHundreds(chunk);
      words.unshift(scales[scaleIdx] ? `${chunkWords} ${scales[scaleIdx]}` : chunkWords);
    }
    num = Math.floor(num / 1000);
    scaleIdx++;
  }

  return words.join(' ').trim();
}

export function numberToBahrainiWords(amount: number): string {
  const safe = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const roundedMillis = Math.round(safe * 1000);
  const dinars = Math.floor(roundedMillis / 1000);
  const fils = roundedMillis % 1000;

  if (dinars === 0 && fils === 0) {
    return 'Bahraini Dinars Zero Only.';
  }

  const dinarWords = integerToWords(dinars);
  if (fils === 0) {
    return `Bahraini Dinars ${dinarWords} Only.`;
  }

  const filsStr = String(fils).padStart(3, '0');
  return `Bahraini Dinars ${dinarWords} and ${filsStr}/1000 Fils Only.`;
}

export function generateNextDocNumber(
  type: DocumentType,
  year: string,
  documents: DocumentRecord[],
  _settings?: AppSettings,
  excludeDocId?: string
): string {
  return computeNextNumberFromDocuments(type, year, documents, excludeDocId);
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'Customer';
}

export function getPdfFileName(doc: DocumentRecord): string {
  const label = doc.type === 'quotation' ? 'Quotation' : 'Invoice';
  const docNum = doc.number.trim().replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Draft';
  const customer = sanitizeFilename(doc.customer.company || doc.customer.attentionTo || 'Customer');
  return `${label}_${docNum}_${customer}.pdf`;
}

export function normalizeBahrainPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 8) {
    return `973${digits}`;
  }
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  return digits;
}

export function buildWhatsAppUrl(doc: DocumentRecord): string {
  const phone = normalizeBahrainPhoneForWhatsApp(doc.customer.mobile || doc.customer.telephone || '');
  const typeLabel = doc.type === 'quotation' ? 'Quotation' : 'Invoice';
  const greetingName = doc.customer.attentionTo || doc.customer.company || 'Sir/Madam';
  const grandTotal = calculateGrandTotal(doc.items);
  const amount = formatBHD(grandTotal);

  const lines = [
    `Dear ${greetingName},`,
    `Please find your ${typeLabel} (${doc.number}) dated ${doc.date} from Popeyee Stationery W.L.L.`,
    `Total Amount: ${amount} BD.`,
  ];

  if (doc.type === 'invoice' && doc.hasAdvance) {
    const advance = calculateAdvanceAmount(doc);
    const balance = calculateBalanceAmount(grandTotal, doc);
    lines.push(`Advance: ${formatBHD(advance)} BD.`);
    lines.push(`Balance: ${formatBHD(balance)} BD.`);
  }

  lines.push('Thank you for your business.');

  const encoded = encodeURIComponent(lines.join('\n'));
  return phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function createEmptyLineItem(): LineItem {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: '',
    qty: '',
    size: '',
    unitPrice: '',
    totalPrice: '',
    manualTotal: false,
  };
}
