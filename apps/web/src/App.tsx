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
  User,
  UserCheck,
  UserX,
  X,
  Cpu,
  Layers,
  RefreshCw,
  ShoppingBag,
  Trash2,
  History,
  Lock,
  Tag,
  BarChart3,
  FlaskConical,
} from 'lucide-react';
import { RetailAnalyticsDashboard } from './components/RetailAnalyticsDashboard.js';
import { ExperimentationDashboard } from './components/ExperimentationDashboard.js';

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

interface WorkflowEventItem {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface WorkflowRunData {
  id: string;
  version: number;
  state: string;
  durationMs: number;
  stepResults: Record<string, {
    state: string;
    durationMs?: number;
    error?: string;
    skipReason?: string;
    output?: unknown;
  }>;
}

interface ShopperProfileView {
  shopper: {
    id: string;
    orgId: string;
    externalCustomerId?: string | null;
    contactHash?: string | null;
    isIdentified: boolean;
    hasConsent: boolean;
  };
  isAnonymous: boolean;
  visitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  interests: string[];
  pastQuestions: Array<{
    conversationId: string;
    question: string;
    date: string;
  }>;
  unresolvedObjections: Array<{
    conversationId: string;
    objectionType: string;
    customerText: string;
    date: string;
  }>;
  priorRecommendations: Array<{
    conversationId: string;
    recommendation: string;
    date: string;
  }>;
  followUpHistory: Array<{
    draftId: string;
    channel: string;
    status: string;
    recommendedAction: string;
    date: string;
  }>;
  outcomes: Array<{
    id: string;
    type: 'purchase' | 'missed_conversion' | 'no_response';
    reason?: string;
    value?: number;
    recordedBy: string;
    recordedAt: string;
  }>;
  hasActiveConsent: boolean;
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

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'orchestration' | 'shopper' | 'analytics' | 'experiments'>('analytics');

  // Follow-up Queue State
  const [drafts, setDrafts] = useState<FollowUpDraft[]>([]);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');

  // Workflow Orchestration State
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowRunData | null>(null);
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEventItem[]>([]);
  const [isProcessingWorkflow, setIsProcessingWorkflow] = useState(false);

  // Shopper Profile State (Phase 10)
  const [shopperProfile, setShopperProfile] = useState<ShopperProfileView | null>(null);
  const [shopperExternalIdInput, setShopperExternalIdInput] = useState('CUST-8831');
  const [isLinkingShopper, setIsLinkingShopper] = useState(false);
  const [outcomeType, setOutcomeType] = useState<'purchase' | 'missed_conversion'>('purchase');
  const [outcomeReason, setOutcomeReason] = useState('');
  const [outcomeValue, setOutcomeValue] = useState<number>(84500);
  const [isRecordingOutcome, setIsRecordingOutcome] = useState(false);

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

