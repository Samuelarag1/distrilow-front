"use client";

type Column = {
  key: string;
  label: string;
};

type ExportTableInput = {
  filename: string;
  title: string;
  subtitle?: string;
  columns: Column[];
  rows: Array<Record<string, unknown>>;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}

export function exportRowsToCsv(input: ExportTableInput) {
  const header = input.columns.map((column) => csvCell(column.label)).join(",");
  const body = input.rows.map((row) =>
    input.columns.map((column) => csvCell(row[column.key])).join(",")
  );

  const csv = [header, ...body].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${input.filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportRowsToPdf(input: ExportTableInput) {
  const popup = window.open("", "_blank", "width=1200,height=900");
  if (!popup) return;

  const columns = input.columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join("");
  const rows = input.rows
    .map((row) => {
      const cells = input.columns
        .map((column) => `<td>${escapeHtml(row[column.key])}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  popup.document.write(`
    <html>
      <head>
        <title>${escapeHtml(input.title)}</title>
        <style>
          body {
            font-family: "Segoe UI", Arial, sans-serif;
            margin: 28px;
            color: #0f172a;
          }
          h1 {
            margin: 0 0 4px 0;
            font-size: 24px;
          }
          p {
            margin: 0 0 16px 0;
            color: #475569;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          thead {
            background: #f1f5f9;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px;
            text-align: left;
            vertical-align: top;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .meta {
            margin-top: 12px;
            font-size: 11px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(input.title)}</h1>
        <p>${escapeHtml(input.subtitle ?? "")}</p>
        <table>
          <thead>
            <tr>${columns}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="meta">Generado: ${escapeHtml(new Date().toLocaleString())}</div>
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();
  popup.print();
}
