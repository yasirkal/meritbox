-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('UNIVERSITY', 'TAFE', 'RTO', 'PROFESSIONAL_BODY', 'EMPLOYER', 'OTHER');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'ISSUER', 'VIEWER');

-- CreateEnum
CREATE TYPE "KeyAlg" AS ENUM ('RS256', 'EdDSA');

-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "AchievementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('LINK', 'PRIVATE');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrgType" NOT NULL DEFAULT 'OTHER',
    "abn" TEXT,
    "rtoCode" TEXT,
    "cricosCode" TEXT,
    "teqsaId" TEXT,
    "website" TEXT,
    "email" TEXT,
    "description" TEXT,
    "brandColor" TEXT NOT NULL DEFAULT '#0f4c81',
    "requireMfa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "totpSecretEnc" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "activeOrgId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "alg" "KeyAlg" NOT NULL,
    "publicJwk" JSONB NOT NULL,
    "encryptedPrivateJwk" TEXT NOT NULL,
    "status" "KeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "SigningKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "achievementType" TEXT NOT NULL DEFAULT 'MicroCredential',
    "status" "AchievementStatus" NOT NULL DEFAULT 'DRAFT',
    "volumeOfLearningHours" INTEGER,
    "aqfLevel" INTEGER,
    "assessmentType" TEXT,
    "deliveryMode" TEXT,
    "creditRecognition" TEXT,
    "industryEndorsement" TEXT,
    "creditPoints" DECIMAL(6,2),
    "tgaCode" TEXT,
    "tgaTitle" TEXT,
    "fieldOfStudy" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "badgeShape" TEXT NOT NULL DEFAULT 'hexagon',
    "badgeColor" TEXT NOT NULL DEFAULT '#0f4c81',
    "badgeAccent" TEXT NOT NULL DEFAULT '#f2a900',
    "badgeIcon" TEXT NOT NULL DEFAULT 'star',
    "expiresAfterDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "usiEnc" TEXT,
    "usiIndex" TEXT,
    "studentId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "jwt" TEXT NOT NULL,
    "statusListId" TEXT NOT NULL,
    "statusListIndex" INTEGER NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'LINK',
    "claimedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "evidenceUrl" TEXT,
    "narrative" TEXT,
    "batchId" TEXT,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusList" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'revocation',
    "size" INTEGER NOT NULL DEFAULT 131072,
    "bits" BYTEA NOT NULL,
    "nextIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssuanceBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "createdById" TEXT,
    "source" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssuanceBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pathway" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rewardAchievementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathwayStep" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PathwayStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorUserId" TEXT,
    "actorApiKeyId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "ip" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationEvent" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT,
    "method" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "OutboxEmail" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TgaComponent" (
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "TgaComponent_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LoginToken_tokenHash_key" ON "LoginToken"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginToken_email_idx" ON "LoginToken"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SigningKey_organizationId_kid_key" ON "SigningKey"("organizationId", "kid");

-- CreateIndex
CREATE INDEX "Achievement_organizationId_idx" ON "Achievement"("organizationId");

-- CreateIndex
CREATE INDEX "Credential_organizationId_issuedAt_idx" ON "Credential"("organizationId", "issuedAt");

-- CreateIndex
CREATE INDEX "Credential_recipientEmail_idx" ON "Credential"("recipientEmail");

-- CreateIndex
CREATE INDEX "Credential_usiIndex_idx" ON "Credential"("usiIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_statusListId_statusListIndex_key" ON "Credential"("statusListId", "statusListIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PathwayStep_pathwayId_achievementId_key" ON "PathwayStep"("pathwayId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationEvent_credentialId_idx" ON "VerificationEvent"("credentialId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningKey" ADD CONSTRAINT "SigningKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_statusListId_fkey" FOREIGN KEY ("statusListId") REFERENCES "StatusList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IssuanceBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusList" ADD CONSTRAINT "StatusList_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuanceBatch" ADD CONSTRAINT "IssuanceBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pathway" ADD CONSTRAINT "Pathway_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pathway" ADD CONSTRAINT "Pathway_rewardAchievementId_fkey" FOREIGN KEY ("rewardAchievementId") REFERENCES "Achievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayStep" ADD CONSTRAINT "PathwayStep_pathwayId_fkey" FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayStep" ADD CONSTRAINT "PathwayStep_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
