"use client";

type Column = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
};

type SummaryItem = {
  label: string;
  value: unknown;
};

type ExportTableInput = {
  filename: string;
  title: string;
  subtitle?: string;
  columns: Column[];
  rows: Array<Record<string, unknown>>;
  summary?: SummaryItem[];
  emptyMessage?: string;
  orientation?: "portrait" | "landscape";
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

  const orientation =
    input.orientation ?? (input.columns.length > 5 ? "landscape" : "portrait");
  const columns = input.columns
    .map(
      (column) =>
        `<th class="${escapeHtml(column.align ?? "left")}">${escapeHtml(column.label)}</th>`,
    )
    .join("");
  const rows =
    input.rows.length > 0
      ? input.rows
          .map((row) => {
            const cells = input.columns
              .map(
                (column) =>
                  `<td class="${escapeHtml(column.align ?? "left")}">${escapeHtml(row[column.key])}</td>`,
              )
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("")
      : `<tr><td colspan="${input.columns.length}" class="empty">${escapeHtml(
          input.emptyMessage ?? "Sin datos para exportar.",
        )}</td></tr>`;
  const summary =
    input.summary && input.summary.length > 0
      ? `
        <section class="summary-grid">
          ${input.summary
            .map(
              (item) => `
                <article class="summary-card">
                  <span class="summary-label">${escapeHtml(item.label)}</span>
                  <strong class="summary-value">${escapeHtml(item.value)}</strong>
                </article>
              `,
            )
            .join("")}
        </section>
      `
      : "";

  popup.document.write(`
    <html>
      <head>
        <title>${escapeHtml(input.title)}</title>
        <style>
          @page {
            size: A4 ${orientation};
            margin: 16mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: "Segoe UI", Arial, sans-serif;
            margin: 0;
            padding: 24px;
            color: #0f172a;
            background: #ffffff;
          }
          .report-shell {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .report-header {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 16px;
          }
          h1 {
            margin: 0 0 4px 0;
            font-size: 26px;
            line-height: 1.2;
          }
          p {
            margin: 0;
            color: #475569;
            font-size: 13px;
            line-height: 1.5;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 12px;
          }
          .summary-card {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #f8fafc;
            padding: 12px 14px;
            page-break-inside: avoid;
          }
          .summary-label {
            display: block;
            margin-bottom: 4px;
            color: #64748b;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .summary-value {
            display: block;
            color: #0f172a;
            font-size: 18px;
            line-height: 1.35;
          }
          .table-shell {
            overflow: hidden;
            border: 1px solid #cbd5e1;
            border-radius: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          thead {
            display: table-header-group;
            background: #e2e8f0;
          }
          th, td {
            padding: 12px 14px;
            text-align: left;
            vertical-align: top;
          }
          th {
            color: #334155;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.03em;
            text-transform: uppercase;
          }
          tbody tr {
            page-break-inside: avoid;
          }
          tbody td {
            border-top: 1px solid #e2e8f0;
            line-height: 1.5;
          }
          tbody tr:nth-child(even) td {
            background: #f8fafc;
          }
          th.right, td.right {
            text-align: right;
          }
          th.center, td.center {
            text-align: center;
          }
          td.empty {
            padding: 24px;
            color: #64748b;
            text-align: center;
          }
          .meta {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 12px;
            font-size: 11px;
            color: #64748b;
          }
          @media print {
            body {
              padding: 0;
            }
            thead,
            .summary-card,
            tbody tr:nth-child(even) td {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <main class="report-shell">
          <header class="report-header">
            <h1>${escapeHtml(input.title)}</h1>
            <p>${escapeHtml(input.subtitle ?? "")}</p>
          </header>
          ${summary}
          <section class="table-shell">
            <table>
              <thead>
                <tr>${columns}</tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </section>
          <div class="meta">
            <span>Registros: ${escapeHtml(input.rows.length)}</span>
            <span>Generado: ${escapeHtml(new Date().toLocaleString())}</span>
          </div>
        </main>
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();
}
