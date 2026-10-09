import type { ParsedSegment } from '../../conversations/segmenter.js';
import type { RetrievedChunk } from '../../rag/retrieval/types.js';

export interface EvidenceRef {
  segmentId: string;
  quote: string;
}

export interface SourceRef {
  chunkId: string;
  documentId?: string;
  filename?: string;
}

export interface GuardValidationResult {
  guard: string;
  passed: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Normalizes text for lenient substring comparison: lowercase, strip punctuation and collapse whitespace.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F\u0C80-\u0CFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts numeric literals, currency figures, and time durations from a text string.
 */
export function extractNumbersAndSpecs(text: string): string[] {
  // Matches integers, decimals, currency symbols, and percentages
  const matches = text.match(/(?:₹|\$|rs\.?|inr)?\s*\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:kmpl|km|bhp|cc|kwh|years?|months?|days?|litres?|kg|%))?/gi);
  if (!matches) return [];

  return matches
    .map((m) => m.trim().toLowerCase())
    .filter((m) => /\d/.test(m)); // Must contain at least one digit
}

/**
 * Guard 1: Evidence Existence
 * Verifies every cited segmentId exists in the active transcript.
 */
export function validateEvidenceExistence(
  evidence: EvidenceRef[],
  segments: ParsedSegment[]
): GuardValidationResult {
  const segmentMap = new Map(segments.map((s) => [s.id, s]));
  const missing: string[] = [];

  for (const ev of evidence) {
    if (!segmentMap.has(ev.segmentId)) {
      missing.push(ev.segmentId);
    }
  }

  if (missing.length > 0) {
    return {
      guard: 'evidence_existence',
      passed: false,
      message: `Cited segment IDs do not exist in transcript: ${missing.join(', ')}`,
      details: { missing },
    };
  }

  return { guard: 'evidence_existence', passed: true };
}

/**
 * Guard 2: Quote Containment
 * Verifies the cited quote is a substring of the referenced transcript segment.
 */
export function validateQuoteContainment(
  evidence: EvidenceRef[],
  segments: ParsedSegment[]
): GuardValidationResult {
  const segmentMap = new Map(segments.map((s) => [s.id, s]));

  for (const ev of evidence) {
    const seg = segmentMap.get(ev.segmentId);
    if (!seg) continue; // Existence guard catches missing

    const normSeg = normalizeText(seg.text);
    const normQuote = normalizeText(ev.quote);

    if (!normSeg.includes(normQuote)) {
      return {
        guard: 'quote_containment',
        passed: false,
        message: `Cited quote "${ev.quote}" is not present in segment ${ev.segmentId} ("${seg.text}")`,
        details: { segmentId: ev.segmentId, quote: ev.quote },
      };
    }
  }

  return { guard: 'quote_containment', passed: true };
}

/**
 * Guard 3: Source Subset
 * Verifies supporting sources were actually retrieved in the RAG retrieval event.
 */
export function validateSourceSubset(
  sources: SourceRef[],
  retrievedChunks: RetrievedChunk[]
): GuardValidationResult {
  const validChunkIds = new Set(retrievedChunks.map((c) => c.chunkId));
  const ungrounded: string[] = [];

  for (const src of sources) {
    if (!validChunkIds.has(src.chunkId)) {
      ungrounded.push(src.chunkId);
    }
  }

  if (ungrounded.length > 0) {
    return {
      guard: 'source_subset',
      passed: false,
      message: `Cited sources were not present in retrieval results: ${ungrounded.join(', ')}`,
      details: { ungrounded },
    };
  }

  return { guard: 'source_subset', passed: true };
}

/**
 * Guard 4: Numeric and Spec Grounding
 * Verifies numbers, prices, or specs in generated text appear in cited knowledge chunks or customer statements.
 */
