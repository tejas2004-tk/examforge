const cell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Writes the rows currently on screen to a CSV file. Export mirrors the visible data
 * rather than re-querying, so what the user downloads matches what they filtered to.
 */
export function downloadCsv(filename, columns, rows) {
  const header = columns.map((c) => cell(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => cell(c.value(row))).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
