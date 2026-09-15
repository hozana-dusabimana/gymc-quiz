import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const ODD_SPACES = new RegExp('[' + '\u00A0\u2007\u202F\u2009' + ']', 'g');

/**
 * Extract plain text from an uploaded document buffer.
 * Returns `{ pages: [{ page, text }], pageCount }`. For formats without a
 * page concept the whole document is a single "page".
 *
 * @param {Buffer} buffer
 * @param {string} fileType  pdf | docx | pptx | txt | md | csv | tsv | json | html | rtf
 */
export async function extractText(buffer, fileType) {
  switch (fileType) {
    case 'pdf':
      return extractPdf(buffer);
    case 'docx':
      return extractDocx(buffer);
    case 'txt':
    case 'md':
    case 'csv':
    case 'tsv':
    case 'json':
      return single(buffer.toString('utf8'));
    case 'html':
    case 'htm':
      return single(stripHtml(buffer.toString('utf8')));
    case 'rtf':
      return single(stripRtf(buffer.toString('utf8')));
    case 'pptx':
      return extractPptx(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

function stripHtml(html) {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripRtf(rtf) {
  return (rtf || '')
    .replace(/\\par[d]?/g, '\n')
    .replace(/\{\\[^}]+\}/g, ' ')
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, ' ')
    .replace(/[{}]/g, ' ');
}

async function extractPdf(buffer) {
  // unpdf wraps a current pdf.js serverless build — handles xref streams and
  // modern PDFs that the old pdf-parse could not.
  const { getDocumentProxy, extractText: extract } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extract(pdf, { mergePages: false });
  const arr = Array.isArray(text) ? text : [text];
  const pages = arr.map((t, i) => ({ page: i + 1, text: normalise(t || '') }));
  const filled = pages.filter((p) => p.text.length > 0);
  return {
    pages: filled.length ? filled : [{ page: 1, text: '' }],
    pageCount: totalPages || pages.length || 1,
  };
}

async function extractDocx(buffer) {
  const mammoth = require('mammoth');
  const { value } = await mammoth.extractRawText({ buffer });
  return single(value);
}

async function extractPptx(buffer) {
  let AdmZip;
  try {
    AdmZip = require('adm-zip');
  } catch {
    return single('');
  }
  const zip = new AdmZip(buffer);
  const slides = zip
    .getEntries()
    .filter((e) => /ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));
  const pages = slides.map((entry, i) => {
    const xml = entry.getData().toString('utf8');
    const text = xml.replace(/<a:t>/g, ' ').replace(/<[^>]+>/g, ' ');
    return { page: i + 1, text: normalise(text) };
  });
  return { pages: pages.length ? pages : [{ page: 1, text: '' }], pageCount: pages.length || 1 };
}

function single(text) {
  return { pages: [{ page: 1, text: normalise(text) }], pageCount: 1 };
}

function normalise(text) {
  return (text || '')
    .replace(ODD_SPACES, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