export function validateNumericGrounding(
  generatedText: string,
  supportingChunks: RetrievedChunk[],
  customerSegments: ParsedSegment[]
): GuardValidationResult {
  const generatedNumbers = extractNumbersAndSpecs(generatedText);
  if (generatedNumbers.length === 0) {
    return { guard: 'numeric_grounding', passed: true };
  }

  // Combine allowable ground truth text from cited chunks + customer dialogue
  const groundTruthText = [
    ...supportingChunks.map((c) => c.content),
    ...customerSegments.map((s) => s.text),
  ]
    .join(' ')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1$2');

  const ungroundedNumbers: string[] = [];

  for (const numStr of generatedNumbers) {
    // Extract just the core numeric digits (e.g. "68" from "68 kmpl", "72000" from "₹72,000")
    const cleanDigits = numStr.replace(/[^\d]/g, '');
    if (!cleanDigits) continue;

    // Check if the number appears anywhere in the cited sources or customer dialogue
    const groundDigits = groundTruthText.replace(/[^\d]/g, ' ');
    const appearsInGroundTruth = groundDigits.split(/\s+/).includes(cleanDigits) || groundTruthText.includes(cleanDigits);

    if (!appearsInGroundTruth) {
      ungroundedNumbers.push(numStr);
    }
  }

  if (ungroundedNumbers.length > 0) {
    return {
      guard: 'numeric_grounding',
      passed: false,
      message: `Generated response contains numbers not grounded in cited knowledge: ${ungroundedNumbers.join(', ')}`,
      details: { ungroundedNumbers },
    };
  }

  return { guard: 'numeric_grounding', passed: true };
}

/**
 * Guard 5: Explicit Basis Check
 * Validates that fields claiming explicit customer basis are cited from a customer-speaker segment.
 */
export function validateExplicitBasis(
  evidence: EvidenceRef[],
  segments: ParsedSegment[]
): GuardValidationResult {
  const segmentMap = new Map(segments.map((s) => [s.id, s]));

  for (const ev of evidence) {
    const seg = segmentMap.get(ev.segmentId);
    if (!seg) continue;

    if (seg.speaker !== 'customer') {
      return {
        guard: 'explicit_basis_check',
        passed: false,
        message: `Field marked as explicit cannot cite advisor segment ${ev.segmentId}. Must be from a customer segment.`,
        details: { segmentId: ev.segmentId, speaker: seg.speaker },
      };
    }
  }

  return { guard: 'explicit_basis_check', passed: true };
}

/**
 * Guard 6: Internal Score Leakage Check
 * Verifies customer-facing message never reveals internal scoring, rubrics, or confidence bands.
 */
export function validateNoInternalScoreLeakage(text: string): GuardValidationResult {
  const forbiddenPatterns = [
    /\bintent\s*score\b/i,
    /\bintent\s*band\b/i,
    /\bintent\s*assessment\b/i,
    /\binsufficient_evidence\b/i,
    /\brubric\b/i,
    /\bscoring\s*rubric\b/i,
    /\bhigh\s*intent\b/i,
    /\blow\s*intent\b/i,
    /\bmedium\s*intent\b/i,
    /\bcontributing\s*signals\b/i,
    /\bsignalanalyst\b/i,
    /\bfloorcoach\b/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) {
      return {
        guard: 'internal_score_leakage',
        passed: false,
        message: `Customer message contains internal algorithmic scores or terminology matching ${pattern.source}`,
        details: { matchedPattern: pattern.source },
      };
    }
  }

  return { guard: 'internal_score_leakage', passed: true };
}

/**
 * Guard 7: Facts Used & Spec Grounding in Draft Message
 * Verifies every fact claim and numeric figure in follow-up draft message is grounded in factsUsed or dialogue.
 */
export function validateFactsUsedGrounding(
  message: string,
  factsUsed: { fact: string; sourceChunkId?: string; sourceSegmentId?: string }[],
  retrievedChunks: RetrievedChunk[],
  customerSegments: ParsedSegment[]
): GuardValidationResult {
  const numbersInMessage = extractNumbersAndSpecs(message);
  if (numbersInMessage.length === 0) {
    return { guard: 'facts_used_grounding', passed: true };
  }

  const allowableText = [
    ...factsUsed.map((f) => f.fact),
    ...retrievedChunks.map((c) => c.content),
    ...customerSegments.map((s) => s.text),
  ]
    .join(' ')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1$2');

  const ungrounded: string[] = [];
  for (const numStr of numbersInMessage) {
    const cleanDigits = numStr.replace(/[^\d]/g, '');
    if (!cleanDigits) continue;

    const groundDigits = allowableText.replace(/[^\d]/g, ' ');
    const appearsInAllowed = groundDigits.split(/\s+/).includes(cleanDigits) || allowableText.includes(cleanDigits);

    if (!appearsInAllowed) {
      ungrounded.push(numStr);
    }
  }

  if (ungrounded.length > 0) {
    return {
      guard: 'facts_used_grounding',
      passed: false,
      message: `Follow-up message contains numbers/specs not grounded in factsUsed or dialogue: ${ungrounded.join(', ')}`,
      details: { ungrounded },
    };
  }

  return { guard: 'facts_used_grounding', passed: true };
}
