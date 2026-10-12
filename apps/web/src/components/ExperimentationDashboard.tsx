import { useState, useEffect } from 'react';
import {
  FlaskConical,
  BarChart2,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Upload,
  Hash,
  ShieldAlert,
} from 'lucide-react';

interface ExperimentItem {
  id: string;
  name: string;
  hypothesis: string;
  targetType: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  trafficAllocationPct: number;
  minSampleSize: number;
  variantCount: number;
  totalExposures: number;
  totalConversions: number;
  overallConversionRate: number;
  allVariantsMeetSampleSize: boolean;
  winnerDeclared: boolean;
  winningVariantKey: string | null;
  createdAt: string;
}

interface VariantMetrics {
  variantId: string;
  key: string;
  name: string;
  isControl: boolean;
  weight: number;
  exposures: number;
  sends: number;
  responses: number;
  conversions: number;
  conversionRate: number;
  conversionConfidenceInterval: {
    lower: number;
    upper: number;
    confidenceLevel: number;
  };
  revenue: number;
  cost: number;
  sampleSizeMet: boolean;
}

interface VariantComparison {
  variantKey: string;
  controlKey: string;
  conversionRateDiff: number;
  relativeUpliftPct: number;
  zScore: number;
  pValue: number;
  isSignificant: boolean;
  verdict: 'significant_winner' | 'significant_underperformer' | 'no_significant_difference' | 'insufficient_sample';
}

interface ExperimentAnalysis {
  experiment: {
    id: string;
    name: string;
    hypothesis: string;
    targetType: string;
    status: string;
    trafficAllocationPct: number;
    minSampleSize: number;
    eligibilityRules: Record<string, any>;
  };
  variants: VariantMetrics[];
  totalExposures: number;
  totalConversions: number;
  overallConversionRate: number;
  minSampleSize: number;
  allVariantsMeetSampleSize: boolean;
  statisticalComparison: {
    controlVariantKey: string;
    comparisons: VariantComparison[];
  } | null;
  winnerDeclared: boolean;
  winningVariantKey: string | null;
  limitationsAndWarnings: string[];
}

