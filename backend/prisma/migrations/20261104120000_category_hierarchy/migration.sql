-- 为已有分类补充可空父级；历史分类保持一级分类语义。
ALTER TABLE "category" ADD COLUMN "parent_id" TEXT;

DROP INDEX "category_ledger_id_type_name_key";

-- PostgreSQL 普通唯一约束允许多个 NULL；部分索引补上一级分类的唯一性。
CREATE UNIQUE INDEX "category_ledger_id_type_parent_id_name_key"
    ON "category"("ledger_id", "type", "parent_id", "name");
CREATE UNIQUE INDEX "category_root_ledger_id_type_name_key"
    ON "category"("ledger_id", "type", "name")
    WHERE "parent_id" IS NULL;

CREATE INDEX "category_ledger_id_type_parent_id_sort_order_idx"
    ON "category"("ledger_id", "type", "parent_id", "sort_order");

ALTER TABLE "category"
    ADD CONSTRAINT "category_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
