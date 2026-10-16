ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TYPE "LearningCourse" ADD VALUE IF NOT EXISTS 'FREE_FOR_ALL';
ALTER TABLE "PaymentRequest" ALTER COLUMN "receiptText" DROP NOT NULL;
ALTER TABLE "PaymentRequest" ALTER COLUMN "receiptObjectKey" DROP NOT NULL;

UPDATE "User"
SET "phone" = NULLIF(regexp_replace("phone", '[[:space:]()-]', '', 'g'), '')
WHERE "role" = 'USER' AND "phone" IS NOT NULL;

-- Student accounts use phone numbers only; administrator email addresses remain intact.
UPDATE "User" SET "email" = NULL WHERE "role" = 'USER';
