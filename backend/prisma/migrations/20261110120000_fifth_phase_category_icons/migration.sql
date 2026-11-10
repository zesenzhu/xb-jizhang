-- 第五期分类图标：分类图标资源与内置图标库。
CREATE TYPE "CategoryIconSource" AS ENUM ('NONE', 'LIBRARY', 'IMAGE');
CREATE TYPE "CategoryIconAssetStatus" AS ENUM ('PENDING', 'ATTACHED', 'DELETED');

ALTER TABLE "category"
    ADD COLUMN "icon_source" "CategoryIconSource" NOT NULL DEFAULT 'NONE',
    ADD COLUMN "icon_key" TEXT,
    ADD COLUMN "icon_asset_id" TEXT,
    ADD COLUMN "default_key" TEXT;

CREATE TABLE "category_icon_asset" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "client_request_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT,
    "declared_mime_type" TEXT NOT NULL,
    "declared_size_bytes" INTEGER NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "status" "CategoryIconAssetStatus" NOT NULL DEFAULT 'PENDING',
    "upload_expires_at" TIMESTAMP(3),
    "orphan_expires_at" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "purged_at" TIMESTAMP(3),
    "purge_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_purge_error" TEXT,
    "last_upload_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_icon_asset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "category_icon_asset_object_key_key"
    ON "category_icon_asset"("object_key");
CREATE UNIQUE INDEX "category_icon_asset_ledger_id_client_request_id_key"
    ON "category_icon_asset"("ledger_id", "client_request_id");
CREATE UNIQUE INDEX "category_icon_icon_asset_id_key"
    ON "category"("icon_asset_id");
CREATE INDEX "category_ledger_id_default_key_idx"
    ON "category"("ledger_id", "default_key");
CREATE INDEX "category_icon_asset_ledger_id_status_created_at_idx"
    ON "category_icon_asset"("ledger_id", "status", "created_at");
CREATE INDEX "category_icon_asset_status_upload_expires_at_idx"
    ON "category_icon_asset"("status", "upload_expires_at");
CREATE INDEX "category_icon_asset_status_orphan_expires_at_idx"
    ON "category_icon_asset"("status", "orphan_expires_at");
CREATE INDEX "category_icon_asset_deleted_at_purged_at_idx"
    ON "category_icon_asset"("deleted_at", "purged_at");

ALTER TABLE "category"
    ADD CONSTRAINT "category_icon_asset_id_fkey"
    FOREIGN KEY ("icon_asset_id") REFERENCES "category_icon_asset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "category_icon_asset"
    ADD CONSTRAINT "category_icon_asset_ledger_id_fkey"
    FOREIGN KEY ("ledger_id") REFERENCES "ledger"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "category_icon_asset"
    ADD CONSTRAINT "category_icon_asset_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 仅迁移仍保留默认名称的系统分类，用户改名后的历史分类不强行覆盖。
WITH default_roots("type", "name", "default_key", "icon_key", "color") AS (
    VALUES
        ('EXPENSE'::"CategoryType", '餐饮', 'expense.food', 'tabler:tools-kitchen-2', '#F97316'),
        ('EXPENSE'::"CategoryType", '交通', 'expense.transport', 'tabler:bus', '#0EA5E9'),
        ('EXPENSE'::"CategoryType", '购物', 'expense.shopping', 'tabler:shopping-cart', '#EC4899'),
        ('EXPENSE'::"CategoryType", '居住', 'expense.housing', 'tabler:home', '#8B5CF6'),
        ('EXPENSE'::"CategoryType", '生活服务', 'expense.services', 'tabler:tool', '#14B8A6'),
        ('EXPENSE'::"CategoryType", '医疗健康', 'expense.health', 'tabler:heart-pulse', '#EF4444'),
        ('EXPENSE'::"CategoryType", '教育学习', 'expense.education', 'tabler:book', '#6366F1'),
        ('EXPENSE'::"CategoryType", '娱乐休闲', 'expense.entertainment', 'tabler:confetti', '#F59E0B'),
        ('EXPENSE'::"CategoryType", '人情往来', 'expense.social', 'tabler:users', '#F43F5E'),
        ('EXPENSE'::"CategoryType", '其他支出', 'expense.other-expense', 'tabler:dots', '#64748B'),
        ('INCOME'::"CategoryType", '工资收入', 'income.salary', 'tabler:briefcase', '#22C55E'),
        ('INCOME'::"CategoryType", '经营收入', 'income.business', 'tabler:building-store', '#10B981'),
        ('INCOME'::"CategoryType", '投资理财', 'income.investment', 'tabler:chart-line', '#14B8A6'),
        ('INCOME'::"CategoryType", '报销退款', 'income.reimbursement', 'tabler:receipt-refund', '#06B6D4'),
        ('INCOME'::"CategoryType", '人情收入', 'income.social-income', 'tabler:heart', '#EC4899'),
        ('INCOME'::"CategoryType", '其他收入', 'income.other-income', 'tabler:plus', '#16A34A')
)
UPDATE "category" AS category
SET "default_key" = root."default_key",
    "icon_source" = 'LIBRARY',
    "icon_key" = root."icon_key",
    "color" = COALESCE(category."color", root."color")
