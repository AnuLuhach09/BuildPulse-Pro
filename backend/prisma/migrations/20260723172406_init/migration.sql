-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DEVELOPER', 'VIEWER');

-- CreateEnum
CREATE TYPE "RepoRole" AS ENUM ('OWNER', 'MAINTAINER', 'DEVELOPER', 'VIEWER');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'WAITING');

-- CreateEnum
CREATE TYPE "Conclusion" AS ENUM ('SUCCESS', 'FAILURE', 'CANCELLED', 'SKIPPED', 'TIMED_OUT', 'NEUTRAL', 'ACTION_REQUIRED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED', 'INACTIVE', 'DESTROYED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "githubId" TEXT,
    "githubLogin" TEXT,
    "role" "Role" NOT NULL DEFAULT 'DEVELOPER',
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "webhookId" INTEGER,
    "webhookSecret" TEXT NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "language" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_members" (
    "userId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "role" "RepoRole" NOT NULL DEFAULT 'VIEWER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repository_members_pkey" PRIMARY KEY ("userId","repositoryId")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "githubWorkflowId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_runs" (
    "id" TEXT NOT NULL,
    "githubRunId" BIGINT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "triggeredById" TEXT,
    "branch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "commitMessage" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'push',
    "status" "RunStatus" NOT NULL,
    "conclusion" "Conclusion",
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "htmlUrl" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_jobs" (
    "id" TEXT NOT NULL,
    "githubJobId" BIGINT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "runnerId" INTEGER,
    "runnerName" TEXT,
    "status" "RunStatus" NOT NULL,
    "conclusion" "Conclusion",
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "build_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_steps" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "RunStatus" NOT NULL,
    "conclusion" "Conclusion",
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "build_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_logs" (
    "id" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "jobId" TEXT,
    "content" TEXT NOT NULL,
    "lineNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "build_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "failureReason" TEXT NOT NULL,
    "suggestedFix" TEXT NOT NULL,
    "affectedFiles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "promptTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL,
    "version" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "commitMessage" TEXT,
    "deployedBy" TEXT,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rollbackOf" TEXT,
    "metadata" JSONB,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_prefs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "slackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "slackWebhook" TEXT,
    "onFailure" BOOLEAN NOT NULL DEFAULT true,
    "onSuccess" BOOLEAN NOT NULL DEFAULT false,
    "onDeploy" BOOLEAN NOT NULL DEFAULT true,
    "onRecovery" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "repositoryId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_githubId_key" ON "repositories"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_fullName_key" ON "repositories"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_githubWorkflowId_repositoryId_key" ON "pipelines"("githubWorkflowId", "repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_runs_githubRunId_key" ON "pipeline_runs"("githubRunId");

-- CreateIndex
CREATE INDEX "pipeline_runs_pipelineId_idx" ON "pipeline_runs"("pipelineId");

-- CreateIndex
CREATE INDEX "pipeline_runs_branch_idx" ON "pipeline_runs"("branch");

-- CreateIndex
CREATE INDEX "pipeline_runs_status_idx" ON "pipeline_runs"("status");

-- CreateIndex
CREATE INDEX "pipeline_runs_createdAt_idx" ON "pipeline_runs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "build_jobs_githubJobId_key" ON "build_jobs"("githubJobId");

-- CreateIndex
CREATE INDEX "build_jobs_pipelineRunId_idx" ON "build_jobs"("pipelineRunId");

-- CreateIndex
CREATE INDEX "build_steps_jobId_idx" ON "build_steps"("jobId");

-- CreateIndex
CREATE INDEX "build_logs_pipelineRunId_idx" ON "build_logs"("pipelineRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_analyses_pipelineRunId_key" ON "ai_analyses"("pipelineRunId");

-- CreateIndex
CREATE INDEX "deployments_repositoryId_idx" ON "deployments"("repositoryId");

-- CreateIndex
CREATE INDEX "deployments_environment_idx" ON "deployments"("environment");

-- CreateIndex
CREATE INDEX "deployments_deployedAt_idx" ON "deployments"("deployedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_prefs_userId_key" ON "notification_prefs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_members" ADD CONSTRAINT "repository_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_members" ADD CONSTRAINT "repository_members_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_jobs" ADD CONSTRAINT "build_jobs_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_steps" ADD CONSTRAINT "build_steps_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "build_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build_logs" ADD CONSTRAINT "build_logs_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
