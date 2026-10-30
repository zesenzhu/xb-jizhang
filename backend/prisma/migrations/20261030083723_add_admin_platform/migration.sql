-- CreateEnum
CREATE TYPE "AdminAuditResult" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "admin_user" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user_role" (
    "admin_user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_role_pkey" PRIMARY KEY ("admin_user_id","role_id")
);

-- CreateTable
CREATE TABLE "admin_role_permission" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_role_permission_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "admin_refresh_session" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_name" TEXT,
    "user_agent" TEXT,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_refresh_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "reason" TEXT,
    "before_data" JSONB,
    "after_data" JSONB,
    "result" "AdminAuditResult" NOT NULL,
    "error_code" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_username_key" ON "admin_user"("username");

-- CreateIndex
CREATE INDEX "admin_user_is_active_created_at_idx" ON "admin_user"("is_active", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_role_code_key" ON "admin_role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "admin_permission_code_key" ON "admin_permission"("code");

-- CreateIndex
CREATE INDEX "admin_user_role_role_id_idx" ON "admin_user_role"("role_id");

-- CreateIndex
CREATE INDEX "admin_role_permission_permission_id_idx" ON "admin_role_permission"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_refresh_session_token_hash_key" ON "admin_refresh_session"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "admin_refresh_session_replaced_by_session_id_key" ON "admin_refresh_session"("replaced_by_session_id");

-- CreateIndex
CREATE INDEX "admin_refresh_session_admin_user_id_revoked_at_idx" ON "admin_refresh_session"("admin_user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "admin_refresh_session_admin_user_id_expires_at_idx" ON "admin_refresh_session"("admin_user_id", "expires_at");

-- CreateIndex
CREATE INDEX "admin_audit_log_admin_user_id_created_at_idx" ON "admin_audit_log"("admin_user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_log_target_type_target_id_created_at_idx" ON "admin_audit_log"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_log_request_id_idx" ON "admin_audit_log"("request_id");

-- CreateIndex
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "admin_user_role" ADD CONSTRAINT "admin_user_role_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_role" ADD CONSTRAINT "admin_user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permission" ADD CONSTRAINT "admin_role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_role_permission" ADD CONSTRAINT "admin_role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "admin_permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_refresh_session" ADD CONSTRAINT "admin_refresh_session_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
