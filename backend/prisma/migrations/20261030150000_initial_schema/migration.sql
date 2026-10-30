-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('PERSONAL', 'SHARED');

-- CreateEnum
CREATE TYPE "LedgerMemberRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "LedgerMemberStatus" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED', 'DECLINED');

-- CreateEnum
CREATE TYPE "AccountVisibility" AS ENUM ('SHARED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'IMPORT', 'RECURRING', 'OFFLINE_SYNC');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('EXPENSE', 'INCOME');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nickname" TEXT,
    "email" TEXT,
    "avatar" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL DEFAULT 'PERSONAL',
    "creator_id" TEXT NOT NULL,
    "default_currency" TEXT NOT NULL DEFAULT 'CNY',
    "icon" TEXT,
    "color" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_member" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "LedgerMemberRole" NOT NULL DEFAULT 'VIEWER',
    "status" "LedgerMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3),

    CONSTRAINT "ledger_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_invitation" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "inviter_id" TEXT NOT NULL,
    "target_email" TEXT,
    "token" TEXT NOT NULL,
    "role" "LedgerMemberRole" NOT NULL DEFAULT 'EDITOR',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visibility" "AccountVisibility" NOT NULL DEFAULT 'SHARED',
    "initial_balance_cents" INTEGER NOT NULL DEFAULT 0,
    "current_balance_cents" INTEGER NOT NULL DEFAULT 0,
    "include_in_assets" BOOLEAN NOT NULL DEFAULT true,
    "icon" TEXT,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "note" TEXT,
    "category_id" TEXT,
    "account_id" TEXT,
    "from_account_id" TEXT,
    "to_account_id" TEXT,
    "transfer_group_id" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "client_request_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "payer_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_audit_log" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "category_id" TEXT,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "ledger_creator_id_idx" ON "ledger"("creator_id");

-- CreateIndex
CREATE INDEX "ledger_member_user_id_status_idx" ON "ledger_member"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_member_ledger_id_user_id_key" ON "ledger_member"("ledger_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_invitation_token_key" ON "ledger_invitation"("token");

-- CreateIndex
CREATE INDEX "ledger_invitation_ledger_id_status_idx" ON "ledger_invitation"("ledger_id", "status");

-- CreateIndex
CREATE INDEX "ledger_invitation_target_email_status_idx" ON "ledger_invitation"("target_email", "status");

-- CreateIndex
CREATE INDEX "account_ledger_id_is_active_idx" ON "account"("ledger_id", "is_active");

-- CreateIndex
CREATE INDEX "account_owner_id_visibility_idx" ON "account"("owner_id", "visibility");

-- CreateIndex
CREATE INDEX "category_ledger_id_type_is_active_idx" ON "category"("ledger_id", "type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "category_ledger_id_type_name_key" ON "category"("ledger_id", "type", "name");

-- CreateIndex
CREATE INDEX "transaction_ledger_id_occurred_at_idx" ON "transaction"("ledger_id", "occurred_at");

-- CreateIndex
CREATE INDEX "transaction_ledger_id_type_occurred_at_idx" ON "transaction"("ledger_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "transaction_ledger_id_category_id_occurred_at_idx" ON "transaction"("ledger_id", "category_id", "occurred_at");

-- CreateIndex
CREATE INDEX "transaction_ledger_id_payer_id_occurred_at_idx" ON "transaction"("ledger_id", "payer_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_ledger_id_client_request_id_key" ON "transaction"("ledger_id", "client_request_id");

-- CreateIndex
CREATE INDEX "transaction_audit_log_ledger_id_created_at_idx" ON "transaction_audit_log"("ledger_id", "created_at");

-- CreateIndex
CREATE INDEX "transaction_audit_log_transaction_id_created_at_idx" ON "transaction_audit_log"("transaction_id", "created_at");

-- CreateIndex
CREATE INDEX "budget_ledger_id_period_start_period_end_idx" ON "budget"("ledger_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "budget_ledger_id_category_id_period_start_period_end_key" ON "budget"("ledger_id", "category_id", "period_start", "period_end");

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_member" ADD CONSTRAINT "ledger_member_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_member" ADD CONSTRAINT "ledger_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invitation" ADD CONSTRAINT "ledger_invitation_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_invitation" ADD CONSTRAINT "ledger_invitation_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_audit_log" ADD CONSTRAINT "transaction_audit_log_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_audit_log" ADD CONSTRAINT "transaction_audit_log_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_audit_log" ADD CONSTRAINT "transaction_audit_log_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
