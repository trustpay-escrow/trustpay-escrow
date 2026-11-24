import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { getStellarExplorerUrl } from '@/lib/soroban';

export interface SettlementReceiptData {
  projectTitle: string;
  milestoneTitle: string;
  milestoneIndex?: number;
  amount: number;
  token: string;
  clientAddress?: string;
  freelancerAddress?: string;
  txHash?: string;
  ledger?: number | string;
  closedAt?: string;
  usdAmount?: number;
  vatRate?: number;
  businessName?: string;
  notes?: string;
  invoiceNumber?: string;
  issuedAt?: string;
  explorerUrl?: string;
}

export interface ReceiptTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

export function calculateReceiptTotals(data: SettlementReceiptData): ReceiptTotals {
  const subtotal = Number.isFinite(data.amount) ? Math.max(0, data.amount) : 0;
  const rate = Number.isFinite(data.vatRate) ? Math.max(0, data.vatRate || 0) : 0;
  const taxAmount = Number((subtotal * (rate / 100)).toFixed(7));
  return { subtotal, taxAmount, total: Number((subtotal + taxAmount).toFixed(7)) };
}

export function slugifyReceiptPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

export function getReceiptFilename(data: SettlementReceiptData): string {
  const project = slugifyReceiptPart(data.projectTitle);
  const milestone = slugifyReceiptPart(data.milestoneTitle);
  return `trustpay-receipt-${project}-${milestone}.pdf`;
}

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 5): number {
  const lines = doc.splitTextToSize(text || '—', width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export async function generateReceiptPdf(data: SettlementReceiptData): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const totals = calculateReceiptTotals(data);
  const issuedAt = data.issuedAt || new Date().toISOString();
  const invoiceNumber = data.invoiceNumber || `TP-${Date.now().toString(36).toUpperCase()}`;
  const verificationUrl =
    data.explorerUrl || (data.txHash ? getStellarExplorerUrl(data.txHash, 'tx') : 'https://stellar.expert/explorer/testnet');

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('SETTLEMENT RECEIPT', 16, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('TrustPay Escrow  |  Stellar Soroban milestone payment proof', 16, 31);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.text(`Invoice: ${invoiceNumber}`, 16, 53);
  doc.text(`Issued: ${new Date(issuedAt).toLocaleString()}`, 194, 53, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(16, 58, 194, 58);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PARTIES', 16, 68);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENT PUBLIC KEY', 16, 75);
  doc.text('FREELANCER PUBLIC KEY', 108, 75);
  doc.setTextColor(30, 41, 59);
  writeWrapped(doc, data.clientAddress || '—', 16, 81, 84);
  writeWrapped(doc, data.freelancerAddress || '—', 108, 81, 86);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MILESTONE DETAILS', 16, 104);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Project: ${data.projectTitle || '—'}`, 16, 112);
  doc.text(
    `Milestone: ${data.milestoneIndex ? `#${data.milestoneIndex} - ` : ''}${data.milestoneTitle || '—'}`,
    16,
    119
  );
  doc.text(`Settlement date: ${data.closedAt ? new Date(data.closedAt).toLocaleString() : '—'}`, 16, 126);
  doc.text(`Business legal name: ${data.businessName || 'TrustPay Escrow'}`, 16, 133);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(16, 142, 178, 46, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PAYMENT SUMMARY', 22, 151);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Milestone amount (${data.token || 'USDC'})`, 22, 160);
  doc.text(formatAmount(totals.subtotal), 188, 160, { align: 'right' });
  doc.text(`VAT / Tax (${data.vatRate || 0}%)`, 22, 168);
  doc.text(formatAmount(totals.taxAmount), 188, 168, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(`Total settled (${data.token || 'USDC'})`, 22, 177);
  doc.text(formatAmount(totals.total), 188, 177, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(79, 70, 229);
  doc.text(
    `USD valuation at settlement: ${data.usdAmount !== undefined ? `$${formatAmount(data.usdAmount)}` : 'Not available'}`,
    22,
    184
  );

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ON-CHAIN VERIFICATION', 16, 202);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const shortHash = data.txHash
    ? data.txHash.length > 38
      ? `${data.txHash.slice(0, 26)}...${data.txHash.slice(-12)}`
      : data.txHash
    : 'Not recorded';
  writeWrapped(doc, `Transaction hash: ${shortHash}`, 16, 210, 132, 4.5);
  doc.text(`Ledger: ${data.ledger ?? '—'}`, 16, 222);
  doc.text(`Closed: ${data.closedAt ? new Date(data.closedAt).toLocaleString() : '—'}`, 16, 229);

  const qr = QRCode.create(verificationUrl, { errorCorrectionLevel: 'M' });
  const qrSize = qr.modules.size;
  const cell = 34 / (qrSize + 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(158, 207, 34, 34, 'F');
  doc.setFillColor(15, 23, 42);
  for (let row = 0; row < qrSize; row++) {
    for (let column = 0; column < qrSize; column++) {
      if (qr.modules.data[row * qrSize + column]) {
        doc.rect(158 + (column + 1) * cell, 207 + (row + 1) * cell, cell, cell, 'F');
      }
    }
  }
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Scan to verify on Stellar Expert', 175, 246, { align: 'center' });

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTES', 16, 258);
  doc.setFont('helvetica', 'normal');
  writeWrapped(doc, data.notes || 'Payment settled through TrustPay Escrow smart contract.', 16, 264, 178, 4.5);

  doc.setDrawColor(226, 232, 240);
  doc.line(16, 282, 194, 282);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('This document is a client-side generated settlement receipt. Verify the QR code against the Stellar ledger.', 16, 287);

  return doc.output('blob');
}

export async function downloadReceiptPdf(data: SettlementReceiptData): Promise<void> {
  const blob = await generateReceiptPdf(data);
  if (typeof document === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = getReceiptFilename(data);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/* Milestone completion certificate (#310)                                     */
/* -------------------------------------------------------------------------- */

export interface MilestoneCertificateData {
  projectTitle: string;
  milestoneTitle: string;
  milestoneIndex?: number;
  amount: number;
  token: string;
  freelancerAddress?: string;
  clientAddress?: string;
  txHash?: string;
  contractId?: string;
  issuedAt?: string;
  /** Overrides the derived Stellar Expert verification URL. */
  verificationUrl?: string;
}

export function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Resolves the on-chain proof link embedded in the certificate QR code. */
export function getCertificateVerificationUrl(data: MilestoneCertificateData): string {
  if (data.verificationUrl) return data.verificationUrl;
  if (data.txHash) return getStellarExplorerUrl(data.txHash, 'tx');
  if (data.contractId) return getStellarExplorerUrl(data.contractId, 'contract');
  return 'https://stellar.expert/explorer/testnet';
}

export function shortenMiddle(value: string, head = 12, tail = 10): string {
  const text = String(value || '');
  if (text.length <= head + tail + 3) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function truncate(value: string, maxLength: number): string {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function formatCertificateAmount(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}

function formatCertificateDate(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return formatCertificateDate(undefined);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Builds a single-path QR payload so it can be embedded as vector SVG. */
function buildQrPath(url: string, size: number): string {
  const qr = QRCode.create(url || 'https://stellar.expert', { errorCorrectionLevel: 'M' });
  const modules = qr.modules.size;
  const cell = size / (modules + 4);
  const offset = cell * 2;
  const segments: string[] = [];

  for (let row = 0; row < modules; row++) {
    for (let column = 0; column < modules; column++) {
      if (qr.modules.data[row * modules + column]) {
        segments.push(`M${(offset + column * cell).toFixed(2)} ${(offset + row * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`);
      }
    }
  }

  return segments.join('');
}

/**
 * buildCertificateSvg (#310)
 *
 * Produces a print-ready 1000x700 vector certificate with ornate double
 * borders, a TrustPay watermark, the Stellar mark, settlement details and a
 * scannable QR code that resolves to the on-chain transaction.
 */
export function buildCertificateSvg(data: MilestoneCertificateData): string {
  const verificationUrl = getCertificateVerificationUrl(data);
  const qrPath = buildQrPath(verificationUrl, 132);
  const amount = `${formatCertificateAmount(data.amount)} ${data.token || 'USDC'}`;
  const freelancer = data.freelancerAddress || 'Stellar freelancer';
  const milestoneLabel = `${data.milestoneIndex ? `#${data.milestoneIndex} · ` : ''}${data.milestoneTitle || 'Final milestone'}`;
  const issuedAt = formatCertificateDate(data.issuedAt);
  const certificateId = data.txHash
    ? shortenMiddle(data.txHash, 10, 8)
    : data.contractId
      ? shortenMiddle(data.contractId, 8, 6)
      : 'TrustPay escrow';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700" role="img" aria-label="Milestone completion certificate for ${escapeXml(
    truncate(data.projectTitle, 80)
  )}" data-certificate="trustpay-milestone">
  <defs>
    <linearGradient id="tp-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1120" />
      <stop offset="55%" stop-color="#111c33" />
      <stop offset="100%" stop-color="#0b1120" />
    </linearGradient>
    <linearGradient id="tp-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7d488" />
      <stop offset="45%" stop-color="#d4a94a" />
      <stop offset="100%" stop-color="#f3e0a8" />
    </linearGradient>
    <radialGradient id="tp-glow" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="1000" height="700" fill="url(#tp-bg)" />
  <rect width="1000" height="700" fill="url(#tp-glow)" />

  <!-- Ornate double border -->
  <rect x="22" y="22" width="956" height="656" rx="10" fill="none" stroke="url(#tp-gold)" stroke-width="3" />
  <rect x="34" y="34" width="932" height="632" rx="6" fill="none" stroke="#d4a94a" stroke-width="1" stroke-dasharray="2 6" opacity="0.8" />
  <g stroke="url(#tp-gold)" stroke-width="2" fill="none" opacity="0.95">
    <path d="M22 62V22h40" /><path d="M938 22h40v40" />
    <path d="M978 638v40h-40" /><path d="M62 678H22v-40" />
  </g>
  <g fill="#d4a94a" opacity="0.9">
    <circle cx="46" cy="46" r="4" /><circle cx="954" cy="46" r="4" />
    <circle cx="46" cy="654" r="4" /><circle cx="954" cy="654" r="4" />
  </g>

  <!-- Watermark -->
  <text x="500" y="430" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="150" font-weight="700" letter-spacing="18" fill="#ffffff" opacity="0.045">TRUSTPAY</text>

  <!-- Stellar mark -->
  <g transform="translate(500 96)" stroke="#67e8f9" stroke-width="2.5" fill="none" opacity="0.95">
    <circle cx="0" cy="0" r="30" />
    <path d="M-38 12l24-14 M-30 20l34-20 M38-12l-24 14 M30-20l-34 20" stroke-linecap="round" />
    <circle cx="0" cy="0" r="5" fill="#67e8f9" stroke="none" />
  </g>

  <text x="500" y="156" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" letter-spacing="6" fill="#d4a94a">TRUSTPAY ESCROW · STELLAR NETWORK</text>
  <text x="500" y="205" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="44" font-weight="700" fill="#ffffff">Certificate of Completion</text>
  <text x="500" y="235" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#94a3b8">This certifies that the milestone below was delivered and paid through an on-chain escrow.</text>

  <text x="500" y="286" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" letter-spacing="3" fill="#d4a94a">AWARDED TO</text>
  <text x="500" y="314" text-anchor="middle" font-family="'Courier New', monospace" font-size="16" fill="#e2e8f0">${escapeXml(
    shortenMiddle(freelancer, 20, 12)
  )}</text>

  <text x="500" y="366" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="32" font-weight="700" fill="#ffffff">${escapeXml(
    truncate(data.projectTitle || 'Escrow project', 58)
  )}</text>
  <text x="500" y="396" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#7dd3fc">${escapeXml(
    truncate(milestoneLabel, 70)
  )}</text>

  <g font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#94a3b8">
    <text x="130" y="468" letter-spacing="2">PAYOUT</text>
    <text x="130" y="492" font-size="22" font-weight="700" fill="#f7d488">${escapeXml(amount)}</text>
    <text x="130" y="536" letter-spacing="2">ISSUED</text>
    <text x="130" y="558" font-size="15" fill="#e2e8f0">${escapeXml(issuedAt)}</text>
    <text x="130" y="602" letter-spacing="2">ON-CHAIN PROOF</text>
    <text x="130" y="624" font-size="13" font-family="'Courier New', monospace" fill="#cbd5e1">${escapeXml(certificateId)}</text>
  </g>

  <!-- Verification QR -->
  <g transform="translate(700 430)">
    <rect x="-10" y="-10" width="144" height="144" rx="8" fill="#ffffff" />
    <path d="${qrPath}" fill="#0b1120" />
  </g>
  <text x="767" y="600" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#94a3b8">Scan to verify on Stellar Expert</text>
  <text x="767" y="626" text-anchor="middle" font-family="'Courier New', monospace" font-size="9" fill="#64748b">${escapeXml(
    truncate(verificationUrl.replace(/^https?:\/\//, ''), 44)
  )}</text>

  <line x1="90" y1="654" x2="910" y2="654" stroke="#d4a94a" stroke-width="1" opacity="0.55" />
  <text x="500" y="674" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="10" letter-spacing="2" fill="#64748b">VERIFIABLE CREDENTIAL · TRUSTPAY-ESCROW.VERCEL.APP</text>
</svg>`;
}

export function getCertificateFilename(data: MilestoneCertificateData, extension = 'svg'): string {
  const project = slugifyReceiptPart(data.projectTitle);
  const milestone = slugifyReceiptPart(data.milestoneTitle);
  return `trustpay-certificate-${project}-${milestone}.${extension}`;
}

function sanitizePdfText(value: string): string {
  return String(value || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '-')
    .replace(/\u00B7/g, '-')
    .replace(/[^\x20-\x7E]/g, '');
}

/** Renders the same certificate as a vector A4 landscape PDF. */
export async function generateCertificatePdf(data: MilestoneCertificateData): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const pageWidth = 297;
  const pageHeight = 210;

  doc.setFillColor(11, 17, 32);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setDrawColor(212, 169, 74);
  doc.setLineWidth(0.8);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
  doc.setLineWidth(0.25);
  doc.rect(14, 14, pageWidth - 28, pageHeight - 28);

  doc.setTextColor(247, 212, 136);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('TRUSTPAY ESCROW  |  STELLAR NETWORK', pageWidth / 2, 30, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'bold');
  doc.setFontSize(30);
  doc.text('Certificate of Completion', pageWidth / 2, 45, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'This certifies that the milestone below was delivered and paid through an on-chain escrow.',
    pageWidth / 2,
    54,
    { align: 'center' }
  );

  doc.setTextColor(212, 169, 74);
  doc.setFontSize(8);
  doc.text('AWARDED TO', pageWidth / 2, 70, { align: 'center' });
  doc.setTextColor(226, 232, 240);
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.text(sanitizePdfText(shortenMiddle(data.freelancerAddress || 'Stellar freelancer', 20, 12)), pageWidth / 2, 78, {
    align: 'center',
  });

  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(sanitizePdfText(truncate(data.projectTitle || 'Escrow project', 58)), pageWidth / 2, 95, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(125, 211, 252);
  const milestoneLabel = `${data.milestoneIndex ? `#${data.milestoneIndex} - ` : ''}${data.milestoneTitle || 'Final milestone'}`;
  doc.text(sanitizePdfText(truncate(milestoneLabel, 70)), pageWidth / 2, 103, { align: 'center' });

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text('PAYOUT', 30, 125);
  doc.setTextColor(247, 212, 136);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`${sanitizePdfText(formatCertificateAmount(data.amount))} ${sanitizePdfText(data.token || 'USDC')}`, 30, 133);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text('ISSUED', 30, 149);
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(10);
  doc.text(sanitizePdfText(formatCertificateDate(data.issuedAt)), 30, 156);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text('ON-CHAIN PROOF', 30, 172);
  doc.setTextColor(203, 213, 225);
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text(
    sanitizePdfText(
      data.txHash
        ? shortenMiddle(data.txHash, 12, 10)
        : data.contractId
          ? shortenMiddle(data.contractId, 10, 8)
          : 'TrustPay escrow'
    ),
    30,
    179
  );

  const verificationUrl = getCertificateVerificationUrl(data);
  const qr = QRCode.create(verificationUrl || 'https://stellar.expert', { errorCorrectionLevel: 'M' });
  const modules = qr.modules.size;
  const qrSize = 42;
  const cell = qrSize / (modules + 4);
  const qrX = pageWidth - 30 - qrSize;
  const qrY = 118;

  doc.setFillColor(255, 255, 255);
  doc.rect(qrX, qrY, qrSize, qrSize, 'F');
  doc.setFillColor(11, 17, 32);
  for (let row = 0; row < modules; row++) {
    for (let column = 0; column < modules; column++) {
      if (qr.modules.data[row * modules + column]) {
        doc.rect(qrX + cell * (column + 2), qrY + cell * (row + 2), cell, cell, 'F');
      }
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Scan to verify on Stellar Expert', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' });

  doc.setDrawColor(212, 169, 74);
  doc.setLineWidth(0.2);
  doc.line(30, 192, pageWidth - 30, 192);
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('VERIFIABLE CREDENTIAL  -  TRUSTPAY-ESCROW.VERCEL.APP', pageWidth / 2, 198, {
    align: 'center',
  });

  return doc.output('blob');
}

export function downloadCertificateSvg(data: MilestoneCertificateData): string {
  const svg = buildCertificateSvg(data);
  if (typeof document === 'undefined') return svg;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = getCertificateFilename(data);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return svg;
}

export async function downloadCertificatePdf(data: MilestoneCertificateData): Promise<void> {
  const blob = await generateCertificatePdf(data);
  if (typeof document === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = getCertificateFilename(data, 'pdf');
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
