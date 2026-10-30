-- 邀请 Token 不能以明文继续保存在数据库；历史数据先使用 SHA-256 回填后再删除旧字段。
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "ledger_invitation" WHERE "target_email" IS NULL) THEN
        RAISE EXCEPTION '无法迁移没有目标邮箱的历史邀请，请先补齐 target_email';
    END IF;
END $$;

ALTER TABLE "ledger_invitation" ADD COLUMN "token_hash" TEXT;

UPDATE "ledger_invitation"
SET "token_hash" = encode(digest("token", 'sha256'), 'hex');

ALTER TABLE "ledger_invitation" ALTER COLUMN "token_hash" SET NOT NULL;
ALTER TABLE "ledger_invitation" ALTER COLUMN "target_email" SET NOT NULL;

DROP INDEX "ledger_invitation_token_key";
DROP INDEX "ledger_invitation_target_email_status_idx";
ALTER TABLE "ledger_invitation" DROP COLUMN "token";

-- CreateTable
CREATE TABLE "refresh_session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_name" TEXT,
    "user_agent" TEXT,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_session_token_hash_key" ON "refresh_session"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_session_replaced_by_session_id_key" ON "refresh_session"("replaced_by_session_id");

-- CreateIndex
CREATE INDEX "refresh_session_user_id_revoked_at_idx" ON "refresh_session"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_session_user_id_expires_at_idx" ON "refresh_session"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_invitation_token_hash_key" ON "ledger_invitation"("token_hash");

-- CreateIndex
CREATE INDEX "ledger_invitation_ledger_id_target_email_status_idx" ON "ledger_invitation"("ledger_id", "target_email", "status");

-- 同一账本和邮箱只允许一个待处理邀请，已处理的历史邀请可以保留。
CREATE UNIQUE INDEX "ledger_invitation_pending_ledger_email_key"
ON "ledger_invitation"("ledger_id", "target_email")
WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "refresh_session" ADD CONSTRAINT "refresh_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