  const fetchShopperProfile = async (conversationId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/conversations/${conversationId}/shopper`);
      if (res.ok) {
        const json = await res.json();
        if (json.data?.profile) {
          setShopperProfile(json.data.profile);
        } else {
          setShopperProfile(null);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleResolveAndLinkShopper = async (anonymous = false) => {
    if (!ingestedConversation) return;
    setIsLinkingShopper(true);
    setStatusMessage(null);
    try {
      const resolveRes = await fetch('http://localhost:3001/api/shoppers/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          anonymous
            ? { anonymousId: `anon-${Date.now()}` }
            : {
                externalCustomerId: shopperExternalIdInput.trim() || 'CUST-8831',
                hasConsent: true,
                authorizer: 'advisor-neha-12',
              }
        ),
      });
      if (!resolveRes.ok) throw new Error('Failed to resolve shopper identity');
      const resolveData = await resolveRes.json();
      const shopper = resolveData.data;

      const linkRes = await fetch(`http://localhost:3001/api/conversations/${ingestedConversation.conversation.id}/link-shopper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopperId: shopper.id,
          basis: anonymous ? 'anonymous_session' : 'explicit_customer_id',
          authorizer: 'advisor-neha-12',
        }),
      });
      if (!linkRes.ok) throw new Error('Failed to link conversation to shopper');

      await fetchShopperProfile(ingestedConversation.conversation.id);
      setStatusMessage(`Shopper ${anonymous ? 'Anonymous' : shopper.externalCustomerId} successfully linked.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Shopper link error: ${msg}`);
    } finally {
      setIsLinkingShopper(false);
    }
  };

  const handleRecordOutcome = async () => {
    if (!shopperProfile) return;
    setIsRecordingOutcome(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`http://localhost:3001/api/shoppers/${shopperProfile.shopper.id}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: ingestedConversation?.conversation.id,
          type: outcomeType,
          reason: outcomeReason || (outcomeType === 'purchase' ? 'Purchased Prithvi 110 Deluxe' : 'Price above budget'),
          value: outcomeValue > 0 ? outcomeValue : (outcomeType === 'purchase' ? 84500 : undefined),
          recordedBy: 'advisor-neha-12',
        }),
      });
      if (!res.ok) throw new Error('Failed to record interaction outcome');
      if (ingestedConversation) {
        await fetchShopperProfile(ingestedConversation.conversation.id);
      }
      setStatusMessage(`Outcome recorded: ${outcomeType.toUpperCase()}`);
      setOutcomeReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Outcome error: ${msg}`);
    } finally {
      setIsRecordingOutcome(false);
    }
  };

  const handleRevokeConsent = async () => {
    if (!shopperProfile) return;
    try {
      const res = await fetch(`http://localhost:3001/api/shoppers/${shopperProfile.shopper.id}/revoke-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'advisor-neha-12' }),
      });
      if (res.ok) {
        if (ingestedConversation) await fetchShopperProfile(ingestedConversation.conversation.id);
        setStatusMessage('Customer consent revoked. History usage immediately stopped.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Revoke consent error: ${msg}`);
    }
  };

  const handleDeleteShopper = async () => {
    if (!shopperProfile) return;
    if (!confirm('Erase this shopper profile and unlink derived records (Right to Erasure)?')) return;
    try {
      const res = await fetch(`http://localhost:3001/api/shoppers/${shopperProfile.shopper.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'advisor-neha-12' }),
      });
      if (res.ok) {
        setShopperProfile(null);
        setStatusMessage('Shopper profile permanently erased (Right to Erasure).');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Erasure error: ${msg}`);
    }
  };

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

      // Automatically check for linked shopper profile
      await fetchShopperProfile(data.conversation.id);
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

  const handleRunWorkflow = async () => {
    if (!ingestedConversation) return;
    setIsProcessingWorkflow(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`http://localhost:3001/api/conversations/${ingestedConversation.conversation.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permittedChannels: ['whatsapp', 'email'],
          forceReRun: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Workflow execution failed');
      }

      const data = await res.json();
      setActiveWorkflow(data.workflowRun);

      // Fetch trace events
      const traceRes = await fetch(`http://localhost:3001/api/conversations/${ingestedConversation.conversation.id}/trace`);
      if (traceRes.ok) {
        const traceData = await traceRes.json();
        setWorkflowEvents(traceData.events || []);
      }

      // Fetch follow-up drafts
      const draftsRes = await fetch(`http://localhost:3001/api/conversations/${ingestedConversation.conversation.id}/drafts`);
      if (draftsRes.ok) {
        const draftsData = await draftsRes.json();
        setDrafts(draftsData.drafts || []);
      }

      setStatusMessage(`Multi-agent workflow completed: State ${data.workflowRun.state} (${data.workflowRun.durationMs}ms).`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Workflow error: ${message}`);
    } finally {
      setIsProcessingWorkflow(false);
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
                Phase 10 • Shopper Profile &amp; Continuity
              </span>
            </h1>
            <p className="text-xs text-slate-400">Agentic Physical-Retail Intelligence &amp; Cross-Visit Shopper Memory</p>
          </div>
        </div>

        {/* API Health indicator & Shopper Pill */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {shopperProfile && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-300">
                {shopperProfile.isAnonymous
                  ? 'Anonymous Session'
                  : `Shopper: ${shopperProfile.shopper.externalCustomerId}`}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold">
                Visit #{shopperProfile.visitCount}
              </span>
            </div>
          )}
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

        {/* Top-Level Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'analytics'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Retail Operations Dashboard (Phase 11)
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold">
              AREAS A-F
            </span>
          </button>
          <button
            onClick={() => setActiveTab('orchestration')}
            className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'orchestration'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            Live Dialogue &amp; Multi-Agent Studio
          </button>
          <button
            onClick={() => setActiveTab('experiments')}
            className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'experiments'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-4 h-4 text-purple-400" />
            Campaign Experiments (Phase 13)
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-500/20 text-purple-300 font-mono font-bold">
              A/B STATS
            </span>
          </button>
        </div>

        {activeTab === 'analytics' ? (
          <RetailAnalyticsDashboard />
        ) : activeTab === 'experiments' ? (
          <ExperimentationDashboard />
        ) : (
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
            {/* Tab navigation */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('orchestration')}
                className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  activeTab === 'orchestration'
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Multi-Agent Workflow &amp; Drafts
              </button>
              <button
                onClick={() => setActiveTab('shopper')}
                className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  activeTab === 'shopper'
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                Shopper Profile &amp; Continuity
                {shopperProfile && (
                  <span
                    className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                      shopperProfile.isAnonymous
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {shopperProfile.isAnonymous ? 'Anon' : shopperProfile.shopper.externalCustomerId}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'orchestration' && (
              <>
            {/* Multi-Agent Orchestration & Trace Card */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    Multi-Agent Orchestration &amp; Tracing
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Governed dependency graph: Retrieval → (Coach ∥ Analyst) → FollowUp Planning.
                  </p>
                </div>

                {ingestedConversation && (
                  <button
                    onClick={handleRunWorkflow}
                    disabled={isProcessingWorkflow}
                    className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white shadow transition flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessingWorkflow ? 'animate-spin' : ''}`} />
                    {isProcessingWorkflow ? 'Orchestrating...' : 'Execute Governed Workflow'}
                  </button>
                )}
              </div>

              {activeWorkflow ? (
                <div className="space-y-3">
                  {/* Pipeline Step Progression */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                    {/* Step 1: Retrieval */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-300">1. Retrieval</span>
                        <span className="text-emerald-400 font-mono text-[10px]">
                          {activeWorkflow.stepResults['retrieval']?.state || 'PENDING'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {activeWorkflow.stepResults['retrieval']?.durationMs ?? 0}ms
                      </div>
                    </div>

                    {/* Step 2: FloorCoach */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-300">2. FloorCoach</span>
                        <span
                          className={`font-mono text-[10px] ${
                            activeWorkflow.stepResults['floor_coach']?.state === 'SUCCEEDED'
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {activeWorkflow.stepResults['floor_coach']?.state || 'PENDING'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {activeWorkflow.stepResults['floor_coach']?.durationMs ?? 0}ms
                      </div>
                    </div>

                    {/* Step 3: SignalAnalyst */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-300">3. SignalAnalyst</span>
                        <span
                          className={`font-mono text-[10px] ${
                            activeWorkflow.stepResults['signal_analyst']?.state === 'SUCCEEDED'
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {activeWorkflow.stepResults['signal_analyst']?.state || 'PENDING'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {activeWorkflow.stepResults['signal_analyst']?.durationMs ?? 0}ms
                      </div>
                    </div>

                    {/* Step 4: FollowUpOptimizer */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-300">4. FollowUp</span>
                        <span
                          className={`font-mono text-[10px] ${
                            activeWorkflow.stepResults['followup_optimizer']?.state === 'SUCCEEDED'
                              ? 'text-emerald-400'
                              : activeWorkflow.stepResults['followup_optimizer']?.state === 'SKIPPED'
                                ? 'text-slate-400'
                                : 'text-amber-400'
                          }`}
                        >
                          {activeWorkflow.stepResults['followup_optimizer']?.state || 'PENDING'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {activeWorkflow.stepResults['followup_optimizer']?.durationMs ?? 0}ms
                      </div>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300">
                      Workflow ID: <span className="text-indigo-400">{activeWorkflow.id}</span>
                    </span>
                    <span className="text-slate-400">Total Duration: {activeWorkflow.durationMs}ms</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        activeWorkflow.state === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : activeWorkflow.state === 'AWAITING_APPROVAL'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : activeWorkflow.state === 'PARTIAL'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {activeWorkflow.state}
                    </span>
                  </div>

                  {/* Trace Event Log */}
                  {workflowEvents.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Execution Trace Events:
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                        {workflowEvents.map((evt) => (
                          <div
                            key={evt.id}
                            className="p-1.5 rounded bg-slate-950 border border-slate-850 flex items-center justify-between text-slate-300"
                          >
                            <span className="text-indigo-400">{evt.eventType}</span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(evt.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center space-y-2">
                  <Cpu className="w-7 h-7 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No active workflow run executed yet. Click &quot;Execute Governed Workflow&quot; to coordinate
                    Retrieval, FloorCoach, SignalAnalyst, and FollowUpOptimizer.
                  </p>
                </div>
              )}
            </div>

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
            </>
            )}

            {activeTab === 'shopper' && (
              <div className="space-y-6">
                {/* Shopper Identity & Linking Card */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-400" />
                        Shopper Identity Resolution &amp; Linking
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Permitted explicit identifiers (external customer ID / consented contact hash) or anonymous session. Zero fuzzy identity guessing.
                      </p>
                    </div>
                  </div>

                  {!shopperProfile ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <p className="text-xs text-slate-300">
                        {ingestedConversation
                          ? 'No shopper profile is currently linked to this conversation session. Resolve an explicit customer ID or provision an isolated anonymous session:'
                          : 'Ingest a conversation first to link a customer profile.'}
                      </p>
                      {ingestedConversation && (
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                          <input
                            type="text"
                            value={shopperExternalIdInput}
                            onChange={(e) => setShopperExternalIdInput(e.target.value)}
                            placeholder="e.g. CUST-8831"
                            className="px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 flex-1 font-mono"
                          />
                          <button
                            onClick={() => handleResolveAndLinkShopper(false)}
                            disabled={isLinkingShopper}
                            className="py-2 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:bg-slate-800"
                          >
                            {isLinkingShopper ? 'Linking...' : 'Link Customer ID'}
                          </button>
                          <button
                            onClick={() => handleResolveAndLinkShopper(true)}
                            disabled={isLinkingShopper}
                            className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition disabled:opacity-50"
                          >
                            Link as Anonymous Session
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Profile Overview Banner */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-white">
                              {shopperProfile.isAnonymous
                                ? 'Anonymous Session'
                                : shopperProfile.shopper.externalCustomerId}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                shopperProfile.isAnonymous
                                  ? 'bg-slate-800 text-slate-400'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {shopperProfile.isAnonymous ? 'Isolated Anon Session' : 'Identified Customer'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
                              Visit #{shopperProfile.visitCount}
                            </span>
                            {shopperProfile.visitCount > 1 && (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                <History className="w-3 h-3 text-purple-400" /> Returning Visitor (+8 Rubric Weight)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase">Shopper ID</span>
                            <span className="text-slate-300 font-mono text-[11px] truncate block" title={shopperProfile.shopper.id}>
                              {shopperProfile.shopper.id}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase">First Seen</span>
                            <span className="text-slate-300 font-mono text-[11px]">
                              {new Date(shopperProfile.firstSeenAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase">Last Seen</span>
                            <span className="text-slate-300 font-mono text-[11px]">
                              {new Date(shopperProfile.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase">Consent Status</span>
                            <span
                              className={`font-semibold flex items-center gap-1 ${
                                shopperProfile.hasActiveConsent ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {shopperProfile.hasActiveConsent ? (
                                <>
                                  <ShieldCheck className="w-3 h-3" /> Active Attested
                                </>
                              ) : (
                                <>
                                  <ShieldAlert className="w-3 h-3" /> Consent Revoked
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Cross-Visit Memory Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Extracted Interests */}
                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-indigo-400" /> Extracted Interests
                          </h3>
                          {shopperProfile.interests.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {shopperProfile.interests.map((interest, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-md text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                                >
                                  {interest}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">No explicit interests recorded yet.</p>
                          )}
                        </div>

                        {/* Unresolved Objections */}
                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Unresolved Objections
                          </h3>
                          {shopperProfile.unresolvedObjections.length > 0 ? (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                              {shopperProfile.unresolvedObjections.map((obj, i) => (
                                <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800 text-xs">
                                  <span className="font-semibold text-amber-300 capitalize">{obj.objectionType}: </span>
                                  <span className="text-slate-300">&ldquo;{obj.customerText}&rdquo;</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">No unresolved objections from prior visits.</p>
                          )}
                        </div>
                      </div>

                      {/* Past Questions & Recommendations */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> Questions Across Visits
                          </h3>
                          {shopperProfile.pastQuestions.length > 0 ? (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                              {shopperProfile.pastQuestions.map((q, i) => (
                                <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300">
                                  &bull; {q.question}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">No recorded past questions.</p>
                          )}
                        </div>

                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> Prior Vehicle Recommendations
                          </h3>
                          {shopperProfile.priorRecommendations.length > 0 ? (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                              {shopperProfile.priorRecommendations.map((r, i) => (
                                <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300">
                                  &bull; {r.recommendation}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">No prior recommendations on file.</p>
                          )}
                        </div>
                      </div>

                      {/* Interaction Outcome Recording */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" /> Record Physical-Retail Interaction Outcome
                        </h3>
                        <p className="text-xs text-slate-400">
                          Record real dealership outcomes to feed the store event stream (emits PURCHASE_RECORDED or MISSED_CONVERSION_RECORDED).
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase block mb-1">Outcome Type</label>
                            <select
                              value={outcomeType}
                              onChange={(e) => setOutcomeType(e.target.value as 'purchase' | 'missed_conversion')}
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="purchase">Purchase</option>
                              <option value="missed_conversion">Missed Conversion</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase block mb-1">Reason / Notes</label>
                            <input
                              type="text"
                              value={outcomeReason}
                              onChange={(e) => setOutcomeReason(e.target.value)}
                              placeholder={outcomeType === 'purchase' ? 'Purchased Prithvi 110 Deluxe' : 'Price above budget'}
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase block mb-1">Value (₹ INR)</label>
                            <input
                              type="number"
                              value={outcomeValue}
                              onChange={(e) => setOutcomeValue(Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            onClick={handleRecordOutcome}
                            disabled={isRecordingOutcome}
                            className="py-1.5 px-4 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {isRecordingOutcome ? 'Recording...' : 'Record Outcome & Emit Event'}
                          </button>
                        </div>

                        {shopperProfile.outcomes.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-2">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase">Recorded Outcomes History</span>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                              {shopperProfile.outcomes.map((out) => (
                                <div
                                  key={out.id}
                                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                        out.type === 'purchase'
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      }`}
                                    >
                                      {out.type}
                                    </span>
                                    <span className="text-slate-200">{out.reason || 'No reason provided'}</span>
                                  </div>
                                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                                    {out.value && <span className="text-emerald-400">₹{out.value.toLocaleString()}</span>}
                                    <span>by {out.recordedBy}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Privacy & Governance Actions */}
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-indigo-400" /> Customer Privacy Controls
                          </span>
                          <p className="text-slate-400 text-[11px]">
                            Enforce right to erasure or immediate consent revocation in compliance with DPDP/GDPR.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleRevokeConsent}
                            className="py-1.5 px-3 rounded-lg text-xs font-medium bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 transition flex items-center gap-1"
                          >
                            <UserX className="w-3.5 h-3.5" /> Revoke Consent
                          </button>
                          <button
                            onClick={handleDeleteShopper}
                            className="py-1.5 px-3 rounded-lg text-xs font-medium bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 transition flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Erase Profile
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
      )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 px-6 py-4 text-center text-xs text-slate-500">
        StoreSignal AI • Portfolio-grade agentic retail intelligence platform • Built strictly phase by phase
      </footer>
    </div>
  );
};
export default App;
