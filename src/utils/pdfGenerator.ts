import { jsPDF } from 'jspdf';
import { LETTERHEAD_IMAGE_PATH, QUOTATION_CLOSING_TEXT } from '../constants';
import { BankDetails, DocumentRecord } from '../types';
import {
  calculateGrandTotal,
  calculateRowTotal,
  formatBHD,
  getPdfFileName,
  numberToBahrainiWords,
  parseDecimal,
} from './formatting';

const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const SAFE_TOP = 55;
const SAFE_BOTTOM = 267; // 297 - 30mm
const MARGIN_X = 14;
const CONTENT_W = A4_WIDTH - MARGIN_X * 2; // 182mm

const COL_WIDTHS = {
  sn: 11,
  desc: 79,
  qty: 24,
  size: 18,
  unit: 24,
  total: 26,
}; // sum = 182mm

let cachedLetterheadBase64: string | null = null;

async function loadLetterheadDataUrl(): Promise<string> {
  if (cachedLetterheadBase64) return cachedLetterheadBase64;
  const response = await fetch(LETTERHEAD_IMAGE_PATH);
  if (!response.ok) {
    throw new Error('Could not load letterhead background image.');
  }
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read letterhead image.'));
    reader.readAsDataURL(blob);
  });
  cachedLetterheadBase64 = dataUrl;
  return dataUrl;
}

function addLetterheadBackground(pdf: jsPDF, letterheadDataUrl: string): void {
  pdf.addImage(letterheadDataUrl, 'JPEG', 0, 0, A4_WIDTH, A4_HEIGHT, 'letterhead', 'FAST');
}

function splitPreservingLines(pdf: jsPDF, text: string, maxWidth: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('');
    } else {
      const wrapped = pdf.splitTextToSize(para, maxWidth) as string[];
      lines.push(...wrapped);
    }
  }
  return lines;
}

