-- CreateTable
CREATE TABLE "Inbox" (
    "type" TEXT NOT NULL,
    "happendAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("messageId", "userId"),
    CONSTRAINT "Inbox_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
CREATE INDEX "Inbox_userId_idx" ON "Inbox"("userId");
