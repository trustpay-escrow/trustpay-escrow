import { Project } from '@/types';

/** Estimated USD conversion rates for supported tokens (for AP reporting). */
const TOKEN_USD_RATES: Record<string, number> = {
  USDC: 1,
  PYUSD: 1,
  EURC: 1.08,
  XLM: 0.15,
};

/** Platform service fee rate applied to contractor disbursements. */
export const AP_PLATFORM_FEE_RATE = 0.025;

export interface PayableRow {
  projectId: string;
  projectTitle: string;
  contractorName: string;
  contractorAddress: string;
  milestoneTitle: string;
  milestoneIndex: number;
  token: string;
  tokenAmount: number;
  usdValue: number;
  platformFee: number;
  netPayout: number;
  txHash: string;
  date: string;
}

export interface PayableTotals {
  grossDisbursement: number;
  platformFees: number;
  netContractorPayout: number;
  rowCount: number;
}

export function tokenUsdRate(token?: string): number {
  return TOKEN_USD_RATES[(token || 'USDC').toUpperCase()] ?? 1;
}

function inDateRange(dateStr: string | undefined, start?: string, end?: string): boolean {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return true;
  if (start) {
    const s = new Date(start);
    if (!Number.isNaN(s.getTime()) && d < s) return false;
  }
  if (end) {
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    if (!Number.isNaN(e.getTime()) && d > e) return false;
  }
  return true;
}

/**
 * Batches milestone disbursements across projects into structured AP ledger rows.
 * Includes active, completed, and disputed projects within the date range.
 */
export function buildPayableRows(
  projects: Project[],
  startDate?: string,
  endDate?: string
): PayableRow[] {
  const rows: PayableRow[] = [];

  for (const project of projects) {
    const milestones = project.milestones || [];
    for (const m of milestones) {
      const amount = Number(m.amount) || 0;
      if (amount <= 0) continue;

      const rowDate = m.submitted_at || m.due_date || project.created_at || '';
      if (!inDateRange(rowDate, startDate, endDate)) continue;

      const platformFee = Number((amount * AP_PLATFORM_FEE_RATE).toFixed(2));
      const token = project.token || 'USDC';

      rows.push({
        projectId: project.id,
        projectTitle: project.title,
        contractorName: project.freelancer_address || project.freelancer_id || 'Unassigned Contractor',
        contractorAddress: project.freelancer_address || '',
        milestoneTitle: m.title || `Milestone ${m.milestone_index + 1}`,
        milestoneIndex: m.milestone_index,
        token,
        tokenAmount: amount,
        usdValue: Number((amount * tokenUsdRate(token)).toFixed(2)),
        platformFee,
        netPayout: Number((amount - platformFee).toFixed(2)),
        txHash: m.tx_hash || project.tx_hash || '',
        date: rowDate,
      });
    }
  }

  return rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

export function summarizePayableRows(rows: PayableRow[]): PayableTotals {
  return rows.reduce<PayableTotals>(
    (acc, r) => {
      acc.grossDisbursement += r.tokenAmount;
      acc.platformFees += r.platformFee;
      acc.netContractorPayout += r.netPayout;
      acc.rowCount += 1;
      return acc;
    },
    { grossDisbursement: 0, platformFees: 0, netContractorPayout: 0, rowCount: 0 }
  );
}

function csvEscape(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const CSV_HEADERS = [
  'Project ID',
  'Project Title',
  'Contractor Name',
  'Wallet Address',
  'Milestone',
  'Token',
  'Token Amount',
  'USD Value',
  'Platform Fee',
  'Net Contractor Payout',
  'Transaction Hash',
  'Date',
];

export function payableRowsToCsv(rows: PayableRow[], totals?: PayableTotals): string {
  const lines: string[] = [CSV_HEADERS.map(csvEscape).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.projectId,
        r.projectTitle,
        r.contractorName,
        r.contractorAddress,
        r.milestoneTitle,
        r.token,
        r.tokenAmount,
        r.usdValue,
        r.platformFee,
        r.netPayout,
        r.txHash,
        r.date,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  if (totals) {
    lines.push('');
    lines.push(['TOTALS', '', '', '', '', '', '', totals.grossDisbursement, totals.platformFees, totals.netContractorPayout, '', ''].map(csvEscape).join(','));
  }
  return lines.join('\n');
}

export function payableRowsToExcelHtml(rows: PayableRow[], totals?: PayableTotals): string {
  const esc = (v: string | number) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const header = `<tr>${CSV_HEADERS.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
  const body = rows
    .map(
      (r) =>
        `<tr>${[
          r.projectId,
          r.projectTitle,
          r.contractorName,
          r.contractorAddress,
          r.milestoneTitle,
          r.token,
          r.tokenAmount,
          r.usdValue,
          r.platformFee,
          r.netPayout,
          r.txHash,
          r.date,
        ]
          .map((v) => `<td>${esc(v)}</td>`)
          .join('')}</tr>`
    )
    .join('');
  const totalRow = totals
    ? `<tr><td colspan="7"><b>TOTALS</b></td><td><b>${totals.grossDisbursement}</b></td><td><b>${totals.platformFees}</b></td><td><b>${totals.netContractorPayout}</b></td><td></td><td></td></tr>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f0f0f0}</style></head><body><table>${header}${body}${totalRow}</table></body></html>`;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportPayableRowsCsv(rows: PayableRow[], totals: PayableTotals, filename = 'accounts-payable.csv') {
  downloadBlob(filename, payableRowsToCsv(rows, totals), 'text/csv;charset=utf-8');
}

export function exportPayableRowsExcel(rows: PayableRow[], totals: PayableTotals, filename = 'accounts-payable.xls') {
  downloadBlob(filename, payableRowsToExcelHtml(rows, totals), 'application/vnd.ms-excel');
}
