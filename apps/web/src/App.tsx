import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  Mail,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  Play,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Upload,
  UserCheck,
  X,
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

interface FollowUpDraft {
  id: string;
  orgId: string;
  conversationId: string;
  version: number;
  channel: 'email' | 'sms' | 'whatsapp' | 'call_task' | 'none';
  subject: string | null;
  message: string | null;
  factsUsed: Array<{ fact: string; sourceChunkId?: string; sourceSegmentId?: string }>;
  recommendedAction: string;
  reason: string;
  status: 'draft' | 'approved' | 'rejected';
  requiresHumanApproval: boolean;
  blockedReason?: string | null;
  createdAt: string;
  updatedAt: string;
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

  // Follow-up Queue State
  const [drafts, setDrafts] = useState<FollowUpDraft[]>([]);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');

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

      const data: ConversationResponse = await res.json();
      setIngestedConversation(data);
      setStatusMessage(`Successfully ingested conversation (ID: ${data.conversation.id}) with ${data.transcript.segmentCount} segments.`);

      // Also record follow-up contact consent for this session
      await fetch('http://localhost:3001/api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: data.conversation.id,
          scope: 'follow_up_contact',
          method: 'verbal',
        }),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Ingestion error: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateFollowUp = async () => {
    if (!ingestedConversation) return;
    setIsGeneratingDraft(true);
    setStatusMessage(null);
    try {
      // 1. First trigger SignalAnalyst
      await fetch(`http://localhost:3001/api/conversations/${ingestedConversation.conversation.id}/analyze`, {
        method: 'POST',
      });

      // 2. Then trigger FollowUpOptimizer
      const res = await fetch(`http://localhost:3001/api/conversations/${ingestedConversation.conversation.id}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permittedChannels: ['whatsapp', 'email'],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to generate follow-up draft');
      }

      const data = await res.json();
      setDrafts([data.draft, ...drafts]);
      setStatusMessage('Follow-up draft successfully generated and placed in human approval queue.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Follow-up error: ${message}`);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleApproveDraft = async (draftId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/drafts/${draftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: 'advisor-neha-12',
          reviewerNotes: reviewerNotes || 'Approved by floor advisor',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDrafts(drafts.map((d) => (d.id === draftId ? data.draft : d)));
        setStatusMessage('Draft approved and recorded in governance audit ledger. No automated dispatch executed.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Approval error: ${message}`);
    }
  };

  const handleRejectDraft = async (draftId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/drafts/${draftId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: 'advisor-neha-12',
          reviewerNotes: reviewerNotes || 'Rejected by floor advisor',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDrafts(drafts.map((d) => (d.id === draftId ? data.draft : d)));
        setStatusMessage('Draft rejected and closed in queue.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Rejection error: ${message}`);
    }
  };

  const handleSaveEdit = async (draftId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editSubject,
          message: editMessage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDrafts(drafts.map((d) => (d.id === draftId ? data.draft : d)));
        setEditingDraftId(null);
        setStatusMessage('Draft text updated successfully.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Edit error: ${message}`);
    }
  };

  const startEdit = (draft: FollowUpDraft) => {
    setEditingDraftId(draft.id);
    setEditSubject(draft.subject || '');
    setEditMessage(draft.message || '');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
            SS
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              StoreSignal AI
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                Phase 8 • Governed Drafts
              </span>
            </h1>
            <p className="text-xs text-slate-400">Agentic Physical-Retail Intelligence &amp; Governed Outbound Queue</p>
          </div>
        </div>

        {/* API Health indicator */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
            <Activity className={`w-3.5 h-3.5 ${health ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <span className="text-slate-300">
              API: {health ? `${health.status} (${health.env})` : 'connecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Banner notification */}
        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 text-xs text-indigo-200 flex items-center justify-between animate-in fade-in">
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white transition"
            >
              &times;
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Ingestion & Live Audio Capture */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Audio Ingestion Simulator Card */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-indigo-400" />
                  Live Showroom Audio Capture
                </h2>
                {isRecording && (
                  <span className="flex items-center gap-1.5 text-xs font-mono text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    REC {recordDuration}s
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Record real physical-retail sales conversations or import multi-turn transcripts. Customer consent is
                mandatory before processing any dialogue.
              </p>

              {/* Consent Checkbox */}
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={consentGranted}
                  onChange={(e) => setConsentGranted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500/20 bg-slate-900"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Customer Consent Attested
                  </span>
                  <p className="text-slate-400 text-[11px]">
                    Customer gave verbal or written consent for conversation capture, analysis, and follow-up.
                  </p>
                </div>
              </label>

              {/* Simulation Action Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsRecording(!isRecording)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition ${
                    isRecording
                      ? 'bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isRecording ? 'Stop Recording' : 'Simulate Audio Ingestion'}
                </button>
              </div>
            </div>

            {/* Transcript Ingestion Input */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  Conversation Dialogue Input
                </h2>
                <button
                  onClick={() =>
                    setRawText(
                      `[00:00:03] Advisor: Namaste! Welcome to Vayu Motors Indiranagar. Looking for a commuter bike today?\n[00:00:09] Customer: Yes, I travel 35 km daily to Whitefield. What is the mileage of the Prithvi 110?\n[00:00:16] Advisor: The Prithvi 110 gives 68 kmpl real-world mileage and has a 5-year warranty.\n[00:00:23] Customer: That sounds good! What is the on-road price with registration?`
                    )
                  }
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Sample
                </button>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={7}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 resize-none"
                placeholder="Paste raw conversation transcript here..."
              />

              <button
                onClick={handleIngestTranscript}
                disabled={isSubmitting || !consentGranted}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                {isSubmitting ? 'Ingesting & Normalizing...' : 'Ingest & Segment Dialogue'}
              </button>
            </div>
          </div>

          {/* Right Column: Follow-Up Drafts Queue & Addressable Segments */}
          <div className="lg:col-span-7 space-y-6">
            {/* Follow-Up Governance Queue Card */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    Governed Follow-Up Approval Queue
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Grounded drafts awaiting human approval. Automated dispatch is strictly disabled.
                  </p>
                </div>

                {ingestedConversation && (
                  <button
                    onClick={handleGenerateFollowUp}
                    disabled={isGeneratingDraft}
                    className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white shadow transition flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3" />
                    {isGeneratingDraft ? 'Synthesizing...' : 'Draft Follow-Up'}
                  </button>
                )}
              </div>

              {/* Draft List */}
              {drafts.length > 0 ? (
                <div className="space-y-4">
                  {drafts.map((draft) => {
                    const isEditing = editingDraftId === draft.id;
                    return (
                      <div
                        key={draft.id}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {draft.channel === 'email' && <Mail className="w-4 h-4 text-blue-400" />}
                            {draft.channel === 'whatsapp' && <MessageSquare className="w-4 h-4 text-emerald-400" />}
                            {draft.channel === 'call_task' && <Phone className="w-4 h-4 text-amber-400" />}
                            {draft.channel === 'none' && <ShieldAlert className="w-4 h-4 text-rose-400" />}

                            <span className="font-semibold uppercase text-slate-200">
                              Channel: {draft.channel}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">v{draft.version}</span>
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                draft.status === 'approved'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : draft.status === 'rejected'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {draft.status}
                            </span>
                          </div>
                        </div>

                        {/* Blocked Alert if Channel is None */}
                        {draft.blockedReason && (
                          <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>Outreach Blocked by Policy: {draft.blockedReason}</span>
                          </div>
                        )}

                        {/* Recommendation Context */}
                        <div className="text-xs text-slate-300 space-y-1 bg-slate-900/50 p-3 rounded-lg border border-slate-800/60">
                          <div className="font-medium text-indigo-300">
                            Action: {draft.recommendedAction}
                          </div>
                          <div className="text-slate-400 text-[11px]">{draft.reason}</div>
                        </div>

                        {/* Draft Subject / Message Content */}
                        {draft.message ? (
                          isEditing ? (
                            <div className="space-y-2">
                              {draft.channel === 'email' && (
                                <input
                                  type="text"
                                  value={editSubject}
                                  onChange={(e) => setEditSubject(e.target.value)}
                                  placeholder="Subject"
                                  className="w-full text-xs p-2 rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
                                />
                              )}
                              <textarea
                                value={editMessage}
                                onChange={(e) => setEditMessage(e.target.value)}
                                rows={4}
                                className="w-full text-xs p-2 rounded bg-slate-900 border border-slate-700 text-slate-200 font-sans focus:outline-none resize-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingDraftId(null)}
                                  className="py-1 px-2.5 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1"
                                >
                                  <X className="w-3 h-3" /> Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveEdit(draft.id)}
                                  className="py-1 px-2.5 rounded text-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1"
                                >
                                  <Save className="w-3 h-3" /> Save Changes
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {draft.subject && (
                                <div className="text-xs font-semibold text-slate-200">
                                  Subject: {draft.subject}
                                </div>
                              )}
                              <p className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                                {draft.message}
                              </p>
                            </div>
                          )
                        ) : null}

                        {/* Grounded Facts Used */}
                        {draft.factsUsed && draft.factsUsed.length > 0 && (
                          <div className="space-y-1 text-[11px]">
                            <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                              Verified Facts Grounded in Draft:
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {draft.factsUsed.map((f, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                                >
                                  {f.fact}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Reviewer Action Bar */}
                        {draft.status === 'draft' && !isEditing && (
                          <div className="pt-2 border-t border-slate-850 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <button
                              onClick={() => startEdit(draft)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 self-start sm:self-center"
                            >
                              <Edit2 className="w-3 h-3" /> Edit Draft
                            </button>

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={reviewerNotes}
                                onChange={(e) => setReviewerNotes(e.target.value)}
                                placeholder="Reviewer notes (optional)..."
                                className="px-2 py-1 text-xs rounded bg-slate-900 border border-slate-800 text-slate-300 focus:outline-none focus:border-slate-700 w-44"
                              />
                              <button
                                onClick={() => handleRejectDraft(draft.id)}
                                className="py-1 px-3 rounded-lg text-xs font-medium bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 transition flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Reject
                              </button>
                              <button
                                onClick={() => handleApproveDraft(draft.id)}
                                className="py-1 px-3 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Approve Draft
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center space-y-2">
                  <Clock className="w-7 h-7 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No active follow-up drafts generated yet. Ingest dialogue and click &quot;Draft Follow-Up&quot; to
                    synthesize a governed draft.
                  </p>
                </div>
              )}
            </div>

            {/* Addressable Dialogue Segments Card */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Addressable Dialogue Segments
                </h2>
                {ingestedConversation && (
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {ingestedConversation.conversation.id}
                  </span>
                )}
              </div>

              {ingestedConversation ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {ingestedConversation.transcript.segments.map((seg) => (
                    <div
                      key={seg.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1 hover:border-slate-700 transition"
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
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center space-y-2">
                  <Upload className="w-6 h-6 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No active conversation segments ingested yet.
                  </p>
                </div>
              )}
            </div>

            {/* Operating Guarantees Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Human Approval Gate
                </span>
                <p className="text-slate-400">
                  Outreach messages require human review and authorization. Zero automatic dispatch is supported.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  Strict Spec Grounding
                </span>
                <p className="text-slate-400">
                  Every figure or claim in drafts maps to cited knowledge chunks and customer consent boundaries.
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
export default App;
