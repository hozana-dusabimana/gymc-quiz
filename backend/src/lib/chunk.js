/**
 * Split extracted pages into overlapping chunks suitable for embedding.
 * Each chunk keeps the page number it started on so references can cite a page.
 *
 * @param {{page:number, text:string}[]} pages
 * @param {{ targetChars?:number, overlapChars?:number }} [opts]
 * @returns {{ chunkIndex:number, content:string, pageNumber:number, tokenEstimate:number }[]}
 */
export function chunkPages(pages, opts = {}) {
  const targetChars = opts.targetChars ?? 1200;
  const overlapChars = opts.overlapChars ?? 200;
  const chunks = [];
  let index = 0;

  for (const { page, text } of pages) {
    if (!text || !text.trim()) continue;
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let buffer = '';

    const flush = () => {
      const content = buffer.trim();
      if (content.length < 40) {
        buffer = '';
        return;
      }
      chunks.push({
        chunkIndex: index++,
        content,
        pageNumber: page,
        tokenEstimate: Math.ceil(content.length / 4),
      });
      buffer = overlapChars > 0 ? content.slice(-overlapChars) : '';
    };

    for (const para of paragraphs) {
      if (para.length > targetChars * 1.5) {
        // very long paragraph: hard-split on sentences
        const sentences = para.split(/(?<=[.!?])\s+/);
        for (const s of sentences) {
          if ((buffer + ' ' + s).length > targetChars) flush();
          buffer += (buffer ? ' ' : '') + s;
        }
        continue;
      }
      if ((buffer + '\n\n' + para).length > targetChars) flush();
      buffer += (buffer ? '\n\n' : '') + para;
    }
    flush();
  }

  return chunks;
}
