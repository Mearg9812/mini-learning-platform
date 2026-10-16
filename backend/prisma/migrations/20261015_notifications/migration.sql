CREATE TABLE "NotificationMessage" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationMessage_createdAt_idx" ON "NotificationMessage"("createdAt");

CREATE TABLE "NotificationRead" (
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("notificationId", "userId")
);

CREATE INDEX "NotificationRead_userId_readAt_idx" ON "NotificationRead"("userId", "readAt");

ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "NotificationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
