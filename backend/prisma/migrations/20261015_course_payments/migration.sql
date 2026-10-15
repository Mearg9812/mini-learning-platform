CREATE TYPE "LearningCourse" AS ENUM ('GRADE_9', 'GRADE_10', 'GRADE_11', 'GRADE_12', 'FRESHMAN', 'UNASSIGNED');
CREATE TYPE "PurchaseOption" AS ENUM ('FULL_ACCESS', 'GRADE_9', 'GRADE_10', 'GRADE_11', 'GRADE_12', 'FRESHMAN');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Video" ADD COLUMN "course" "LearningCourse" NOT NULL DEFAULT 'UNASSIGNED';

CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "option" "PurchaseOption" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "receiptText" TEXT NOT NULL,
    "receiptObjectKey" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "approvedOption" "PurchaseOption",
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentRequest_userId_status_idx" ON "PaymentRequest"("userId", "status");
CREATE INDEX "PaymentRequest_status_createdAt_idx" ON "PaymentRequest"("status", "createdAt");
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
