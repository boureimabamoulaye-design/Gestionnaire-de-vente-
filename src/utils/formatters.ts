/**
 * Formats numbers in CFA Francs (FCFA) with clean space thousands separators
 * e.g., 50000 -> "50 000 FCFA"
 */
export function formatFCFA(amount: number | string | undefined | null): string {
  const num = Number(amount || 0);
  if (isNaN(num)) return '0 FCFA';
  const rounded = Math.round(num);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} FCFA`;
}

export function formatNumber(val: number | string | undefined | null): string {
  const num = Number(val || 0);
  if (isNaN(num)) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  const clean = String(dateStr).replace('T', ' ').slice(0, 16);
  const parts = clean.split(' ');
  if (parts.length >= 2) {
    const [y, m, d] = parts[0].split('-');
    if (y && m && d) {
      return `${d}/${m}/${y} à ${parts[1]}`;
    }
  }
  return clean;
}

export function formatDateShort(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  const clean = String(dateStr).slice(0, 10);
  const [y, m, d] = clean.split('-');
  if (y && m && d) {
    return `${d}/${m}/${y}`;
  }
  return clean;
}

export function getTodayInputDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getNowDateTimeString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