export async function generateDocumentPdf(
  doc: DocumentRecord,
  bankDetails: BankDetails
): Promise<void> {
  const letterheadDataUrl = await loadLetterheadDataUrl();
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  addLetterheadBackground(pdf, letterheadDataUrl);
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);

  let y = SAFE_TOP;

  const ensureSpace = (neededHeight: number): void => {
    if (y + neededHeight > SAFE_BOTTOM) {
      pdf.addPage();
      addLetterheadBackground(pdf, letterheadDataUrl);
      pdf.setTextColor(0, 0, 0);
      pdf.setDrawColor(0, 0, 0);
      y = SAFE_TOP;
    }
  };

  // 1. Title (centered, bold, underlined)
  const title = doc.type === 'quotation' ? 'Quotation' : 'INVOICE';
  pdf.setFont('times', 'bold');
  pdf.setFontSize(15);
  const titleWidth = pdf.getTextWidth(title);
  const titleX = A4_WIDTH / 2;
  pdf.text(title, titleX, y + 4, { align: 'center' });
  pdf.setLineWidth(0.4);
  pdf.line(titleX - titleWidth / 2, y + 5.2, titleX + titleWidth / 2, y + 5.2);

  // Optional Invoice Status Stamp (PAID / PARTIALLY PAID)
  if (doc.type === 'invoice' && doc.stamp) {
    const stampText = doc.stamp;
    pdf.setFont('times', 'bold');
    pdf.setFontSize(10);
    const stampW = pdf.getTextWidth(stampText) + 8;
    const stampX = A4_WIDTH - MARGIN_X - stampW;
    const stampY = y - 1;
    if (stampText === 'PAID') {
      pdf.setDrawColor(22, 163, 74);
      pdf.setTextColor(22, 163, 74);
    } else {
      pdf.setDrawColor(217, 119, 6);
      pdf.setTextColor(217, 119, 6);
    }
    pdf.setLineWidth(0.6);
    pdf.rect(stampX, stampY, stampW, 7);
    pdf.text(stampText, stampX + stampW / 2, stampY + 4.8, { align: 'center' });
    pdf.setDrawColor(0, 0, 0);
    pdf.setTextColor(0, 0, 0);
  }

  y += 11;

  // 2. Two-column Metadata Block
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + 98;
  const labelWLeft = 24;
  const labelWRight = 28;
  const valMaxWLeft = 68;
  const valMaxWRight = 56;

  const leftRows: Array<[string, string]> = [
    ['Date:', doc.date || '-'],
    ['Company:', doc.customer.company || '-'],
    ['Mobile:', doc.customer.mobile || '-'],
    ['Email:', doc.customer.email || '-'],
  ];
  const rightRows: Array<[string, string]> = [
    [doc.type === 'quotation' ? 'Quotation No:' : 'Invoice No:', doc.number || '-'],
    ['Attention to:', doc.customer.attentionTo || '-'],
    ['Telephone:', doc.customer.telephone || '-'],
  ];

  if (doc.lpoNumber.trim() || doc.lpoDate.trim()) {
    if (doc.lpoNumber.trim()) {
      leftRows.push(['LPO No:', doc.lpoNumber.trim()]);
    }
    if (doc.lpoDate.trim()) {
      rightRows.push(['LPO Date:', doc.lpoDate.trim()]);
    }
  }

  pdf.setFontSize(9.5);
  const rowCount = Math.max(leftRows.length, rightRows.length);
  for (let i = 0; i < rowCount; i++) {
    let rowH = 5;
    let leftLines: string[] = [];
    let rightLines: string[] = [];

    if (leftRows[i]) {
      pdf.setFont('times', 'normal');
      leftLines = pdf.splitTextToSize(leftRows[i][1], valMaxWLeft) as string[];
      rowH = Math.max(rowH, leftLines.length * 4.2 + 0.8);
    }
    if (rightRows[i]) {
      pdf.setFont('times', 'normal');
      rightLines = pdf.splitTextToSize(rightRows[i][1], valMaxWRight) as string[];
      rowH = Math.max(rowH, rightLines.length * 4.2 + 0.8);
    }

    ensureSpace(rowH);

    if (leftRows[i]) {
      pdf.setFont('times', 'bold');
      pdf.text(leftRows[i][0], leftX, y + 3.5);
      pdf.setFont('times', 'normal');
      leftLines.forEach((line, idx) => {
        pdf.text(line, leftX + labelWLeft, y + 3.5 + idx * 4.2);
      });
    }

    if (rightRows[i]) {
      pdf.setFont('times', 'bold');
      pdf.text(rightRows[i][0], rightX, y + 3.5);
      pdf.setFont('times', 'normal');
      rightLines.forEach((line, idx) => {
        pdf.text(line, rightX + labelWRight, y + 3.5 + idx * 4.2);
      });
    }

    y += rowH;
  }

  y += 3.5;

  // 3. Items Table
  const drawTableHeader = (): void => {
    const headerH = 7.5;
    ensureSpace(headerH);
    pdf.setLineWidth(0.3);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9);

    const headers: Array<{ label: string; width: number }> = [
      { label: 'S/N', width: COL_WIDTHS.sn },
      { label: 'Items Description', width: COL_WIDTHS.desc },
      { label: 'QTY', width: COL_WIDTHS.qty },
      { label: 'SIZE', width: COL_WIDTHS.size },
      { label: 'UNIT PRICE', width: COL_WIDTHS.unit },
      { label: 'TOTAL PRICE', width: COL_WIDTHS.total },
    ];

    let x = MARGIN_X;
    for (const h of headers) {
      pdf.rect(x, y, h.width, headerH);
      pdf.text(h.label, x + h.width / 2, y + 5, { align: 'center' });
      x += h.width;
    }
    y += headerH;
  };

  drawTableHeader();

  pdf.setFont('times', 'normal');
  pdf.setFontSize(9);
  const lineH = 4;

  const itemsToRender = doc.items.length > 0 ? doc.items : [];
  itemsToRender.forEach((item, index) => {
    const snStr = String(index + 1);
    const descText = item.description.trim() || '-';
    const qtyText = item.qty.trim() || '-';
    const sizeText = item.size.trim() || '-';
    const unitNum = item.unitPrice.trim() !== '' ? parseDecimal(item.unitPrice) : null;
    const unitStr = unitNum !== null ? formatBHD(unitNum) : '-';
    const rowTotalVal = calculateRowTotal(item);
    const totalStr = rowTotalVal > 0 || item.totalPrice.trim() !== '' ? formatBHD(rowTotalVal) : '0.000';

    const descLines = splitPreservingLines(pdf, descText, COL_WIDTHS.desc - 4);
    const qtyLines = pdf.splitTextToSize(qtyText, COL_WIDTHS.qty - 3) as string[];
    const sizeLines = pdf.splitTextToSize(sizeText, COL_WIDTHS.size - 3) as string[];

    const maxLines = Math.max(descLines.length, qtyLines.length, sizeLines.length, 1);
    const rowH = Math.max(7, maxLines * lineH + 2.8);

    if (y + rowH > SAFE_BOTTOM) {
      pdf.addPage();
      addLetterheadBackground(pdf, letterheadDataUrl);
      pdf.setTextColor(0, 0, 0);
      pdf.setDrawColor(0, 0, 0);
      y = SAFE_TOP;
      drawTableHeader();
      pdf.setFont('times', 'normal');
      pdf.setFontSize(9);
    }

    pdf.setLineWidth(0.3);
    let x = MARGIN_X;

    // S/N
    pdf.rect(x, y, COL_WIDTHS.sn, rowH);
    pdf.text(snStr, x + COL_WIDTHS.sn / 2, y + 4.6, { align: 'center' });
    x += COL_WIDTHS.sn;

    // Description
    pdf.rect(x, y, COL_WIDTHS.desc, rowH);
    descLines.forEach((line, idx) => {
      if (line) {
        pdf.text(line, x + 2, y + 4.4 + idx * lineH);
      }
    });
    x += COL_WIDTHS.desc;

    // QTY
    pdf.rect(x, y, COL_WIDTHS.qty, rowH);
    qtyLines.forEach((line, idx) => {
      pdf.text(line, x + COL_WIDTHS.qty / 2, y + 4.6 + idx * lineH, { align: 'center' });
    });
    x += COL_WIDTHS.qty;

    // SIZE
    pdf.rect(x, y, COL_WIDTHS.size, rowH);
    sizeLines.forEach((line, idx) => {
      pdf.text(line, x + COL_WIDTHS.size / 2, y + 4.6 + idx * lineH, { align: 'center' });
    });
    x += COL_WIDTHS.size;

    // UNIT PRICE
    pdf.rect(x, y, COL_WIDTHS.unit, rowH);
    pdf.text(unitStr, x + COL_WIDTHS.unit / 2, y + 4.6, { align: 'center' });
    x += COL_WIDTHS.unit;

    // TOTAL PRICE
    pdf.rect(x, y, COL_WIDTHS.total, rowH);
    pdf.text(totalStr, x + COL_WIDTHS.total / 2, y + 4.6, { align: 'center' });

    y += rowH;
  });

  // TOTAL AMOUNT row
  const grandTotal = calculateGrandTotal(doc.items);
  const formattedTotal = formatBHD(grandTotal);
  const totalRowH = 7.5;
  ensureSpace(totalRowH + 8);

  const labelSpanW =
    COL_WIDTHS.sn + COL_WIDTHS.desc + COL_WIDTHS.qty + COL_WIDTHS.size + COL_WIDTHS.unit;
  pdf.setLineWidth(0.3);
  pdf.rect(MARGIN_X, y, labelSpanW, totalRowH);
  pdf.rect(MARGIN_X + labelSpanW, y, COL_WIDTHS.total, totalRowH);

  pdf.setFont('times', 'bold');
  pdf.setFontSize(9.5);
  pdf.text('TOTAL AMOUNT', MARGIN_X + labelSpanW - 3, y + 5.1, { align: 'right' });
  pdf.text(`${formattedTotal} BD`, MARGIN_X + labelSpanW + COL_WIDTHS.total / 2, y + 5.1, {
    align: 'center',
  });
  y += totalRowH + 4.5;

  // In words line
  const inWordsText = `In words: ${numberToBahrainiWords(grandTotal)}`;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(9);
  const inWordsLines = pdf.splitTextToSize(inWordsText, CONTENT_W) as string[];
  ensureSpace(inWordsLines.length * 4.2 + 4);
  inWordsLines.forEach((line, idx) => {
    pdf.text(line, MARGIN_X, y + idx * 4.2);
  });
  y += inWordsLines.length * 4.2 + 4;

  // 4. Quotation vs Invoice Footer Sections
  if (doc.type === 'quotation') {
    // Terms & Conditions
    const termsLines = splitPreservingLines(pdf, doc.terms || '', CONTENT_W);
    ensureSpace(10);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(8.5);
    pdf.text('Terms & Conditions:', MARGIN_X, y);
    y += 4;

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8);
    const termLineH = 3.5;
    for (const line of termsLines) {
      if (line === '') {
        y += 2;
        continue;
      }
      ensureSpace(termLineH + 1);
      pdf.text(line, MARGIN_X, y);
      y += termLineH;
    }

    y += 3.5;
    const closingLines = pdf.splitTextToSize(QUOTATION_CLOSING_TEXT, CONTENT_W) as string[];
    ensureSpace(closingLines.length * 3.8 + 2);
    pdf.setFont('times', 'normal');
    pdf.setFontSize(8.5);
    closingLines.forEach((line, idx) => {
      pdf.text(line, MARGIN_X, y + idx * 3.8);
    });
  } else {
    // Invoice: Payment Section
    ensureSpace(16);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9);
    pdf.text(`Payment Method: ${doc.paymentMethod}`, MARGIN_X, y);
    y += 4.2;

    if (doc.paymentNote.trim()) {
      pdf.setFont('times', 'normal');
      pdf.setFontSize(8.5);
      const payLines = splitPreservingLines(pdf, doc.paymentNote.trim(), CONTENT_W);
      for (const line of payLines) {
        ensureSpace(4);
        if (line) pdf.text(line, MARGIN_X, y);
        y += 3.8;
      }
    }

    if (doc.lpoNumber.trim() || doc.lpoDate.trim()) {
      const lpoRef = [
        doc.lpoNumber.trim() ? `LPO No: ${doc.lpoNumber.trim()}` : '',
        doc.lpoDate.trim() ? `LPO Date: ${doc.lpoDate.trim()}` : '',
      ]
        .filter(Boolean)
        .join('   |   ');
      ensureSpace(4.5);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(8.5);
      pdf.text(`Reference: ${lpoRef}`, MARGIN_X, y);
      y += 4.2;
    }

    y += 2;

    // Bank Details Box (always shown on invoices)
    const bankRows: Array<[string, string]> = [
      ['Account Name:', bankDetails.accountName],
      ['Bank:', bankDetails.bankName],
      ['IBAN:', bankDetails.iban],
      ['Currency:', bankDetails.currency],
    ];
    const boxPaddingTop = 5.5;
    const boxRowH = 4.1;
    const boxH = boxPaddingTop + bankRows.length * boxRowH + 2;
    ensureSpace(boxH + 4);

    pdf.setLineWidth(0.3);
    pdf.rect(MARGIN_X, y, CONTENT_W, boxH);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9);
    pdf.text('Bank Details:', MARGIN_X + 3, y + 4.3);

    pdf.setFontSize(8.5);
    bankRows.forEach(([label, val], idx) => {
      const rowY = y + boxPaddingTop + 3.2 + idx * boxRowH;
      pdf.setFont('times', 'bold');
      pdf.text(label, MARGIN_X + 3, rowY);
      pdf.setFont('times', 'normal');
      pdf.text(val || '-', MARGIN_X + 32, rowY);
    });

    y += boxH + 4.5;

    // Editable Invoice Terms
    if (doc.terms.trim()) {
      ensureSpace(8);
      pdf.setFont('times', 'bold');
      pdf.setFontSize(8.5);
      pdf.text('Terms & Conditions:', MARGIN_X, y);
      y += 3.8;

      pdf.setFont('times', 'normal');
      pdf.setFontSize(8);
      const invTermsLines = splitPreservingLines(pdf, doc.terms, CONTENT_W);
      const termLineH = 3.5;
      for (const line of invTermsLines) {
        if (line === '') {
          y += 2;
          continue;
        }
        ensureSpace(termLineH + 1);
        pdf.text(line, MARGIN_X, y);
        y += termLineH;
      }
    }
  }

  pdf.save(getPdfFileName(doc));
}
