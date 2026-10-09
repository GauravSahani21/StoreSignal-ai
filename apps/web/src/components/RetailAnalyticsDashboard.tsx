import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Layers,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  Zap,
  RefreshCw,
} from 'lucide-react';

export interface OverviewMetrics {
  conversationsProcessed: number;
  uniqueAuthorizedShoppers: number;
  questionsDetected: number;
  objectionsIdentified: number;
  unresolvedQuestions: number;
  followUpDraftsTotal: number;
  pendingApprovals: number;
  recordedConversions: number;
  totalRevenueInr: number;
  conversionRatePercentage: number;
  avgProcessingLatencyMs: number;
  workflowSuccessRatePercentage: number;
  totalAiTokensUsed: number;
  totalAiCostUsd: number;
  sampleSize: number;
  isLowDataState: boolean;
}

export interface ConversationListItem {
  id: string;
  orgId: string;
  storeId: string;
  isDemo: boolean;
  status: string;
  source: string;
  segmentCount: number;
  shopperId?: string;
  externalCustomerId?: string;
  isReturningVisitor: boolean;
  workflowState?: string;
  workflowDurationMs?: number;
  intentScore?: number;
  intentBand?: string;
  createdAt: string;
}

export interface ConversationDetailsView {
  conversation: {
    id: string;
    orgId: string;
    storeId: string;
    isDemo: boolean;
    status: string;
    source: string;
    createdAt: string;
  };
  transcript: {
    id: string;
    segments: Array<{
      id: string;
      speaker: string;
      text: string;
      startMs: number;
      endMs: number;
    }>;
  };
  shopper: {
    id: string;
    externalCustomerId?: string;
    isIdentified: boolean;
    visitCount: number;
  } | null;
  intelligence: {
    summary?: string;
    intentScore?: number;
    intentBand?: string;
    intentConfidence?: string;
    questionsDetected: string[];
    objectionsIdentified: Array<{ type: string; quote: string }>;
    unresolvedQuestions: string[];
    suggestedResponses: Array<{ topic: string; guidance: string; factsUsed: string[] }>;
    productInterests: Array<{ productRef: string; text: string; basis: string }>;
    contributingSignals: Array<{ signalId: string; weight: number; label: string }>;
  };
  workflow: {
    id: string;
    state: string;
    durationMs: number;
    stepResults: Record<string, unknown>;
  } | null;
  drafts: Array<{
    id: string;
    channel: string;
    status: string;
    subject: string | null;
    message: string | null;
    recommendedAction: string;
  }>;
  outcomes: Array<{
    id: string;
    type: string;
    reason: string;
    value?: number;
    recordedBy: string;
    recordedAt: string;
  }>;
}

export interface ShopperInsightsMetrics {
  intentBandDistribution: { high: number; medium: number; low: number; abstained: number };
  totalShoppersAnalyzed: number;
  identifiedShoppers: number;
  anonymousShoppers: number;
  returningVisitors: number;
  conversionRateComparison: {
    firstTimeConversionRate: number;
    returningConversionRate: number;
    firstTimeTotal: number;
    returningTotal: number;
  };
  topProductInterests: Array<{ productRef: string; name: string; count: number }>;
}

export interface AgentActivityMetrics {
  agents: Record<
    string,
    {
      invocations: number;
      successful: number;
      failed: number;
      successRatePercentage: number;
      p50LatencyMs: number;
      p95LatencyMs: number;
      totalPromptTokens: number;
      totalCompletionTokens: number;
      totalTokens: number;
      totalCostUsd: number;
    }
  >;
  totalInvocations: number;
  overallCostUsd: number;
}

export interface FollowUpQueueMetrics {
  totalDrafts: number;
  byStatus: { draft: number; approved: number; rejected: number };
  byChannel: { whatsapp: number; email: number; sms: number; call_task: number; none: number };
}

export interface StoreConversionInsights {
  frequentObjections: Array<{ type: string; count: number; sampleQuote: string }>;
  missedConversionReasons: Array<{ reason: string; count: number }>;
  revenueByStore: Array<{ storeId: string; revenueInr: number; count: number }>;
  sampleSize: number;
  isLowDataState: boolean;
}

