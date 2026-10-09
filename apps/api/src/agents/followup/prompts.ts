import type { SignalAnalystOutput } from '../signalanalyst/schema.js';
import type { FloorCoachOutput } from '../floorcoach/schema.js';
import type { RetrievedChunk } from '../../rag/retrieval/types.js';

export const FOLLOWUP_PROMPT_VERSION = '1.0.0';

export function buildFollowUpSystemPrompt(): string {
  return `You are FollowUpOptimizer, a governed retail customer engagement agent for StoreSignal AI.
Your role is to recommend the next best action and generate a personalized, respectful follow-up draft message based ONLY on verified customer insights and retrieved product facts.

NON-NEGOTIABLE OPERATING CONTRACT:
1. HUMAN APPROVAL MANDATORY: You ONLY generate drafts. You never send messages. "status" MUST ALWAYS be "draft", and "requiresHumanApproval" MUST ALWAYS be true.
2. CHANNEL RESTRICTION: You may ONLY select a channel that is explicitly permitted in the "Permitted Channels" list. If no channels are permitted or consent is not granted, you MUST set channel = "none", message = null, and blockedReason = "no_consent" or "no_contact_channel".
3. ZERO INTERNAL SCORES IN MESSAGE: The customer-facing message MUST NEVER mention internal metrics, scores, confidence bands, or algorithmic terms (e.g. "intent score", "rubric", "high intent", "insufficient evidence", "SignalAnalyst", "FloorCoach").
4. STRICT SPEC GROUNDING: Every number, price, EMI amount, or specification in "message" MUST be listed in "factsUsed" and be backed by the verified knowledge base chunks or dialogue. If an exact spec or price is not in the knowledge base, do not fabricate it.
5. NO UNSOLICITED CLAIMS: Address the customer's actual expressed interests, questions, or unresolved concerns. Do not spam generic marketing copy.
6. OUTPUT FORMAT: Respond ONLY with a single JSON object matching the exact JSON schema. Do not include markdown codeblocks or explanatory commentary.`;
}

export function buildFollowUpUserPrompt(params: {
  analystOutput: SignalAnalystOutput;
  floorCoachOutput?: FloorCoachOutput | null;
  retrievedChunks: RetrievedChunk[];
  permittedChannels: string[];
  hasConsent: boolean;
}): string {
  const { analystOutput, floorCoachOutput, retrievedChunks, permittedChannels, hasConsent } = params;

  const chunksText = retrievedChunks.length > 0
    ? retrievedChunks
        .map((c, i) => `[Chunk ${i + 1} | ID: ${c.chunkId}]\n${c.content}`)
        .join('\n\n')
    : '(No knowledge chunks retrieved)';

  const unresolvedFloorCoach = floorCoachOutput?.unresolved?.map((u) => `- Question: "${u.question}" | Reason: ${u.reason}`).join('\n') || 'None';

  return `CONSENT & PERMISSIONS:
- Has Consent: ${hasConsent ? 'YES' : 'NO'}
- Permitted Channels: ${permittedChannels.length > 0 ? permittedChannels.join(', ') : 'NONE'}

CUSTOMER INSIGHTS (from SignalAnalyst):
- Summary: ${analystOutput.summary}
- Product Interests: ${analystOutput.productInterests.map((p) => `${p.text} (${p.basis}${p.productRef ? `, ref: ${p.productRef}` : ''})`).join(', ') || 'None'}
- Preferences: ${analystOutput.preferences.map((p) => `${p.text} (${p.basis})`).join('; ') || 'None'}
- Budget: ${analystOutput.budget ? `${analystOutput.budget.value} (${analystOutput.budget.basis})` : 'Not specified'}
- Timeline: ${analystOutput.timeline ? `${analystOutput.timeline.value} (${analystOutput.timeline.basis})` : 'Not specified'}
- Objections: ${analystOutput.objections.map((o) => `${o.type}: ${o.text} (Resolved: ${o.resolved ? 'Yes' : 'No'})`).join('; ') || 'None'}
- Recommended Action: ${analystOutput.recommendedNextAction}

UNRESOLVED QUESTIONS (from FloorCoach):
${unresolvedFloorCoach}

VERIFIED KNOWLEDGE CHUNKS:
${chunksText}

Generate the follow-up recommendation and draft. If consent or permitted channels are lacking, abstain by setting channel to "none" and specifying the blockedReason.

JSON FORMAT:
{
  "recommendedAction": "string",
  "reason": "string",
  "channel": "email" | "sms" | "whatsapp" | "call_task" | "none",
  "subject": "string or null",
  "message": "string or null",
  "factsUsed": [
    { "fact": "string", "sourceChunkId": "string optional", "sourceSegmentId": "string optional" }
  ],
  "status": "draft",
  "requiresHumanApproval": true,
  "blockedReason": "no_consent" | "no_contact_channel" | "insufficient_evidence" | null
}`;
}

export function buildFollowUpRepairPrompt(
  originalPrompt: string,
  invalidJsonText: string,
  issues: string[]
): string {
  return `${originalPrompt}

PREVIOUS RESPONSE ATTEMPT FAILED GOVERNANCE VALIDATION:
Errors detected:
${issues.map((i) => `- ${i}`).join('\n')}

Previous raw response:
${invalidJsonText}

Please correct these violations immediately and output ONLY a valid JSON object matching the required schema. Ensure channel matches permitted channels, status is "draft", requiresHumanApproval is true, no internal score terminology is present, and every spec is grounded in factsUsed.`;
}
