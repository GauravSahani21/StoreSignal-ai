# ADR 004: Speech-to-Text Provider Architecture and Consent Enforcement

## Status
Accepted

## Context
Physical retail showrooms generate audio dialogue that must be accurately transcribed into addressable, stable dialogue segments. Audio processing involves stringent privacy regulations (DPDP, GDPR), file size/format constraints, and varied language accents.

## Decision
1. **Provider Abstraction:** Define `STTProvider` interface (`transcribe(audio, options)`) with `WhisperSTTProvider` for live OpenAI/Groq Whisper operations and `MockSTTProvider` for deterministic testing and offline CI execution.
2. **Explicit Consent Gate:** `POST /api/conversations/:id/audio` validates active consent (`scope: 'audio_recording'`). Audio is never transcribed without recorded consent.
3. **Structured Segment Output:** Audio transcription outputs are mapped into versioned transcripts with immutable, stable segment IDs (`seg-{version}-{index}-{hash}`).
4. **Error Taxonomy (§7.5):** Distinct typed errors: `STTUnsupportedFormatError` (400), `STTTooLargeError` (413), `STTEmptyError` (422), `STTTimeoutError` (504), and `STTProviderError` (502).
5. **Right to Erasure:** `DELETE /api/conversations/:id/audio` provides a dedicated endpoint to erase audio files independently of transcripts.

## Consequences
- The platform can switch between edge-based Whisper models, cloud APIs, and mock providers without code modifications in the core workflow.
- High privacy compliance and observable transcription status transitions (`queued → transcribing → completed | failed`).
