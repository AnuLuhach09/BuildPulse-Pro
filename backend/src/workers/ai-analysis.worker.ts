import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { createBullMQConnection } from '../config/redis';
import prisma from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { AIAnalysisJobData } from '../queues/notification.queue';

/**
 * AI Analysis Worker — powered by Groq (Llama 3.3 70B)
 *
 * WHY Groq over OpenAI:
 * - Groq's inference hardware (LPUs) delivers sub-second latency —
 *   typical response in 200-500ms vs 2-5s for OpenAI
 * - Llama 3.3 70B is open-weights, so no vendor lock-in
 * - Groq's API is 100% OpenAI-compatible — same JSON structure
 * - Free tier supports development without credit card
 *
 * WHY a separate queue/worker:
 * AI calls can take up to 10 seconds. Running this inline in the
 * webhook handler would block job processing and slow down the queue.
 * A dedicated ai-analysis queue with lower concurrency prevents
 * API rate limit issues on Groq's side.
 */
export const createAIAnalysisWorker = () => {
  const worker = new Worker<AIAnalysisJobData>(
    'ai-analysis',
    async (job: Job<AIAnalysisJobData>) => {
      const { pipelineRunId, repositoryId, workflowName, branch } = job.data;

      if (!env.GROQ_API_KEY) {
        logger.warn('[AIWorker] GROQ_API_KEY not set — skipping AI analysis');
        return;
      }

      // Check if analysis already exists
      const existing = await prisma.aIAnalysis.findUnique({
        where: { pipelineRunId },
      });
      if (existing) {
        logger.info(`[AIWorker] Analysis already exists for run: ${pipelineRunId}`);
        return;
      }

      // Fetch the build logs for the failed run
      const logs = await fetchFailureLogs(pipelineRunId);
      if (!logs) {
        logger.warn(`[AIWorker] No logs found for run: ${pipelineRunId}`);
        return;
      }

      // Truncate logs to fit within context window
      // Groq Llama 3.3 70B has 128k context — we use 8k chars of logs
      const truncatedLogs = logs.slice(0, 8_000);

      logger.info(`[AIWorker] Analyzing failure for run: ${pipelineRunId} (${truncatedLogs.length} chars)`);

      const prompt = buildFailureAnalysisPrompt({
        logs: truncatedLogs,
        workflowName,
        branch,
      });

      // Call Groq API (OpenAI-compatible endpoint)
      const response = await axios.post(
        `${env.GROQ_BASE_URL}/chat/completions`,
        {
          model: env.GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are a senior DevOps engineer analyzing CI/CD build failures.
You provide concise, actionable failure analysis in JSON format.
Always respond with valid JSON only, no markdown or explanation outside the JSON.`,
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,    // Low temperature for deterministic analysis
          max_tokens: 1024,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        }
      );

      const rawContent = response.data.choices?.[0]?.message?.content;
      const usage = response.data.usage;

      let analysis: {
        failureReason: string;
        suggestedFix: string;
        affectedFiles: string[];
        confidence: number;
      };

      try {
        analysis = JSON.parse(rawContent);
      } catch {
        logger.error('[AIWorker] Failed to parse Groq response as JSON', { rawContent });
        throw new Error('Invalid JSON response from Groq');
      }

      // Persist the analysis
      await prisma.aIAnalysis.create({
        data: {
          pipelineRunId,
          failureReason: analysis.failureReason ?? 'Unknown failure reason',
          suggestedFix: analysis.suggestedFix ?? 'No suggestion available',
          affectedFiles: analysis.affectedFiles ?? [],
          confidence: Math.min(1, Math.max(0, analysis.confidence ?? 0.5)),
          model: env.GROQ_MODEL,
          promptTokens: usage?.total_tokens ?? null,
        },
      });

      logger.info(`[AIWorker] ✅ Analysis saved for run: ${pipelineRunId}, tokens used: ${usage?.total_tokens}`);
    },
    {
      connection: createBullMQConnection(),
      concurrency: 2, // Low concurrency to respect Groq rate limits
    }
  );

  worker.on('failed', (job, err) =>
    logger.error(`[AIWorker] Job ${job?.id} failed`, { err: err.message })
  );
  worker.on('error', (err) => logger.error('[AIWorker] Error', { err }));

  logger.info('[AIWorker] Started — using Groq model: ' + env.GROQ_MODEL);
  return worker;
};

// =============================================================================
// HELPERS
// =============================================================================

async function fetchFailureLogs(pipelineRunId: string): Promise<string | null> {
  const logs = await prisma.buildLog.findMany({
    where: { pipelineRunId },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  if (logs.length > 0) {
    return logs.map((l) => l.content).join('\n');
  }

  // If no stored logs, return a summary from the failed jobs
  const jobs = await prisma.buildJob.findMany({
    where: { pipelineRunId, conclusion: 'FAILURE' },
    include: { steps: { where: { conclusion: 'FAILURE' } } },
    take: 5,
  });

  if (jobs.length === 0) return null;

  return jobs
    .map((j) => {
      const failedSteps = j.steps.map((s) => `  - Step "${s.name}" failed`).join('\n');
      return `Job "${j.name}" failed:\n${failedSteps || '  (no step details)'}`;
    })
    .join('\n\n');
}

function buildFailureAnalysisPrompt(args: {
  logs: string;
  workflowName: string;
  branch: string;
}) {
  return `Analyze this CI/CD build failure and respond with a JSON object.

**Workflow**: ${args.workflowName}
**Branch**: ${args.branch}

**Build Logs**:
\`\`\`
${args.logs}
\`\`\`

Respond with exactly this JSON structure:
{
  "failureReason": "One clear sentence describing the root cause",
  "suggestedFix": "Specific actionable steps to fix this (2-4 sentences)",
  "affectedFiles": ["list", "of", "file", "paths", "if", "identifiable"],
  "confidence": 0.85
}

Confidence should be 0.0-1.0 based on how clearly the logs identify the issue.`;
}
