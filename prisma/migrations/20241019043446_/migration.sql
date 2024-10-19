-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invitation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "inviteCode" TEXT NOT NULL,
    "createdUserId" TEXT NOT NULL,
    "expireDate" DATETIME NOT NULL DEFAULT (datetime('now', '+1 day')),
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Invitation_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invitation" ("createdUserId", "expireDate", "id", "inviteCode", "isActive", "usedCount") SELECT "createdUserId", "expireDate", "id", "inviteCode", "isActive", "usedCount" FROM "Invitation";
DROP TABLE "Invitation";
ALTER TABLE "new_Invitation" RENAME TO "Invitation";
CREATE UNIQUE INDEX "Invitation_inviteCode_key" ON "Invitation"("inviteCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ChannelJoin_userId_idx" ON "ChannelJoin"("userId");

-- CreateIndex
CREATE INDEX "ChannelJoin_channelId_idx" ON "ChannelJoin"("channelId");
