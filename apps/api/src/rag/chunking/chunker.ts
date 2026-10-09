export interface RawChunk {
  chunkIndex: number;
  content: string;
  locationMetadata: {
    page?: number;
    sheet?: string;
    row?: number;
    heading?: string;
    section?: string;
  };
}

export interface ChunkerOptions {
  maxChunkSize?: number;
  overlap?: number;
}

/**
 * Structure-aware document chunker preserving tabular headers and markdown hierarchies.
 */
export function chunkDocument(
  content: string,
  fileType: string,
  options: ChunkerOptions = {}
): RawChunk[] {
  const normalizedType = fileType.toLowerCase().replace(/^\./, '');
  const maxChunkSize = options.maxChunkSize || 600;

  if (normalizedType === 'csv' || normalizedType === 'xlsx') {
    return chunkCsvOrTable(content);
  }

  if (normalizedType === 'md' || normalizedType === 'markdown') {
    return chunkMarkdown(content, maxChunkSize);
  }

  return chunkPlainText(content, maxChunkSize);
}

function chunkCsvOrTable(content: string): RawChunk[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0] || '');
  const chunks: RawChunk[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i] || '');
    if (values.length === 0) continue;

    const rowPairs: string[] = [];
    for (let col = 0; col < headers.length; col++) {
      const headerName = headers[col] || `Column_${col + 1}`;
      const cellValue = values[col] !== undefined ? values[col] : '';
      rowPairs.push(`${headerName}: ${cellValue}`);
    }

    const formattedContent = `[Service Schedule / Rates] ${rowPairs.join(' | ')}`;
    chunks.push({
      chunkIndex: i - 1,
      content: formattedContent,
      locationMetadata: {
        row: i,
        sheet: 'Sheet1',
        section: 'table_row',
      },
    });
  }

  return chunks;
}

function parseCsvLine(line: string): string[] {
  // Simple CSV parser handling comma separation and basic quotes
  const result: string[] = [];
  let inQuotes = false;
  let current = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function chunkMarkdown(content: string, maxChunkSize: number): RawChunk[] {
  const lines = content.split(/\r?\n/);
  const chunks: RawChunk[] = [];
  let currentHeading = 'Overview';
  let currentBuffer: string[] = [];
  let chunkIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (line === undefined) continue;

    if (line.startsWith('#')) {
      if (currentBuffer.length > 0) {
        chunks.push({
          chunkIndex: chunkIndex++,
          content: `[Section: ${currentHeading}]\n${currentBuffer.join('\n')}`,
          locationMetadata: {
            heading: currentHeading,
            section: 'markdown_section',
          },
        });
        currentBuffer = [];
      }
      currentHeading = line.replace(/^#+\s*/, '').trim();
    } else if (line.length > 0) {
      currentBuffer.push(line);
      const currentLength = currentBuffer.join(' ').length;
      if (currentLength >= maxChunkSize) {
        chunks.push({
          chunkIndex: chunkIndex++,
          content: `[Section: ${currentHeading}]\n${currentBuffer.join('\n')}`,
          locationMetadata: {
            heading: currentHeading,
            section: 'markdown_paragraph',
          },
        });
        currentBuffer = [];
      }
    }
  }

  if (currentBuffer.length > 0) {
    chunks.push({
      chunkIndex: chunkIndex++,
      content: `[Section: ${currentHeading}]\n${currentBuffer.join('\n')}`,
      locationMetadata: {
        heading: currentHeading,
        section: 'markdown_section',
      },
    });
  }

  return chunks;
}

function chunkPlainText(content: string, maxChunkSize: number): RawChunk[] {
  const paragraphs = content.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: RawChunk[] = [];
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if (para.length <= maxChunkSize) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: para,
        locationMetadata: {
          section: 'paragraph',
        },
      });
    } else {
      // Split into smaller sentence/word blocks
      const words = para.split(/\s+/);
      let buffer: string[] = [];
      for (const word of words) {
        buffer.push(word);
        if (buffer.join(' ').length >= maxChunkSize) {
          chunks.push({
            chunkIndex: chunkIndex++,
            content: buffer.join(' '),
            locationMetadata: {
              section: 'paragraph_part',
            },
          });
          buffer = [];
        }
      }
      if (buffer.length > 0) {
        chunks.push({
          chunkIndex: chunkIndex++,
          content: buffer.join(' '),
          locationMetadata: {
            section: 'paragraph_part',
          },
        });
      }
    }
  }

  return chunks;
}
