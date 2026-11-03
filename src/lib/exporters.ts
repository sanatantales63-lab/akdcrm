import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BusinessSettings,
  Client,
  ClientFinancialSummary,
  DEFAULT_QUOTATION_PDF_SECTIONS,
  Enquiry,
  Expense,
  Payment,
  Project,
  ProjectFinancialSummary,
  Quotation,
  QuotationItem,
  QuotationPDFSections,
  ProjectWorkUpdate,
} from '@/types/crm';
import {
  amountToIndianWords,
  formatDate,
  formatINRForPDF,
  fromPaise,
  safeAdd,
  safeSubtract,
  safeSum,
  toPaise,
} from '@/lib/formatters';

// ============================================================================
// LOGO & SIGNATURE LOADER FOR PDF GENERATION
// Renders /logo.png onto a crisp charcoal architectural badge so the metallic
// champagne gold AKD logo is 100% legible on white print documents.
// ============================================================================

const cachedLogoMap = new Map<string, string>();

async function getBrandedLogoDataUrl(logoUrl: string = '/logo.png'): Promise<string | null> {
  const key = logoUrl || '/logo.png';
  if (cachedLogoMap.has(key)) return cachedLogoMap.get(key) || null;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 240;
          canvas.height = 240;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          // Draw warm charcoal rounded emblem background so gold logo pops cleanly
          ctx.fillStyle = '#1E1E1C';
          const r = 28;
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.lineTo(240 - r, 0);
          ctx.quadraticCurveTo(240, 0, 240, r);
          ctx.lineTo(240, 240 - r);
          ctx.quadraticCurveTo(240, 240, 240 - r, 240);
          ctx.lineTo(r, 240);
          ctx.quadraticCurveTo(0, 240, 0, 240 - r);
          ctx.lineTo(0, r);
          ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.closePath();
          ctx.fill();

          // Subtle gold border
          ctx.strokeStyle = '#C5A059';
          ctx.lineWidth = 4;
          ctx.stroke();

          // Draw official AKD logo centered
          ctx.drawImage(img, 12, 12, 216, 216);
          const dataUrl = canvas.toDataURL('image/png');
          cachedLogoMap.set(key, dataUrl);
          resolve(dataUrl);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = key;
    } catch {
      resolve(null);
    }
  });
}

async function loadImageAsPngDataUrl(
  url?: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!url || !url.trim()) return null;
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = Math.max(1, img.naturalWidth || img.width || 240);
          const h = Math.max(1, img.naturalHeight || img.height || 100);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            width: w,
            height: h,
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url.trim();
    } catch {
      resolve(null);
    }
  });
}

// ============================================================================
// SHARED PDF HEADER, SUMMARY STRIP, AND PAGE NUMBER FOOTER
// ============================================================================

interface PDFHeaderOptions {
  doc: jsPDF;
  settings: BusinessSettings;
  title: string;
  subtitle?: string;
  filterScope?: string;
  logoDataUrl: string | null;
}

