ALTER TABLE "ledger"
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai';

CREATE TABLE "user_ledger_preference" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "current_ledger_id" TEXT,
    "default_ledger_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ledger_preference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_copy_request" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_request_id" TEXT NOT NULL,
    "source_ledger_id" TEXT,
    "target_ledger_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_copy_request_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_ledger_preference_user_id_key"
ON "user_ledger_preference"("user_id");

CREATE INDEX "user_ledger_preference_current_ledger_id_idx"
ON "user_ledger_preference"("current_ledger_id");

CREATE INDEX "user_ledger_preference_default_ledger_id_idx"
ON "user_ledger_preference"("default_ledger_id");

CREATE UNIQUE INDEX "ledger_copy_request_target_ledger_id_key"
ON "ledger_copy_request"("target_ledger_id");

CREATE UNIQUE INDEX "ledger_copy_request_user_id_client_request_id_key"
ON "ledger_copy_request"("user_id", "client_request_id");

CREATE INDEX "ledger_copy_request_source_ledger_id_idx"
ON "ledger_copy_request"("source_ledger_id");

ALTER TABLE "user_ledger_preference"
ADD CONSTRAINT "user_ledger_preference_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_ledger_preference"
ADD CONSTRAINT "user_ledger_preference_current_ledger_id_fkey"
FOREIGN KEY ("current_ledger_id") REFERENCES "ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_ledger_preference"
ADD CONSTRAINT "user_ledger_preference_default_ledger_id_fkey"
FOREIGN KEY ("default_ledger_id") REFERENCES "ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ledger_copy_request"
ADD CONSTRAINT "ledger_copy_request_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ledger_copy_request"
ADD CONSTRAINT "ledger_copy_request_source_ledger_id_fkey"
FOREIGN KEY ("source_ledger_id") REFERENCES "ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ledger_copy_request"
ADD CONSTRAINT "ledger_copy_request_target_ledger_id_fkey"
FOREIGN KEY ("target_ledger_id") REFERENCES "ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH ranked_memberships AS (
    SELECT
        "user_id",
        "ledger_id",
        ROW_NUMBER() OVER (
            PARTITION BY "user_id"
            ORDER BY "joined_at" ASC, "id" ASC
        ) AS "position"
    FROM "ledger_member"
    WHERE "status" = 'ACTIVE'
)
INSERT INTO "user_ledger_preference" (
    "id",
    "user_id",
    "current_ledger_id",
    "default_ledger_id",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid()::TEXT,
    "user_id",
    "ledger_id",
    "ledger_id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM ranked_memberships
WHERE "position" = 1;
