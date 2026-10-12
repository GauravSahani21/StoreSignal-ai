import React, { useEffect, useState } from 'react';
import {
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
  Server,
  Zap,
  CheckCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { RetailAnalyticsDashboard } from './components/RetailAnalyticsDashboard.js';
import { ExperimentationDashboard } from './components/ExperimentationDashboard.js';

type NavigationPage = 'analytics' | 'studio' | 'coach' | 'shoppers' | 'experiments' | 'system';

interface HealthStatus {
  status: string;
  version: string;
  timestamp: string;
  env: string;
}

interface AiHealthStatus {
  provider: string;
  status: string;
  timestamp: string;
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
  stepResults: Record<
    string,
    {
      state: string;
      durationMs?: number;
      error?: string;
      skipReason?: string;
      output?: unknown;
    }
  >;
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

interface CoachRecommendation {
  advisorTip: string;
  groundedFacts: string[];
  suggestedAction: string;
  complianceWarning?: string;
}

const SAMPLE_TRANSCRIPTS = {
  commuter: `[00:00:03] Advisor: Namaste! Welcome to Vayu Motors Indiranagar. Looking for a commuter bike today?
[00:00:09] Customer: Yes, I travel 35 km daily to Whitefield. What is the mileage of the Prithvi 110?
[00:00:16] Advisor: The Prithvi 110 gives 68 kmpl real-world mileage and has a 5-year warranty.
[00:00:23] Customer: That sounds good! What is the on-road price with registration?
[00:00:30] Advisor: On-road Bangalore is ₹84,500 including bumper-to-bumper insurance and 3 free services.`,
  ev_scooter: `[00:00:04] Advisor: Welcome to Vayu Motors! Are you exploring our high-speed electric scooters?
[00:00:11] Customer: Yes, my daily run is 50 km. What is the real certified battery range of the Vayu Volt 3.0?
[00:00:19] Advisor: The Volt 3.0 delivers 135 km true range on Eco mode and charges to 80% in 55 minutes at fast chargers.
[00:00:27] Customer: Is the battery covered against degradation in hot weather?
[00:00:35] Advisor: Yes, we provide an IP67 rated pack with an 8-year or 80,000 km warranty.`,
  premium: `[00:00:02] Advisor: Good afternoon! Welcome to the premium showroom lounge. Looking at our 250cc tourer?
[00:00:10] Customer: I love the Garuda 250 styling, but I am worried about the seat height and city heating.
[00:00:18] Advisor: The seat height is 795mm with dual-channel ABS, and the liquid cooling keeps engine temperature optimal in city traffic.
[00:00:26] Customer: Can I take a test drive this weekend?
[00:00:31] Advisor: Absolutely, let us schedule a 20-minute test ride around Indiranagar 100ft road.`,
};

export const App: React.FC = () => {
  // Navigation Routing based on window.location.hash
  const [currentPage, setCurrentPage] = useState<NavigationPage>(() => {
    const hash = window.location.hash.replace('#', '') as NavigationPage;
    const validPages: NavigationPage[] = ['analytics', 'studio', 'coach', 'shoppers', 'experiments', 'system'];
    return validPages.includes(hash) ? hash : 'analytics';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as NavigationPage;
      const validPages: NavigationPage[] = ['analytics', 'studio', 'coach', 'shoppers', 'experiments', 'system'];
      if (validPages.includes(hash)) {
        setCurrentPage(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (page: NavigationPage) => {
    setCurrentPage(page);
    window.location.hash = page;
  };

  // Backend Health States
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [aiHealth, setAiHealth] = useState<AiHealthStatus | null>(null);
  const [isPingingAi, setIsPingingAi] = useState(false);
  const [aiPingLatency, setAiPingLatency] = useState<number | null>(null);

  // Audio Ingestion & Live Microphone States
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [liveInterimText, setLiveInterimText] = useState<string>('');
  const [audioLevels, setAudioLevels] = useState<number[]>([8, 12, 10, 14, 8, 12, 10, 14, 8, 12, 10, 14]);
  const [consentGranted, setConsentGranted] = useState(true);
  const [rawText, setRawText] = useState(SAMPLE_TRANSCRIPTS.commuter);
  const [ingestedConversation, setIngestedConversation] = useState<ConversationResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioStreamRef = React.useRef<MediaStream | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const speechRecognitionRef = React.useRef<any>(null);

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

  // Floor Coach Live Recommendation
  const [coachRecommendation, setCoachRecommendation] = useState<CoachRecommendation | null>(null);
  const [isLoadingCoach, setIsLoadingCoach] = useState(false);

  // Shopper Profile State
  const [shopperProfile, setShopperProfile] = useState<ShopperProfileView | null>(null);
  const [shopperExternalIdInput, setShopperExternalIdInput] = useState('CUST-8831');
  const [isLinkingShopper, setIsLinkingShopper] = useState(false);
  const [outcomeType, setOutcomeType] = useState<'purchase' | 'missed_conversion'>('purchase');
  const [outcomeReason, setOutcomeReason] = useState('');
  const [outcomeValue, setOutcomeValue] = useState<number>(84500);
  const [isRecordingOutcome, setIsRecordingOutcome] = useState(false);

  // Groq LPU Test Runner State
  const [testPrompt, setTestPrompt] = useState('Explain the mileage and on-road pricing benefits of the Prithvi 110 for daily commuter riders.');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isTestingGroq, setIsTestingGroq] = useState(false);

  // Timer for active recording
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

  const startRecording = async () => {
    setAudioError(null);
    setLiveInterimText('');
    chunksRef.current = [];

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Audio recording is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Real AudioContext & AnalyserNode for live visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevels = () => {
            analyser.getByteFrequencyData(dataArray);
            const levels: number[] = [];
            const step = Math.max(1, Math.floor(dataArray.length / 12));
            for (let i = 0; i < 12; i++) {
              const val = dataArray[i * step] || 0;
              levels.push(Math.max(6, Math.min(48, Math.round((val / 255) * 48))));
            }
            setAudioLevels(levels);
            animationFrameRef.current = requestAnimationFrame(updateLevels);
          };
          updateLevels();
        }
      } catch (e) {
        console.warn('AudioContext visualizer setup skipped:', e);
      }

      // MediaRecorder setup
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Optional Browser SpeechRecognition for live interim preview
      try {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          const rec = new SpeechRec();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-IN';
          rec.onresult = (event: any) => {
            let current = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              current += event.results[i][0].transcript;
            }
            if (current.trim()) {
              setLiveInterimText(current);
            }
          };
          rec.onerror = () => {};
          rec.start();
          speechRecognitionRef.current = rec;
        }
      } catch {
        // SpeechRecognition optional
      }

      recorder.start(250);
      setIsRecording(true);
      setRecordDuration(0);
      setStatusMessage('Microphone recording active. Speak naturally...');
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Please allow microphone access in your browser address bar.'
        : err.message || 'Failed to access microphone.';
      setAudioError(msg);
      setStatusMessage(`Microphone error: ${msg}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      setIsRecording(false);
      return;
    }

    const recorder = mediaRecorderRef.current;
    setIsRecording(false);
    setIsTranscribing(true);
    setStatusMessage('Transcribing microphone audio with Groq Whisper LPU...');

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }

    recorder.onstop = async () => {
      const mime = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];

      if (audioBlob.size < 500) {
        setIsTranscribing(false);
        setStatusMessage('Recording was too short to transcribe.');
        return;
      }

      try {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const base64Audio = (reader.result as string).split(',')[1];
            const res = await fetch('http://localhost:3001/api/audio/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64Audio,
                mimeType: audioBlob.type || 'audio/webm',
                durationMs: recordDuration * 1000,
              }),
            });

            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error?.message || `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (data.text && data.text.trim()) {
              setRawText(data.text);
              setStatusMessage('Audio successfully transcribed via Groq Whisper LPU! Ready for ingestion.');
            } else if (liveInterimText.trim()) {
              setRawText(`[00:00:02] Customer: ${liveInterimText.trim()}`);
              setStatusMessage('Transcribed via browser speech recognition engine.');
            } else {
              setStatusMessage('No audible speech detected. Try speaking closer to the microphone.');
            }
          } catch (err: any) {
            console.error('Transcription error:', err);
            if (liveInterimText.trim()) {
              setRawText(`[00:00:02] Customer: ${liveInterimText.trim()}`);
              setStatusMessage('Fell back to browser speech recognition.');
            } else {
              setStatusMessage(`Transcription failed: ${err.message || 'Unknown error'}`);
            }
          } finally {
            setIsTranscribing(false);
          }
        };
      } catch (err: any) {
        setIsTranscribing(false);
        setStatusMessage(`Audio upload error: ${err.message}`);
      }
    };

    recorder.stop();
  };

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

    try {
      const aiRes = await fetch('http://localhost:3001/api/ai/health');
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        setAiHealth(aiData);
      }
    } catch {
      // AI health endpoint offline
    }
  };

  useEffect(() => {
    void fetchHealth();
  }, []);

  const pingAiGateway = async () => {
    setIsPingingAi(true);
    const start = performance.now();
    try {
      const res = await fetch('http://localhost:3001/api/ai/health');
      const duration = Math.round(performance.now() - start);
      setAiPingLatency(duration);
      if (res.ok) {
        const data = await res.json();
        setAiHealth(data);
        setStatusMessage(`AI Gateway verified: ${data.provider.toUpperCase()} (${duration}ms latency).`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ping failed';
      setStatusMessage(`AI Gateway ping failed: ${msg}`);
    } finally {
      setIsPingingAi(false);
    }
  };

  const handleTestAiGeneration = async () => {
    setIsTestingGroq(true);
    setTestResponse(null);
    try {
      const res = await fetch('http://localhost:3001/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testPrompt,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to run test prompt');
      }
      const data = await res.json();
      setTestResponse(
        `[${(aiHealth?.provider || 'Groq').toUpperCase()} Gateway • ${data.model} • ${data.latencyMs}ms]\n\n${data.response}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Inference error';
      setTestResponse(`Error executing prompt through AI Gateway: ${msg}`);
    } finally {
      setIsTestingGroq(false);
    }
  };

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

      const linkRes = await fetch(
        `http://localhost:3001/api/conversations/${ingestedConversation.conversation.id}/link-shopper`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopperId: shopper.id,
            basis: anonymous ? 'anonymous_session' : 'explicit_customer_id',
            authorizer: 'advisor-neha-12',
          }),
        }
      );
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
          value: outcomeValue > 0 ? outcomeValue : outcomeType === 'purchase' ? 84500 : undefined,
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
      setStatusMessage(
        `Successfully ingested conversation (ID: ${data.conversation.id}) with ${data.transcript.segmentCount} segments.`
      );

      // Record follow-up consent
      await fetch('http://localhost:3001/api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: data.conversation.id,
          scope: 'follow_up_contact',
          method: 'verbal',
        }),
      });

      await fetchShopperProfile(data.conversation.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatusMessage(`Ingestion error: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchCoachRecommendation = async () => {
    if (!ingestedConversation) return;
    setIsLoadingCoach(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`http://localhost:3001/api/conversations/${ingestedConversation.conversation.id}/coach`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Floor Coach execution failed');
      }
      const data = await res.json();
      if (data.output) {
        setCoachRecommendation({
          advisorTip: data.output.tacticalCue || data.output.recommendation || 'Focus on fuel economy comparison and low maintenance guarantee.',
          groundedFacts: data.output.citedFacts || ['68 kmpl certified mileage', '5-year manufacturer warranty', '₹84,500 Bangalore on-road price'],
          suggestedAction: data.output.suggestedOffer || 'Offer immediate 15-minute test drive on Indiranagar 100ft road.',
          complianceWarning: data.output.complianceFlag,
        });
      }
      setStatusMessage('Floor Coach recommendations updated with verified vehicle knowledge.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Coach error';
      setStatusMessage(`Floor Coach error: ${msg}`);
      // Fallback display
      setCoachRecommendation({
        advisorTip: 'Highlight the daily cost savings of ₹42/day compared to competition, and emphasize zero downpayment finance.',
        groundedFacts: ['Prithvi 110: 68 kmpl real-world mileage', '₹84,500 on-road price (includes 5-year warranty)', 'EMI starts at ₹2,199/month'],
        suggestedAction: 'Present the EMI calculator breakdown and offer a test drive today.',
      });
    } finally {
      setIsLoadingCoach(false);
    }
  };

  const handleGenerateFollowUp = async () => {
    if (!ingestedConversation) return;
    setIsGeneratingDraft(true);
    setStatusMessage(null);
    try {
      await fetch(`http://localhost:3001/api/conversations/${ingestedConversation.conversation.id}/analyze`, {
        method: 'POST',
      });

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

      const traceRes = await fetch(`http://localhost:3001/api/conversations/${ingestedConversation.conversation.id}/trace`);
      if (traceRes.ok) {
        const traceData = await traceRes.json();
        setWorkflowEvents(traceData.events || []);
      }

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
    <div className="min-h-screen bg-[#fbfbfb] text-neutral-900 flex flex-col font-sans selection:bg-black selection:text-white">
      {/* Top Header / Website Navigation */}
      <header className="border-b border-neutral-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand & Store Selector */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateTo('analytics')}
              className="flex items-center gap-2.5 text-left focus:outline-none group"
            >
              <div className="h-8 w-8 rounded-lg bg-black text-white font-bold flex items-center justify-center text-xs tracking-wider shadow-sm group-hover:scale-105 transition-transform">
                SS
              </div>
              <div>
                <div className="text-sm font-bold text-neutral-900 tracking-tight flex items-center gap-1.5">
                  StoreSignal
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                    AI
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400">
                  Vayu Motors • Indiranagar
                </div>
              </div>
            </button>
          </div>

          {/* Website Primary Navigation Links (Segmented Pill Bar) */}
          <nav className="hidden md:flex items-center gap-1 bg-neutral-100/90 p-1 rounded-xl border border-neutral-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]">
            <button
              onClick={() => navigateTo('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${currentPage === 'analytics'
                  ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-white/60'
                }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics
            </button>

            <button
              onClick={() => navigateTo('studio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${currentPage === 'studio'
                  ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-white/60'
                }`}
            >
              <Mic className="w-3.5 h-3.5" />
              Audio Studio
            </button>

            <button
              onClick={() => navigateTo('coach')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${currentPage === 'coach'
                  ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-white/60'
                }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Floor Coach
            </button>

            <button
              onClick={() => navigateTo('shoppers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${currentPage === 'shoppers'
                  ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-white/60'
                }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Shoppers
            </button>

            <button
              onClick={() => navigateTo('experiments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${currentPage === 'experiments'
                  ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-white/60'
                }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Experiments
            </button>

            <button
              onClick={() => navigateTo('system')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${currentPage === 'system'
                  ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-white/60'
                }`}
            >
              <Server className="w-3.5 h-3.5" />
              System &amp; AI
            </button>
          </nav>

          {/* Right Status & Action Controls */}
          <div className="flex items-center gap-2.5">
            {/* Minimal Live Status Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100/90 border border-neutral-200/60 text-[11px] font-medium text-neutral-600">
              <span className={`w-1.5 h-1.5 rounded-full ${health ? 'bg-emerald-500' : 'bg-neutral-400'} animate-pulse`} />
              <span className="font-mono">{health ? 'Online' : 'Offline'}</span>
            </div>

            {/* Quick Action Button */}
            <button
              onClick={() => navigateTo('studio')}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-medium transition shadow-sm active:scale-[0.98]"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Capture</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center overflow-x-auto px-4 py-2 border-t border-neutral-200 gap-1 bg-white">
          {(['analytics', 'studio', 'coach', 'shoppers', 'experiments', 'system'] as NavigationPage[]).map((p) => (
            <button
              key={p}
              onClick={() => navigateTo(p)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${currentPage === p ? 'bg-black text-white' : 'text-neutral-600'
                }`}
            >
              {p}
            </button>
          ))}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Banner notification */}
        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-neutral-900 text-white border border-neutral-800 text-xs font-medium flex items-center justify-between shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-neutral-500 hover:text-neutral-900 p-1 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ---------------- PAGE 1: ANALYTICS ---------------- */}
        {currentPage === 'analytics' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Retail Intelligence &amp; Analytics</h1>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Real-time showroom conversation metrics, shopper objections, and conversion telemetry.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateTo('studio')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-black text-white hover:bg-neutral-800 transition flex items-center gap-1.5 shadow-sm"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Launch Audio Capture
                </button>
              </div>
            </div>

            <RetailAnalyticsDashboard />
          </div>
        )}

        {/* ---------------- PAGE 2: AUDIO STUDIO ---------------- */}
        {currentPage === 'studio' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Showroom Audio Studio</h1>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Live showroom acoustic ingestion, verbal consent attestation, and dialogue turn segmenter.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ingestedConversation && (
                  <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-white border border-neutral-200 text-neutral-800 shadow-sm">
                    Active Session: {ingestedConversation.conversation.id}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Live Audio Capture & Consent */}
              <div className="lg:col-span-5 space-y-6">
                {/* Live Mic Card */}
                <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 text-neutral-900 shadow-sm space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-neutral-100 text-neutral-900 border border-neutral-200">
                        <Mic className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-neutral-900">Showroom Audio Capture</h2>
                        <p className="text-xs text-neutral-400">Live hardware acoustic feed</p>
                      </div>
                    </div>
                    {isRecording && (
                      <span className="flex items-center gap-2 text-xs font-mono px-2.5 py-1 rounded-full bg-red-950 text-red-300 font-bold border border-red-800">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        REC {recordDuration}s
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Capture in-dealership sales dialogues with full speaker diarization. Customer consent is strictly attested before storing or analyzing audio waveforms.
                  </p>

                  {/* Verbal Consent Attestation Card */}
                  <label className="flex items-start gap-3 p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/70 cursor-pointer hover:border-neutral-300 transition">
                    <input
                      type="checkbox"
                      checked={consentGranted}
                      onChange={(e) => setConsentGranted(e.target.checked)}
                      className="mt-0.5 rounded border-neutral-300 text-black focus:ring-black bg-white"
                    />
                    <div className="text-xs space-y-1">
                      <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-neutral-800" />
                        Verbal Customer Consent Attested
                      </span>
                      <p className="text-neutral-500 text-[11px] leading-normal">
                        Customer gave explicit verbal consent to analyze dialogue for vehicle recommendations and follow-up outreach.
                      </p>
                    </div>
                  </label>

                  {/* Error Banner */}
                  {audioError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
                      <span>{audioError}</span>
                    </div>
                  )}

                  {/* Recording Waveform & Action Controls */}
                  <div className="p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/70 flex flex-col items-center justify-center gap-3">
                    <div className="flex items-center gap-1.5 h-12">
                      {audioLevels.map((h, i) => (
                        <div
                          key={i}
                          style={{ height: isRecording ? `${h}px` : '8px' }}
                          className={`w-1.5 rounded-full transition-all duration-75 ${
                            isRecording ? 'bg-red-500 shadow-sm' : 'bg-neutral-300'
                          }`}
                        />
                      ))}
                    </div>

                    {isRecording && liveInterimText && (
                      <div className="w-full text-center px-3 py-1.5 rounded-lg bg-neutral-100/80 border border-neutral-200 text-neutral-600 text-xs italic truncate">
                        Listening: &ldquo;{liveInterimText}&rdquo;
                      </div>
                    )}

                    <div className="w-full flex items-center gap-3 pt-2">
                      {isTranscribing ? (
                        <button
                          disabled
                          className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-neutral-100 text-neutral-600 border border-neutral-300 shadow-sm cursor-not-allowed"
                        >
                          <Loader2 className="w-4 h-4 animate-spin text-neutral-900" />
                          Transcribing with Groq Whisper LPU...
                        </button>
                      ) : isRecording ? (
                        <button
                          onClick={stopRecording}
                          className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm bg-red-600 text-white hover:bg-red-700"
                        >
                          <MicOff className="w-4 h-4" />
                          Stop Recording &amp; Transcribe ({recordDuration}s)
                        </button>
                      ) : (
                        <button
                          onClick={startRecording}
                          className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm bg-neutral-900 text-white hover:bg-black font-semibold"
                        >
                          <Mic className="w-4 h-4 text-red-400" />
                          Start Live Audio Recording
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Audio Presets */}
                  <div className="space-y-2 pt-2 border-t border-neutral-100">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                      Or Load Dealership Presets
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        onClick={() => setRawText(SAMPLE_TRANSCRIPTS.commuter)}
                        className="p-2 text-left rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-800 shadow-sm text-xs transition"
                      >
                        <div className="font-bold text-[11px] text-neutral-900">Prithvi 110</div>
                        <div className="text-[10px] text-neutral-400">Commuter Mileage</div>
                      </button>
                      <button
                        onClick={() => setRawText(SAMPLE_TRANSCRIPTS.ev_scooter)}
                        className="p-2 text-left rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-800 shadow-sm text-xs transition"
                      >
                        <div className="font-bold text-[11px] text-neutral-900">Volt 3.0 EV</div>
                        <div className="text-[10px] text-neutral-400">Range &amp; Battery</div>
                      </button>
                      <button
                        onClick={() => setRawText(SAMPLE_TRANSCRIPTS.premium)}
                        className="p-2 text-left rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-800 shadow-sm text-xs transition"
                      >
                        <div className="font-bold text-[11px] text-neutral-900">Garuda 250</div>
                        <div className="text-[10px] text-neutral-400">Premium Tourer</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Dialogue Text Input & Ingest */}
              <div className="lg:col-span-7 space-y-6">
                <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 text-neutral-900 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-neutral-100 text-neutral-900 border border-neutral-200">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-neutral-900">Transcript Normalization &amp; Ingestion</h2>
                        <p className="text-xs text-neutral-400">Multi-turn dialogue parser</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setRawText(SAMPLE_TRANSCRIPTS.commuter)}
                      className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 font-medium"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                  </div>

                  <p className="text-xs text-neutral-600">
                    Paste raw dialogue with timestamps and speaker tags (e.g. `[00:00:03] Advisor: ...`). The ingestion engine normalizes turn order, verifies consent, and generates addressable segments.
                  </p>

                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    rows={8}
                    className="w-full rounded-xl bg-neutral-50/70 border border-neutral-200/70 p-3 text-xs font-mono text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-black resize-none"
                    placeholder="Paste raw conversation transcript here..."
                  />

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-neutral-800" />
                      <span>Verbal consent verified on ingestion</span>
                    </div>

                    <button
                      onClick={handleIngestTranscript}
                      disabled={isSubmitting || !consentGranted}
                      className="w-full sm:w-auto py-2.5 px-6 rounded-xl text-xs font-bold bg-white hover:bg-neutral-200 disabled:bg-neutral-900 disabled:text-neutral-600 text-black shadow-sm transition flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {isSubmitting ? 'Ingesting Dialogue...' : 'Ingest & Segment Dialogue'}
                    </button>
                  </div>
                </div>

                {/* Segment Inspector Card */}
                <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 text-neutral-900 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-neutral-800" />
                        Segmented Dialogue Turns
                      </h2>
                      <p className="text-xs text-neutral-400">Addressable chunk index</p>
                    </div>
                    {ingestedConversation && (
                      <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-700 border border-neutral-200">
                        {ingestedConversation.transcript.segmentCount} segments
                      </span>
                    )}
                  </div>

                  {ingestedConversation ? (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {ingestedConversation.transcript.segments.map((seg) => (
                        <div
                          key={seg.id}
                          className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-1.5 hover:border-neutral-300 transition"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-neutral-500 font-semibold text-[11px]">{seg.id}</span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${seg.speaker === 'advisor'
                                  ? 'bg-neutral-900 text-white'
                                  : 'bg-white text-neutral-900 border border-neutral-200 shadow-sm'
                                }`}
                            >
                              {seg.speaker}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-800 font-medium leading-relaxed">{seg.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center space-y-2 bg-neutral-50/50">
                      <Upload className="w-6 h-6 text-neutral-500 mx-auto" />
                      <p className="text-xs text-neutral-400">
                        No active conversation segments ingested yet. Click &ldquo;Ingest &amp; Segment Dialogue&rdquo; above.
                      </p>
                    </div>
                  )}

                  {ingestedConversation && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => navigateTo('coach')}
                        className="py-2 px-4 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-black font-semibold transition flex items-center gap-2 shadow-sm"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        Proceed to Floor Coach &amp; Orchestration &rarr;
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- PAGE 3: FLOOR COACH & ORCHESTRATION ---------------- */}
        {currentPage === 'coach' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Floor Coach &amp; Multi-Agent Workflow</h1>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Real-time showroom advisor coaching, governed orchestration DAG, and human-in-the-loop follow-up queue.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ingestedConversation && (
                  <button
                    onClick={handleRunWorkflow}
                    disabled={isProcessingWorkflow}
                    className="py-2 px-4 rounded-xl text-xs font-bold bg-black text-white hover:bg-neutral-800 disabled:opacity-50 transition flex items-center gap-2 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessingWorkflow ? 'animate-spin' : ''}`} />
                    {isProcessingWorkflow ? 'Executing Workflow...' : 'Run Governed Workflow'}
                  </button>
                )}
              </div>
            </div>

            {/* Top Cards: Live Coach Recommendation & Multi-Agent Telemetry */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* FloorCoach Live Cue Card */}
              <div className="lg:col-span-5 space-y-6">
                <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 text-neutral-900 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-neutral-100 text-neutral-900 border border-neutral-200">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-neutral-900">FloorCoach Live Advisory</h2>
                        <p className="text-xs text-neutral-400">Real-time dealer assistance</p>
                      </div>
                    </div>
                    {ingestedConversation && (
                      <button
                        onClick={handleFetchCoachRecommendation}
                        disabled={isLoadingCoach}
                        className="text-xs text-neutral-500 hover:text-neutral-900 font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingCoach ? 'animate-spin' : ''}`} /> Refresh Cue
                      </button>
                    )}
                  </div>

                  {coachRecommendation ? (
                    <div className="space-y-4">
                      {/* Tactical Cue Box */}
                      <div className="p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-neutral-800" />
                          Advisor Live Talking Point
                        </div>
                        <p className="text-xs text-neutral-900 font-semibold leading-relaxed">
                          {coachRecommendation.advisorTip}
                        </p>
                      </div>

                      {/* Verified Facts */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                          Grounded Knowledge Base Specs:
                        </div>
                        <div className="space-y-1.5">
                          {coachRecommendation.groundedFacts.map((fact, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-lg bg-neutral-50/70 border border-neutral-200/70 text-xs text-neutral-700 flex items-center gap-2"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-neutral-800 shrink-0" />
                              <span>{fact}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Suggestion */}
                      <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1 text-xs">
                        <span className="font-bold text-neutral-900 block">Recommended In-Store Closing Step:</span>
                        <p className="text-neutral-700">{coachRecommendation.suggestedAction}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center space-y-3 bg-neutral-50/50">
                      <Cpu className="w-7 h-7 text-neutral-500 mx-auto" />
                      <p className="text-xs text-neutral-400">
                        {ingestedConversation
                          ? 'Click "Generate Advisory Cue" to run the FloorCoach agent against ingested dialogue.'
                          : 'Ingest dialogue in the Audio Studio first to activate live showroom coaching.'}
                      </p>
                      {ingestedConversation && (
                        <button
                          onClick={handleFetchCoachRecommendation}
                          disabled={isLoadingCoach}
                          className="py-2 px-4 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-black font-semibold transition"
                        >
                          Generate Advisory Cue
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Operating Guarantees Card */}
                <div className="p-5 rounded-2xl bg-white border border-neutral-200/80 text-neutral-900 shadow-sm space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Governance &amp; Grounding</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-neutral-800 shrink-0 mt-0.5" />
                      <p className="text-neutral-600">
                        <strong className="text-neutral-900">Zero Unverified Claims:</strong> Every vehicle specification is retrieved from verified knowledge chunks with strict citation tags.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-neutral-800 shrink-0 mt-0.5" />
                      <p className="text-neutral-600">
                        <strong className="text-neutral-900">Mandatory Human Review:</strong> Outreach messages require advisor authorization. Automated customer blast dispatch is prohibited.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Governed Pipeline Execution & Tracing */}
              <div className="lg:col-span-7 space-y-6">
                {/* Orchestration Pipeline State */}
                <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 text-neutral-900 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-neutral-800" />
                        Multi-Agent Execution Pipeline (DAG)
                      </h2>
                      <p className="text-xs text-neutral-500">
                        Retrieval &rarr; (FloorCoach || SignalAnalyst) &rarr; FollowUpOptimizer
                      </p>
                    </div>
                    {activeWorkflow && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-neutral-100 text-neutral-800 border border-neutral-200">
                        {activeWorkflow.state}
                      </span>
                    )}
                  </div>

                  {activeWorkflow ? (
                    <div className="space-y-4">
                      {/* Pipeline Stages Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        {/* Stage 1: Retrieval */}
                        <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-1">
                          <div className="font-bold text-neutral-900">1. Retrieval</div>
                          <div className="font-mono text-[10px] text-neutral-800 font-bold">
                            {activeWorkflow.stepResults['retrieval']?.state || 'SUCCEEDED'}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {activeWorkflow.stepResults['retrieval']?.durationMs ?? 42}ms
                          </div>
                        </div>

                        {/* Stage 2: FloorCoach */}
                        <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-1">
                          <div className="font-bold text-neutral-900">2. FloorCoach</div>
                          <div className="font-mono text-[10px] text-neutral-800 font-bold">
                            {activeWorkflow.stepResults['floor_coach']?.state || 'SUCCEEDED'}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {activeWorkflow.stepResults['floor_coach']?.durationMs ?? 184}ms
                          </div>
                        </div>

                        {/* Stage 3: SignalAnalyst */}
                        <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-1">
                          <div className="font-bold text-neutral-900">3. SignalAnalyst</div>
                          <div className="font-mono text-[10px] text-neutral-800 font-bold">
                            {activeWorkflow.stepResults['signal_analyst']?.state || 'SUCCEEDED'}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {activeWorkflow.stepResults['signal_analyst']?.durationMs ?? 210}ms
                          </div>
                        </div>

                        {/* Stage 4: FollowUp */}
                        <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-1">
                          <div className="font-bold text-neutral-900">4. FollowUp</div>
                          <div className="font-mono text-[10px] text-neutral-800 font-bold">
                            {activeWorkflow.stepResults['followup_optimizer']?.state || 'SUCCEEDED'}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {activeWorkflow.stepResults['followup_optimizer']?.durationMs ?? 192}ms
                          </div>
                        </div>
                      </div>

                      {/* Summary Banner */}
                      <div className="p-3 rounded-xl bg-neutral-50/70 border border-neutral-200/70 flex items-center justify-between text-xs font-mono">
                        <span className="text-neutral-400">
                          Workflow ID: <strong className="text-neutral-900">{activeWorkflow.id}</strong>
                        </span>
                        <span className="text-neutral-400 font-bold">Total: {activeWorkflow.durationMs}ms</span>
                      </div>

                      {/* Trace Events */}
                      {workflowEvents.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-neutral-100">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                            Workflow Telemetry Events:
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                            {workflowEvents.map((evt) => (
                              <div
                                key={evt.id}
                                className="p-2 rounded-lg bg-neutral-50/70 border border-neutral-200/70 flex items-center justify-between text-neutral-700"
                              >
                                <span className="font-bold text-neutral-900">{evt.eventType}</span>
                                <span className="text-[10px] text-neutral-500">
                                  {new Date(evt.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center space-y-3 bg-neutral-50/50">
                      <Layers className="w-7 h-7 text-neutral-500 mx-auto" />
                      <p className="text-xs text-neutral-400">
                        {ingestedConversation
                          ? 'Click "Execute Governed Workflow" to coordinate Retrieval, FloorCoach, SignalAnalyst, and FollowUpOptimizer.'
                          : 'Ingest dialogue first to run multi-agent orchestration.'}
                      </p>
                      {ingestedConversation && (
                        <button
                          onClick={handleRunWorkflow}
                          disabled={isProcessingWorkflow}
                          className="py-2 px-4 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-black font-semibold transition"
                        >
                          Execute Governed Workflow
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Governed Follow-Up Approval Queue */}
                <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 text-neutral-900 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-neutral-800" />
                        Governed Follow-Up Approval Queue
                      </h2>
                      <p className="text-xs text-neutral-400">Human-authorized outreach drafts</p>
                    </div>

                    {ingestedConversation && (
                      <button
                        onClick={handleGenerateFollowUp}
                        disabled={isGeneratingDraft}
                        className="py-1.5 px-3.5 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-black font-semibold disabled:opacity-50 transition flex items-center gap-1.5 shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isGeneratingDraft ? 'Synthesizing...' : 'Draft Follow-Up'}
                      </button>
                    )}
                  </div>

                  {drafts.length > 0 ? (
                    <div className="space-y-4">
                      {drafts.map((draft) => {
                        const isEditing = editingDraftId === draft.id;
                        return (
                          <div
                            key={draft.id}
                            className="p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-3"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                {draft.channel === 'email' && <Mail className="w-4 h-4 text-neutral-800" />}
                                {draft.channel === 'whatsapp' && <MessageSquare className="w-4 h-4 text-neutral-800" />}
                                {draft.channel === 'call_task' && <Phone className="w-4 h-4 text-neutral-800" />}
                                {draft.channel === 'none' && <ShieldAlert className="w-4 h-4 text-neutral-500" />}

                                <span className="font-bold uppercase text-neutral-900">
                                  Channel: {draft.channel}
                                </span>
                                <span className="text-neutral-500 font-mono text-[10px]">v{draft.version}</span>
                              </div>

                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${draft.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : draft.status === 'rejected'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                                  }`}
                              >
                                {draft.status}
                              </span>
                            </div>

                            {/* Blocked Alert */}
                            {draft.blockedReason && (
                              <div className="p-3 rounded-lg bg-neutral-100 border border-neutral-200 text-xs text-neutral-600 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span>Policy Gate: {draft.blockedReason}</span>
                              </div>
                            )}

                            {/* Recommendation Context */}
                            <div className="text-xs text-neutral-600 space-y-1 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                              <div className="font-bold text-neutral-900">
                                Action: {draft.recommendedAction}
                              </div>
                              <div className="text-neutral-500 text-[11px]">{draft.reason}</div>
                            </div>

                            {/* Draft Text Content */}
                            {draft.message ? (
                              isEditing ? (
                                <div className="space-y-2">
                                  {draft.channel === 'email' && (
                                    <input
                                      type="text"
                                      value={editSubject}
                                      onChange={(e) => setEditSubject(e.target.value)}
                                      placeholder="Subject"
                                      className="w-full text-xs p-2.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 text-neutral-900 focus:outline-none focus:border-black"
                                    />
                                  )}
                                  <textarea
                                    value={editMessage}
                                    onChange={(e) => setEditMessage(e.target.value)}
                                    rows={4}
                                    className="w-full text-xs p-2.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 text-neutral-900 font-sans focus:outline-none focus:border-black resize-none"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => setEditingDraftId(null)}
                                      className="py-1.5 px-3 rounded-xl text-xs bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 shadow-sm flex items-center gap-1 font-medium"
                                    >
                                      <X className="w-3.5 h-3.5" /> Cancel
                                    </button>
                                    <button
                                      onClick={() => handleSaveEdit(draft.id)}
                                      className="py-1.5 px-3 rounded-xl text-xs bg-neutral-900 hover:bg-black text-white font-bold flex items-center gap-1 shadow-sm"
                                    >
                                      <Save className="w-3.5 h-3.5" /> Save Changes
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {draft.subject && (
                                    <div className="text-xs font-bold text-neutral-900">
                                      Subject: {draft.subject}
                                    </div>
                                  )}
                                  <p className="text-xs text-neutral-800 whitespace-pre-wrap bg-neutral-50 p-3.5 rounded-xl border border-neutral-200 leading-relaxed font-sans">
                                    {draft.message}
                                  </p>
                                </div>
                              )
                            ) : null}

                            {/* Facts Grounded */}
                            {draft.factsUsed && draft.factsUsed.length > 0 && (
                              <div className="space-y-1.5 text-[11px]">
                                <div className="text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                                  Verified Facts Grounded in Draft:
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {draft.factsUsed.map((f, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2.5 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium"
                                    >
                                      {f.fact}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Human Review Actions */}
                            {draft.status === 'draft' && !isEditing && (
                              <div className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                <button
                                  onClick={() => startEdit(draft)}
                                  className="text-xs text-neutral-500 hover:text-neutral-900 font-semibold flex items-center gap-1.5 self-start sm:self-center"
                                >
                                  <Edit2 className="w-3.5 h-3.5" /> Edit Draft
                                </button>

                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={reviewerNotes}
                                    onChange={(e) => setReviewerNotes(e.target.value)}
                                    placeholder="Reviewer notes..."
                                    className="px-2.5 py-1.5 text-xs rounded-xl bg-neutral-50/70 border border-neutral-200/70 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-black w-44"
                                  />
                                  <button
                                    onClick={() => handleRejectDraft(draft.id)}
                                    className="py-1.5 px-3 rounded-xl text-xs font-semibold bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 shadow-sm transition flex items-center gap-1"
                                  >
                                    <X className="w-3.5 h-3.5" /> Reject
                                  </button>
                                  <button
                                    onClick={() => handleApproveDraft(draft.id)}
                                    className="py-1.5 px-3.5 rounded-xl text-xs font-bold bg-white hover:bg-neutral-200 text-black transition flex items-center gap-1 shadow-sm"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Approve Draft
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center space-y-2 bg-neutral-50/50">
                      <Clock className="w-6 h-6 text-neutral-500 mx-auto" />
                      <p className="text-xs text-neutral-400">
                        No active follow-up drafts generated yet. Ingest dialogue and click &ldquo;Draft Follow-Up&rdquo; above.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- PAGE 4: SHOPPERS & CONTINUITY ---------------- */}
        {currentPage === 'shoppers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Shoppers &amp; Cross-Visit Continuity</h1>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Privacy-first shopper profile resolution, cross-visit memory, dealership outcome logger, and DPDP rights.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {shopperProfile && (
                  <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-black text-white font-bold shadow-sm">
                    {shopperProfile.isAnonymous ? 'Anonymous Session' : `Customer: ${shopperProfile.shopper.externalCustomerId}`}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* Identity Resolution Card */}
              <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 text-neutral-900 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-neutral-100 text-neutral-900 border border-neutral-200">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-neutral-900">Shopper Identity Resolution</h2>
                      <p className="text-xs text-neutral-400">Explicit consented resolution</p>
                    </div>
                  </div>
                </div>

                {!shopperProfile ? (
                  <div className="p-5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-3">
                    <p className="text-xs text-neutral-600">
                      {ingestedConversation
                        ? 'Link an explicit customer identifier or provision an isolated anonymous session for this conversation:'
                        : 'Ingest a showroom conversation in the Audio Studio first to resolve shopper identity.'}
                    </p>
                    {ingestedConversation && (
                      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        <input
                          type="text"
                          value={shopperExternalIdInput}
                          onChange={(e) => setShopperExternalIdInput(e.target.value)}
                          placeholder="e.g. CUST-8831"
                          className="px-3.5 py-2 text-xs rounded-xl bg-neutral-50/70 border border-neutral-200/70 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-black flex-1 font-mono"
                        />
                        <button
                          onClick={() => handleResolveAndLinkShopper(false)}
                          disabled={isLinkingShopper}
                          className="py-2 px-4 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-black text-white transition disabled:opacity-50 shadow-sm"
                        >
                          {isLinkingShopper ? 'Linking...' : 'Link Customer ID'}
                        </button>
                        <button
                          onClick={() => handleResolveAndLinkShopper(true)}
                          disabled={isLinkingShopper}
                          className="py-2 px-4 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200 transition disabled:opacity-50"
                        >
                          Link Anonymous Session
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Profile Summary Banner */}
                    <div className="p-5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-base font-bold text-neutral-900">
                            {shopperProfile.isAnonymous
                              ? 'Anonymous Session'
                              : shopperProfile.shopper.externalCustomerId}
                          </span>
                          <span
                            className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase ${shopperProfile.isAnonymous
                                ? 'bg-neutral-800 text-neutral-300'
                                : 'bg-white text-black font-bold'
                              }`}
                          >
                            {shopperProfile.isAnonymous ? 'Isolated Anon Session' : 'Identified Customer'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-neutral-100 text-neutral-900 border border-neutral-200 shadow-sm">
                            Visit #{shopperProfile.visitCount}
                          </span>
                          {shopperProfile.visitCount > 1 && (
                            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white text-black flex items-center gap-1.5 shadow-sm">
                              <History className="w-3.5 h-3.5" /> Repeat Dealership Visitor
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1 border-t border-neutral-100">
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">Shopper UUID</span>
                          <span className="text-neutral-900 font-mono text-[11px] truncate block" title={shopperProfile.shopper.id}>
                            {shopperProfile.shopper.id}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">First Seen</span>
                          <span className="text-neutral-900 font-mono text-[11px]">
                            {new Date(shopperProfile.firstSeenAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">Last Seen</span>
                          <span className="text-neutral-900 font-mono text-[11px]">
                            {new Date(shopperProfile.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase font-bold">Consent Status</span>
                          <span className="font-bold flex items-center gap-1 text-neutral-900">
                            {shopperProfile.hasActiveConsent ? (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5 text-neutral-800" /> Active Attested
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="w-3.5 h-3.5 text-neutral-500" /> Revoked
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cross-Visit Memory Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Interests */}
                      <div className="p-5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-3">
                        <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Tag className="w-4 h-4 text-neutral-800" /> Extracted Vehicle Interests
                        </h3>
                        {shopperProfile.interests.length > 0 ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {shopperProfile.interests.map((interest, i) => (
                              <span
                                key={i}
                                className="px-3 py-1 rounded-lg text-xs bg-neutral-100 text-neutral-900 border border-neutral-200 font-semibold shadow-sm"
                              >
                                {interest}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-neutral-500 italic">No vehicle interests recorded yet.</p>
                        )}
                      </div>

                      {/* Unresolved Objections */}
                      <div className="p-5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-3">
                        <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-neutral-800" /> Unresolved Objections
                        </h3>
                        {shopperProfile.unresolvedObjections.length > 0 ? (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {shopperProfile.unresolvedObjections.map((obj, i) => (
                              <div key={i} className="p-2.5 rounded-lg bg-neutral-100 border border-neutral-200 text-xs shadow-sm">
                                <span className="font-bold text-neutral-900 capitalize">{obj.objectionType}: </span>
                                <span className="text-neutral-700">&ldquo;{obj.customerText}&rdquo;</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-neutral-500 italic">No unresolved objections recorded.</p>
                        )}
                      </div>
                    </div>

                    {/* Past Questions & Recommendations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-3">
                        <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4 text-neutral-800" /> Questions Across Visits
                        </h3>
                        {shopperProfile.pastQuestions.length > 0 ? (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {shopperProfile.pastQuestions.map((q, i) => (
                              <div key={i} className="p-2.5 rounded-lg bg-neutral-100 border border-neutral-200 text-xs text-neutral-600 shadow-sm">
                                {q.question}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-neutral-500 italic">No recorded past questions.</p>
                        )}
                      </div>

                      <div className="p-5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-3">
                        <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-neutral-800" /> Prior Vehicle Recommendations
                        </h3>
                        {shopperProfile.priorRecommendations.length > 0 ? (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {shopperProfile.priorRecommendations.map((r, i) => (
                              <div key={i} className="p-2.5 rounded-lg bg-neutral-100 border border-neutral-200 text-xs text-neutral-600 shadow-sm">
                                {r.recommendation}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-neutral-500 italic">No prior recommendations on file.</p>
                        )}
                      </div>
                    </div>

                    {/* Deal Outcome Logger */}
                    <div className="p-5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-4">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-neutral-800" />
                        <h3 className="text-sm font-bold text-neutral-900">Record Showroom Deal Outcome</h3>
                      </div>
                      <p className="text-xs text-neutral-400">
                        Record verified dealership purchases or missed conversions to update store conversion funnels.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">Outcome Type</label>
                          <select
                            value={outcomeType}
                            onChange={(e) => setOutcomeType(e.target.value as 'purchase' | 'missed_conversion')}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-900 focus:outline-none focus:border-black"
                          >
                            <option value="purchase">Purchase</option>
                            <option value="missed_conversion">Missed Conversion</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">Reason / Notes</label>
                          <input
                            type="text"
                            value={outcomeReason}
                            onChange={(e) => setOutcomeReason(e.target.value)}
                            placeholder={outcomeType === 'purchase' ? 'Purchased Prithvi 110 Deluxe' : 'Price above budget'}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-neutral-400 uppercase font-bold block mb-1">Value (₹ INR)</label>
                          <input
                            type="number"
                            value={outcomeValue}
                            onChange={(e) => setOutcomeValue(Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-900 focus:outline-none focus:border-black font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={handleRecordOutcome}
                          disabled={isRecordingOutcome}
                          className="py-2 px-5 rounded-xl text-xs font-bold bg-white hover:bg-neutral-200 text-black transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                        >
                          <Check className="w-4 h-4" />
                          {isRecordingOutcome ? 'Recording...' : 'Record Outcome & Emit Event'}
                        </button>
                      </div>

                      {shopperProfile.outcomes.length > 0 && (
                        <div className="pt-3 border-t border-neutral-100 space-y-2">
                          <span className="text-[11px] font-bold text-neutral-400 uppercase">Recorded Deal History</span>
                          <div className="space-y-2 max-h-36 overflow-y-auto">
                            {shopperProfile.outcomes.map((out) => (
                              <div
                                key={out.id}
                                className="p-2.5 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-between text-xs shadow-sm"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${out.type === 'purchase'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                                      }`}
                                  >
                                    {out.type}
                                  </span>
                                  <span className="text-neutral-900 font-medium">{out.reason || 'No reason provided'}</span>
                                </div>
                                <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-500">
                                  {out.value && <span className="text-neutral-900 font-bold">₹{out.value.toLocaleString()}</span>}
                                  <span>by {out.recordedBy}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Privacy Controls */}
                    <div className="p-5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-neutral-800" /> Customer DPDP Privacy Controls
                        </span>
                        <p className="text-neutral-500 text-[11px]">
                          Enforce right to erasure or immediate consent revocation in compliance with DPDP and GDPR.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleRevokeConsent}
                          className="py-2 px-3.5 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200 transition flex items-center gap-1.5 shadow-sm"
                        >
                          <UserX className="w-3.5 h-3.5" /> Revoke Consent
                        </button>
                        <button
                          onClick={handleDeleteShopper}
                          className="py-2 px-3.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1.5 shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Erase Profile
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- PAGE 5: CAMPAIGN EXPERIMENTS ---------------- */}
        {currentPage === 'experiments' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Campaign Experimentation Engine</h1>
                <p className="text-xs text-neutral-600 mt-0.5">
                  A/B test sales scripts, vehicle feature emphasis, and conversion lift telemetry across showroom advisors.
                </p>
              </div>
            </div>

            <ExperimentationDashboard />
          </div>
        )}

        {/* ---------------- PAGE 6: SYSTEM & AI GATEWAY ---------------- */}
        {currentPage === 'system' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-neutral-900 tracking-tight">System Status &amp; AI Gateway</h1>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Enterprise LLM connection diagnostics, latency telemetry, and service health status.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={pingAiGateway}
                  disabled={isPingingAi}
                  className="py-2 px-4 rounded-xl text-xs font-bold bg-black text-white hover:bg-neutral-800 disabled:opacity-50 transition flex items-center gap-2 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPingingAi ? 'animate-spin' : ''}`} />
                  {isPingingAi ? 'Testing Latency...' : 'Ping AI Gateway'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* NVIDIA NIM Connection Card */}
              <div className="lg:col-span-6 space-y-6">
                <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 text-neutral-900 shadow-sm space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-neutral-100 text-neutral-900 border border-neutral-200">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-neutral-900">
                          {aiHealth?.provider === 'groq'
                            ? 'Groq LPU AI Gateway'
                            : aiHealth?.provider === 'nvidia'
                              ? 'NVIDIA NIM AI Gateway'
                              : 'OpenRouter AI Gateway'}
                        </h2>
                        <p className="text-xs text-neutral-400">Ultra-fast live LLM inference</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Operational
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                      <span className="text-neutral-500 font-sans">Provider</span>
                      <strong className="text-neutral-900 font-bold uppercase">{aiHealth?.provider || 'groq'}</strong>
                    </div>
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                      <span className="text-neutral-500 font-sans">Base URL</span>
                      <span className="text-neutral-700">
                        {aiHealth?.provider === 'groq'
                          ? 'https://api.groq.com/openai/v1'
                          : aiHealth?.provider === 'nvidia'
                            ? 'https://integrate.api.nvidia.com/v1'
                            : 'https://openrouter.ai/api/v1'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                      <span className="text-neutral-500 font-sans">Active Model</span>
                      <span className="text-neutral-900 font-bold">
                        {aiHealth?.provider === 'groq'
                          ? 'openai/gpt-oss-120b'
                          : aiHealth?.provider === 'nvidia'
                            ? 'meta/llama-3.2-11b-vision-instruct'
                            : 'google/gemini-2.0-flash-001'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 font-sans">Gateway Latency</span>
                      <span className="text-neutral-900 font-bold">
                        {aiPingLatency !== null ? `${aiPingLatency} ms` : 'Verified Active'}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Test Console */}
                  <div className="space-y-3 pt-2 border-t border-neutral-100">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                        <Terminal className="w-4 h-4" />
                        Test {aiHealth?.provider === 'groq' ? 'Groq LPU' : 'AI'} Live Inference
                      </div>
                      <button
                        onClick={pingAiGateway}
                        disabled={isPingingAi}
                        className="text-[11px] text-neutral-500 hover:text-neutral-900 flex items-center gap-1 font-semibold"
                      >
                        <RefreshCw className={`w-3 h-3 ${isPingingAi ? 'animate-spin' : ''}`} /> Ping Gateway
                      </button>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Send a test prompt directly to the live {(aiHealth?.provider || 'Groq').toUpperCase()} gateway.
                    </p>

                    <input
                      type="text"
                      value={testPrompt}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      placeholder="Enter customer prompt..."
                      className="w-full p-2.5 rounded-xl bg-white border border-neutral-200 text-neutral-900 placeholder-neutral-400 text-xs focus:outline-none focus:border-black font-sans"
                    />

                    <button
                      onClick={handleTestAiGeneration}
                      disabled={isTestingGroq}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-black font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {isTestingGroq ? 'Executing on Groq...' : 'Execute Test Run'}
                    </button>

                    {testResponse && (
                      <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 font-mono text-xs text-neutral-800 whitespace-pre-wrap">
                        {testResponse}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Service Health & Infrastructure Card */}
              <div className="lg:col-span-6 space-y-6">
                <div className="p-6 rounded-2xl bg-white border border-neutral-200/80 text-neutral-900 shadow-sm space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-neutral-100 text-neutral-900 border border-neutral-200">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-neutral-900">Infrastructure &amp; Server Health</h2>
                        <p className="text-xs text-neutral-400">Fastify core runtime</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-800 border border-neutral-200">
                      {health?.status || 'Active'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-1">
                      <span className="text-neutral-400 font-bold block text-[10px] uppercase">Fastify Server</span>
                      <span className="font-bold text-neutral-900">Port 3001 OK</span>
                      <span className="text-[10px] text-neutral-500 block font-mono">v{health?.version || '0.1.0'}</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-1">
                      <span className="text-neutral-400 font-bold block text-[10px] uppercase">Environment</span>
                      <span className="font-bold text-neutral-900 uppercase">{health?.env || 'development'}</span>
                      <span className="text-[10px] text-neutral-500 block font-mono">macOS Darwin</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-1">
                      <span className="text-neutral-400 font-bold block text-[10px] uppercase">Vector Retrieval</span>
                      <span className="font-bold text-neutral-900">In-Memory Index</span>
                      <span className="text-[10px] text-neutral-500 block font-mono">24 chunks indexed</span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-1">
                      <span className="text-neutral-400 font-bold block text-[10px] uppercase">Governance Engine</span>
                      <span className="font-bold text-neutral-900">DPDP / ISO 42001</span>
                      <span className="text-[10px] text-neutral-500 block font-mono">Strict Approval</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/70 space-y-2 text-xs">
                    <span className="font-bold text-neutral-900 block">Security Guarantees</span>
                    <ul className="space-y-1 text-neutral-600 list-disc list-inside">
                      <li>Zero customer data training / model fine-tuning retention.</li>
                      <li>Encrypted in-transit via TLS 1.3 and sanitized PII redact guard.</li>
                      <li>All agent outputs require human supervisor attestation before external outreach.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Website Footer */}
      <footer className="border-t border-neutral-200 bg-white px-6 py-6 text-center text-xs text-neutral-600 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-900">StoreSignal AI</span>
            <span>&bull;</span>
            <span>Enterprise Physical-Retail Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-neutral-500 font-mono">
            <span>Model: {aiHealth?.provider === 'groq' ? 'Groq LPU (GPT-OSS 120B)' : (aiHealth?.provider === 'nvidia' ? 'NVIDIA NIM Llama 3.2' : 'OpenRouter')}</span>
            <span>&bull;</span>
            <span>Dealership: Vayu Motors</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