function drawPDFHeader({
  doc,
  settings,
  title,
  subtitle,
  filterScope,
  logoDataUrl,
}: PDFHeaderOptions): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Top champagne gold accent hairline
  doc.setFillColor(176, 138, 62); // #B08A3E
  doc.rect(0, 0, pageWidth, 2.2, 'F');

  // Logo badge
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin, 8, 18, 18);
  } else {
    doc.setFillColor(30, 30, 28);
    doc.roundedRect(margin, 8, 18, 18, 2, 2, 'F');
    doc.setTextColor(197, 160, 89);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('AKD', margin + 9, 18.5, { align: 'center' });
  }

  // Studio branding on left next to logo
  const brandX = margin + 22;
  doc.setTextColor(36, 36, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(settings.business_name || 'AKD All Kind Decor', brandX, 13.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(119, 119, 119);
  doc.text(
    `${settings.address || 'Kharagpur, West Bengal'}  |  ${settings.phone || '+91 76027 72338'}`,
    brandX,
    18.5
  );
  doc.text(
    `${settings.email || 'owner@akdstudio.com'}  |  ${settings.website || 'https://www.akdinterior.in/'}`,
    brandX,
    23
  );

  // Report title & metadata on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(36, 36, 36);
  doc.text(title.toUpperCase(), pageWidth - margin, 13.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(119, 119, 119);
  const generatedStr = `Generated: ${formatDate(
    new Date().toISOString().slice(0, 10),
    settings.date_format
  )}`;
  doc.text(generatedStr, pageWidth - margin, 18.5, { align: 'right' });

  if (filterScope || subtitle) {
    doc.text(filterScope || subtitle || '', pageWidth - margin, 23, { align: 'right' });
  }

  // Divider line
  doc.setDrawColor(232, 230, 225); // #E8E6E1
  doc.setLineWidth(0.4);
  doc.line(margin, 29, pageWidth - margin, 29);

  return 34;
}

function drawSummaryBoxes(
  doc: jsPDF,
  startY: number,
  metrics: Array<{ label: string; value: string; sub?: string }>
): number {
  if (!metrics.length) return startY;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const gap = 3;
  const boxWidth = (usableWidth - gap * (metrics.length - 1)) / metrics.length;
  const boxHeight = 17;

  metrics.forEach((m, idx) => {
    const x = margin + idx * (boxWidth + gap);
    doc.setFillColor(247, 247, 245); // #F7F7F5
    doc.setDrawColor(232, 230, 225); // #E8E6E1
    doc.roundedRect(x, startY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(119, 119, 119);
    doc.text(m.label.toUpperCase(), x + 3.5, startY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(36, 36, 36);
    doc.text(m.value, x + 3.5, startY + 12.2);

    if (m.sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(140, 140, 136);
      doc.text(m.sub, x + 3.5, startY + 15.5);
    }
  });

  return startY + boxHeight + 6;
}

function attachPageFooters(doc: jsPDF, settings: BusinessSettings, documentLabel: string) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(232, 230, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(135, 135, 130);
    doc.text(
      `${settings.business_name} — Confidential Business Document (${documentLabel})`,
      margin,
      pageHeight - 7.5
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 7.5, {
      align: 'right',
    });
  }
}

// ============================================================================
// 1. INDIVIDUAL PAYMENT RECEIPT PDF EXPORT
// Explicitly labeled as a PAYMENT RECEIPT (Not a Tax Invoice, no fake GST)
// ============================================================================

export async function exportPaymentReceiptPDF(params: {
  payment: Payment;
  project: Project;
  client: Client;
  allProjectPayments: Payment[];
  settings: BusinessSettings;
}): Promise<void> {
  const { payment, project, client, allProjectPayments, settings } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoDataUrl = await getBrandedLogoDataUrl(settings.logo_url);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;

  // Top gold bar
  doc.setFillColor(176, 138, 62);
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Header
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin, 12, 22, 22);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(36, 36, 36);
  doc.text(settings.business_name || 'AKD All Kind Decor', margin + 26, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(115, 115, 115);
  doc.text(settings.address || 'Kharagpur, West Bengal, India', margin + 26, 23.5);
  doc.text(
    `Phone: ${settings.phone || '+91 76027 72338'}  |  Email: ${settings.email || 'owner@akdstudio.com'}`,
    margin + 26,
    28.5
  );
  doc.text(settings.website || 'https://www.akdinterior.in/', margin + 26, 33);

  // PAYMENT RECEIPT BADGE
  doc.setFillColor(36, 36, 36);
  doc.roundedRect(pageWidth - margin - 56, 12, 56, 11, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('PAYMENT RECEIPT', pageWidth - margin - 28, 19, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(119, 119, 119);
  doc.text('Official Payment Acknowledgment', pageWidth - margin, 27.5, {
    align: 'right',
  });
  doc.text('(Not a Tax Invoice)', pageWidth - margin, 32, { align: 'right' });

  // Horizontal rule
  doc.setDrawColor(232, 230, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, 39, pageWidth - margin, 39);

  // Receipt Meta Strip
  let y = 45;
  doc.setFillColor(247, 247, 245);
  doc.setDrawColor(232, 230, 225);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 2, 2, 'FD');

  const colW = (pageWidth - margin * 2) / 4;
  const metaItems = [
    { label: 'RECEIPT NUMBER', value: payment.receipt_number },
    {
      label: 'PAYMENT DATE',
      value: formatDate(payment.payment_date, settings.date_format),
    },
    { label: 'PAYMENT METHOD', value: payment.payment_method },
    { label: 'PAYMENT TYPE', value: payment.payment_type },
  ];

  metaItems.forEach((item, idx) => {
    const x = margin + idx * colW + 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(119, 119, 119);
    doc.text(item.label, x, y + 7.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(36, 36, 36);
    doc.text(item.value, x, y + 14.5);
  });

  y += 28;

  // Two-column Client & Project Details
  const halfW = (pageWidth - margin * 2 - 6) / 2;

  // Client Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(232, 230, 225);
  doc.roundedRect(margin, y, halfW, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(176, 138, 62);
  doc.text('RECEIVED FROM (CLIENT DETAILS)', margin + 5, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(36, 36, 36);
  doc.text(client.full_name, margin + 5, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(95, 95, 95);
  doc.text(`Client ID: ${client.client_code} (${client.client_type})`, margin + 5, y + 19.5);
  doc.text(`Phone: ${client.phone}`, margin + 5, y + 24.5);
  if (client.email) {
    doc.text(`Email: ${client.email}`, margin + 5, y + 29.5);
  }
  const clientAddr = client.full_address || client.property_location || '';
  if (clientAddr) {
    const wrappedAddr = doc.splitTextToSize(clientAddr, halfW - 10);
    doc.text(wrappedAddr[0] || '', margin + 5, y + 34.5);
  }

  // Project Box
  const projX = margin + halfW + 6;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(232, 230, 225);
  doc.roundedRect(projX, y, halfW, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(176, 138, 62);
  doc.text('ASSOCIATED PROJECT', projX + 5, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(36, 36, 36);
  const wrappedProjName = doc.splitTextToSize(project.project_name, halfW - 10);
  doc.text(wrappedProjName[0] || project.project_name, projX + 5, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(95, 95, 95);
  doc.text(`Project ID: ${project.project_code}`, projX + 5, y + 19.5);
  doc.text(`Category: ${project.category}`, projX + 5, y + 24.5);
  doc.text(`Location: ${project.property_location}`, projX + 5, y + 29.5);
  doc.text(
    `Reference: ${payment.transaction_reference || 'Direct / Not Provided'}`,
    projX + 5,
    y + 34.5
  );

  y += 46;

  // Prominent Amount Received Highlight Box
  doc.setFillColor(248, 244, 235); // Subtle champagne tint
  doc.setDrawColor(230, 216, 184);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(140, 107, 40);
  doc.text('AMOUNT RECEIVED', margin + 6, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(36, 36, 36);
  doc.text(formatINRForPDF(payment.amount), pageWidth - margin - 6, y + 11, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 76);
  const words = amountToIndianWords(payment.amount);
  doc.text(`In Words: ${words}`, margin + 6, y + 19.5);

  y += 34;

  // Calculate Project Balance Statement
  // Sort payments chronologically up to and including this payment
  const activePayments = allProjectPayments.filter((p) => !p.is_archived);
  const totalConfirmedReceived = safeSum(activePayments.map((p) => p.amount));
  const previousPayments = safeSubtract(totalConfirmedReceived, payment.amount);
  const remainingProjectBalance = Math.max(
    0,
    safeSubtract(project.total_value, totalConfirmedReceived)
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(36, 36, 36);
  doc.text('PROJECT FINANCIAL STATEMENT', margin, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Description', 'Amount (INR)']],
    body: [
      ['Total Agreed Project Value', formatINRForPDF(project.total_value)],
      [
        'Other Confirmed Payments Received on Project',
        formatINRForPDF(Math.max(0, previousPayments)),
      ],
      [
        `Current Receipt Amount (${payment.receipt_number} - ${payment.payment_type})`,
        formatINRForPDF(payment.amount),
      ],
      ['Total Confirmed Payments Received to Date', formatINRForPDF(totalConfirmedReceived)],
      ['REMAINING OUTSTANDING PROJECT BALANCE', formatINRForPDF(remainingProjectBalance)],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [36, 36, 36],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3.5,
    },
    bodyStyles: {
      textColor: [36, 36, 36],
      fontSize: 9,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 4) {
        data.cell.styles.fillColor = [247, 247, 245];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  if (payment.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(95, 95, 95);
    doc.text('Payment Notes / Remarks:', margin, y);
    doc.setFont('helvetica', 'normal');
    const wrappedNotes = doc.splitTextToSize(payment.notes, pageWidth - margin * 2);
    doc.text(wrappedNotes, margin, y + 5);
    y += 6 + wrappedNotes.length * 4.5;
  }

  // Authorized Signatory Area
  const sigY = Math.max(y + 18, 228);
  doc.setDrawColor(210, 208, 200);
  doc.line(margin, sigY + 18, margin + 62, sigY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(119, 119, 119);
  doc.text('Client Acknowledgment', margin, sigY + 23);

  doc.line(pageWidth - margin - 68, sigY + 18, pageWidth - margin, sigY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(36, 36, 36);
  doc.text(
    `For ${settings.authorized_signatory || settings.business_name}`,
    pageWidth - margin,
    sigY + 13,
    { align: 'right' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(119, 119, 119);
  doc.text('Authorized Business Signatory', pageWidth - margin, sigY + 23, {
    align: 'right',
  });

  // Explicit Legal Clarification
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(130, 130, 125);
  doc.text(
    'Note: This document is an official payment receipt acknowledging funds received against the specified interior project. It is not a tax invoice.',
    margin,
    274
  );

  attachPageFooters(doc, settings, `Payment Receipt ${payment.receipt_number}`);
  doc.save(`${payment.receipt_number}_${client.full_name.replace(/\s+/g, '_')}.pdf`);
}

// ============================================================================
// 2. CLIENTS EXPORT (PDF & EXCEL)
// ============================================================================

export async function exportClientsPDF(params: {
  clients: ClientFinancialSummary[];
  settings: BusinessSettings;
  filterScope?: string;
}): Promise<void> {
  const { clients, settings, filterScope } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoDataUrl = await getBrandedLogoDataUrl(settings.logo_url);

  let y = drawPDFHeader({
    doc,
    settings,
    title: 'Client Directory & Financial Register',
    filterScope: filterScope || `Total Records: ${clients.length}`,
    logoDataUrl,
  });

  const totalPortfolioValue = safeSum(clients.map((c) => c.totalProjectValue));
  const totalReceived = safeSum(clients.map((c) => c.totalPaymentsReceived));
  const totalOutstanding = safeSum(clients.map((c) => c.outstandingBalance));

  y = drawSummaryBoxes(doc, y, [
    { label: 'Clients in Scope', value: String(clients.length) },
    { label: 'Total Project Value', value: formatINRForPDF(totalPortfolioValue) },
    { label: 'Total Payments Received', value: formatINRForPDF(totalReceived) },
    { label: 'Total Outstanding Balance', value: formatINRForPDF(totalOutstanding) },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [
      [
        'Client ID',
        'Full Name',
        'Phone',
        'Type / Location',
        'Status',
        'Projects',
        'Project Value',
        'Received',
        'Outstanding',
        'Date Added',
      ],
    ],
    body: clients.map((item) => [
      item.client.client_code,
      item.client.full_name,
      item.client.phone,
      `${item.client.client_type}${
        item.client.property_location ? ` • ${item.client.property_location}` : ''
      }`,
      item.client.status,
      String(item.projectCount),
      formatINRForPDF(item.totalProjectValue),
      formatINRForPDF(item.totalPaymentsReceived),
      formatINRForPDF(item.outstandingBalance),
      formatDate(item.client.date_added, settings.date_format),
    ]),
    foot: [
      [
        'TOTAL',
        `${clients.length} Clients`,
        '',
        '',
        '',
        String(clients.reduce((acc, c) => acc + c.projectCount, 0)),
        formatINRForPDF(totalPortfolioValue),
        formatINRForPDF(totalReceived),
        formatINRForPDF(totalOutstanding),
        '',
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [36, 36, 36],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [36, 36, 36],
    },
    footStyles: {
      fillColor: [247, 247, 245],
      textColor: [36, 36, 36],
      fontSize: 8,
      fontStyle: 'bold',
    },
    columnStyles: {
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  });

  attachPageFooters(doc, settings, 'Client Directory');
  doc.save(`AKD_Interior_Clients_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportClientsExcel(params: {
  clients: ClientFinancialSummary[];
  settings: BusinessSettings;
  filterScope?: string;
}): void {
  const { clients, settings, filterScope } = params;
  const wb = XLSX.utils.book_new();

  const totalPortfolioValue = safeSum(clients.map((c) => c.totalProjectValue));
  const totalReceived = safeSum(clients.map((c) => c.totalPaymentsReceived));
  const totalOutstanding = safeSum(clients.map((c) => c.outstandingBalance));

  const summaryRows = [
    [settings.business_name, 'CLIENT DIRECTORY & FINANCIAL REGISTER'],
    ['Generated On', new Date().toISOString().slice(0, 10)],
    ['Filter Scope', filterScope || 'All Active Clients'],
    [],
    ['METRIC', 'VALUE'],
    ['Total Clients Exported', clients.length],
    ['Total Project Value (INR)', totalPortfolioValue],
    ['Total Confirmed Payments Received (INR)', totalReceived],
    ['Total Outstanding Balance (INR)', totalOutstanding],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const detailRows = clients.map((item) => ({
    'Client ID': item.client.client_code,
    'Full Name': item.client.full_name,
    'Phone Number': item.client.phone,
    'WhatsApp Number': item.client.whatsapp || '',
    'Email Address': item.client.email || '',
    'Client Type': item.client.client_type,
    'Property Type': item.client.property_type || '',
    'Property Location': item.client.property_location || '',
    'Full Address': item.client.full_address || '',
    'Estimated Budget (INR)': item.client.project_budget ?? '',
    'Lead Source': item.client.lead_source || '',
    'Client Status': item.client.status,
    'Total Projects': item.projectCount,
    'Total Project Value (INR)': item.totalProjectValue,
    'Payments Received (INR)': item.totalPaymentsReceived,
    'Outstanding Balance (INR)': item.outstandingBalance,
    'Date Added': item.client.date_added,
    Notes: item.client.notes || '',
  }));

  const wsRecords = XLSX.utils.json_to_sheet(detailRows);
  wsRecords['!cols'] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
    { wch: 24 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 30 },
    { wch: 18 },
    { wch: 20 },
    { wch: 15 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 14 },
    { wch: 35 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRecords, 'Clients');

  XLSX.writeFile(wb, `AKD_Interior_Clients_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================================
// 3. INDIVIDUAL CLIENT DOSSIER PDF
// ============================================================================

export async function exportClientDetailPDF(params: {
  summary: ClientFinancialSummary;
  projects: ProjectFinancialSummary[];
  payments: Payment[];
  settings: BusinessSettings;
}): Promise<void> {
  const { summary, projects, payments, settings } = params;
  const { client } = summary;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoDataUrl = await getBrandedLogoDataUrl(settings.logo_url);

  let y = drawPDFHeader({
    doc,
    settings,
    title: `Client Portfolio Statement`,
    subtitle: `${client.full_name} (${client.client_code})`,
    logoDataUrl,
  });

  y = drawSummaryBoxes(doc, y, [
    { label: 'Total Projects', value: String(summary.projectCount) },
    { label: 'Total Project Value', value: formatINRForPDF(summary.totalProjectValue) },
    { label: 'Payments Received', value: formatINRForPDF(summary.totalPaymentsReceived) },
    { label: 'Outstanding Balance', value: formatINRForPDF(summary.outstandingBalance) },
  ]);

  // Client Details Table
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Client Profile Field', 'Details']],
    body: [
      ['Client Name & ID', `${client.full_name} (${client.client_code})`],
      [
        'Phone / WhatsApp',
        `${client.phone}${client.whatsapp ? `  |  WhatsApp: ${client.whatsapp}` : ''}`,
      ],
      ['Email Address', client.email || '—'],
      [
        'Property Type & Location',
        `${client.client_type} • ${client.property_type || 'Standard'} • ${
          client.property_location || '—'
        }`,
      ],
      ['Full Address', client.full_address || '—'],
      ['Status & Date Added', `${client.status}  |  Added ${formatDate(client.date_added, settings.date_format)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [36, 36, 36], fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, textColor: [36, 36, 36] },
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // Associated Projects
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ASSOCIATED PROJECTS', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Project ID', 'Project Name', 'Category', 'Status', 'Value', 'Received', 'Balance']],
    body: projects.length
      ? projects.map((p) => [
          p.project.project_code,
          p.project.project_name,
          p.project.category,
          `${p.project.status} (${p.project.progress_percentage}%)`,
          formatINRForPDF(p.totalValue),
          formatINRForPDF(p.paymentsReceived),
          formatINRForPDF(p.outstandingBalance),
        ])
      : [['—', 'No projects recorded', '—', '—', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [36, 36, 36], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [36, 36, 36] },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  // Payment History
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CONFIRMED PAYMENT HISTORY', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [['Receipt No.', 'Date', 'Type', 'Method', 'Reference', 'Amount']],
    body: payments.length
      ? payments.map((pay) => [
          pay.receipt_number,
          formatDate(pay.payment_date, settings.date_format),
          pay.payment_type,
          pay.payment_method,
          pay.transaction_reference || '—',
          formatINRForPDF(pay.amount),
        ])
      : [['—', 'No payments recorded yet', '—', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [36, 36, 36], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [36, 36, 36] },
    columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
  });

  attachPageFooters(doc, settings, `Client Dossier ${client.client_code}`);
  doc.save(`${client.client_code}_${client.full_name.replace(/\s+/g, '_')}_Portfolio.pdf`);
}

// ============================================================================
// 4. PROJECTS EXPORT (PDF & EXCEL)
// ============================================================================

export async function exportProjectsPDF(params: {
  projects: ProjectFinancialSummary[];
  settings: BusinessSettings;
  filterScope?: string;
}): Promise<void> {
  const { projects, settings, filterScope } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoDataUrl = await getBrandedLogoDataUrl(settings.logo_url);

  let y = drawPDFHeader({
    doc,
    settings,
    title: 'Project Register & Financial Summary',
    filterScope: filterScope || `Projects in Scope: ${projects.length}`,
    logoDataUrl,
  });

  const totalValue = safeSum(projects.map((p) => p.totalValue));
  const totalReceived = safeSum(projects.map((p) => p.paymentsReceived));
  const totalOutstanding = safeSum(projects.map((p) => p.outstandingBalance));
  const totalExpenses = safeSum(projects.map((p) => p.recordedExpenses));

  y = drawSummaryBoxes(doc, y, [
    { label: 'Total Projects', value: String(projects.length) },
    { label: 'Total Project Value', value: formatINRForPDF(totalValue) },
    { label: 'Confirmed Received', value: formatINRForPDF(totalReceived) },
    { label: 'Outstanding Balance', value: formatINRForPDF(totalOutstanding) },
    { label: 'Project Expenses', value: formatINRForPDF(totalExpenses) },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [
      [
        'Project ID',
        'Project Name',
        'Client',
        'Category / Location',
        'Status',
        'Progress',
        'Target Date',
        'Project Value',
        'Received',
        'Balance',
        'Expenses',
      ],
    ],
    body: projects.map((item) => [
      item.project.project_code,
      item.project.project_name,
      item.client?.full_name || '—',
      `${item.project.category} • ${item.project.property_location}`,
      item.project.status,
      `${item.project.progress_percentage}%`,
      formatDate(item.project.expected_completion_date, settings.date_format),
      formatINRForPDF(item.totalValue),
      formatINRForPDF(item.paymentsReceived),
      formatINRForPDF(item.outstandingBalance),
      formatINRForPDF(item.recordedExpenses),
    ]),
    foot: [
      [
        'TOTAL',
        `${projects.length} Projects`,
        '',
        '',
        '',
        '',
        '',
        formatINRForPDF(totalValue),
        formatINRForPDF(totalReceived),
        formatINRForPDF(totalOutstanding),
        formatINRForPDF(totalExpenses),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [36, 36, 36], fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [36, 36, 36] },
    footStyles: { fillColor: [247, 247, 245], textColor: [36, 36, 36], fontSize: 7.5, fontStyle: 'bold' },
    columnStyles: {
      5: { halign: 'center' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'right' },
    },
  });

  attachPageFooters(doc, settings, 'Project Register');
  doc.save(`AKD_Interior_Projects_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportProjectsExcel(params: {
  projects: ProjectFinancialSummary[];
  settings: BusinessSettings;
  filterScope?: string;
}): void {
  const { projects, settings, filterScope } = params;
  const wb = XLSX.utils.book_new();

  const totalValue = safeSum(projects.map((p) => p.totalValue));
  const totalReceived = safeSum(projects.map((p) => p.paymentsReceived));
  const totalOutstanding = safeSum(projects.map((p) => p.outstandingBalance));
  const totalExpenses = safeSum(projects.map((p) => p.recordedExpenses));

  const summaryRows = [
    [settings.business_name, 'PROJECT REGISTER & FINANCIAL SUMMARY'],
    ['Generated On', new Date().toISOString().slice(0, 10)],
    ['Filter Scope', filterScope || 'All Projects'],
    [],
    ['METRIC', 'VALUE'],
    ['Total Projects Exported', projects.length],
    ['Total Agreed Project Value (INR)', totalValue],
    ['Confirmed Payments Received (INR)', totalReceived],
    ['Outstanding Project Balance (INR)', totalOutstanding],
    ['Recorded Project Expenses (INR)', totalExpenses],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const detailRows = projects.map((item) => ({
    'Project ID': item.project.project_code,
    'Project Name': item.project.project_name,
    'Client Name': item.client?.full_name || '',
    'Client Phone': item.client?.phone || '',
    Category: item.project.category,
    'Property Location': item.project.property_location,
    'Site Address': item.project.site_address || '',
    Status: item.project.status,
    'Progress (%)': item.project.progress_percentage,
    'Estimated Start Date': item.project.estimated_start_date || '',
    'Expected Completion Date': item.project.expected_completion_date || '',
    'Actual Completion Date': item.project.actual_completion_date || '',
    'Total Project Value (INR)': item.totalValue,
    'Confirmed Payments Received (INR)': item.paymentsReceived,
    'Outstanding Balance (INR)': item.outstandingBalance,
    'Recorded Project Expenses (INR)': item.recordedExpenses,
    'Payment Terms': item.project.payment_terms || '',
    'Internal Notes': item.project.internal_notes || '',
  }));

  const wsRecords = XLSX.utils.json_to_sheet(detailRows);
  wsRecords['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 22 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 28 },
    { wch: 15 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
    { wch: 22 },
    { wch: 24 },
    { wch: 25 },
    { wch: 32 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRecords, 'Projects');

  XLSX.writeFile(wb, `AKD_Interior_Projects_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================================
// 5. ENQUIRIES EXPORT (PDF & EXCEL)
// ============================================================================

export async function exportEnquiriesPDF(params: {
  enquiries: Enquiry[];
  settings: BusinessSettings;
  filterScope?: string;
}): Promise<void> {
  const { enquiries, settings, filterScope } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoDataUrl = await getBrandedLogoDataUrl(settings.logo_url);

  let y = drawPDFHeader({
    doc,
    settings,
    title: 'Lead & Enquiry Register',
    filterScope: filterScope || `Enquiries in Scope: ${enquiries.length}`,
    logoDataUrl,
  });

  const convertedCount = enquiries.filter((e) => e.status === 'Converted').length;
  const estimatedPipeline = safeSum(enquiries.map((e) => e.estimated_budget || 0));

  y = drawSummaryBoxes(doc, y, [
    { label: 'Total Enquiries', value: String(enquiries.length) },
    { label: 'Converted Enquiries', value: String(convertedCount) },
    {
      label: 'Conversion Rate',
      value: `${enquiries.length ? Math.round((convertedCount / enquiries.length) * 100) : 0}%`,
    },
    { label: 'Estimated Pipeline Value', value: formatINRForPDF(estimatedPipeline) },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [
      [
        'Enquiry ID',
        'Prospect Name',
        'Phone',
        'Project Type',
        'Location',
        'Est. Budget',
        'Lead Source',
        'Enquiry Date',
        'Follow-up Date',
        'Status',
      ],
    ],
    body: enquiries.map((e) => [
      e.enquiry_code,
      e.name,
      e.phone,
      e.project_type,
      e.property_location || '—',
      e.estimated_budget ? formatINRForPDF(e.estimated_budget) : '—',
      e.lead_source || '—',
      formatDate(e.enquiry_date, settings.date_format),
      formatDate(e.follow_up_date, settings.date_format),
      e.status,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [36, 36, 36], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [36, 36, 36] },
    columnStyles: { 5: { halign: 'right' } },
  });

  attachPageFooters(doc, settings, 'Enquiry Register');
  doc.save(`AKD_Interior_Enquiries_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportEnquiriesExcel(params: {
  enquiries: Enquiry[];
  settings: BusinessSettings;
  filterScope?: string;
}): void {
  const { enquiries, settings, filterScope } = params;
  const wb = XLSX.utils.book_new();

  const convertedCount = enquiries.filter((e) => e.status === 'Converted').length;
  const estimatedPipeline = safeSum(enquiries.map((e) => e.estimated_budget || 0));

  const summaryRows = [
    [settings.business_name, 'ENQUIRY & LEAD PIPELINE REPORT'],
    ['Generated On', new Date().toISOString().slice(0, 10)],
    ['Filter Scope', filterScope || 'All Enquiries'],
    [],
    ['METRIC', 'VALUE'],
    ['Total Enquiries', enquiries.length],
    ['Converted Enquiries', convertedCount],
    ['Estimated Pipeline Value (INR)', estimatedPipeline],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 34 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const detailRows = enquiries.map((e) => ({
    'Enquiry ID': e.enquiry_code,
    Name: e.name,
    'Phone Number': e.phone,
    Email: e.email || '',
    'Project Type': e.project_type,
    'Property Location': e.property_location || '',
    'Estimated Budget (INR)': e.estimated_budget ?? '',
    'Lead Source': e.lead_source || '',
    'Enquiry Date': e.enquiry_date,
    'Follow-up Date': e.follow_up_date || '',
    'Enquiry Status': e.status,
    Notes: e.notes || '',
  }));

  const wsRecords = XLSX.utils.json_to_sheet(detailRows);
  wsRecords['!cols'] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 16 },
    { wch: 24 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 35 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRecords, 'Enquiries');

  XLSX.writeFile(wb, `AKD_Interior_Enquiries_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================================
// 6. PAYMENTS EXPORT (PDF & EXCEL)
// ============================================================================

export async function exportPaymentsPDF(params: {
  payments: Array<{ payment: Payment; clientName: string; projectName: string; projectCode: string }>;
  settings: BusinessSettings;
  filterScope?: string;
}): Promise<void> {
  const { payments, settings, filterScope } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoDataUrl = await getBrandedLogoDataUrl(settings.logo_url);

  let y = drawPDFHeader({
    doc,
    settings,
    title: 'Confirmed Payment Ledger',
    filterScope: filterScope || `Transactions: ${payments.length}`,
    logoDataUrl,
  });

  const totalCollected = safeSum(payments.map((p) => p.payment.amount));

  y = drawSummaryBoxes(doc, y, [
    { label: 'Payment Transactions', value: String(payments.length) },
    { label: 'Total Confirmed Receipts', value: formatINRForPDF(totalCollected) },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [
      [
        'Receipt No.',
        'Payment Date',
        'Client Name',
        'Project',
        'Payment Type',
        'Method',
        'Reference',
        'Amount (INR)',
      ],
    ],
    body: payments.map(({ payment, clientName, projectName, projectCode }) => [
      payment.receipt_number,
      formatDate(payment.payment_date, settings.date_format),
      clientName,
      `${projectName} (${projectCode})`,
      payment.payment_type,
      payment.payment_method,
      payment.transaction_reference || '—',
      formatINRForPDF(payment.amount),
    ]),
    foot: [
      [
        'TOTAL',
        `${payments.length} Receipts`,
        '',
        '',
        '',
        '',
        '',
        formatINRForPDF(totalCollected),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [36, 36, 36], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [36, 36, 36] },
    footStyles: { fillColor: [247, 247, 245], textColor: [36, 36, 36], fontSize: 8, fontStyle: 'bold' },
    columnStyles: { 7: { halign: 'right', fontStyle: 'bold' } },
  });

  attachPageFooters(doc, settings, 'Payment Ledger');
  doc.save(`AKD_Interior_Payments_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportPaymentsExcel(params: {
  payments: Array<{ payment: Payment; clientName: string; projectName: string; projectCode: string }>;
  settings: BusinessSettings;
  filterScope?: string;
}): void {
  const { payments, settings, filterScope } = params;
  const wb = XLSX.utils.book_new();

  const totalCollected = safeSum(payments.map((p) => p.payment.amount));

  const summaryRows = [
    [settings.business_name, 'CONFIRMED PAYMENT LEDGER'],
    ['Generated On', new Date().toISOString().slice(0, 10)],
    ['Filter Scope', filterScope || 'All Recorded Payments'],
    [],
    ['METRIC', 'VALUE'],
    ['Total Transactions', payments.length],
    ['Total Confirmed Payments Received (INR)', totalCollected],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const detailRows = payments.map(({ payment, clientName, projectName, projectCode }) => ({
    'Payment ID': payment.payment_code,
    'Receipt Number': payment.receipt_number,
    'Payment Date': payment.payment_date,
    'Client Name': clientName,
    'Project ID': projectCode,
    'Project Name': projectName,
    'Payment Type': payment.payment_type,
    'Payment Method': payment.payment_method,
    'Transaction Reference': payment.transaction_reference || '',
    'Amount Received (INR)': payment.amount,
    Notes: payment.notes || '',
  }));

  const wsRecords = XLSX.utils.json_to_sheet(detailRows);
  wsRecords['!cols'] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 26 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 32 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRecords, 'Payments');

  XLSX.writeFile(wb, `AKD_Interior_Payments_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================================
// 7. EXPENSES EXPORT (PDF & EXCEL)
// ============================================================================

export async function exportExpensesPDF(params: {
  expenses: Array<{ expense: Expense; projectName?: string; projectCode?: string }>;
  settings: BusinessSettings;
  filterScope?: string;
}): Promise<void> {
  const { expenses, settings, filterScope } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoDataUrl = await getBrandedLogoDataUrl(settings.logo_url);

  let y = drawPDFHeader({
    doc,
    settings,
    title: 'Business Expenditure Register',
    filterScope: filterScope || `Expense Records: ${expenses.length}`,
    logoDataUrl,
  });

  const totalExpenditure = safeSum(expenses.map((e) => e.expense.amount));

  y = drawSummaryBoxes(doc, y, [
    { label: 'Expense Vouchers', value: String(expenses.length) },
    { label: 'Total Recorded Expenses', value: formatINRForPDF(totalExpenditure) },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [
      [
        'Expense ID',
        'Date',
        'Expense Title',
        'Category',
        'Project',
        'Vendor / Payee',
        'Method',
        'Reference',
        'Amount (INR)',
      ],
    ],
    body: expenses.map(({ expense, projectName, projectCode }) => [
      expense.expense_code,
      formatDate(expense.expense_date, settings.date_format),
      expense.title,
      expense.category,
      projectName ? `${projectName} (${projectCode})` : 'General Studio Overhead',
      expense.vendor_name || '—',
      expense.payment_method,
      expense.reference_number || '—',
      formatINRForPDF(expense.amount),
    ]),
    foot: [
      [
        'TOTAL',
        `${expenses.length} Entries`,
        '',
        '',
        '',
        '',
        '',
        '',
        formatINRForPDF(totalExpenditure),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [36, 36, 36], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [36, 36, 36] },
    footStyles: { fillColor: [247, 247, 245], textColor: [36, 36, 36], fontSize: 8, fontStyle: 'bold' },
    columnStyles: { 8: { halign: 'right', fontStyle: 'bold' } },
  });

  attachPageFooters(doc, settings, 'Expense Register');
  doc.save(`AKD_Interior_Expenses_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportExpensesExcel(params: {
  expenses: Array<{ expense: Expense; projectName?: string; projectCode?: string }>;
  settings: BusinessSettings;
  filterScope?: string;
}): void {
  const { expenses, settings, filterScope } = params;
  const wb = XLSX.utils.book_new();

  const totalExpenditure = safeSum(expenses.map((e) => e.expense.amount));

  const summaryRows = [
    [settings.business_name, 'BUSINESS EXPENDITURE REGISTER'],
    ['Generated On', new Date().toISOString().slice(0, 10)],
    ['Filter Scope', filterScope || 'All Recorded Expenses'],
    [],
    ['METRIC', 'VALUE'],
    ['Total Expense Entries', expenses.length],
    ['Total Recorded Expenses (INR)', totalExpenditure],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const detailRows = expenses.map(({ expense, projectName, projectCode }) => ({
    'Expense ID': expense.expense_code,
    'Expense Date': expense.expense_date,
    'Expense Title': expense.title,
    Category: expense.category,
    'Project ID': projectCode || '',
    'Associated Project': projectName || 'General Studio Overhead',
    'Vendor / Payee': expense.vendor_name || '',
    'Payment Method': expense.payment_method,
    'Reference Number': expense.reference_number || '',
    'Amount (INR)': expense.amount,
    Notes: expense.notes || '',
  }));

  const wsRecords = XLSX.utils.json_to_sheet(detailRows);
  wsRecords['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 28 },
    { wch: 20 },
    { wch: 14 },
    { wch: 26 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 32 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRecords, 'Expenses');

  XLSX.writeFile(wb, `AKD_Interior_Expenses_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================================
// 8. COMPREHENSIVE FINANCIAL & OPERATIONAL ANALYTICS REPORT (PDF & EXCEL)
// ============================================================================

export async function exportComprehensiveReportPDF(params: {
  settings: BusinessSettings;
  filterScope: string;
  financialMetrics: {
    totalProjectValue: number;
    totalPaymentsReceived: number;
    totalOutstandingReceivables: number;
    totalRecordedExpenses: number;
    netRecordedCashFlow: number;
  };
  operationalMetrics: {
    activeProjects: number;
    completedProjects: number;
    onHoldProjects: number;
    overdueProjects: number;
    newEnquiries: number;
    convertedEnquiries: number;
    conversionRate: number;
  };
  projectRows: ProjectFinancialSummary[];
  monthlySeries: Array<{ month: string; paymentsReceived: number; expenses: number; netCashFlow: number }>;
}): Promise<void> {
  const {
    settings,
    filterScope,
    financialMetrics,
    operationalMetrics,
    projectRows,
    monthlySeries,
  } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logoDataUrl = await getBrandedLogoDataUrl(settings.logo_url);

  let y = drawPDFHeader({
    doc,
    settings,
    title: 'Executive Financial & Operational Report',
    filterScope,
    logoDataUrl,
  });

  y = drawSummaryBoxes(doc, y, [
    { label: 'Total Project Value', value: formatINRForPDF(financialMetrics.totalProjectValue) },
    {
      label: 'Confirmed Payments Received',
      value: formatINRForPDF(financialMetrics.totalPaymentsReceived),
    },
    {
      label: 'Outstanding Receivables',
      value: formatINRForPDF(financialMetrics.totalOutstandingReceivables),
    },
    {
      label: 'Total Recorded Expenses',
      value: formatINRForPDF(financialMetrics.totalRecordedExpenses),
    },
    {
      label: 'Net Recorded Cash Flow',
      value: formatINRForPDF(financialMetrics.netRecordedCashFlow),
      sub: 'Confirmed Receipts minus Expenses',
    },
  ]);

  // Operational summary strip
  y = drawSummaryBoxes(doc, y, [
    { label: 'Active Projects', value: String(operationalMetrics.activeProjects) },
    { label: 'Completed Projects', value: String(operationalMetrics.completedProjects) },
    { label: 'Projects On Hold', value: String(operationalMetrics.onHoldProjects) },
    { label: 'Overdue Projects', value: String(operationalMetrics.overdueProjects) },
    {
      label: 'Enquiry Conversion Rate',
      value: `${operationalMetrics.conversionRate}%`,
      sub: `${operationalMetrics.convertedEnquiries} of ${operationalMetrics.newEnquiries} converted`,
    },
  ]);

  // Project-wise Financial Summary Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(36, 36, 36);
  doc.text('PROJECT-WISE FINANCIAL SUMMARY', 14, y + 2);

  autoTable(doc, {
    startY: y + 5,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [
      [
        'Project ID',
        'Project Name',
        'Client Name',
        'Project Value',
        'Payments Received',
        'Outstanding Balance',
        'Recorded Project Expenses',
        'Project Status',
      ],
    ],
    body: projectRows.length
      ? projectRows.map((p) => [
          p.project.project_code,
          p.project.project_name,
          p.client?.full_name || '—',
          formatINRForPDF(p.totalValue),
          formatINRForPDF(p.paymentsReceived),
          formatINRForPDF(p.outstandingBalance),
          formatINRForPDF(p.recordedExpenses),
          p.project.status,
        ])
      : [['—', 'No projects matching selected filters', '—', '—', '—', '—', '—', '—']],
    foot: projectRows.length
      ? [
          [
            'TOTAL',
            `${projectRows.length} Projects`,
            '',
            formatINRForPDF(safeSum(projectRows.map((p) => p.totalValue))),
            formatINRForPDF(safeSum(projectRows.map((p) => p.paymentsReceived))),
            formatINRForPDF(safeSum(projectRows.map((p) => p.outstandingBalance))),
            formatINRForPDF(safeSum(projectRows.map((p) => p.recordedExpenses))),
            '',
          ],
        ]
      : undefined,
    theme: 'grid',
    headStyles: { fillColor: [36, 36, 36], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [36, 36, 36] },
    footStyles: { fillColor: [247, 247, 245], textColor: [36, 36, 36], fontSize: 8, fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const afterTableY = (doc as any).lastAutoTable.finalY + 8;

  if (monthlySeries.length > 0) {
    if (afterTableY > 155) {
      doc.addPage();
      y = 20;
    } else {
      y = afterTableY;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(36, 36, 36);
    doc.text('MONTHLY RECORDED CASH FLOW BREAKDOWN', 14, y);

    autoTable(doc, {
      startY: y + 3,
      margin: { left: 14, right: 14, bottom: 18 },
      head: [
        [
          'Month',
          'Confirmed Payments Received (INR)',
          'Recorded Expenses (INR)',
          'Net Recorded Cash Flow (INR)',
        ],
      ],
      body: monthlySeries.map((m) => [
        m.month,
        formatINRForPDF(m.paymentsReceived),
        formatINRForPDF(m.expenses),
        formatINRForPDF(m.netCashFlow),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [36, 36, 36], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [36, 36, 36] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
      },
    });
  }

  attachPageFooters(doc, settings, 'Executive Financial & Operational Report');
  doc.save(`AKD_Interior_Executive_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportComprehensiveReportExcel(params: {
  settings: BusinessSettings;
  filterScope: string;
  financialMetrics: {
    totalProjectValue: number;
    totalPaymentsReceived: number;
    totalOutstandingReceivables: number;
    totalRecordedExpenses: number;
    netRecordedCashFlow: number;
  };
  operationalMetrics: {
    activeProjects: number;
    completedProjects: number;
    onHoldProjects: number;
    overdueProjects: number;
    newEnquiries: number;
    convertedEnquiries: number;
    conversionRate: number;
  };
  projectRows: ProjectFinancialSummary[];
  monthlySeries: Array<{ month: string; paymentsReceived: number; expenses: number; netCashFlow: number }>;
}): void {
  const {
    settings,
    filterScope,
    financialMetrics,
    operationalMetrics,
    projectRows,
    monthlySeries,
  } = params;
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    [settings.business_name, 'EXECUTIVE FINANCIAL & OPERATIONAL REPORT'],
    ['Generated On', new Date().toISOString().slice(0, 10)],
    ['Selected Filter Scope', filterScope],
    [],
    ['FINANCIAL SUMMARY', 'AMOUNT (INR)'],
    ['Total Project Value', financialMetrics.totalProjectValue],
    ['Confirmed Payments Received', financialMetrics.totalPaymentsReceived],
    ['Total Outstanding Receivables', financialMetrics.totalOutstandingReceivables],
    ['Total Recorded Expenses', financialMetrics.totalRecordedExpenses],
    ['Net Recorded Cash Flow (Receipts minus Expenses)', financialMetrics.netRecordedCashFlow],
    [],
    ['OPERATIONAL SUMMARY', 'COUNT / RATE'],
    ['Active Projects', operationalMetrics.activeProjects],
    ['Completed Projects', operationalMetrics.completedProjects],
    ['Projects On Hold', operationalMetrics.onHoldProjects],
    ['Overdue Projects', operationalMetrics.overdueProjects],
    ['Enquiries in Period', operationalMetrics.newEnquiries],
    ['Converted Enquiries', operationalMetrics.convertedEnquiries],
    ['Enquiry Conversion Rate (%)', operationalMetrics.conversionRate],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 46 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  const wsProjects = XLSX.utils.json_to_sheet(
    projectRows.map((p) => ({
      'Project ID': p.project.project_code,
      'Project Name': p.project.project_name,
      'Client Name': p.client?.full_name || '',
      'Project Category': p.project.category,
      'Project Value (INR)': p.totalValue,
      'Payments Received (INR)': p.paymentsReceived,
      'Outstanding Balance (INR)': p.outstandingBalance,
      'Recorded Project Expenses (INR)': p.recordedExpenses,
      'Project Status': p.project.status,
      'Progress (%)': p.project.progress_percentage,
    }))
  );
  wsProjects['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
    { wch: 26 },
    { wch: 16 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsProjects, 'Project Financial Report');

  const wsMonthly = XLSX.utils.json_to_sheet(
    monthlySeries.map((m) => ({
      Month: m.month,
      'Confirmed Payments Received (INR)': m.paymentsReceived,
      'Recorded Expenses (INR)': m.expenses,
      'Net Recorded Cash Flow (INR)': m.netCashFlow,
    }))
  );
  wsMonthly['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 24 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Cash Flow');

  XLSX.writeFile(wb, `AKD_Interior_Executive_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================================
// 9. INDIVIDUAL PROJECT DOSSIER PDF EXPORT
// ============================================================================

export async function exportProjectDetailPDF(params: {
  summary: ProjectFinancialSummary;
  payments: Payment[];
  expenses: Expense[];
  settings: BusinessSettings;
}): Promise<void> {
  const { summary, payments, expenses, settings } = params;
  const { project, client } = summary;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoDataUrl = await getBrandedLogoDataUrl(settings.logo_url);

  let y = drawPDFHeader({
    doc,
    settings,
    title: 'Project Execution & Financial Dossier',
    subtitle: `${project.project_name} (${project.project_code})`,
    logoDataUrl,
  });

  y = drawSummaryBoxes(doc, y, [
    { label: 'Total Project Value', value: formatINRForPDF(summary.totalValue) },
    { label: 'Confirmed Received', value: formatINRForPDF(summary.paymentsReceived) },
    { label: 'Outstanding Balance', value: formatINRForPDF(summary.outstandingBalance) },
    { label: 'Recorded Expenses', value: formatINRForPDF(summary.recordedExpenses) },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Project Attribute', 'Specification']],
    body: [
      ['Project Name & Code', `${project.project_name} (${project.project_code})`],
      ['Client', client ? `${client.full_name} (${client.phone})` : '—'],
      ['Category & Location', `${project.category} • ${project.property_location}`],
      ['Full Site Address', project.site_address || '—'],
      ['Status & Progress', `${project.status} (${project.progress_percentage}% Complete)`],
      [
        'Project Timeline',
        `Start: ${formatDate(project.estimated_start_date, settings.date_format)}  |  Target: ${formatDate(
          project.expected_completion_date,
          settings.date_format
        )}${
          project.actual_completion_date
            ? `  |  Completed: ${formatDate(project.actual_completion_date, settings.date_format)}`
            : ''
        }`,
      ],
      ['Payment Terms', project.payment_terms || '—'],
      ['Scope / Description', project.description || '—'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [36, 36, 36], fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, textColor: [36, 36, 36] },
    columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PROJECT PAYMENT LEDGER', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [['Receipt No.', 'Date', 'Type', 'Method', 'Reference', 'Amount']],
    body: payments.length
      ? payments.map((p) => [
          p.receipt_number,
          formatDate(p.payment_date, settings.date_format),
          p.payment_type,
          p.payment_method,
          p.transaction_reference || '—',
          formatINRForPDF(p.amount),
        ])
      : [['—', 'No payments recorded yet', '—', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [36, 36, 36], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [36, 36, 36] },
    columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('RECORDED PROJECT EXPENSES', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [['Expense ID', 'Date', 'Title', 'Category', 'Vendor', 'Amount']],
    body: expenses.length
      ? expenses.map((e) => [
          e.expense_code,
          formatDate(e.expense_date, settings.date_format),
          e.title,
          e.category,
          e.vendor_name || '—',
          formatINRForPDF(e.amount),
        ])
      : [['—', 'No project-specific expenses recorded', '—', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [36, 36, 36], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [36, 36, 36] },
    columnStyles: { 5: { halign: 'right', fontStyle: 'bold' } },
  });

  attachPageFooters(doc, settings, `Project Dossier ${project.project_code}`);
  doc.save(`${project.project_code}_${project.project_name.replace(/\s+/g, '_')}.pdf`);
}

// ============================================================================
// 10. FULL BUSINESS DATA EXPORT WORKBOOK (FOR SETTINGS -> DATA MANAGEMENT)
// ============================================================================

export function exportFullDatabaseWorkbook(params: {
  settings: BusinessSettings;
  clients: Client[];
  enquiries: Enquiry[];
  projects: Project[];
  payments: Payment[];
  expenses: Expense[];
}): void {
  const { settings, clients, enquiries, projects, payments, expenses } = params;
  const wb = XLSX.utils.book_new();

  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const wsClients = XLSX.utils.json_to_sheet(
    clients.map((c) => ({
      'Client ID': c.client_code,
      'Full Name': c.full_name,
      Phone: c.phone,
      WhatsApp: c.whatsapp || '',
      Email: c.email || '',
      Type: c.client_type,
      'Property Type': c.property_type || '',
      Location: c.property_location || '',
      Address: c.full_address || '',
      'Budget (INR)': c.project_budget ?? '',
      'Lead Source': c.lead_source || '',
      Status: c.status,
      'Date Added': c.date_added,
      Notes: c.notes || '',
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsClients, 'Clients');

  const wsProjects = XLSX.utils.json_to_sheet(
    projects.map((p) => ({
      'Project ID': p.project_code,
      'Project Name': p.project_name,
      Client: clientMap.get(p.client_id)?.full_name || '',
      Category: p.category,
      Location: p.property_location,
      'Site Address': p.site_address || '',
      Status: p.status,
      'Progress (%)': p.progress_percentage,
      'Total Value (INR)': p.total_value,
      'Start Date': p.estimated_start_date || '',
      'Expected Completion': p.expected_completion_date || '',
      'Actual Completion': p.actual_completion_date || '',
      'Payment Terms': p.payment_terms || '',
      Notes: p.internal_notes || '',
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsProjects, 'Projects');

  const wsEnquiries = XLSX.utils.json_to_sheet(
    enquiries.map((e) => ({
      'Enquiry ID': e.enquiry_code,
      Name: e.name,
      Phone: e.phone,
      Email: e.email || '',
      'Project Type': e.project_type,
      Location: e.property_location || '',
      'Estimated Budget (INR)': e.estimated_budget ?? '',
      'Lead Source': e.lead_source || '',
      'Enquiry Date': e.enquiry_date,
      'Follow-up Date': e.follow_up_date || '',
      Status: e.status,
      Notes: e.notes || '',
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsEnquiries, 'Enquiries');

  const wsPayments = XLSX.utils.json_to_sheet(
    payments.map((pay) => ({
      'Payment ID': pay.payment_code,
      'Receipt Number': pay.receipt_number,
      Date: pay.payment_date,
      Client: clientMap.get(pay.client_id)?.full_name || '',
      Project: projectMap.get(pay.project_id)?.project_name || '',
      'Amount (INR)': pay.amount,
      Method: pay.payment_method,
      Type: pay.payment_type,
      Reference: pay.transaction_reference || '',
      Notes: pay.notes || '',
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments');

  const wsExpenses = XLSX.utils.json_to_sheet(
    expenses.map((exp) => ({
      'Expense ID': exp.expense_code,
      Date: exp.expense_date,
      Title: exp.title,
      Category: exp.category,
      Project: exp.project_id ? projectMap.get(exp.project_id)?.project_name || '' : 'General Overhead',
      Vendor: exp.vendor_name || '',
      'Amount (INR)': exp.amount,
      Method: exp.payment_method,
      Reference: exp.reference_number || '',
      Notes: exp.notes || '',
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

  XLSX.writeFile(
    wb,
    `${settings.business_name.replace(/\s+/g, '_')}_Full_CRM_Export_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`
  );
}

// ============================================================================
// QUOTATION & ITEMIZED BOQ PDF EXPORTER
// "Midnight Atelier" layout: charcoal brand band with champagne-gold accents,
// strictly labeled as QUOTATION, with full support for independent PDF section
// selection & multi-page flow without clipping. Only the visual styling lives
// here — quotation data, totals and section toggles are untouched.
// ============================================================================
export async function buildQuotationPDFDoc(params: {
  quotation: Quotation;
  client: Client;
  project?: Project;
  settings: BusinessSettings;
  sections?: Partial<QuotationPDFSections>;
}): Promise<jsPDF> {
  const { quotation, client, project, settings } = params;
  const sections: QuotationPDFSections = {
    ...DEFAULT_QUOTATION_PDF_SECTIONS,
    ...(settings.quotation_pdf_defaults || {}),
    ...(quotation.pdf_sections || {}),
    ...(params.sections || {}),
  };

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const [logoDataUrl, signatureImg] = await Promise.all([
    sections.showBusinessDetails ? getBrandedLogoDataUrl(settings.logo_url) : Promise.resolve(null),
    sections.showSignature && settings.signature_url
      ? loadImageAsPngDataUrl(settings.signature_url)
      : Promise.resolve(null),
  ]);

  // ---- Palette (RGB) ----
  type RGB = [number, number, number];
  const INK: RGB = [24, 23, 19]; // warm charcoal
  const GOLD: RGB = [197, 160, 89]; // champagne gold
  const GOLD_SOFT: RGB = [233, 213, 161]; // light gold for text on charcoal
  const GOLD_DEEP: RGB = [138, 106, 34]; // gold for text on paper
  const PAPER: RGB = [250, 248, 242]; // warm card fill
  const HAIR: RGB = [229, 224, 210]; // hairlines
  const TEXT: RGB = [44, 40, 32]; // body text
  const MUTED: RGB = [120, 113, 98]; // labels
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const usableWidth = pageWidth - margin * 2;
  const pageBottom = pageHeight - 18;
  const rightEdge = pageWidth - margin;

  // 1. Brand band — measure first so the charcoal band always fits its content
  const showBiz = sections.showBusinessDetails;
  const logoSize = 22;
  const brandX = margin + logoSize + 5;
  const rightBlockW = 74; // reserved for the QUOTATION title on the right
  const maxBrandW = usableWidth - logoSize - 5 - rightBlockW;

  let bizNameLines: string[] = [];
  let addrLines: string[] = [];
  let contactLines: string[] = [];
  let extraLines: string[] = [];
  let brandBottomY = 0;

  if (showBiz) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    bizNameLines = doc.splitTextToSize(
      (settings.business_name || 'ALL KIND DECOR INTERIOR').toUpperCase(),
      maxBrandW
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (settings.address?.trim()) {
      addrLines = doc.splitTextToSize(settings.address.trim(), maxBrandW);
    }
    const contactParts: string[] = [];
    if (settings.phone?.trim()) contactParts.push(`Mobile: ${settings.phone.trim()}`);
    if (settings.email?.trim()) contactParts.push(`Email: ${settings.email.trim()}`);
    if (contactParts.length > 0) {
      contactLines = doc.splitTextToSize(contactParts.join('   |   '), maxBrandW);
    }
    const extraParts: string[] = [];
    if (settings.website?.trim()) extraParts.push(settings.website.trim());
    if (settings.gstin?.trim()) extraParts.push(`GSTIN: ${settings.gstin.trim()}`);
    if (extraParts.length > 0) {
      extraLines = doc.splitTextToSize(extraParts.join('   |   '), maxBrandW);
    }

    brandBottomY =
      14 +
      bizNameLines.length * 5 +
      addrLines.length * 3.8 +
      contactLines.length * 3.8 +
      extraLines.length * 3.8;
  }

  const bandH = Math.max(38, showBiz ? Math.max(9 + logoSize, brandBottomY) + 6 : 0);

  // Band background + gold rule
  setFill(INK);
  doc.rect(0, 0, pageWidth, bandH, 'F');
  setFill(GOLD);
  doc.rect(0, bandH, pageWidth, 1.2, 'F');

  if (showBiz) {
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', margin, 9, logoSize, logoSize);
    } else {
      setFill([38, 36, 30]);
      doc.roundedRect(margin, 9, logoSize, logoSize, 2.5, 2.5, 'F');
      setText(GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('AKD', margin + logoSize / 2, 21.5, { align: 'center' });
    }

    let bY = 14.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setText([248, 241, 223]);
    doc.text(bizNameLines, brandX, bY);
    bY += bizNameLines.length * 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText([196, 188, 170]);
    if (addrLines.length) {
      doc.text(addrLines, brandX, bY);
      bY += addrLines.length * 3.8;
    }
    if (contactLines.length) {
      setText(GOLD_SOFT);
      doc.text(contactLines, brandX, bY);
      bY += contactLines.length * 3.8;
    }
    if (extraLines.length) {
      setText([160, 152, 134]);
      doc.text(extraLines, brandX, bY);
    }
  }

  // Title block: right-aligned beside the brand, or left-aligned when no brand is shown
  const titleX = showBiz ? rightEdge : margin;
  const titleAlign = showBiz ? 'right' : 'left';
  doc.setFont('times', 'bold');
  doc.setFontSize(25);
  setText(GOLD);
  doc.text('QUOTATION', titleX, 20, { align: titleAlign });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  setText([160, 152, 134]);
  doc.text('ORIGINAL FOR RECIPIENT', titleX, 26, { align: titleAlign });

  // 2. Meta strip (Quotation no. / Date / Valid until) beneath the band
  const revSuffix = quotation.revision_number > 1 ? ` (Rev ${quotation.revision_number})` : '';
  const metaCells: Array<{ label: string; value: string }> = [
    { label: 'QUOTATION NO.', value: `${quotation.quotation_number}${revSuffix}` },
    { label: 'DATE', value: formatDate(quotation.quotation_date, settings.date_format) },
    { label: 'VALID UNTIL', value: formatDate(quotation.valid_until, settings.date_format) },
  ];
  const metaTop = bandH + 1.2 + 5;
  const metaH = 14;
  setFill(PAPER);
  setDraw(HAIR);
  doc.setLineWidth(0.3);
  doc.rect(margin, metaTop, usableWidth, metaH, 'FD');
  const metaColW = usableWidth / metaCells.length;
  metaCells.forEach((cell, i) => {
    const cx = margin + i * metaColW;
    if (i > 0) {
      setDraw(HAIR);
      doc.line(cx, metaTop + 3, cx, metaTop + metaH - 3);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    setText(MUTED);
    doc.text(cell.label, cx + 5, metaTop + 5.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setText(INK);
    const valueLine = doc.splitTextToSize(cell.value, metaColW - 10)[0] || cell.value;
    doc.text(valueLine, cx + 5, metaTop + 10.6);
  });

  let curY = metaTop + metaH + 5;

  // 3. Client Details Box & Project/Work-Site Details Box
  const showClient = sections.showClientDetails;
  const showProject = sections.showProjectDetails;

  if (showClient || showProject) {
    const bothShown = showClient && showProject;
    const boxGap = 4;
    const boxW = bothShown ? (usableWidth - boxGap) / 2 : usableWidth;
    const innerW = boxW - 10;

    // Prepare Client Lines
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.8);
    const clientNameLines = showClient
      ? doc.splitTextToSize(client.full_name || 'Client', innerW)
      : [];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const clientDetailLines: string[] = [];
    if (showClient) {
      if (client.phone?.trim()) {
        clientDetailLines.push(`Phone: ${client.phone.trim()}`);
      }
      if (client.email?.trim()) {
        clientDetailLines.push(`Email: ${client.email.trim()}`);
      }
      const addr = client.full_address?.trim() || client.property_location?.trim() || '';
      if (addr) {
        clientDetailLines.push(...doc.splitTextToSize(`Addr: ${addr}`, innerW));
      }
    }

    // Prepare Project / Work-Site Lines
    const projTitleRaw = project?.project_name?.trim()
      ? project.project_name.trim()
      : client.property_type?.trim()
        ? `${client.property_type.trim()} Interior Work`
        : `${client.client_type || 'Residential'} Interior Work`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.8);
    const projTitleLines = showProject ? doc.splitTextToSize(projTitleRaw, innerW) : [];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const projDetailLines: string[] = [];
    if (showProject) {
      if (project?.category) {
        const codePart = project.project_code ? ` (${project.project_code})` : '';
        projDetailLines.push(`Category: ${project.category}${codePart}`);
      } else if (client.property_type?.trim()) {
        projDetailLines.push(`Property Type: ${client.property_type.trim()}`);
      }
      const siteLoc =
        project?.site_address?.trim() ||
        project?.property_location?.trim() ||
        client.full_address?.trim() ||
        client.property_location?.trim() ||
        '';
      if (siteLoc) {
        projDetailLines.push(...doc.splitTextToSize(`Loc: ${siteLoc}`, innerW));
      }
    }

    const clientBoxContentH =
      8 + clientNameLines.length * 4.5 + clientDetailLines.length * 3.9 + 4;
    const projBoxContentH = 8 + projTitleLines.length * 4.5 + projDetailLines.length * 3.9 + 4;
    const boxH = Math.max(
      24,
      bothShown
        ? Math.max(clientBoxContentH, projBoxContentH)
        : showClient
          ? clientBoxContentH
          : projBoxContentH
    );

    const drawDetailBox = (
      x: number,
      heading: string,
      titleLines: string[],
      detailLines: string[]
    ) => {
      setFill(PAPER);
      setDraw(HAIR);
      doc.setLineWidth(0.3);
      doc.rect(x, curY, boxW, boxH, 'FD');
      setFill(GOLD);
      doc.rect(x, curY, 1.4, boxH, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      setText(GOLD_DEEP);
      doc.text(heading.toUpperCase(), x + 5, curY + 5.2);

      let lineY = curY + 10.6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.8);
      setText(INK);
      doc.text(titleLines, x + 5, lineY);
      lineY += titleLines.length * 4.5 + 0.6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      setText(TEXT);
      detailLines.forEach((dl) => {
        doc.text(dl, x + 5, lineY);
        lineY += 3.9;
      });
    };

    if (showClient && showProject) {
      drawDetailBox(margin, 'Client Details (Bill To)', clientNameLines, clientDetailLines);
      drawDetailBox(
        margin + boxW + boxGap,
        'Project / Work-Site Details',
        projTitleLines,
        projDetailLines
      );
    } else if (showClient) {
      drawDetailBox(margin, 'Client Details (Bill To)', clientNameLines, clientDetailLines);
    } else if (showProject) {
      drawDetailBox(margin, 'Project / Work-Site Details', projTitleLines, projDetailLines);
    }

    curY += boxH + 6;
  }

  // 4. BOQ Line Items Table (when enabled)
  if (sections.showBoqTable) {
    const sortedItems = [...(quotation.items || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );

    const showPricingCols = sections.showRateQtyAmount;
    const headRow = showPricingCols
      ? [['#', 'DESCRIPTION OF WORK / SERVICE', 'RATE (Rs.)', 'QUANTITY', 'AMOUNT (Rs.)']]
      : [['#', 'DESCRIPTION OF WORK / SERVICE', 'UNIT']];

    // Explicit column widths so the description text can be laid out precisely
    const fixedColsW = showPricingCols ? 10 + 30 + 28 + 32 : 12 + 28;
    const descColW = usableWidth - fixedColsW;
    const cellPadX = 3.2;
    const cellPadY = 3.4;
    const descInnerW = descColW - cellPadX * 2;
    const NAME_LH = 4.1;
    const DESC_LH = 3.6;

    // Item title (bold) + description (muted) are laid out manually per row
    const itemLayouts = sortedItems.map((it) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      const nameLines: string[] = doc.splitTextToSize(it.item_name?.trim() || '-', descInnerW);
      let descLines: string[] = [];
      if (it.description?.trim()) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        descLines = doc.splitTextToSize(it.description.trim(), descInnerW);
      }
      const contentH =
        nameLines.length * NAME_LH + (descLines.length ? 0.9 + descLines.length * DESC_LH : 0);
      return { nameLines, descLines, minH: contentH + cellPadY * 2 };
    });

    const bodyRows = sortedItems.map((it, idx) => {
      const descCell = { content: '', styles: { minCellHeight: itemLayouts[idx].minH } };
      if (showPricingCols) {
        return [
          String(idx + 1).padStart(2, '0'),
          descCell,
          formatINRForPDF(it.rate, 'Rs. '),
          `${it.quantity.toLocaleString('en-IN')} ${it.unit}`,
          formatINRForPDF(it.amount, 'Rs. '),
        ];
      }
      return [String(idx + 1).padStart(2, '0'), descCell, it.unit];
    });

    autoTable(doc, {
      startY: curY,
      head: headRow,
      body: bodyRows,
      margin: { left: margin, right: margin, bottom: 18 },
      theme: 'plain',
      headStyles: {
        fillColor: INK,
        textColor: GOLD_SOFT,
        font: 'helvetica',
        fontStyle: 'bold',
        fontSize: 7.4,
        cellPadding: { top: 3.4, bottom: 3.4, left: cellPadX, right: cellPadX },
      },
      bodyStyles: {
        textColor: TEXT,
        fontSize: 8.4,
        cellPadding: { top: cellPadY, bottom: cellPadY, left: cellPadX, right: cellPadX },
        valign: 'top',
      },
      alternateRowStyles: {
        fillColor: PAPER,
      },
      columnStyles: showPricingCols
        ? {
            0: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: GOLD_DEEP },
            1: { cellWidth: descColW },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 28, halign: 'center' },
            4: { cellWidth: 32, halign: 'right', fontStyle: 'bold', textColor: INK },
          }
        : {
            0: { cellWidth: 12, halign: 'center', fontStyle: 'bold', textColor: GOLD_DEEP },
            1: { cellWidth: descColW },
            2: { cellWidth: 28, halign: 'center' },
          },
      styles: {
        overflow: 'linebreak',
      },
      // Never split a line item across two pages
      rowPageBreak: 'avoid',
      // Align header labels with the alignment of their column values
      didParseCell: (hook) => {
        if (hook.section !== 'head') return;
        const alignByCol: Array<'left' | 'center' | 'right'> = showPricingCols
          ? ['center', 'left', 'right', 'center', 'right']
          : ['center', 'left', 'center'];
        hook.cell.styles.halign = alignByCol[hook.column.index] || 'left';
      },
      didDrawCell: (hook) => {
        if (hook.section !== 'body') return;
        const { cell, row, column } = hook;

        // Hairline under every row; stronger gold rule closing the table
        const isLastRow = row.index === bodyRows.length - 1;
        if (isLastRow) {
          setDraw(GOLD);
          doc.setLineWidth(0.5);
        } else {
          setDraw(HAIR);
          doc.setLineWidth(0.2);
        }
        doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);

        // Description column: bold item title + muted detail lines
        if (column.index === 1) {
          const layout = itemLayouts[row.index];
          if (!layout) return;
          let ty = cell.y + cellPadY + 2.9;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.8);
          setText(INK);
          layout.nameLines.forEach((ln) => {
            doc.text(ln, cell.x + cellPadX, ty);
            ty += NAME_LH;
          });
          if (layout.descLines.length) {
            ty += 0.9 - 0.4;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.8);
            setText(MUTED);
            layout.descLines.forEach((ln) => {
              doc.text(ln, cell.x + cellPadX, ty);
              ty += DESC_LH;
            });
          }
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    curY = ((doc as any).lastAutoTable?.finalY || curY + 20) + 6;
  }

  // 5. Financial Totals (Right) & Total Amount in Words (Left)
  // Note: Hiding discount or tax never alters the saved quotation.total_amount.
  const summaryRows: Array<{
    label: string;
    value: string;
    color?: RGB;
  }> = [];

  summaryRows.push({
    label: 'Sub Total',
    value: formatINRForPDF(quotation.subtotal, 'Rs. '),
  });

  if (sections.showDiscount && quotation.discount_amount > 0) {
    summaryRows.push({
      label: `Discount (${quotation.discount_percentage}%)`,
      value: `- ${formatINRForPDF(quotation.discount_amount, 'Rs. ')}`,
      color: [185, 28, 28],
    });
  }

  if (sections.showTax && quotation.tax_rate > 0 && quotation.tax_amount > 0) {
    summaryRows.push({
      label: `Tax / GST (${quotation.tax_rate}%)`,
      value: `+ ${formatINRForPDF(quotation.tax_amount, 'Rs. ')}`,
    });
  }

  const grandTotalValue = formatINRForPDF(quotation.total_amount, 'Rs. ');

  const summaryBoxW = 78;
  const wordsBoxW = usableWidth - summaryBoxW - 6;
  const wordsStr = amountToIndianWords(quotation.total_amount);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  const wordsLines = doc.splitTextToSize(wordsStr, wordsBoxW - 11);

  const ROW_H = 6.2;
  const GRAND_H = 11;
  const wordsBoxH = 11 + wordsLines.length * 4.3 + 3.5;
  const summaryBlockH = summaryRows.length * ROW_H + 2 + GRAND_H;
  const totalsSectionH = Math.max(wordsBoxH, summaryBlockH, 24);

  if (curY + totalsSectionH > pageBottom) {
    doc.addPage();
    curY = 16;
  }

  // Left: Total Amount (in words) card
  setFill(PAPER);
  setDraw(HAIR);
  doc.setLineWidth(0.3);
  doc.rect(margin, curY, wordsBoxW, totalsSectionH, 'FD');
  setFill(GOLD);
  doc.rect(margin, curY, 1.4, totalsSectionH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setText(GOLD_DEEP);
  doc.text('TOTAL AMOUNT (IN WORDS)', margin + 5, curY + 5.4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  setText(INK);
  doc.text(wordsLines, margin + 5, curY + 11);

  // Right: Financial summary rows, closed by a charcoal GRAND TOTAL bar
  const summaryBoxX = margin + wordsBoxW + 6;
  let rY = curY + 4.2;
  summaryRows.forEach((row) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    setText(MUTED);
    doc.text(row.label, summaryBoxX, rY);

    setText(row.color || INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.text(row.value, summaryBoxX + summaryBoxW, rY, { align: 'right' });

    setDraw(HAIR);
    doc.setLineWidth(0.2);
    doc.line(summaryBoxX, rY + 2, summaryBoxX + summaryBoxW, rY + 2);
    rY += ROW_H;
  });

  const grandTop = curY + summaryRows.length * ROW_H + 2;
  setFill(INK);
  doc.rect(summaryBoxX, grandTop, summaryBoxW, GRAND_H, 'F');
  setFill(GOLD);
  doc.rect(summaryBoxX, grandTop, 1.4, GRAND_H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  setText(GOLD_SOFT);
  doc.text('GRAND TOTAL', summaryBoxX + 5, grandTop + 6.7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  setText([255, 255, 255]);
  doc.text(grandTotalValue, summaryBoxX + summaryBoxW - 4, grandTop + 6.9, { align: 'right' });

  curY += totalsSectionH + 7;

  // 6. Multi-Page Safe Optional Narrative Sections
  const drawNarrativeSection = (heading: string, content?: string) => {
    const clean = content?.trim();
    if (!clean) return;

    if (curY + 16 > pageBottom) {
      doc.addPage();
      curY = 16;
    }

    // Heading: gold tick + uppercase title + hairline
    setFill(GOLD);
    doc.rect(margin, curY - 0.4, 1.4, 5.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setText(INK);
    doc.text(heading.toUpperCase(), margin + 4, curY + 3.5);
    setDraw(HAIR);
    doc.setLineWidth(0.3);
    doc.line(margin, curY + 6.3, pageWidth - margin, curY + 6.3);
    curY += 11;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    setText(TEXT);

    const lines: string[] = doc.splitTextToSize(clean, usableWidth - 4);
    lines.forEach((line) => {
      if (curY + 4.2 > pageBottom) {
        doc.addPage();
        curY = 16;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.3);
        setText(TEXT);
      }
      doc.text(line, margin + 2, curY);
      curY += 4.2;
    });

    curY += 4;
  };

  if (sections.showScopeOfWork && quotation.scope_of_work?.trim()) {
    drawNarrativeSection('Scope of Work & Specifications', quotation.scope_of_work);
  }

  const resolvedPaymentTerms = quotation.payment_terms?.trim() || '';
  if (sections.showPaymentTerms && resolvedPaymentTerms) {
    drawNarrativeSection('Payment Terms', resolvedPaymentTerms);
  }

  if (sections.showTermsAndConditions && quotation.terms_and_conditions?.trim()) {
    drawNarrativeSection('Terms and Conditions', quotation.terms_and_conditions);
  }

  if (sections.showNotes && quotation.notes?.trim()) {
    drawNarrativeSection('Notes', quotation.notes);
  }

  // 7. Bottom Row: Optional Bank Details (Left) & Optional Authorized Signature (Right)
  const bankRows: Array<[string, string]> = [];
  if (sections.showBankDetails) {
    if (settings.bank_account_name?.trim()) {
      bankRows.push(['Account Name:', settings.bank_account_name.trim()]);
    }
    if (settings.bank_name?.trim()) {
      bankRows.push(['Bank Name:', settings.bank_name.trim()]);
    }
    if (settings.bank_account_number?.trim()) {
      bankRows.push(['Account No.:', settings.bank_account_number.trim()]);
    }
    if (settings.bank_ifsc_code?.trim()) {
      bankRows.push(['IFSC Code:', settings.bank_ifsc_code.trim()]);
    }
    if (settings.bank_branch?.trim()) {
      bankRows.push(['Branch:', settings.bank_branch.trim()]);
    }
    if (settings.bank_upi_id?.trim()) {
      bankRows.push(['UPI ID:', settings.bank_upi_id.trim()]);
    }
  }

  const hasBankBox = sections.showBankDetails && bankRows.length > 0;
  const hasSigBox = sections.showSignature;

  if (hasBankBox || hasSigBox) {
    const bankBoxH = hasBankBox ? 10 + bankRows.length * 4.6 + 3 : 0;
    const sigBoxH = hasSigBox ? 32 : 0;
    const bottomBlockH = Math.max(bankBoxH, sigBoxH);

    if (curY + bottomBlockH + 2 > pageBottom) {
      doc.addPage();
      curY = 16;
    }

    const bankW = hasSigBox ? usableWidth * 0.58 : usableWidth;

    if (hasBankBox) {
      setFill(PAPER);
      setDraw(HAIR);
      doc.setLineWidth(0.3);
      doc.rect(margin, curY, bankW, bankBoxH, 'FD');
      setFill(GOLD);
      doc.rect(margin, curY, 1.4, bankBoxH, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      setText(GOLD_DEEP);
      doc.text('BANK DETAILS FOR DIRECT NEFT / RTGS TRANSFER', margin + 5, curY + 5.4);

      let bLineY = curY + 11;
      bankRows.forEach(([label, val]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        setText(MUTED);
        doc.text(label, margin + 5, bLineY);

        doc.setFont('helvetica', 'bold');
        setText(INK);
        const valTrimmed = doc.splitTextToSize(val, bankW - 36)[0] || val;
        doc.text(valTrimmed, margin + 31, bLineY);
        bLineY += 4.6;
      });
    }

    if (hasSigBox) {
      const sigW = usableWidth * 0.4;

      const bizLabel = `For ${(settings.business_name || 'ALL KIND DECOR INTERIOR').toUpperCase()}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      setText(MUTED);
      const wrappedFor = doc.splitTextToSize(bizLabel, sigW)[0] || bizLabel;
      doc.text(wrappedFor, pageWidth - margin, curY + 5, { align: 'right' });

      if (signatureImg) {
        const maxSigW = 38;
        const maxSigH = 14;
        const ratio = Math.min(maxSigW / signatureImg.width, maxSigH / signatureImg.height);
        const drawW = Math.max(12, signatureImg.width * ratio);
        const drawH = Math.max(6, signatureImg.height * ratio);
        doc.addImage(
          signatureImg.dataUrl,
          'PNG',
          pageWidth - margin - drawW,
          curY + bottomBlockH - 11 - drawH,
          drawW,
          drawH
        );
      }

      const sigBaseY = curY + bottomBlockH - 6;
      // Signature rule (always present, sits above the signatory name/label)
      setDraw(GOLD);
      doc.setLineWidth(0.4);
      doc.line(pageWidth - margin - 52, sigBaseY - 4.4, pageWidth - margin, sigBaseY - 4.4);

      if (settings.authorized_signatory?.trim()) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.8);
        setText(INK);
        const sigName =
          doc.splitTextToSize(settings.authorized_signatory.trim(), sigW)[0] || '';
        doc.text(sigName, pageWidth - margin, sigBaseY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        setText(MUTED);
        doc.text('Authorized Signatory', pageWidth - margin, sigBaseY + 4, { align: 'right' });
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        setText(MUTED);
        doc.text('Authorized Signatory', pageWidth - margin, sigBaseY, { align: 'right' });
      }
    }
  }

  // 8. Professional Footer and Page Numbering on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Continuation pages get a slim brand rule (page 1 already has the full band)
    if (i > 1) {
      setFill(INK);
      doc.rect(0, 0, pageWidth, 2.4, 'F');
      setFill(GOLD);
      doc.rect(0, 2.4, pageWidth, 0.7, 'F');
    }

    setDraw(HAIR);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    setFill(GOLD);
    doc.rect(margin, pageHeight - 11.4, 14, 0.8, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setText(MUTED);
    const leftFooter = sections.showBusinessDetails
      ? `${settings.business_name || 'ALL KIND DECOR INTERIOR'}  •  Quotation Ref: ${quotation.quotation_number}`
      : `Quotation Ref: ${quotation.quotation_number}`;
    doc.text(leftFooter, margin, pageHeight - 6.5);
    doc.text(`Page ${i}/${totalPages}`, pageWidth - margin, pageHeight - 6.5, {
      align: 'right',
    });
  }

  return doc;
}

export async function exportQuotationPDF(params: {
  quotation: Quotation;
  client: Client;
  project?: Project;
  settings: BusinessSettings;
  sections?: Partial<QuotationPDFSections>;
}): Promise<void> {
  const doc = await buildQuotationPDFDoc(params);
  doc.save(`AKD_Quotation_${params.quotation.quotation_number}.pdf`);
}

// ============================================================================
// WORK UPDATE & PROGRESS DOSSIER PDF EXPORTER
// Summary of project work milestones and progress history for clients & owner.
// ============================================================================
export async function exportWorkUpdateReportPDF(params: {
  project: Project;
  client: Client;
  updates: ProjectWorkUpdate[];
  settings: BusinessSettings;
}): Promise<void> {
  const { project, client, updates, settings } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoDataUrl = await getBrandedLogoDataUrl(settings.logo_url);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const startY = drawPDFHeader({
    doc,
    settings,
    title: 'Work Progress Report',
    subtitle: `${project.project_name} (${project.project_code})`,
    filterScope: `Client: ${client.full_name}`,
    logoDataUrl,
  });

  let curY = startY + 4;

  // Project Progress Summary Cards
  const summaryBoxH = 22;
  const colW = (pageWidth - margin * 2 - 8) / 3;

  // Stage Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, curY, colW, summaryBoxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CURRENT WORK STAGE', margin + 4, curY + 6);
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(String(project.current_work_stage || project.status), margin + 4, curY + 14);

  // Progress % Card
  const col2X = margin + colW + 4;
  doc.roundedRect(col2X, curY, colW, summaryBoxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('COMPLETION PROGRESS', col2X + 4, curY + 6);
  doc.setFontSize(12);
  doc.setTextColor(84, 72, 237); // #5448ED
  doc.text(`${project.progress_percentage}% Completed`, col2X + 4, curY + 15);

  // Status & Updates Count Card
  const col3X = col2X + colW + 4;
  doc.roundedRect(col3X, curY, colW, summaryBoxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('RECORDED WORK UPDATES', col3X + 4, curY + 6);
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${updates.length} Updates Recorded`, col3X + 4, curY + 14);

  curY += summaryBoxH + 6;

  // Work Updates Timeline Table
  const sortedUpdates = [...updates].sort((a, b) => b.update_date.localeCompare(a.update_date));
  const tableRows = sortedUpdates.map((u) => [
    formatDate(u.update_date, settings.date_format),
    u.work_stage,
    `${u.progress_percentage}%`,
    u.work_completed + (u.work_remaining ? `\n\nNext: ${u.work_remaining}` : ''),
    u.is_visible_to_client ? 'Visible' : 'Internal',
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Update Date', 'Stage', 'Progress', 'Work Details & Next Steps', 'Visibility']],
    body: tableRows,
    margin: { left: margin, right: margin },
    theme: 'plain',
    headStyles: {
      fillColor: [30, 30, 28],
      textColor: [255, 255, 255],
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 8,
      cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
      lineColor: [241, 245, 249],
      lineWidth: 0.3,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 28 },
      2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 18, halign: 'center' },
    },
  });

  // Footer Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `AKD Interior  |  Project Progress Dossier  |  ${project.project_name}`,
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  doc.save(`AKD_Work_Updates_${project.project_code}.pdf`);
}

