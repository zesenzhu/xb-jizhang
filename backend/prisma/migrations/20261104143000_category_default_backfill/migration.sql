-- 为迁移前已经存在的账本补齐默认分类。
-- 只补缺失项，不修改或删除已有分类，避免影响历史账单的 category_id 关联。
WITH default_roots("type", "name", "sort_order") AS (
    VALUES
        ('EXPENSE'::"CategoryType", '餐饮', 10),
        ('EXPENSE'::"CategoryType", '交通', 20),
        ('EXPENSE'::"CategoryType", '购物', 30),
        ('EXPENSE'::"CategoryType", '居住', 40),
        ('EXPENSE'::"CategoryType", '生活服务', 50),
        ('EXPENSE'::"CategoryType", '医疗健康', 60),
        ('EXPENSE'::"CategoryType", '教育学习', 70),
        ('EXPENSE'::"CategoryType", '娱乐休闲', 80),
        ('EXPENSE'::"CategoryType", '人情往来', 90),
        ('EXPENSE'::"CategoryType", '其他支出', 100),
        ('INCOME'::"CategoryType", '工资收入', 10),
        ('INCOME'::"CategoryType", '经营收入', 20),
        ('INCOME'::"CategoryType", '投资理财', 30),
        ('INCOME'::"CategoryType", '报销退款', 40),
        ('INCOME'::"CategoryType", '人情收入', 50),
        ('INCOME'::"CategoryType", '其他收入', 100)
)
INSERT INTO "category" (
    "id",
    "ledger_id",
    "type",
    "name",
    "parent_id",
    "sort_order",
    "is_system",
    "is_active",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    ledger."id",
    root."type",
    root."name",
    NULL,
    root."sort_order",
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "ledger" AS ledger
CROSS JOIN default_roots AS root
WHERE NOT EXISTS (
    SELECT 1
    FROM "category" AS existing
    WHERE existing."ledger_id" = ledger."id"
      AND existing."type" = root."type"
      AND existing."parent_id" IS NULL
      AND existing."name" = root."name"
);

WITH default_children("type", "root_name", "name", "sort_order") AS (
    VALUES
        ('EXPENSE'::"CategoryType", '餐饮', '早餐', 10),
        ('EXPENSE'::"CategoryType", '餐饮', '午餐', 20),
        ('EXPENSE'::"CategoryType", '餐饮', '晚餐', 30),
        ('EXPENSE'::"CategoryType", '餐饮', '饮品零食', 40),
        ('EXPENSE'::"CategoryType", '餐饮', '其他餐饮', 90),
        ('EXPENSE'::"CategoryType", '交通', '公共交通', 10),
        ('EXPENSE'::"CategoryType", '交通', '打车', 20),
        ('EXPENSE'::"CategoryType", '交通', '自驾', 30),
        ('EXPENSE'::"CategoryType", '交通', '长途出行', 40),
        ('EXPENSE'::"CategoryType", '购物', '日用品', 10),
        ('EXPENSE'::"CategoryType", '购物', '服饰鞋包', 20),
        ('EXPENSE'::"CategoryType", '购物', '数码家电', 30),
        ('EXPENSE'::"CategoryType", '购物', '其他购物', 90),
        ('EXPENSE'::"CategoryType", '居住', '房租', 10),
        ('EXPENSE'::"CategoryType", '居住', '水电燃气', 20),
        ('EXPENSE'::"CategoryType", '居住', '物业', 30),
        ('EXPENSE'::"CategoryType", '居住', '家居维修', 40),
        ('EXPENSE'::"CategoryType", '生活服务', '通讯', 10),
        ('EXPENSE'::"CategoryType", '生活服务', '快递', 20),
        ('EXPENSE'::"CategoryType", '生活服务', '生活服务', 30),
        ('EXPENSE'::"CategoryType", '生活服务', '其他生活', 90),
        ('EXPENSE'::"CategoryType", '医疗健康', '医疗', 10),
        ('EXPENSE'::"CategoryType", '医疗健康', '药品', 20),
        ('EXPENSE'::"CategoryType", '医疗健康', '运动健身', 30),
        ('EXPENSE'::"CategoryType", '医疗健康', '其他健康', 90),
        ('EXPENSE'::"CategoryType", '教育学习', '学费课程', 10),
        ('EXPENSE'::"CategoryType", '教育学习', '书籍资料', 20),
        ('EXPENSE'::"CategoryType", '教育学习', '其他学习', 90),
        ('EXPENSE'::"CategoryType", '娱乐休闲', '电影演出', 10),
        ('EXPENSE'::"CategoryType", '娱乐休闲', '游戏', 20),
        ('EXPENSE'::"CategoryType", '娱乐休闲', '旅游', 30),
        ('EXPENSE'::"CategoryType", '娱乐休闲', '其他娱乐', 90),
        ('EXPENSE'::"CategoryType", '人情往来', '礼金红包', 10),
        ('EXPENSE'::"CategoryType", '人情往来', '聚会', 20),
        ('EXPENSE'::"CategoryType", '人情往来', '其他人情', 90),
        ('INCOME'::"CategoryType", '工资收入', '工资', 10),
        ('INCOME'::"CategoryType", '工资收入', '奖金', 20),
        ('INCOME'::"CategoryType", '工资收入', '补贴', 30),
        ('INCOME'::"CategoryType", '经营收入', '经营所得', 10),
        ('INCOME'::"CategoryType", '经营收入', '劳务收入', 20),
        ('INCOME'::"CategoryType", '经营收入', '其他经营', 90),
        ('INCOME'::"CategoryType", '投资理财', '利息', 10),
        ('INCOME'::"CategoryType", '投资理财', '分红', 20),
        ('INCOME'::"CategoryType", '投资理财', '其他投资', 90),
        ('INCOME'::"CategoryType", '报销退款', '报销', 10),
        ('INCOME'::"CategoryType", '报销退款', '退款', 20),
        ('INCOME'::"CategoryType", '报销退款', '其他返还', 90),
        ('INCOME'::"CategoryType", '人情收入', '礼金红包', 10),
        ('INCOME'::"CategoryType", '人情收入', '其他人情', 90)
)
INSERT INTO "category" (
    "id",
    "ledger_id",
    "type",
    "name",
    "parent_id",
    "sort_order",
    "is_system",
    "is_active",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    root."ledger_id",
    child."type",
    child."name",
    root."id",
    child."sort_order",
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "category" AS root
JOIN default_children AS child
  ON child."type" = root."type"
 AND child."root_name" = root."name"
WHERE root."parent_id" IS NULL
  AND root."is_active" = true
  AND NOT EXISTS (
      SELECT 1
      FROM "category" AS existing
      WHERE existing."ledger_id" = root."ledger_id"
        AND existing."parent_id" = root."id"
        AND existing."name" = child."name"
  );
