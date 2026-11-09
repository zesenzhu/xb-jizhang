-- 第四期：账单图片附件元数据。图片二进制保存在 MinIO/OSS，本表只保存状态与对象键。
CREATE TYPE "TransactionAttachmentStatus" AS ENUM ('PENDING', 'ATTACHED', 'DELETED');

CREATE TABLE "transaction_attachment" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "client_request_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT,
    "declared_mime_type" TEXT,
    "declared_size_bytes" INTEGER,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "checksum_sha256" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "status" "TransactionAttachmentStatus" NOT NULL DEFAULT 'PENDING',
    "upload_expires_at" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "purged_at" TIMESTAMP(3),
    "purge_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_purge_error" TEXT,
    "last_upload_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_attachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transaction_attachment_object_key_key" ON "transaction_attachment"("object_key");
CREATE UNIQUE INDEX "transaction_attachment_transaction_id_client_request_id_key" ON "transaction_attachment"("transaction_id", "client_request_id");
CREATE INDEX "transaction_attachment_ledger_id_transaction_id_status_idx" ON "transaction_attachment"("ledger_id", "transaction_id", "status");
CREATE INDEX "transaction_attachment_status_created_at_idx" ON "transaction_attachment"("status", "created_at");
CREATE INDEX "transaction_attachment_deleted_at_purged_at_idx" ON "transaction_attachment"("deleted_at", "purged_at");
CREATE INDEX "transaction_attachment_uploaded_by_id_created_at_idx" ON "transaction_attachment"("uploaded_by_id", "created_at");

ALTER TABLE "transaction_attachment"
ADD CONSTRAINT "transaction_attachment_ledger_id_fkey"
FOREIGN KEY ("ledger_id") REFERENCES "ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transaction_attachment"
ADD CONSTRAINT "transaction_attachment_transaction_id_fkey"
FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transaction_attachment"
ADD CONSTRAINT "transaction_attachment_uploaded_by_id_fkey"
FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
