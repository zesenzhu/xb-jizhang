CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK_CARD', 'CREDIT_CARD', 'ALIPAY', 'WECHAT', 'OTHER');

ALTER TABLE "account"
ALTER COLUMN "type" TYPE "AccountType"
USING CASE "type"
  WHEN 'CASH' THEN 'CASH'::"AccountType"
  WHEN 'BANK_CARD' THEN 'BANK_CARD'::"AccountType"
  WHEN 'CREDIT_CARD' THEN 'CREDIT_CARD'::"AccountType"
  WHEN 'ALIPAY' THEN 'ALIPAY'::"AccountType"
  WHEN 'WECHAT' THEN 'WECHAT'::"AccountType"
  ELSE 'OTHER'::"AccountType"
END;
