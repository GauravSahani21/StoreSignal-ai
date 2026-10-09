import crypto from 'node:crypto';
import { ValidationError } from '../errors/AppError.js';

export type SpeakerRole = 'advisor' | 'customer' | 'unknown';

export interface ParsedSegment {
  id: string; // Stable ID
  index: number;
  speaker: SpeakerRole;
  startMs: number | null;
  endMs: number | null;
  text: string;
  confidence: number | null;
}

export interface SegmenterOptions {
  conversationId?: string;
  transcriptVersion?: number;
}

/**
 * Parses timestamp string "[00:01:23]" or "[01:23]" or "[12.345]" into milliseconds.
 */
function parseTimestampToMs(timestampStr: string): number | null {
  const cleaned = timestampStr.replace(/[\[\]]/g, '').trim();
  const parts = cleaned.split(':');

  if (parts.length === 3) {
    const hours = Number.parseFloat(parts[0] || '0');
    const minutes = Number.parseFloat(parts[1] || '0');
    const seconds = Number.parseFloat(parts[2] || '0');
    if (Number.isFinite(hours) && Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
    }
  } else if (parts.length === 2) {
    const minutes = Number.parseFloat(parts[0] || '0');
    const seconds = Number.parseFloat(parts[1] || '0');
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return Math.round((minutes * 60 + seconds) * 1000);
    }
  } else if (parts.length === 1) {
    const seconds = Number.parseFloat(parts[0] || '0');
    if (Number.isFinite(seconds)) {
      return Math.round(seconds * 1000);
    }
  }

  return null;
}

/**
 * Normalizes speaker label to standard SpeakerRole supporting English and Indian language terms.
 */
function normalizeSpeaker(speakerStr: string): SpeakerRole {
  const lower = speakerStr.toLowerCase().trim();

  const advisorKeywords = [
    'advisor',
    'agent',
    'salesperson',
    'staff',
    'executive',
    'sales',
    'dealer',
    'सलाहकार',
    'विक्रेता',
    'एग्जीक्यूटिव',
  ];

  const customerKeywords = [
    'customer',
    'shopper',
    'buyer',
    'client',
    'visitor',
    'कस्टमर',
    'ग्राहक',
    'खरीदार',
  ];

  // Exact match
  if (advisorKeywords.includes(lower)) {
    return 'advisor';
  }
  if (customerKeywords.includes(lower)) {
    return 'customer';
  }

  // Token / substring match for compound roles like "Sales Executive" or "Retail Buyer"
  const tokens = lower.split(/\s+/);
  for (const token of tokens) {
    if (advisorKeywords.includes(token)) {
      return 'advisor';
    }
    if (customerKeywords.includes(token)) {
      return 'customer';
    }
  }

  return 'unknown';
}

/**
 * Generates a stable deterministic segment ID based on segment index and content.
 */
function generateStableSegmentId(
  conversationId: string,
  version: number,
  index: number,
  text: string
): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${conversationId}:v${version}:${index}:${text}`)
    .digest('hex')
    .substring(0, 8);
  return `seg-${version}-${index}-${hash}`;
}

/**
 * Parses raw transcript text into stable, structured segments per Appendix E.
 * Supports timestamps, speaker prefixes (Advisor/Customer/etc), and mixed Indian language scripts.
 */
export function segmentTranscript(
  rawText: string,
  options: SegmenterOptions = {}
): ParsedSegment[] {
  if (!rawText || !rawText.trim()) {
    throw new ValidationError('Transcript content cannot be empty.');
  }

  const conversationId = options.conversationId || 'conv-default';
  const version = options.transcriptVersion || 1;

  const lines = rawText.split(/\r?\n/);
  const segments: ParsedSegment[] = [];
  let currentIndex = 0;

  const timestampRegex = /^(\[\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\]|\(\d{1,2}:\d{2}\))\s*/;
  // Support Latin, Devanagari (\u0900-\u097F), Kannada (\u0C80-\u0CFF), and common punctuation
  const speakerRegex = /^([a-zA-Z\u0900-\u097F\u0C80-\u0CFF\s]+):/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]?.trim();
    if (!rawLine) {
      continue;
    }

    let remainingLine = rawLine;
    let startMs: number | null = null;
    let speaker: SpeakerRole = 'unknown';

    // 1. Extract timestamp if present
    const tsMatch = remainingLine.match(timestampRegex);
    if (tsMatch && tsMatch[0]) {
      startMs = parseTimestampToMs(tsMatch[1] || '');
      remainingLine = remainingLine.substring(tsMatch[0].length).trim();
    }

    // 2. Extract speaker if present
    const spkMatch = remainingLine.match(speakerRegex);
    if (spkMatch && spkMatch[1]) {
      speaker = normalizeSpeaker(spkMatch[1]);
      remainingLine = remainingLine.substring(spkMatch[0].length).trim();
    }

    // Remaining text is the dialogue
    const text = remainingLine.trim();
    if (!text) {
      continue;
    }

    const id = generateStableSegmentId(conversationId, version, currentIndex, text);

    segments.push({
      id,
      index: currentIndex,
      speaker,
      startMs,
      endMs: null,
      text,
      confidence: 1.0,
    });

    currentIndex++;
  }

  if (segments.length === 0) {
    throw new ValidationError('No valid dialogue segments could be extracted from transcript.');
  }

  return segments;
}
