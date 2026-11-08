-- 三期：邀请列表按目标邮箱查询，以及备注候选按用户/账本/最近使用时间查询。
CREATE INDEX "ledger_invitation_target_email_status_expires_at_idx"
ON "ledger_invitation"("target_email", "status", "expires_at");

ALTER TABLE "transaction" ADD COLUMN "note_updated_at" TIMESTAMP(3);

-- 历史备注没有单独的“最近使用”时间，用账单最后更新时间回填，避免候选为空。
UPDATE "transaction"
SET "note_updated_at" = "updated_at"
WHERE "note" IS NOT NULL AND btrim("note") <> '';

CREATE INDEX "transaction_ledger_id_created_by_id_note_updated_at_idx"
ON "transaction"("ledger_id", "created_by_id", "note_updated_at");