export function ExperimentationDashboard() {
  const [experiments, setExperiments] = useState<ExperimentItem[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ExperimentAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Simulator State
  const [simEntityId, setSimEntityId] = useState<string>('shp-sim-customer-01');
  const [simIntentScore, setSimIntentScore] = useState<number>(75);
  const [simChannel, setSimChannel] = useState<string>('whatsapp');
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  // CSV Import State
  const [showCsvModal, setShowCsvModal] = useState<boolean>(false);
  const [csvContent, setCsvContent] = useState<string>(
    'variant_key,entity_id,event_type,value\nvariant_a,shp-new-401,exposure,\nvariant_a,shp-new-401,conversion,82000'
  );
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Fetch experiments list
  const fetchExperiments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/experiments', {
        headers: { 'x-org-id': 'org-vayu-motors-dev' },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setExperiments(data.data);
        if (data.data.length > 0 && !selectedExpId) {
          setSelectedExpId(data.data[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load experiments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch analysis for selected experiment
  const fetchAnalysis = async (expId: string) => {
    try {
      const res = await fetch(`/api/experiments/${expId}/analysis`, {
        headers: { 'x-org-id': 'org-vayu-motors-dev' },
      });
      const data = await res.json();
      if (data.success) {
        setAnalysis(data.data);
      }
    } catch (err: any) {
      console.error('Error fetching analysis:', err);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, []);

  useEffect(() => {
    if (selectedExpId) {
      fetchAnalysis(selectedExpId);
      setSimResult(null);
    }
  }, [selectedExpId]);

  // Test deterministic assignment
  const handleTestAssignment = async () => {
    if (!selectedExpId) return;
    setSimLoading(true);
    try {
      const res = await fetch(`/api/experiments/${selectedExpId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'org-vayu-motors-dev',
        },
        body: JSON.stringify({
          entityType: 'shopper',
          entityId: simEntityId,
          intentScore: simIntentScore,
          channel: simChannel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSimResult(data.data);
      }
    } catch (err: any) {
      console.error('Assignment error:', err);
    } finally {
      setSimLoading(false);
    }
  };

  // Handle CSV Import
  const handleImportCsv = async () => {
    if (!selectedExpId) return;
    try {
      setImportStatus('Importing...');
      const res = await fetch(`/api/experiments/${selectedExpId}/events/csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'org-vayu-motors-dev',
        },
        body: JSON.stringify({ csvContent }),
      });
      const data = await res.json();
      if (data.success) {
        setImportStatus(`Successfully imported ${data.data.importedCount} event(s)!`);
        fetchAnalysis(selectedExpId);
        setTimeout(() => setShowCsvModal(false), 1200);
      } else {
        setImportStatus(`Error: ${data.error?.message || 'Failed to import CSV'}`);
      }
    } catch (err: any) {
      setImportStatus(`Import failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Campaign Experimentation & Optimization
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white text-black font-mono font-bold">
                  A/B STATISTICAL ENGINE
                </span>
              </h2>
              <p className="text-sm text-neutral-400">
                Governed A/B variant assignments with Wilson 95% confidence intervals and strict sample-size guardrails.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchExperiments()}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-xl text-sm transition-colors border border-neutral-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowCsvModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-neutral-200 text-black rounded-xl text-sm font-semibold transition-colors shadow"
          >
            <Upload className="w-4 h-4" />
            Import Outcome Events
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Experiments List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-1">
            Active Experiments ({experiments.length})
          </div>

          <div className="space-y-2">
            {experiments.map((exp) => {
              const isSelected = exp.id === selectedExpId;
              return (
                <div
                  key={exp.id}
                  onClick={() => setSelectedExpId(exp.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-neutral-900 border-white shadow-lg text-white'
                      : 'bg-neutral-950 border-neutral-800 hover:bg-neutral-900/60 hover:border-neutral-700 text-neutral-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        exp.status === 'running'
                          ? 'bg-white text-black font-bold'
                          : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                      }`}
                    >
                      {exp.status.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-mono">
                      {exp.targetType.replace('_', ' ')}
                    </span>
                  </div>

                  <h3 className="font-semibold text-sm text-white line-clamp-1 mb-1">
                    {exp.name}
                  </h3>
                  <p className="text-xs text-neutral-400 line-clamp-2 mb-3">
                    {exp.hypothesis}
                  </p>

                  <div className="flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-800 pt-2 font-mono">
                    <span>N = {exp.totalExposures}</span>
                    <span className="text-white font-medium">
                      {(exp.overallConversionRate * 100).toFixed(1)}% CR
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Columns: Experiment Detail, Variants & Analysis */}
        <div className="lg:col-span-3 space-y-6">
          {analysis ? (
            <>
              {/* Hypothesis & Overview Card */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {analysis.experiment.name}
                    </h3>
                    <p className="text-sm text-neutral-300 mt-1">
                      <span className="text-neutral-400 font-medium">Hypothesis: </span>
                      {analysis.experiment.hypothesis}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {analysis.winnerDeclared ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-black text-xs font-bold border border-white">
                        <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                        Significant Winner: {analysis.winningVariantKey}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 text-xs font-semibold">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        Exploratory / No Declared Winner
                      </span>
                    )}
                  </div>
                </div>

                {/* Statistical Disclaimers & Limitations Banner */}
                <div className="p-4 rounded-xl bg-black border border-neutral-800 text-neutral-300 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                    <ShieldAlert className="w-4 h-4 text-white" />
                    Statistical Governance & Safeguard Warnings
                  </div>
                  <ul className="text-xs space-y-1.5 list-disc pl-5 text-neutral-400 leading-relaxed">
                    {analysis.limitationsAndWarnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>

                {/* Variant Performance Breakdown Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {analysis.variants.map((v) => {
                    const crPct = (v.conversionRate * 100).toFixed(1);
                    const lowerPct = (v.conversionConfidenceInterval.lower * 100).toFixed(1);
                    const upperPct = (v.conversionConfidenceInterval.upper * 100).toFixed(1);

                    return (
                      <div
                        key={v.variantId}
                        className={`rounded-xl p-5 border transition-all ${
                          v.key === analysis.winningVariantKey
                            ? 'bg-black border-2 border-white shadow-xl'
                            : 'bg-black border border-neutral-800'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-white text-base">{v.name}</h4>
                              {v.isControl ? (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono border border-neutral-700">
                                  CONTROL
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-white text-black font-bold font-mono">
                                  CHALLENGER
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-neutral-400 font-mono">Key: {v.key}</span>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                v.sampleSizeMet
                                  ? 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                                  : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                              }`}
                            >
                              N = {v.exposures} / {analysis.minSampleSize}
                            </span>
                          </div>
                        </div>

                        {/* Conversion Rate & Metrics */}
                        <div className="grid grid-cols-3 gap-2 py-3 border-y border-neutral-800 my-3 text-center">
                          <div>
                            <div className="text-xs text-neutral-400">Exposures</div>
                            <div className="text-lg font-bold text-white font-mono">{v.exposures}</div>
                          </div>
                          <div>
                            <div className="text-xs text-neutral-400">Conversions</div>
                            <div className="text-lg font-bold text-white font-mono">{v.conversions}</div>
                          </div>
                          <div>
                            <div className="text-xs text-neutral-400">Conversion Rate</div>
                            <div className="text-lg font-bold text-white font-mono">{crPct}%</div>
                          </div>
                        </div>

                        {/* Wilson 95% Confidence Interval Display */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-400">95% Wilson Score Interval</span>
                            <span className="font-mono text-white">
                              [{lowerPct}% — {upperPct}%]
                            </span>
                          </div>
                          {/* Visual Range Bar */}
                          <div className="w-full bg-neutral-800 rounded-full h-2 relative overflow-hidden">
                            <div
                              className="absolute bg-white h-full rounded-full"
                              style={{
                                left: `${Math.max(0, parseFloat(lowerPct))}%`,
                                width: `${Math.max(2, parseFloat(upperPct) - parseFloat(lowerPct))}%`,
                              }}
                            />
                          </div>
                          <div className="text-[11px] text-neutral-400 text-right">
                            Margin: ±{((parseFloat(upperPct) - parseFloat(lowerPct)) / 2).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Two-Proportion Statistical Hypothesis Comparison */}
                {analysis.statisticalComparison && (
                  <div className="border border-neutral-800 rounded-xl p-5 bg-black space-y-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-white" />
                      Two-Proportion Z-Test Comparison (Against {analysis.statisticalComparison.controlVariantKey})
                    </h4>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="text-neutral-400 border-b border-neutral-800 uppercase tracking-wider font-mono">
                          <tr>
                            <th className="py-2 px-3">Challenger Variant</th>
                            <th className="py-2 px-3">Diff vs Control</th>
                            <th className="py-2 px-3">Relative Uplift</th>
                            <th className="py-2 px-3">Z-Score</th>
                            <th className="py-2 px-3">p-Value</th>
                            <th className="py-2 px-3">Statistical Verdict</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900 font-mono">
                          {analysis.statisticalComparison.comparisons.map((c, i) => (
                            <tr key={i} className="hover:bg-neutral-900/50">
                              <td className="py-3 px-3 font-semibold text-white">{c.variantKey}</td>
                              <td className="py-3 px-3 text-neutral-300">
                                {c.conversionRateDiff > 0 ? `+${(c.conversionRateDiff * 100).toFixed(1)}%` : `${(c.conversionRateDiff * 100).toFixed(1)}%`}
                              </td>
                              <td className="py-3 px-3 font-semibold text-white">
                                {c.relativeUpliftPct > 0 ? `+${c.relativeUpliftPct.toFixed(1)}%` : `${c.relativeUpliftPct.toFixed(1)}%`}
                              </td>
                              <td className="py-3 px-3 text-neutral-300">{c.zScore}</td>
                              <td className="py-3 px-3">
                                <span className={c.pValue < 0.05 ? 'text-white font-bold' : 'text-neutral-400'}>
                                  {c.pValue}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase tracking-wider ${
                                    c.verdict === 'significant_winner'
                                      ? 'bg-white text-black font-bold'
                                      : c.verdict === 'insufficient_sample'
                                      ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                                      : 'bg-neutral-900 text-neutral-400'
                                  }`}
                                >
                                  {c.verdict.replace('_', ' ')}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Deterministic Assignment Simulator */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-neutral-900 text-white border border-neutral-700">
                    <Hash className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      Deterministic Assignment Simulator
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Simulate cryptographic SHA-256 assignment for any customer ref under current eligibility rules.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-neutral-300 font-medium block mb-1">
                      Entity / Shopper ID
                    </label>
                    <input
                      type="text"
                      value={simEntityId}
                      onChange={(e) => setSimEntityId(e.target.value)}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-300 font-medium block mb-1">
                      Intent Score ({simIntentScore}/100)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={simIntentScore}
                      onChange={(e) => setSimIntentScore(parseInt(e.target.value))}
                      className="w-full accent-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-neutral-300 font-medium block mb-1">
                      Target Channel
                    </label>
                    <select
                      value={simChannel}
                      onChange={(e) => setSimChannel(e.target.value)}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white"
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="call_task">Call Task</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleTestAssignment}
                    disabled={simLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-200 text-black rounded-xl text-sm font-semibold transition-colors shadow"
                  >
                    <Sparkles className="w-4 h-4" />
                    {simLoading ? 'Evaluating...' : 'Test Deterministic Allocation'}
                  </button>

                  {simResult && (
                    <div
                      className={`text-xs px-4 py-2 rounded-xl border font-mono ${
                        simResult.isEnrolled
                          ? 'bg-neutral-900 border-white text-white font-semibold'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      {simResult.isEnrolled
                        ? `Allocated Variant: ${simResult.variant?.name} (${simResult.variant?.key})`
                        : `Not Enrolled: ${simResult.reason}`}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-neutral-400 bg-neutral-950 border border-neutral-800 rounded-2xl">
              Select an experiment to view variant analytics.
            </div>
          )}
        </div>
      </div>

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-white" />
                Import Experiment Outcomes (CSV)
              </h3>
              <button
                onClick={() => setShowCsvModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Paste CSV rows with headers: <code className="text-white">variant_key,entity_id,event_type,value</code>. Supported event types: exposure, send, response, conversion.
            </p>

            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs font-mono text-neutral-200 focus:outline-none focus:border-white"
            />

            {importStatus && (
              <div className="text-xs p-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono">
                {importStatus}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCsv}
                className="px-4 py-2 bg-white hover:bg-neutral-200 text-black font-semibold rounded-xl text-sm shadow"
              >
                Import Events
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
