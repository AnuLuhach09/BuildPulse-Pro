import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pipelinesApi, BuildJob, BuildStep } from '@/api/pipelines.api';
import { useSocket } from '@/hooks/useSocket';
import {
  ArrowLeft,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  Cpu,
  GitBranch,
  Terminal,
  Brain,
  AlertTriangle,
  FileCode,
  ThumbsUp,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function PipelineDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // States
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulateStep, setSimulateStep] = useState(0);

  const handleSimulateFix = async () => {
    setIsSimulating(true);
    setSimulateStep(0);

    const t1 = setTimeout(() => setSimulateStep(1), 1000);
    const t2 = setTimeout(() => setSimulateStep(2), 2200);
    const t3 = setTimeout(() => setSimulateStep(3), 3500);

    try {
      await pipelinesApi.simulateFix(id!);
      
      setTimeout(() => {
        setIsSimulating(false);
        setShowSimulateModal(false);
        toast.success('AI Autopilot patch successfully pushed! Rerun triggered.');
        refetch();
        setSelectedJobId(null);
        setLogs('');
      }, 4800);
    } catch (e) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setIsSimulating(false);
      toast.error('Simulation failed to trigger.');
    }
  };

  // Query Details
  const { data: run, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['pipeline-run', id],
    queryFn: () => pipelinesApi.getRunById(id!),
    enabled: !!id,
  });

  // Fetch initial logs for the run
  const fetchLogs = async () => {
    setIsLogsLoading(true);
    try {
      const logsData = await pipelinesApi.getLogs(id!);
      if (logsData && logsData.length > 0) {
        setLogs(logsData.map((l: any) => l.content).join('\n'));
      } else {
        setLogs('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchLogs();
    }
  }, [id]);

  // Real-time socket updates for details and logs
  useEffect(() => {
    if (!id || !socket.isConnected) return;

    // Join the specific pipeline run room
    socket.joinRun(id);

    // Join the repo room for run status changes
    if (run?.pipeline?.repository?.id) {
      socket.joinRepo(run.pipeline.repository.id);
    }

    // Listen to log chunks (Milestone 10: live log streaming)
    socket.on('log:chunk', (chunk: { content: string }) => {
      setLogs((prev) => prev + '\n' + chunk.content);
      // Auto scroll to bottom
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    // Listen to status updates
    socket.on('pipeline:update', (updatedRun: any) => {
      if (updatedRun.id === id) {
        queryClient.setQueryData(['pipeline-run', id], (old: any) => {
          if (!old) return old;
          return { ...old, ...updatedRun };
        });
        // If status completed, refetch to fetch final logs/AI analysis
        if (updatedRun.status === 'COMPLETED') {
          queryClient.invalidateQueries({ queryKey: ['pipeline-run', id] });
          fetchLogs();
        }
      }
    });

    return () => {
      socket.leaveRun(id);
      if (run?.pipeline?.repository?.id) {
        socket.leaveRepo(run.pipeline.repository.id);
      }
      socket.off('log:chunk');
      socket.off('pipeline:update');
    };
  }, [id, socket.isConnected, run?.pipeline?.repository?.id, queryClient]);

  const toggleJob = (jobId: string) => {
    setExpandedJobs((prev) => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  const getStatusIcon = (status: string, conclusion?: string) => {
    if (status === 'QUEUED') return <Clock className="w-4 h-4 text-warning-500 animate-pulse" />;
    if (status === 'IN_PROGRESS') return <Play className="w-4 h-4 text-brand-400 animate-spin" />;
    if (conclusion === 'SUCCESS') return <CheckCircle2 className="w-4 h-4 text-success-500" />;
    if (conclusion === 'FAILURE') return <XCircle className="w-4 h-4 text-danger-500" />;
    return <Clock className="w-4 h-4 text-dark-300" />;
  };

  const getStatusClass = (status: string, conclusion?: string) => {
    if (status === 'QUEUED') return 'status-queued';
    if (status === 'IN_PROGRESS') return 'status-running';
    if (conclusion === 'SUCCESS') return 'status-success';
    if (conclusion === 'FAILURE') return 'status-failure';
    return 'status-cancelled';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 flex-col gap-4">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        <span className="text-sm text-dark-300">Loading run metrics...</span>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="glass-card p-12 text-center max-w-xl mx-auto space-y-4">
        <AlertTriangle className="w-12 h-12 text-danger-500 mx-auto" />
        <h3 className="text-lg font-semibold text-white">Pipeline Run Not Found</h3>
        <p className="text-sm text-dark-300">
          The pipeline run does not exist or you do not have permission to view it.
        </p>
        <Link to="/pipelines" className="btn-primary inline-flex">
          Back to Pipelines
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back nav & Actions */}
      <div className="flex items-center justify-between">
        <Link to="/pipelines" className="flex items-center gap-2 text-xs font-semibold text-dark-300 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Pipelines
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="btn-ghost"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <a
            href={run.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            Open in GitHub
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Stats Header */}
      <div className={`glass-card p-6 border-l-4 ${
        run.status === 'QUEUED' ? 'border-l-warning-500' :
        run.status === 'IN_PROGRESS' ? 'border-l-brand-500' :
        run.conclusion === 'SUCCESS' ? 'border-l-success-500 border-glow-success' :
        'border-l-danger-500 border-glow-danger'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`status-badge ${getStatusClass(run.status, run.conclusion)}`}>
                {getStatusIcon(run.status, run.conclusion)}
                {run.conclusion || run.status}
              </span>
              <h1 className="text-xl font-bold text-white leading-none">{run.pipeline.name}</h1>
            </div>
            
            <p className="text-sm font-medium text-white">{run.commitMessage || 'No commit message'}</p>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-dark-300">
              <span className="flex items-center gap-1">
                <GitBranch className="w-3.5 h-3.5" />
                {run.branch}
              </span>
              <span className="font-mono text-dark-400">{run.commitSha}</span>
              <span>•</span>
              <span>{run.pipeline.repository.fullName}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 border-t lg:border-t-0 border-white/[0.06] pt-4 lg:pt-0">
            {run.durationMs && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-dark-300 tracking-wider">Duration</p>
                <p className="text-sm font-bold text-white mt-0.5">
                  {Math.floor(run.durationMs / 1000 / 60)}m {Math.floor((run.durationMs / 1000) % 60)}s
                </p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase font-semibold text-dark-300 tracking-wider">Run Date</p>
              <p className="text-sm font-medium text-white mt-0.5" title={new Date(run.createdAt).toLocaleString()}>
                {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
              </p>
            </div>
            {run.triggeredBy && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-dark-300 tracking-wider">Author</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {run.triggeredBy.avatarUrl ? (
                    <img src={run.triggeredBy.avatarUrl} className="w-5 h-5 rounded-full" />
                  ) : (
                    <Cpu className="w-4 h-4 text-dark-300" />
                  )}
                  <span className="text-sm font-semibold text-white">{run.triggeredBy.name}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Timeline Jobs Tree & AI failures */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Timeline and Log */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Jobs Timeline Tree */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-brand-400" />
              Build Jobs & Steps Timeline
            </h3>

            {run.jobs.length === 0 ? (
              <p className="text-xs text-dark-300">No jobs registered for this run yet.</p>
            ) : (
              <div className="space-y-3">
                {run.jobs.map((job: BuildJob) => {
                  const isExpanded = expandedJobs[job.id];
                  return (
                    <div key={job.id} className="border border-white/[0.06] rounded-lg overflow-hidden bg-dark-800/40">
                      {/* Job Row */}
                      <div
                        onClick={() => toggleJob(job.id)}
                        className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {getStatusIcon(job.status, job.conclusion)}
                          <span className="text-xs font-semibold text-white truncate">{job.name}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {job.durationMs && (
                            <span className="text-[11px] text-dark-300 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {Math.floor(job.durationMs / 1000 / 60)}m {Math.floor((job.durationMs / 1000) % 60)}s
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-dark-300" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-dark-300" />
                          )}
                        </div>
                      </div>

                      {/* Steps List */}
                      {isExpanded && (
                        <div className="px-4 pb-3 pt-1 border-t border-white/[0.04] bg-dark-900/20 divide-y divide-white/[0.03]">
                          {job.steps.length === 0 ? (
                            <p className="text-[11px] text-dark-400 py-1.5">No steps reported for this job.</p>
                          ) : (
                            job.steps.map((step: BuildStep) => (
                              <div key={step.id} className="flex items-center justify-between py-2 text-[11px]">
                                <div className="flex items-center gap-2 min-w-0">
                                  {getStatusIcon(step.status, step.conclusion)}
                                  <span className="text-dark-300 font-medium truncate">{step.name}</span>
                                </div>
                                {step.startedAt && step.completedAt && (
                                  <span className="text-dark-400 font-mono">
                                    {Math.round((new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 1000)}s
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Build Log Streams */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-brand-400" />
                Live Build Logs
              </h3>
              {run.status === 'IN_PROGRESS' && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success-500/10 border border-success-500/20">
                  <span className="live-dot" />
                  <span className="text-[10px] text-success-500 font-semibold tracking-wide uppercase">Streaming</span>
                </div>
              )}
            </div>

            <div className="log-viewer h-96 relative">
              {isLogsLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-dark-900/60">
                  <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                </div>
              ) : logs ? (
                <pre className="text-[11px] text-dark-300 font-mono leading-relaxed whitespace-pre-wrap">
                  {logs}
                  <div ref={logEndRef} />
                </pre>
              ) : (
                <div className="text-center py-24 text-xs text-dark-300">
                  No logs available for this build run.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: AI failure insights */}
        <div className="xl:col-span-1">
          
          {/* AI failure explainer */}
          {run.conclusion === 'FAILURE' && (
            <div className="glass-card p-6 border border-brand-500/20 shadow-glow space-y-5 bg-gradient-to-b from-dark-800 to-dark-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                  <Brain className="w-4.5 h-4.5 text-brand-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-none">AI Failure Explainer</h3>
                  <span className="text-[10px] text-brand-400 font-medium">Llama-3.3 failure insights</span>
                </div>
              </div>

              {!run.aiAnalysis ? (
                <div className="py-6 text-center space-y-2">
                  <Loader2 className="w-6 h-6 text-brand-500 animate-spin mx-auto" />
                  <p className="text-xs text-dark-300">Generating intelligent failure fix suggestion...</p>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in text-xs">
                  {/* Failure Reason */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] uppercase tracking-wider font-semibold text-danger-500">Root Cause</h4>
                    <p className="text-dark-300 leading-relaxed bg-danger-500/5 p-3 border border-danger-500/10 rounded-lg">
                      {run.aiAnalysis.failureReason}
                    </p>
                  </div>

                  {/* Suggested Fix */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] uppercase tracking-wider font-semibold text-brand-400">Suggested Action</h4>
                    <p className="text-dark-300 leading-relaxed bg-brand-500/5 p-3 border border-brand-500/10 rounded-lg">
                      {run.aiAnalysis.suggestedFix}
                    </p>
                  </div>

                  {/* Affected Files */}
                  {run.aiAnalysis.affectedFiles?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] uppercase tracking-wider font-semibold text-dark-300">Identified Files</h4>
                      <div className="space-y-1">
                        {run.aiAnalysis.affectedFiles.map((file: string) => (
                          <div key={file} className="flex items-center gap-1.5 bg-dark-900/60 p-2 rounded border border-white/[0.04] font-mono text-[10px]">
                            <FileCode className="w-3.5 h-3.5 text-brand-400" />
                            <span className="text-white truncate">{file}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence Score */}
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 text-[10px]">
                    <span className="text-dark-300">Confidence Match</span>
                    <span className="text-brand-400 font-bold font-mono">{(run.aiAnalysis.confidence * 100).toFixed(0)}%</span>
                  </div>

                  {/* Simulate Fix Button */}
                  <button
                    onClick={() => setShowSimulateModal(true)}
                    className="w-full btn-primary justify-center text-[10px] uppercase font-bold tracking-wider py-2 bg-gradient-brand hover:opacity-90 transition-all gap-1.5 mt-2 shadow-glow"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Simulate AI Autopilot Fix
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Simulation Autopilot Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass-card w-full max-w-2xl overflow-hidden border border-white/10 shadow-glow-indigo flex flex-col max-h-[90vh] text-left">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-brand-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Autopilot Code Diff Simulator</h3>
              </div>
              <button 
                onClick={() => !isSimulating && setShowSimulateModal(false)}
                disabled={isSimulating}
                className="text-dark-300 hover:text-white transition-colors disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {!isSimulating ? (
                <>
                  <p className="text-dark-300 leading-relaxed">
                    BuildPulse Pro AI has analyzed the failure and prepared a code patch for the identified files:
                  </p>

                  <div className="bg-dark-900/80 p-3 rounded-lg border border-white/[0.04]">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-brand-400 mb-2">
                      <FileCode className="w-3.5 h-3.5" />
                      <span>{run?.aiAnalysis?.affectedFiles?.[0] || 'src/modules/webhooks/webhook.middleware.ts'}</span>
                    </div>

                    {/* Diff viewer */}
                    <div className="font-mono text-[10px] leading-relaxed p-4 bg-dark-950/80 rounded border border-white/5 space-y-1">
                      <div className="text-dark-400">@@ -82,9 +82,15 @@ calculatedSig</div>
                      <div className="bg-red-500/10 text-red-400 px-1 py-0.5 rounded">-   const verifySignature = crypto.timingSafeEqual(headerSig, calculatedSig);</div>
                      <div className="bg-red-500/10 text-red-400 px-1 py-0.5 rounded">-   if (!verifySignature) &#123;</div>
                      <div className="bg-red-500/10 text-red-400 px-1 py-0.5 rounded">-     throw new Error('Invalid signature');</div>
                      <div className="bg-red-500/10 text-red-400 px-1 py-0.5 rounded">-   &#125;</div>
                      <div className="bg-green-500/10 text-green-400 px-1 py-0.5 rounded">+   // Skip signature check in development mode to support ngrok</div>
                      <div className="bg-green-500/10 text-green-400 px-1 py-0.5 rounded">+   if (process.env.NODE_ENV === 'development') &#123;</div>
                      <div className="bg-green-500/10 text-green-400 px-1 py-0.5 rounded">+     logger.warn('Skipping webhook signature verification in dev environment');</div>
                      <div className="bg-green-500/10 text-green-400 px-1 py-0.5 rounded">+     return true;</div>
                      <div className="bg-green-500/10 text-green-400 px-1 py-0.5 rounded">+   &#125;</div>
                      <div className="bg-green-500/10 text-green-400 px-1 py-0.5 rounded">+   const verifySignature = crypto.timingSafeEqual(headerSig, calculatedSig);</div>
                    </div>
                  </div>

                  <div className="bg-brand-500/5 p-4 border border-brand-500/20 rounded-lg text-brand-400 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5 text-[11px]">
                      <Zap className="w-3.5 h-3.5" />
                      What happens next?
                    </p>
                    <p className="text-dark-300 text-[10px] leading-relaxed">
                      BuildPulse Autopilot will push a simulated branch commit directly to your database, clear the failing build logs, and trigger a self-healing build simulation. You will watch the pipeline status update and output logs in real-time.
                    </p>
                  </div>
                </>
              ) : (
                <div className="py-8 space-y-6 flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
                  
                  {/* Simulation timeline */}
                  <div className="w-full max-w-sm space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                        simulateStep >= 0 ? "bg-success-500 text-white" : "bg-dark-600 text-dark-300"
                      )}>
                        {simulateStep > 0 ? "✓" : "1"}
                      </span>
                      <span className={clsx("font-medium", simulateStep >= 0 ? "text-white" : "text-dark-300")}>
                        Applying suggested codebase patch...
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                        simulateStep >= 1 ? "bg-success-500 text-white" : "bg-dark-600 text-dark-300"
                      )}>
                        {simulateStep > 1 ? "✓" : "2"}
                      </span>
                      <span className={clsx("font-medium", simulateStep >= 1 ? "text-white" : "text-dark-300")}>
                        Pushing patch branch `buildpulse-bot/fix`...
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                        simulateStep >= 2 ? "bg-success-500 text-white" : "bg-dark-600 text-dark-300"
                      )}>
                        {simulateStep > 2 ? "✓" : "3"}
                      </span>
                      <span className={clsx("font-medium", simulateStep >= 2 ? "text-white" : "text-dark-300")}>
                        Triggering pipeline build run...
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                        simulateStep >= 3 ? "bg-brand-500 text-white animate-pulse" : "bg-dark-600 text-dark-300"
                      )}>
                        4
                      </span>
                      <span className={clsx("font-medium", simulateStep >= 3 ? "text-brand-400" : "text-dark-300")}>
                        Verifying build and integration test suites...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] bg-dark-900/30 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSimulateModal(false)}
                disabled={isSimulating}
                className="btn-ghost text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSimulateFix}
                disabled={isSimulating}
                className="btn-primary text-xs px-4 py-2 bg-gradient-brand hover:opacity-90 font-bold"
              >
                {isSimulating ? 'Processing...' : 'Apply Patch & Commit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
