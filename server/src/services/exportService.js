/**
 * CSV and XLSX exports (ERP rework §7.4, phase 12b).
 *
 * **The export honours the current filter set.** §7.4 is blunt about it: "an
 * export that ignores active filters is a bug, not a shortcut." So every export
 * route runs the *same service function* the screen ran, with the same query,
 * and formats whatever comes back — rather than a second query that agrees with
 * the list until one of them is changed.
 *
 * **XLSX is a real spreadsheet, written by hand.** A `.xlsx` is a zip of XML
 * parts, and Excel is happy with the minimal set. Building it here rather than
 * adding a spreadsheet dependency keeps this consistent with how `nodemailer`
 * is treated — the feature works out of the box, and nothing in the export path
 * can fail because an optional package is missing.
 */

const { deflateRawSync } = require('node:zlib');

/**
 * CRC-32, computed here rather than taken from `node:zlib`.
 *
 * `zlib.crc32` only exists from Node 20.15, and this project supports Node >= 20
 * — depending on a patch release would mean an export that throws on a runtime
 * the rest of the codebase runs on perfectly well. The table is built once.
 */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/** RFC 4180: quote anything containing a comma, quote or newline; double inner quotes. */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Rows to CSV.
 *
 * Prefixed with a UTF-8 BOM. Without it Excel on Windows reads the file as the
 * system codepage and mangles every accented business name — which for a
 * Canadian wholesaler means Québec addresses arrive broken.
 */
function toCsv(columns, rows) {
  const header = columns.map((column) => csvCell(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => csvCell(column.get(row))).join(','));
  return `﻿${[header, ...body].join('\r\n')}\r\n`;
}

// ---- xlsx -------------------------------------------------------------------

const xmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** A1, B1 … Z1, AA1. Sheets wider than 26 columns exist, so this loops. */
function cellRef(columnIndex, rowNumber) {
  let ref = '';
  let index = columnIndex;
  while (index >= 0) {
    ref = String.fromCharCode(65 + (index % 26)) + ref;
    index = Math.floor(index / 26) - 1;
  }
  return `${ref}${rowNumber}`;
}

/**
 * The sheet XML.
 *
 * Numbers are written as numbers so Excel can total a column; everything else
 * is an inline string. Inline rather than a shared-strings table because the
 * table is a second part that has to stay in step with the sheet, and these
 * exports are read once and thrown away.
 */
function sheetXml(columns, rows) {
  const lines = [];

  lines.push(
    `<row r="1">${columns
      .map(
        (column, index) =>
          `<c r="${cellRef(index, 1)}" t="inlineStr"><is><t>${xmlEscape(column.label)}</t></is></c>`,
      )
      .join('')}</row>`,
  );

  rows.forEach((row, rowIndex) => {
    const cells = columns
      .map((column, columnIndex) => {
        const value = column.get(row);
        const ref = cellRef(columnIndex, rowIndex + 2);

        if (value === null || value === undefined || value === '') return '';
        if (typeof value === 'number' && Number.isFinite(value)) {
          return `<c r="${ref}"><v>${value}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
      })
      .join('');

    lines.push(`<row r="${rowIndex + 2}">${cells}</row>`);
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${lines.join('')}</sheetData></worksheet>`;
}

/**
 * A minimal zip writer.
 *
 * Only what a `.xlsx` needs: stored or deflated entries, no directory
 * traversal, no encryption, no zip64. The alternative is a dependency for four
 * files.
 */
function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const content = Buffer.from(file.content, 'utf8');
    const compressed = deflateRawSync(content);
    const useDeflate = compressed.length < content.length;
    const payload = useDeflate ? compressed : content;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10); // time
    localHeader.writeUInt16LE(0, 12); // date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    chunks.push(localHeader, name, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    central.push(centralHeader, name);
    offset += localHeader.length + name.length + payload.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuffer, end]);
}

/** Rows to a single-sheet `.xlsx` buffer. */
function toXlsx(columns, rows, sheetName = 'Export') {
  return zip([
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml(columns, rows) },
  ]);
}

/**
 * Writes an export to the response, with the right headers.
 *
 * **Money is exported as a decimal number, not a formatted string.** `$1,234.56`
 * in a spreadsheet is text that cannot be summed, which defeats the reason
 * somebody exported it. The column definitions below divide cents by 100 and
 * leave formatting to Excel.
 */
function send(res, { format, filename, columns, rows, sheetName }) {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${filename}-${stamp}`;

  if (String(format).toLowerCase() === 'xlsx') {
    const buffer = toXlsx(columns, rows, sheetName ?? filename);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
    return res.send(buffer);
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
  return res.send(toCsv(columns, rows));
}

/** Cents to a spreadsheet-native number. */
const asMoney = (cents) => (cents ?? 0) / 100;

/** A date as `YYYY-MM-DD`, which sorts correctly as text in every locale. */
const asDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

exports.default = { toCsv, toXlsx, send, asMoney, asDate };

// --- CommonJS exports -------------------------------------------------
exports.toCsv = toCsv;
exports.toXlsx = toXlsx;
exports.send = send;
exports.asMoney = asMoney;
exports.asDate = asDate;
