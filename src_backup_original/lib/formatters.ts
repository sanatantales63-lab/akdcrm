import {
  format,
  parseISO,
  isValid,
  subDays,
  differenceInCalendarDays,
  startOfDay,
  endOfDay,
  isBefore,
} from 'date-fns';
import { DateFilterRange } from '@/types/crm';

// ============================================================================
// DECIMAL-SAFE MONETARY ARITHMETIC (PAISE INTEGER ENGINE)
// Prevents IEEE-754 floating point drift across all project & ledger balances
// ============================================================================

export function toPaise(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === '') return 0;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(num) || !Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

export function safeAdd(a: number, b: number): number {
  return fromPaise(toPaise(a) + toPaise(b));
}

export function safeSubtract(a: number, b: number): number {
  return fromPaise(toPaise(a) - toPaise(b));
}

export function safeSum(values: Array<number | null | undefined>): number {
  const totalPaise = values.reduce<number>((acc, val) => acc + toPaise(val), 0);
  return fromPaise(totalPaise);
}

export function safePercentage(part: number, total: number): number {
  const totalP = toPaise(total);
  if (totalP <= 0) return 0;
  const partP = toPaise(part);
  return Math.min(100, Math.max(0, Math.round((partP / totalP) * 1000) / 10));
}

// ============================================================================
// INDIAN RUPEE (INR) FORMATTING — e.g. ₹12,50,000
// ============================================================================

const inrWholeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrDecimalFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number | null | undefined, showDecimals = false): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '₹0';
  }
  const cleanAmount = fromPaise(toPaise(amount));
  const hasPaise = Math.abs(cleanAmount % 1) > 0.001;
  if (showDecimals || hasPaise) {
    return inrDecimalFormatter.format(cleanAmount);
  }
  return inrWholeFormatter.format(cleanAmount);
}

/**
 * Formats INR for PDF tables (using Rs. or INR prefix if standard Helvetica lacks ₹ glyph,
 * or ₹ for UI display).
 */
export function formatINRForPDF(amount: number | null | undefined, prefix: string = 'Rs. '): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return `${prefix}0`;
  }
  const cleanAmount = fromPaise(toPaise(amount));
  const hasPaise = Math.abs(cleanAmount % 1) > 0.001;
  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cleanAmount);
  return `${prefix}${formattedNumber}`;
}

export function formatINRCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2).replace(/\.00$/, '')} L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return formatINR(amount);
}

/**
 * Converts a numeric INR value into Indian English words for Quotations & Payment Receipts
 * e.g. 250000 -> "Rupees Two Lakh Fifty Thousand Only"
 *      250000.50 -> "Rupees Two Lakh Fifty Thousand and Fifty Paise Only"
 */
export function amountToIndianWords(amount: number): string {
  const totalPaise = Math.abs(toPaise(amount));
  const whole = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  if (whole === 0 && paise === 0) return 'Rupees Zero Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  const twoDigits = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 !== 0 ? ' ' + ones[n % 10] : ''}`;
  };

  const convertIndianInt = (num: number): string => {
    if (num === 0) return '';
    const parts: string[] = [];
    let rem = num;

    const crore = Math.floor(rem / 10000000);
    rem %= 10000000;
    if (crore > 0) {
      parts.push(`${crore < 100 ? twoDigits(crore) : convertIndianInt(crore)} Crore`);
    }

    const lakh = Math.floor(rem / 100000);
    rem %= 100000;
    if (lakh > 0) {
      parts.push(`${twoDigits(lakh)} Lakh`);
    }

    const thousand = Math.floor(rem / 1000);
    rem %= 1000;
    if (thousand > 0) {
      parts.push(`${twoDigits(thousand)} Thousand`);
    }

    const hundred = Math.floor(rem / 100);
    rem %= 100;
    if (hundred > 0) {
      parts.push(`${ones[hundred]} Hundred`);
    }

    if (rem > 0) {
      if (parts.length > 0 && paise === 0) parts.push('and');
      parts.push(twoDigits(rem));
    }

    return parts.join(' ');
  };

  const rupeeWords = whole > 0 ? convertIndianInt(whole) : 'Zero';
  if (paise > 0) {
    return `Rupees ${rupeeWords} and ${twoDigits(paise)} Paise Only`;
  }
  return `Rupees ${rupeeWords} Only`;
}

// ============================================================================
// DATE & FINANCIAL YEAR UTILITIES
// ============================================================================

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDate(
  dateStr: string | null | undefined,
  dateFormat: string = 'dd MMM yyyy'
): string {
  if (!dateStr) return '—';
  try {
    const parsed = parseISO(dateStr);
    if (!isValid(parsed)) return dateStr;
    return format(parsed, dateFormat);
  } catch {
    return dateStr;
  }
}