FROM default_roots AS root
WHERE category."is_system" = true
  AND category."parent_id" IS NULL
  AND category."type" = root."type"
  AND category."name" = root."name";

WITH default_children("type", "parent_default_key", "parent_name", "name", "default_key", "icon_key", "color") AS (
    VALUES
        ('EXPENSE'::"CategoryType", 'expense.food', '餐饮', '早餐', 'expense.food.breakfast', 'tabler:egg-fried', '#F97316'),
        ('EXPENSE'::"CategoryType", 'expense.food', '餐饮', '午餐', 'expense.food.lunch', 'tabler:bowl', '#F97316'),
        ('EXPENSE'::"CategoryType", 'expense.food', '餐饮', '晚餐', 'expense.food.dinner', 'tabler:tools-kitchen-2', '#F97316'),
        ('EXPENSE'::"CategoryType", 'expense.food', '餐饮', '饮品零食', 'expense.food.snacks', 'tabler:cookie', '#F97316'),
        ('EXPENSE'::"CategoryType", 'expense.food', '餐饮', '其他餐饮', 'expense.food.other', 'tabler:dots', '#F97316'),
        ('EXPENSE'::"CategoryType", 'expense.transport', '交通', '公共交通', 'expense.transport.public', 'tabler:bus', '#0EA5E9'),
        ('EXPENSE'::"CategoryType", 'expense.transport', '交通', '打车', 'expense.transport.taxi', 'tabler:taxi', '#0EA5E9'),
        ('EXPENSE'::"CategoryType", 'expense.transport', '交通', '自驾', 'expense.transport.driving', 'tabler:car', '#0EA5E9'),
        ('EXPENSE'::"CategoryType", 'expense.transport', '交通', '长途出行', 'expense.transport.long-distance', 'tabler:route', '#0EA5E9'),
        ('EXPENSE'::"CategoryType", 'expense.shopping', '购物', '日用品', 'expense.shopping.daily', 'tabler:shopping-bag', '#EC4899'),
        ('EXPENSE'::"CategoryType", 'expense.shopping', '购物', '服饰鞋包', 'expense.shopping.clothing', 'tabler:shirt', '#EC4899'),
        ('EXPENSE'::"CategoryType", 'expense.shopping', '购物', '数码家电', 'expense.shopping.digital', 'tabler:device-mobile', '#EC4899'),
        ('EXPENSE'::"CategoryType", 'expense.shopping', '购物', '其他购物', 'expense.shopping.other', 'tabler:dots', '#EC4899'),
        ('EXPENSE'::"CategoryType", 'expense.housing', '居住', '房租', 'expense.housing.rent', 'tabler:home-dollar', '#8B5CF6'),
        ('EXPENSE'::"CategoryType", 'expense.housing', '居住', '水电燃气', 'expense.housing.utilities', 'tabler:bolt', '#8B5CF6'),
        ('EXPENSE'::"CategoryType", 'expense.housing', '居住', '物业', 'expense.housing.property', 'tabler:building', '#8B5CF6'),
        ('EXPENSE'::"CategoryType", 'expense.housing', '居住', '家居维修', 'expense.housing.repair', 'tabler:tools', '#8B5CF6'),
        ('EXPENSE'::"CategoryType", 'expense.services', '生活服务', '通讯', 'expense.services.telecom', 'tabler:phone', '#14B8A6'),
        ('EXPENSE'::"CategoryType", 'expense.services', '生活服务', '快递', 'expense.services.delivery', 'tabler:package', '#14B8A6'),
        ('EXPENSE'::"CategoryType", 'expense.services', '生活服务', '生活服务', 'expense.services.service', 'tabler:scissors', '#14B8A6'),
        ('EXPENSE'::"CategoryType", 'expense.services', '生活服务', '其他生活', 'expense.services.other', 'tabler:dots', '#14B8A6'),
        ('EXPENSE'::"CategoryType", 'expense.health', '医疗健康', '医疗', 'expense.health.medical', 'tabler:medical-cross', '#EF4444'),
        ('EXPENSE'::"CategoryType", 'expense.health', '医疗健康', '药品', 'expense.health.medicine', 'tabler:pill', '#EF4444'),
        ('EXPENSE'::"CategoryType", 'expense.health', '医疗健康', '运动健身', 'expense.health.fitness', 'tabler:barbell', '#EF4444'),
        ('EXPENSE'::"CategoryType", 'expense.health', '医疗健康', '其他健康', 'expense.health.other', 'tabler:dots', '#EF4444'),
        ('EXPENSE'::"CategoryType", 'expense.education', '教育学习', '学费课程', 'expense.education.tuition', 'tabler:school', '#6366F1'),
        ('EXPENSE'::"CategoryType", 'expense.education', '教育学习', '书籍资料', 'expense.education.books', 'tabler:books', '#6366F1'),
        ('EXPENSE'::"CategoryType", 'expense.education', '教育学习', '其他学习', 'expense.education.other', 'tabler:pencil', '#6366F1'),
        ('EXPENSE'::"CategoryType", 'expense.entertainment', '娱乐休闲', '电影演出', 'expense.entertainment.movie', 'tabler:movie', '#F59E0B'),
        ('EXPENSE'::"CategoryType", 'expense.entertainment', '娱乐休闲', '游戏', 'expense.entertainment.game', 'tabler:device-gamepad-2', '#F59E0B'),
        ('EXPENSE'::"CategoryType", 'expense.entertainment', '娱乐休闲', '旅游', 'expense.entertainment.travel', 'tabler:plane', '#F59E0B'),
        ('EXPENSE'::"CategoryType", 'expense.entertainment', '娱乐休闲', '其他娱乐', 'expense.entertainment.other', 'tabler:mood-happy', '#F59E0B'),
        ('EXPENSE'::"CategoryType", 'expense.social', '人情往来', '礼金红包', 'expense.social.gift', 'tabler:gift', '#F43F5E'),
        ('EXPENSE'::"CategoryType", 'expense.social', '人情往来', '聚会', 'expense.social.party', 'tabler:cake', '#F43F5E'),
        ('EXPENSE'::"CategoryType", 'expense.social', '人情往来', '其他人情', 'expense.social.other', 'tabler:heart', '#F43F5E'),
        ('INCOME'::"CategoryType", 'income.salary', '工资收入', '工资', 'income.salary.salary', 'tabler:cash', '#22C55E'),
        ('INCOME'::"CategoryType", 'income.salary', '工资收入', '奖金', 'income.salary.bonus', 'tabler:gift', '#22C55E'),
        ('INCOME'::"CategoryType", 'income.salary', '工资收入', '补贴', 'income.salary.allowance', 'tabler:wallet', '#22C55E'),
        ('INCOME'::"CategoryType", 'income.business', '经营收入', '经营所得', 'income.business.business', 'tabler:shopping-bag', '#10B981'),
        ('INCOME'::"CategoryType", 'income.business', '经营收入', '劳务收入', 'income.business.labor', 'tabler:hammer', '#10B981'),
        ('INCOME'::"CategoryType", 'income.business', '经营收入', '其他经营', 'income.business.other', 'tabler:receipt', '#10B981'),
        ('INCOME'::"CategoryType", 'income.investment', '投资理财', '利息', 'income.investment.interest', 'tabler:percentage', '#14B8A6'),
        ('INCOME'::"CategoryType", 'income.investment', '投资理财', '分红', 'income.investment.dividend', 'tabler:coins', '#14B8A6'),
        ('INCOME'::"CategoryType", 'income.investment', '投资理财', '其他投资', 'income.investment.other', 'tabler:chart-bar', '#14B8A6'),
        ('INCOME'::"CategoryType", 'income.reimbursement', '报销退款', '报销', 'income.reimbursement.reimbursement', 'tabler:receipt', '#06B6D4'),
        ('INCOME'::"CategoryType", 'income.reimbursement', '报销退款', '退款', 'income.reimbursement.refund', 'tabler:arrow-back-up', '#06B6D4'),
        ('INCOME'::"CategoryType", 'income.reimbursement', '报销退款', '其他返还', 'income.reimbursement.other', 'tabler:rotate', '#06B6D4'),
        ('INCOME'::"CategoryType", 'income.social-income', '人情收入', '礼金红包', 'income.social-income.gift', 'tabler:gift', '#EC4899'),
        ('INCOME'::"CategoryType", 'income.social-income', '人情收入', '其他人情', 'income.social-income.other', 'tabler:users', '#EC4899')
)
UPDATE "category" AS category
SET "default_key" = child."default_key",
    "icon_source" = 'LIBRARY',
    "icon_key" = child."icon_key",
    "color" = COALESCE(category."color", child."color")
FROM default_children AS child
JOIN "category" AS parent
  ON parent."default_key" = child."parent_default_key"
 AND parent."type" = child."type"
 AND parent."parent_id" IS NULL
WHERE category."is_system" = true
  AND parent."ledger_id" = category."ledger_id"
  AND category."parent_id" = parent."id"
  AND category."type" = child."type"
  AND category."name" = child."name";
