-- CreateTable
CREATE TABLE "MessageFileAttached" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actualFileName" TEXT NOT NULL,
    "savedFileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "messageId" TEXT,
    CONSTRAINT "MessageFileAttached_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MessageFileAttached_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MessageFileAttached_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invitation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inviteCode" TEXT NOT NULL,
    "createdUserId" TEXT NOT NULL,
    "expireDate" DATETIME NOT NULL DEFAULT (datetime('now', '+1 day')),
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Invitation_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invitation" ("createdUserId", "expireDate", "id", "inviteCode", "usedCount") SELECT "createdUserId", "expireDate", "id", "inviteCode", "usedCount" FROM "Invitation";
DROP TABLE "Invitation";
ALTER TABLE "new_Invitation" RENAME TO "Invitation";
CREATE UNIQUE INDEX "Invitation_inviteCode_key" ON "Invitation"("inviteCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MessageFileAttached_channelId_idx" ON "MessageFileAttached"("channelId");

-- CreateIndex
CREATE INDEX "MessageFileAttached_userId_idx" ON "MessageFileAttached"("userId");
