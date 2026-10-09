import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, ShieldCheck, Terminal, Cpu, Database } from 'lucide-react';

interface HealthStatus {
  status: string;
  version: string;
  timestamp: string;
  env: string;
}

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
            Phase 1: Project Foundation
          </span>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Hero Section */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 md:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Physical Retail Conversation & Signal Engine
              </h2>
              <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
                Transform authorized showroom dialogue into structured sales coaching, verified shopper profiles,
                grounded follow-up recommendations, and privacy-first retail intelligence.
              </p>
            </div>
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              <Activity className="w-4 h-4" />
              <span>{loading ? 'Checking...' : 'Check API Status'}</span>
            </button>
          </div>
        </div>

        {/* Foundation Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Backend Fastify API */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Core Service</span>
              <Terminal className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-base font-medium text-white">Fastify API Gateway</div>
              <div className="text-xs text-slate-400 mt-1">Strict TypeScript • Pino Redaction • Safe Envelopes</div>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Health Endpoint:</span>
              {health ? (
                <span className="text-emerald-400 font-mono font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 200 OK (v{health.version})
                </span>
              ) : error ? (
                <span className="text-amber-400 font-mono">{error}</span>
              ) : (
                <span className="text-slate-500">Checking...</span>
              )}
            </div>
          </div>

          {/* Card 2: Postgres & Vector Foundation */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Persistence</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-base font-medium text-white">PostgreSQL + pgvector</div>
              <div className="text-xs text-slate-400 mt-1">Docker Compose Service • Parameterized SQL</div>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Vector Extension:</span>
              <span className="text-slate-300 font-mono">pgvector:pg16</span>
            </div>
          </div>

          {/* Card 3: Security & Privacy Contract */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Operating Contract</span>
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="text-base font-medium text-white">Privacy & Guardrails</div>
              <div className="text-xs text-slate-400 mt-1">Zero Leaked Secrets • Mandatory Consent • Human Approval</div>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Isolation:</span>
              <span className="text-slate-300 font-mono">Org-Scoped Repositories</span>
            </div>
          </div>
        </div>

        {/* Operating Principles Summary */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/20 p-6 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            System Architecture Principles
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="font-semibold text-slate-200">1. Evidence-Grounded Outputs:</span> Every extracted question, objection, and preference references stable transcript segment IDs and exact quotes.
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="font-semibold text-slate-200">2. Centralized OpenRouter Gateway:</span> All LLM agent invocations flow through a single resilient backend module with strict timeouts, retries, and redaction.
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="font-semibold text-slate-200">3. First-Class Abstention:</span> Insufficient evidence yields safe abstention rather than hallucinated prices, specs, or customer intent.
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="font-semibold text-slate-200">4. Human-In-The-Loop:</span> Outbound recommendations remain strictly editable drafts requiring explicit human authorization.
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
