import type { SpeakerRole } from '../../conversations/segmenter.js';

export interface STTSegment {
  index: number;
  speaker: SpeakerRole;
  text: string;
  startMs?: number | null;
  endMs?: number | null;
  confidence?: number | null;
}

export interface STTResult {
  text: string;
  segments: STTSegment[];
  language?: string;
  durationMs?: number;
}

export interface AudioBufferData {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
  durationMs?: number;
  sizeBytes: number;
}

export interface STTOptions {
  language?: string;
  diarize?: boolean;
}

export interface STTProvider {
  transcribe(audio: AudioBufferData, options?: STTOptions): Promise<STTResult>;
}