export function getIndianFinancialYearBounds(
  referenceDate: Date = new Date(),
  fyStartMonth: number = 4 // April (1-indexed)
): { start: Date; end: Date; label: string } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1; // 1-12
  const startYear = month >= fyStartMonth ? year : year - 1;
  const endYear = startYear + 1;
  const start = new Date(startYear, fyStartMonth - 1, 1, 0, 0, 0);
  const end = new Date(endYear, fyStartMonth - 1, 0, 23, 59, 59);
  return {
    start,
    end,
    label: `FY ${startYear}–${String(endYear).slice(-2)}`,
  };
}

export function getDateFilterBounds(
  range: DateFilterRange,
  fyStartMonth: number = 4
): { start: Date | null; end: Date | null; label: string } {
  const now = new Date();
  switch (range.preset) {
    case '30d':
      return {
        start: startOfDay(subDays(now, 30)),
        end: endOfDay(now),
        label: 'Last 30 Days',
      };
    case '90d':
      return {
        start: startOfDay(subDays(now, 90)),
        end: endOfDay(now),
        label: 'Last 90 Days',
      };
    case 'fy': {
      const fy = getIndianFinancialYearBounds(now, fyStartMonth);
      return {
        start: fy.start,
        end: fy.end,
        label: `Current Financial Year (${fy.label})`,
      };
    }
    case 'custom': {
      const start = range.startDate ? startOfDay(parseISO(range.startDate)) : null;
      const end = range.endDate ? endOfDay(parseISO(range.endDate)) : null;
      const startStr = range.startDate ? formatDate(range.startDate) : 'Start';
      const endStr = range.endDate ? formatDate(range.endDate) : 'Present';
      return {
        start: start && isValid(start) ? start : null,
        end: end && isValid(end) ? end : null,
        label: `${startStr} – ${endStr}`,
      };
    }
    case 'all':
    default:
      return {
        start: null,
        end: null,
        label: 'All Time',
      };
  }
}

export function isDateInRange(
  dateStr: string | null | undefined,
  range: DateFilterRange,
  fyStartMonth: number = 4
): boolean {
  if (!dateStr) return false;
  if (range.preset === 'all') return true;
  try {
    const parsed = parseISO(dateStr);
    if (!isValid(parsed)) return false;
    const { start, end } = getDateFilterBounds(range, fyStartMonth);
    if (start && parsed < start) return false;
    if (end && parsed > end) return false;
    return true;
  } catch {
    return false;
  }
}

export function getDeadlineInfo(
  expectedCompletionDate?: string,
  status?: string
): {
  daysRemaining: number | null;
  isOverdue: boolean;
  isApproaching: boolean;
  label: string;
} {
  if (!expectedCompletionDate || status === 'Completed' || status === 'Cancelled') {
    return { daysRemaining: null, isOverdue: false, isApproaching: false, label: '—' };
  }
  try {
    const target = startOfDay(parseISO(expectedCompletionDate));
    if (!isValid(target)) {
      return { daysRemaining: null, isOverdue: false, isApproaching: false, label: '—' };
    }
    const today = startOfDay(new Date());
    const diff = differenceInCalendarDays(target, today);
    if (diff < 0) {
      return {
        daysRemaining: diff,
        isOverdue: true,
        isApproaching: false,
        label: `${Math.abs(diff)}d overdue`,
      };
    }
    if (diff === 0) {
      return {
        daysRemaining: 0,
        isOverdue: false,
        isApproaching: true,
        label: 'Due today',
      };
    }
    if (diff <= 14) {
      return {
        daysRemaining: diff,
        isOverdue: false,
        isApproaching: true,
        label: `Due in ${diff}d`,
      };
    }
    return {
      daysRemaining: diff,
      isOverdue: false,
      isApproaching: false,
      label: `${diff}d remaining`,
    };
  } catch {
    return { daysRemaining: null, isOverdue: false, isApproaching: false, label: '—' };
  }
}

export function isFollowUpOverdue(followUpDate?: string, status?: string): boolean {
  if (!followUpDate || status === 'Converted' || status === 'Lost') return false;
  try {
    const target = startOfDay(parseISO(followUpDate));
    if (!isValid(target)) return false;
    return isBefore(target, startOfDay(new Date()));
  } catch {
    return false;
  }
}

// ============================================================================
// CONTACT NORMALIZATION FOR DUPLICATE CHECKS
// ============================================================================

export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  return digits;
}

export function normalizeEmail(email?: string | null): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}