export const RetailAnalyticsDashboard: React.FC = () => {
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [demoFilter, setDemoFilter] = useState<'all' | 'real_only' | 'demo_only'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Analytics Datasets
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [shopperInsights, setShopperInsights] = useState<ShopperInsightsMetrics | null>(null);
  const [agentActivity, setAgentActivity] = useState<AgentActivityMetrics | null>(null);
  const [queueMetrics, setQueueMetrics] = useState<FollowUpQueueMetrics | null>(null);
  const [storeInsights, setStoreInsights] = useState<StoreConversionInsights | null>(null);

  // Selected conversation for Dual-Pane dialogue intelligence view
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationDetails, setConversationDetails] = useState<ConversationDetailsView | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (storeFilter) params.set('storeId', storeFilter);
    if (demoFilter) params.set('demoFilter', demoFilter);
    return params.toString() ? `?${params.toString()}` : '';
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    const q = buildQuery();
    try {
      const [ovRes, convRes, shpRes, agtRes, qRes, stRes] = await Promise.all([
        fetch(`http://localhost:3001/api/analytics/overview${q}`),
        fetch(`http://localhost:3001/api/analytics/conversations${q}`),
        fetch(`http://localhost:3001/api/analytics/shoppers${q}`),
        fetch(`http://localhost:3001/api/analytics/agents${q}`),
        fetch(`http://localhost:3001/api/analytics/followups${q}`),
        fetch(`http://localhost:3001/api/analytics/store-insights${q}`),
      ]);

      if (ovRes.ok) {
        const json = await ovRes.json();
        setOverview(json.data);
      }
      if (convRes.ok) {
        const json = await convRes.json();
        setConversations(json.data);
        const firstConv = json.data[0] as ConversationListItem | undefined;
        if (firstConv && !selectedConversationId) {
          void loadConversationDetails(firstConv.id);
        }
      }
      if (shpRes.ok) {
        const json = await shpRes.json();
        setShopperInsights(json.data);
      }
      if (agtRes.ok) {
        const json = await agtRes.json();
        setAgentActivity(json.data);
      }
      if (qRes.ok) {
        const json = await qRes.json();
        setQueueMetrics(json.data);
      }
      if (stRes.ok) {
        const json = await stRes.json();
        setStoreInsights(json.data);
      }
    } catch (err) {
      console.error('Failed to load retail analytics data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversationDetails = async (id: string) => {
    setSelectedConversationId(id);
    setIsLoadingDetails(true);
    try {
      const res = await fetch(`http://localhost:3001/api/analytics/conversations/${id}`);
      if (res.ok) {
        const json = await res.json();
        setConversationDetails(json.data);
      }
    } catch (err) {
      console.error(`Failed to load details for conversation ${id}:`, err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    void loadDashboardData();
  }, [storeFilter, demoFilter]);

  const handleExportCsv = () => {
    const q = buildQuery();
    window.open(`http://localhost:3001/api/analytics/export/csv${q}`, '_blank');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const demoCount = conversations.filter((c) => c.isDemo).length;

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Filters:</span>
          </div>

          {/* Store Selector */}
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/60"
          >
            <option value="">All Stores (Indiranagar &amp; Koramangala)</option>
            <option value="store-indiranagar-01">Vayu Motors - Indiranagar (store-indiranagar-01)</option>
            <option value="store-koramangala-02">Vayu Motors - Koramangala (store-koramangala-02)</option>
          </select>

          {/* Demo Filter */}
          <select
            value={demoFilter}
            onChange={(e) => setDemoFilter(e.target.value as 'all' | 'real_only' | 'demo_only')}
            className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/60"
          >
            <option value="all">Include Demo &amp; Real Data</option>
            <option value="real_only">Real Store Operations Only</option>
            <option value="demo_only">Seeded Demo Data Only</option>
          </select>

          {/* DEMO Indicator Pill */}
          {demoFilter !== 'real_only' && demoCount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              DEMO DATA ACTIVE ({demoCount} records)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => void loadDashboardData()}
            className="py-1.5 px-3 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExportCsv}
            className="py-1.5 px-3.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export Events CSV (RFC 4180)
          </button>
        </div>
      </div>

      {/* Low-data Disclaimer Banner (Statistical Transparency) */}
      {overview?.isLowDataState && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-700/50 text-xs text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Notice: Low sample size (N = {overview.sampleSize} &lt; 5).</span>{' '}
            Metrics are indicative; statistical confidence requires larger sample volume.
          </div>
        </div>
      )}

      {/* Area A: Executive & Floor Manager KPI Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        {/* KPI 1: Conversations */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Conversations</span>
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            {overview?.conversationsProcessed ?? 0}
          </div>
          <div className="text-[11px] text-slate-400">
            Sample size: <span className="text-slate-300 font-mono">{overview?.sampleSize ?? 0}</span>
          </div>
        </div>

        {/* KPI 2: Unique Shoppers */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Shoppers</span>
            <Users className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-300">
            {overview?.uniqueAuthorizedShoppers ?? 0}
          </div>
          <div className="text-[11px] text-slate-400">Consented &amp; linked</div>
        </div>

        {/* KPI 3: Recorded Conversions & Rate */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Conversions</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {overview?.recordedConversions ?? 0}
            <span className="text-xs font-normal text-slate-400 ml-1.5">
              ({overview?.conversionRatePercentage ?? 0}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-400">Store purchase rate</div>
        </div>

        {/* KPI 4: Total Revenue */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Revenue</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300 truncate">
            {formatCurrency(overview?.totalRevenueInr ?? 0)}
          </div>
          <div className="text-[11px] text-slate-400">Attributed to visits</div>
        </div>

        {/* KPI 5: Avg Processing Latency */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Latency</span>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-300">
            {overview?.avgProcessingLatencyMs ?? 0}
            <span className="text-xs font-normal text-slate-400 ml-1">ms</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Success: <span className="text-emerald-400">{overview?.workflowSuccessRatePercentage ?? 0}%</span>
          </div>
        </div>

        {/* KPI 6: AI Usage & Cost */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">AI Operations</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">
            ${(overview?.totalAiCostUsd ?? 0).toFixed(4)}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {(overview?.totalAiTokensUsed ?? 0).toLocaleString()} tokens
          </div>
        </div>
      </div>

      {/* Area B: Conversation Workspace & Dual-Pane Dialogue View */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Area B: Conversation Intelligence Workspace
            </h3>
            <p className="text-xs text-slate-400">
              Filterable dialogue list with dual-pane transcript inspector, detected objections, and FloorCoach responses.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">{conversations.length} conversations loaded</span>
        </div>

        {/* Conversation List Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Conversation ID</th>
                <th className="py-2.5 px-3">Store Location</th>
                <th className="py-2.5 px-3">Shopper</th>
                <th className="py-2.5 px-3 text-center">Segments</th>
                <th className="py-2.5 px-3 text-center">Intent Score</th>
                <th className="py-2.5 px-3 text-center">Workflow</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {conversations.map((c) => {
                const isSelected = selectedConversationId === c.id;
                const bandColor =
                  c.intentBand === 'high'
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                    : c.intentBand === 'medium'
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                    : 'text-slate-400 bg-slate-800/50 border-slate-700/50';

                return (
                  <tr
                    key={c.id}
                    onClick={() => void loadConversationDetails(c.id)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-950/40 text-indigo-200'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-medium flex items-center gap-1.5">
                      <span>{c.id}</span>
                      {c.isDemo && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 font-sans font-semibold">
                          DEMO
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-300">{c.storeId}</td>
                    <td className="py-2.5 px-3 font-sans">
                      {c.externalCustomerId ? (
                        <span className="text-purple-300 font-medium">
                          {c.externalCustomerId}{' '}
                          {c.isReturningVisitor && (
                            <span className="text-[10px] text-purple-400 font-normal">(Returning)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Anonymous Walk-in</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">{c.segmentCount}</td>
                    <td className="py-2.5 px-3 text-center">
                      {c.intentScore !== undefined ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${bandColor}`}>
                          {c.intentScore} ({c.intentBand})
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-emerald-400 text-[11px] font-sans font-medium">
                        {c.workflowState || 'DONE'}
                      </span>
                      {c.workflowDurationMs ? (
                        <span className="text-[10px] text-slate-400 ml-1">({c.workflowDurationMs}ms)</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void loadConversationDetails(c.id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-medium transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Dual-Pane Dialogue & Intelligence Inspector */}
        {selectedConversationId && (
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Dual-Pane Dialogue View: {selectedConversationId}
              </h4>
              {isLoadingDetails && (
                <span className="text-xs text-indigo-400 font-mono animate-pulse">Loading dialogue...</span>
              )}
            </div>

            {conversationDetails && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Pane: Real Dialogue Transcript */}
                <div className="lg:col-span-6 p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3 max-h-[520px] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-semibold text-slate-300">Showroom Dialogue Transcript</span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {conversationDetails.transcript.segments.length} turns
                    </span>
                  </div>

                  <div className="space-y-3">
                    {conversationDetails.transcript.segments.map((seg) => {
                      const isAdvisor = seg.speaker.toLowerCase() === 'advisor';
                      return (
                        <div
                          key={seg.id}
                          className={`p-3 rounded-xl text-xs space-y-1 ${
                            isAdvisor
                              ? 'bg-indigo-950/30 border border-indigo-800/40 text-indigo-100 ml-4'
                              : 'bg-slate-900 border border-slate-800 text-slate-200 mr-4'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className={isAdvisor ? 'text-indigo-400 font-bold' : 'text-purple-400 font-bold'}>
                              {isAdvisor ? 'Advisor' : 'Customer'}
                            </span>
                            <span className="text-slate-400">
                              +{Math.floor(seg.startMs / 1000)}s
                            </span>
                          </div>
                          <p className="leading-relaxed">{seg.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Pane: Intelligence, Grounded Signals & FloorCoach Guidance */}
                <div className="lg:col-span-6 p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-4 max-h-[520px] overflow-y-auto text-xs">
                  {/* Summary & Intent */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase text-slate-400">Signal Assessment</span>
                      {conversationDetails.intelligence.intentScore !== undefined && (
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Score: {conversationDetails.intelligence.intentScore} (
                          {conversationDetails.intelligence.intentBand})
                        </span>
                      )}
                    </div>
                    {conversationDetails.intelligence.summary && (
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        {conversationDetails.intelligence.summary}
                      </p>
                    )}
                  </div>

                  {/* Detected Questions */}
                  {conversationDetails.intelligence.questionsDetected.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-blue-400" />
                        Customer Questions Detected ({conversationDetails.intelligence.questionsDetected.length})
                      </span>
                      <div className="space-y-1">
                        {conversationDetails.intelligence.questionsDetected.map((q, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-blue-950/20 border border-blue-800/40 text-blue-200 text-[11px]"
                          >
                            &ldquo;{q}&rdquo;
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Objections with Quote Evidence */}
                  {conversationDetails.intelligence.objectionsIdentified.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        Identified Objections &amp; Direct Quotes (
                        {conversationDetails.intelligence.objectionsIdentified.length})
                      </span>
                      <div className="space-y-1.5">
                        {conversationDetails.intelligence.objectionsIdentified.map((obj, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 space-y-1 text-[11px]"
                          >
                            <div className="font-semibold text-amber-300 uppercase tracking-wider text-[10px]">
                              Type: {obj.type}
                            </div>
                            <blockquote className="text-slate-300 italic">
                              &ldquo;{obj.quote}&rdquo;
                            </blockquote>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FloorCoach Guidance & Grounding */}
                  {conversationDetails.intelligence.suggestedResponses.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        FloorCoach Real-Time Recommendations
                      </span>
                      <div className="space-y-2">
                        {conversationDetails.intelligence.suggestedResponses.map((r, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-800/40 space-y-1 text-[11px]"
                          >
                            <div className="font-semibold text-indigo-300">{r.topic}</div>
                            <p className="text-slate-200">{r.guidance}</p>
                            {r.factsUsed.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {r.factsUsed.map((fact, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-900/40 text-indigo-300 border border-indigo-700/50"
                                  >
                                    Fact: {fact}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contributing Rubric Signals */}
                  {conversationDetails.intelligence.contributingSignals.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase text-slate-400">
                        Contributing Scoring Signals
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {conversationDetails.intelligence.contributingSignals.map((sig, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-1 rounded-md text-[10px] font-mono border ${
                              sig.weight > 0
                                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                                : sig.weight < 0
                                ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {sig.label}:{' '}
                            <strong>{sig.weight > 0 ? `+${sig.weight}` : sig.weight}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Governed Follow-Up Draft */}
                  {conversationDetails.drafts.length > 0 && conversationDetails.drafts[0] && (
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase text-slate-400">
                          Follow-Up Communication Draft
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                            conversationDetails.drafts[0]!.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : conversationDetails.drafts[0]!.status === 'rejected'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {conversationDetails.drafts[0]!.status} ({conversationDetails.drafts[0]!.channel})
                        </span>
                      </div>
                      {conversationDetails.drafts[0]!.subject && (
                        <div className="text-[11px] font-medium text-slate-200">
                          Subject: {conversationDetails.drafts[0]!.subject}
                        </div>
                      )}
                      {conversationDetails.drafts[0]!.message && (
                        <p className="text-[11px] text-slate-300 font-mono bg-slate-950 p-2 rounded border border-slate-800/80 leading-relaxed">
                          {conversationDetails.drafts[0]!.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Row: Areas C, E, F - Shopper Insights, Queue, and Store Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area C: Shopper Insights Aggregation */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg space-y-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              Area C: Shopper Intent Distribution
            </h3>
            <p className="text-xs text-slate-400">Purchase readiness across identified &amp; anonymous shoppers.</p>
          </div>

          {/* Band distribution */}
          {shopperInsights && (
            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-emerald-400 font-medium">High Intent (&gt;= 70)</span>
                  <span className="font-mono text-slate-300">
                    {shopperInsights.intentBandDistribution.high}
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{
                      width: `${(shopperInsights.intentBandDistribution.high /
                        Math.max(1, shopperInsights.totalShoppersAnalyzed)) *
                        100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-amber-400 font-medium">Medium Intent (40 - 69)</span>
                  <span className="font-mono text-slate-300">
                    {shopperInsights.intentBandDistribution.medium}
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{
                      width: `${(shopperInsights.intentBandDistribution.medium /
                        Math.max(1, shopperInsights.totalShoppersAnalyzed)) *
                        100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-rose-400 font-medium">Low Intent (&lt; 40)</span>
                  <span className="font-mono text-slate-300">
                    {shopperInsights.intentBandDistribution.low}
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full"
                    style={{
                      width: `${(shopperInsights.intentBandDistribution.low /
                        Math.max(1, shopperInsights.totalShoppersAnalyzed)) *
                        100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Abstained (Thin Dialogue)</span>
                  <span className="font-mono text-slate-300">
                    {shopperInsights.intentBandDistribution.abstained}
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-700 h-full rounded-full"
                    style={{
                      width: `${(shopperInsights.intentBandDistribution.abstained /
                        Math.max(1, shopperInsights.totalShoppersAnalyzed)) *
                        100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Identified vs Returning Comparison */}
              <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-3 text-center">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] uppercase text-slate-400">Identified Shoppers</div>
                  <div className="text-base font-bold font-mono text-purple-300">
                    {shopperInsights.identifiedShoppers}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] uppercase text-slate-400">Returning Visitors</div>
                  <div className="text-base font-bold font-mono text-indigo-300">
                    {shopperInsights.returningVisitors}
                  </div>
                </div>
              </div>

              {/* Top Products */}
              {shopperInsights.topProductInterests.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                    Top Inquired Vehicles
                  </span>
                  <div className="space-y-1">
                    {shopperInsights.topProductInterests.slice(0, 3).map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 truncate">{p.name}</span>
                        <span className="font-mono text-slate-400 ml-2">{p.count} inquiries</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Area E: Follow-Up Approval Queue Breakdown */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg space-y-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Area E: Governed Follow-Up Queue
            </h3>
            <p className="text-xs text-slate-400">Human-in-the-loop review status and delivery channels.</p>
          </div>

          {queueMetrics && (
            <div className="space-y-4 text-xs">
              {/* Status summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-800/40">
                  <div className="text-[10px] uppercase text-amber-400 font-semibold">Pending</div>
                  <div className="text-lg font-bold font-mono text-amber-300">
                    {queueMetrics.byStatus.draft}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                  <div className="text-[10px] uppercase text-emerald-400 font-semibold">Approved</div>
                  <div className="text-lg font-bold font-mono text-emerald-300">
                    {queueMetrics.byStatus.approved}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-800/40">
                  <div className="text-[10px] uppercase text-rose-400 font-semibold">Rejected</div>
                  <div className="text-lg font-bold font-mono text-rose-300">
                    {queueMetrics.byStatus.rejected}
                  </div>
                </div>
              </div>

              {/* Channel breakdown */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Channel Distribution
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                    <span className="text-emerald-400">WhatsApp:</span>
                    <span className="font-bold text-slate-200">{queueMetrics.byChannel.whatsapp}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                    <span className="text-blue-400">Email:</span>
                    <span className="font-bold text-slate-200">{queueMetrics.byChannel.email}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                    <span className="text-amber-400">Call Task:</span>
                    <span className="font-bold text-slate-200">{queueMetrics.byChannel.call_task}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Blocked:</span>
                    <span className="font-bold text-slate-200">{queueMetrics.byChannel.none}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Area F: Store & Conversion Insights */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg space-y-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Area F: Objections &amp; Lost Deals
            </h3>
            <p className="text-xs text-slate-400">Root cause analysis of showroom objections and missed sales.</p>
          </div>

          {storeInsights && (
            <div className="space-y-3.5 text-xs">
              {/* Frequent objections */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Frequent Objections Detected
                </span>
                {storeInsights.frequentObjections.length > 0 ? (
                  <div className="space-y-1.5">
                    {storeInsights.frequentObjections.map((obj, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-[11px]"
                      >
                        <div className="flex justify-between font-semibold text-amber-300">
                          <span>{obj.type}</span>
                          <span className="font-mono text-slate-400">{obj.count} occurrences</span>
                        </div>
                        <p className="text-slate-400 italic text-[10px] truncate">&ldquo;{obj.sampleQuote}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-[11px]">No recurring objections recorded.</p>
                )}
              </div>

              {/* Missed conversions */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Missed Conversion Reasons
                </span>
                {storeInsights.missedConversionReasons.length > 0 ? (
                  <div className="space-y-1">
                    {storeInsights.missedConversionReasons.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-[11px] p-1.5 rounded bg-slate-950 border border-slate-800/80"
                      >
                        <span className="text-slate-300 truncate">{m.reason}</span>
                        <span className="font-mono text-rose-400 ml-2 font-bold">{m.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-[11px]">No missed conversions recorded.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Area D: Agent Activity & System Telemetry */}
      {agentActivity && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Area D: Multi-Agent Activity &amp; Telemetry
              </h3>
              <p className="text-xs text-slate-400">
                Invocations, latency percentiles, token usage, and OpenRouter API cost across agents.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Total Invocations: <strong className="text-slate-200">{agentActivity.totalInvocations}</strong> | Total Cost:{' '}
              <strong className="text-emerald-400">${agentActivity.overallCostUsd.toFixed(4)}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(agentActivity.agents).map(([agentName, metrics]) => (
              <div
                key={agentName}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs font-mono"
              >
                <div className="flex items-center justify-between font-sans">
                  <span className="font-bold text-slate-200 uppercase tracking-wide text-[11px]">
                    {agentName.replace('_', ' ')}
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {metrics.successRatePercentage}% pass
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invocations:</span>
                    <span>{metrics.invocations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">p50 / p95 Latency:</span>
                    <span>
                      {metrics.p50LatencyMs}ms / {metrics.p95LatencyMs}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Prompt / Comp Tokens:</span>
                    <span>
                      {metrics.totalPromptTokens} / {metrics.totalCompletionTokens}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-400 pt-1 border-t border-slate-900">
                    <span className="text-slate-500 font-normal">Agent Cost:</span>
                    <span>${metrics.totalCostUsd.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
