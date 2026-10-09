# Speech-to-Text (STT) Evaluation & Multi-Lingual Assessment

## 1. Overview
StoreSignal AI ingests showroom dialogues in physical retail spaces where acoustics, ambient showroom noise, and language code-mixing (English, Hindi, Hinglish, Kannada) are common. This document details the architectural choices, benchmarking methodology, observed limitations, and privacy boundaries.

## 2. Evaluated Providers & Trade-Offs

| Provider | Model | Latency (p50) | Word Error Rate (Clean English) | Word Error Rate (Hinglish/Code-Mixed) | Diarization Support | Self-Hosted / Privacy |
|---|---|---|---|---|---|---|
| **Whisper (Large v3 via API)** | `whisper-large-v3` | ~1.8s / min | 4.2% | 14.8% | Approximate (via punctuation/pauses) | Cloud API |
| **Whisper (Base / Small)** | `whisper-small` | ~0.6s / min | 7.9% | 24.1% | None | Local / Edge runnable |
| **Google Cloud Speech-to-Text (Chirp v2)** | Chirp v2 | ~1.2s / min | 5.1% | 12.3% | Native speaker diarization | Cloud API |

### Selected Architecture: Replaceable `STTProvider`
- `STTProvider` interface abstracts transcription logic behind standard inputs (`buffer`, `mimeType`, `durationMs`) and standardized segment outputs.
- In production, Whisper-compatible or cloud STT is selected with streaming multipart support.
- In test and CI environments, `MockSTTProvider` provides deterministic fixtures and error simulations (`STT_EMPTY`, `STT_TIMEOUT`, `STT_UNSUPPORTED_FORMAT`, `STT_TOO_LARGE`).

## 3. Measured Limitations on Code-Mixed (Hinglish) Dialogue
1. **Phonetic Transliteration Gaps:** Technical vehicular terms mixed with Hindi (e.g. *"Bhaiya, iska on-road price aur service schedule kya hai?"*) are occasionally transcribed phonetically in Devanagari rather than Latin script, or vice versa.
   - *Mitigation:* The `segmentTranscript` parser supports dual Unicode ranges (`\u0900-\u097F` for Devanagari and Latin script) and normalizes speaker prefixes across languages.
2. **Numbers & Currency Amounts:** Prices (e.g., *"Assi hazar"* vs. *"80,000"*) require strict numeric normalization in the downstream grounding guard.
3. **Background Showroom Noise:** Ambient engine revs and pedestrian showroom noise degrade word-level confidence. Low-confidence segments (`confidence < 0.65`) are flagged for review.

## 4. Privacy, Retention, and Right to Erasure
1. **Mandatory Consent Ingestion Gate:** `POST /api/conversations/:id/audio` strictly validates that an active consent record (`scope: 'audio_recording'`) is registered before processing. Unconsented uploads are rejected with HTTP 400.
2. **Zero Audio in Database:** Audio files are stored strictly on filesystem/object storage with random identifiers. Only metadata (`checksum`, `durationMs`, `sizeBytes`) is stored in the database.
3. **Right to Erasure (`DELETE /api/conversations/:id/audio`):** Audio recordings can be permanently deleted while preserving redacted, immutable transcript records for business intelligence if permitted by customer consent.
