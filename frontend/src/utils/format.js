export function countChars(text) {
  return Array.from(String(text || '').replace(/\s/g, '')).length;
}

export function chapterDisplayTitle(chapter) {
  const full = String(chapter?.title || '').trim();
  const cleaned = full
    .replace(
      /^第\s*[0-9０-９一二三四五六七八九十百千零〇两]+\s*[章回节卷篇][\s·:：、.．—-]*/,
      ''
    )
    .replace(/^chapter\s+\d+[\s:：.．—-]*/i, '')
    .trim();
  return cleaned || full || '未命名章节';
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(value)} ${hours}:${minutes}`;
}

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export const SEVERITY_META = {
  high: { label: '明显', color: '#b9412b', className: 'high' },
  medium: { label: '注意', color: '#a98445', className: 'medium' },
  low: { label: '轻微', color: '#7b7467', className: 'low' },
};

export function severityMeta(severity) {
  return SEVERITY_META[severity] || SEVERITY_META.low;
}

export function scoreTone(score) {
  if (score >= 85) {
    return { label: '很像你', color: 'var(--jade)', soft: 'var(--jade-soft)' };
  }
  if (score >= 70) {
    return { label: '有几分像', color: 'var(--gold)', soft: 'rgba(155, 123, 66, 0.12)' };
  }
  return { label: '还差一点', color: 'var(--vermilion)', soft: 'var(--vermilion-soft)' };
}
