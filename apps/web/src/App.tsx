import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  ShieldCheck,
  Terminal,
  Upload,
} from 'lucide-react';

interface HealthStatus {
  status: string;
  version: string;
  timestamp: string;
  env: string;
}

interface Segment {
  id: string;
  index: number;
  speaker: string;
  text: string;
  startMs?: number | null;
}

interface ConversationResponse {
  conversation: {
    id: string;
    status: string;
    source: string;
  };
  transcript: {
    id: string;
    version: number;
    segmentCount: number;
    segments: Segment[];
  };
}

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [consentGranted, setConsentGranted] = useState(true);
  const [rawText, setRawText] = useState(
    `[00:00:03] Advisor: Namaste! Welcome to Vayu Motors Indiranagar. Looking for a commuter bike today?\n[00:00:09] Customer: Yes, I travel 35 km daily to Whitefield. What is the mileage of the Prithvi 110?\n[00:00:16] Advisor: The Prithvi 110 gives 68 kmpl real-world mileage and has a 5-year warranty.\n[00:00:23] Customer: That sounds good! What is the on-road price with registration?`
  );
  const [ingestedConversation, setIngestedConversation] = useState<ConversationResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Timer for active recording simulation
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => setRecordDuration((prev) => prev + 1), 1000);
    } else {
      setRecordDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const fetchHealth = async () => {
    try {
      const res = await fetch('http://localhost:3001/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      // API may be offline in dev
    }
  };

  useEffect(() => {
    void fetchHealth();
  }, []);

  const handleIngestTranscript = async () => {
    if (!consentGranted) {
      alert('Error: Customer consent is required before processing any conversation data.');
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('http://localhost:3001/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTranscript: rawText,
          hasConsent: consentGranted,
          consentMethod: 'verbal',
          source: 'transcript_import',
          isDemo: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Ingestion failed');
      }
      const data = await res.json();
      setIngestedConversation(data);
      setStatusMessage('Conversation successfully ingested and segmented with stable IDs.');
    } catch (err: unknown) {
      setStatusMessage(`Error: ${err instanceof Error ? err.message : 'Failed to connect to API'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            S
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">StoreSignal AI</h1>
            <p className="text-xs text-slate-400">Agentic Retail Intelligence & Conversion Platform</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {health && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
              API v{health.version}
            </span>
          )}
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
            Phase 4: Speech-to-Text & Ingestion Active
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Capture & Ingestion (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-indigo-400" />
                  Showroom Audio & Transcript
                </h2>
                {isRecording && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    REC {Math.floor(recordDuration / 60)}:{(recordDuration % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>

              {/* Audio Controls */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsRecording(!isRecording)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition ${
                    isRecording
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isRecording ? 'Stop Recording' : 'Start Mic Recording'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRawText(
                      `[00:00:04] Advisor: Namaste! Are you interested in the Vayu Vidyut S1 electric scooter?\n[00:00:11] Customer: Yes, kya iska real range 100 km cross karta hai? Battery warranty kitne saal hai?`
                    )
                  }
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs"
                  title="Load Sample Hinglish Demo"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Mandatory Consent Checkbox */}
              <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-900/40 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentGranted}
                    onChange={(e) => setConsentGranted(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-300 leading-snug">
                    <strong className="text-white">Customer Consent Attested:</strong> Explicit permission granted
                    for showroom audio and dialogue intelligence per privacy policy.
                  </span>
                </label>
              </div>

              {/* Transcript Textarea */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-400">
                  Dialogue Input (Supports Timestamps & Speaker Roles)
                </label>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="[00:00:05] Advisor: Welcome to Vayu Motors..."
                />
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleIngestTranscript}
                disabled={isSubmitting || !consentGranted}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
              >
                {isSubmitting ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Ingest & Segment Dialogue
              </button>

              {statusMessage && (
                <div
                  className={`p-3 rounded-lg text-xs ${
                    statusMessage.startsWith('Error')
                      ? 'bg-red-950/40 border border-red-800 text-red-300'
                      : 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                  }`}
                >
                  {statusMessage}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Structured Segments & Evidence (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Addressable Dialogue Segments (Version 1)
                </h2>
                {ingestedConversation && (
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {ingestedConversation.conversation.id}
                  </span>
                )}
              </div>

              {ingestedConversation ? (
                <div className="space-y-3">
                  {ingestedConversation.transcript.segments.map((seg) => (
                    <div
                      key={seg.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-indigo-400 font-medium">{seg.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            seg.speaker === 'advisor'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : seg.speaker === 'customer'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {seg.speaker}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200">{seg.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center space-y-3">
                  <Upload className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    No active conversation segments ingested yet. Click &quot;Ingest &amp; Segment Dialogue&quot; on
                    the left to parse raw transcript into stable, cited segments.
                  </p>
                </div>
              )}
            </div>

            {/* Operating Guarantees Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Stable Segment IDs
                </span>
                <p className="text-slate-400">
                  Segments maintain deterministic IDs for downstream FloorCoach and SignalAnalyst evidence citations.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  Right to Erasure
                </span>
                <p className="text-slate-400">
                  Dedicated audio deletion endpoint removes audio files permanently while honoring consent boundaries.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 px-6 py-4 text-center text-xs text-slate-500">
        StoreSignal AI • Portfolio-grade agentic retail intelligence platform • Built strictly phase by phase
      </footer>
    </div>
  );
};
