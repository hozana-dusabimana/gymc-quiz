export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 45) return 'just now';
  if (s < 90) return 'a minute ago';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function deadlineLabel(iso?: string | null): string {
  if (!iso) return 'No deadline';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'Closed';
  const h = Math.round(diff / 3_600_000);
  if (h < 1) return 'Due within the hour';
  if (h < 24) return `Due in ${h} hour${h === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  return `Due in ${d} day${d === 1 ? '' : 's'}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function pct(value: number | null | undefined, digits = 0): string {
  if (value == null) return '—';
  return `${value.toFixed(digits)}%`;
}

/** "+4.2", "−1.5", or "" when there is no delta to show. */
export function signedDelta(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '';
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return '';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}`;
}

export function performanceBandLabel(index: number | null | undefined): string {
  if (index == null) return 'No graded work yet';
  if (index >= 3.7) return 'Excellent standing';
  if (index >= 3.0) return 'Strong standing';
  if (index >= 2.0) return 'Satisfactory';
  return 'Needs improvement';
}
