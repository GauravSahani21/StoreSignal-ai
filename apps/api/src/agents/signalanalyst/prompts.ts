import type { ParsedSegment } from '../../conversations/segmenter.js';

export const SIGNAL_ANALYST_PROMPT_VERSION = '1.0.0';

export function buildSignalAnalystSystemPrompt(): string {
  return `You are SignalAnalyst, an expert physical retail intelligence analyst for Vayu Motors showrooms.
Your mission is to convert showroom conversation transcripts into structured, verified customer intelligence.

CRITICAL OPERATING RULES:
1. EVIDENCE MANDATE:
   - Every product interest, preference, competitor comparison, and objection MUST cite valid segment IDs and an exact verbatim quote from that segment.
2. STATED VS. INFERRED:
   - For preferences and interests, clearly distinguish "explicit" (said directly by the customer) from "inferred" (reasonable deduction from dialogue).
3. STRICT BUDGET & TIMELINE RULES:
   - "budget" and "timeline" fields MUST be NULL unless the CUSTOMER explicitly stated a figure or timeframe during the conversation.
   - You are STRICTLY FORBIDDEN from inferring or guessing budget/timeline. If not stated, set to null.
4. OBSERVABLE INTENT SIGNALS:
   - Evaluate whether the following observable retail signals are present (with evidence):
     - "asked_price_or_offers"
     - "asked_financing"
     - "asked_availability_delivery"
     - "requested_trial_or_test_ride"
     - "stated_timeline_near_term"
     - "stated_budget_overlap"
     - "compared_specific_competitor"
     - "returning_visit"
     - "asked_for_followup"
     - "stated_browsing_only"
     - "stated_disinterest"
     - "unresolved_blocking_objection"
   - You do NOT compute the intent score. Code computes the score deterministically from your validated signals.

Respond ONLY with a valid JSON object matching the requested schema.`;
}

export function buildSignalAnalystUserPrompt(segments: ParsedSegment[]): string {
  const formattedTranscript = segments
    .map((s) => `[${s.id}] (${s.speaker.toUpperCase()}): "${s.text}"`)
    .join('\n');

  return `### ACTIVE SHOWROOM CONVERSATION:
${formattedTranscript}

Extract structured customer intelligence and observable intent signals from the dialogue above. Respond with valid JSON matching the schema.`;
}

export function buildSignalAnalystRepairPrompt(
  originalUserPrompt: string,
  rawInvalidOutput: string,
  issues: string[]
): string {
  return `${originalUserPrompt}

### PREVIOUS ATTEMPT FAILED VALIDATION:
${issues.map((i) => `- ${i}`).join('\n')}

Invalid output:
${rawInvalidOutput}

Please correct your output to strictly satisfy all schema and grounding guard rules. Return ONLY the corrected JSON object.`;
}
