import {
  STTEmptyError,
  STTProviderError,
  STTTimeoutError,
  STTTooLargeError,
  STTUnsupportedFormatError,
} from '../../errors/AppError.js';
import type { AudioBufferData, STTOptions, STTProvider, STTResult } from './types.js';

export interface WhisperSTTConfig {
  apiKey: string;
  endpointUrl?: string;
  defaultLanguage?: string;
  timeoutMs?: number;
}

export class WhisperSTTProvider implements STTProvider {
  private readonly apiKey: string;
  private readonly endpointUrl: string;
  private readonly defaultLanguage: string;
  private readonly timeoutMs: number;

  constructor(config: WhisperSTTConfig) {
    this.apiKey = config.apiKey;
    this.endpointUrl = config.endpointUrl || 'https://api.openai.com/v1/audio/transcriptions';
    this.defaultLanguage = config.defaultLanguage || 'en';
    this.timeoutMs = config.timeoutMs || 45000;
  }

  async transcribe(audio: AudioBufferData, options?: STTOptions): Promise<STTResult> {
    if (audio.sizeBytes > 26214400) {
      throw new STTTooLargeError('Audio file exceeds 25MB maximum limit for transcription.');
    }

    const allowedMimes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/m4a'];
    if (!allowedMimes.some((m) => audio.mimeType.toLowerCase().includes(m.split('/')[1] || ''))) {
      throw new STTUnsupportedFormatError(
        `Mime-type "${audio.mimeType}" is not supported. Supported: wav, mp3, mp4, m4a, webm, ogg.`
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const formData = new FormData();
    const blob = new Blob([audio.buffer], { type: audio.mimeType });
    formData.append('file', blob, audio.filename || 'recording.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', options?.language || this.defaultLanguage);
    formData.append('response_format', 'verbose_json');

    try {
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new STTProviderError(`Upstream STT failed with status ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        text?: string;
        segments?: Array<{ text: string; start: number; end: number }>;
      };

      if (!data.text || !data.text.trim()) {
        throw new STTEmptyError('Speech-to-text returned an empty transcription.');
      }

      return {
        text: data.text,
        language: options?.language || this.defaultLanguage,
        segments: (data.segments || []).map((seg, idx) => ({
          index: idx,
          speaker: 'unknown',
          text: seg.text.trim(),
          startMs: Math.round(seg.start * 1000),
          endMs: Math.round(seg.end * 1000),
        })),
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new STTTimeoutError(`Speech transcription timed out after ${this.timeoutMs}ms.`);
      }
      if (err instanceof STTProviderError || err instanceof STTEmptyError) {
        throw err;
      }
      throw new STTProviderError(
        `Failed to communicate with STT service: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
