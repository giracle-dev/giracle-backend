/*
  Warnings:

  - You are about to drop the column `isActive` on the `Invitation` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "MessageReadTime" (
    "readTime" DATETIME NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("channelId", "userId"),
    CONSTRAINT "MessageReadTime_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MessageReadTime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
CREATE INDEX "MessageReadTime_userId_idx" ON "MessageReadTime"("userId");

-- CreateIndex
CREATE INDEX "MessageReadTime_channelId_idx" ON "MessageReadTime"("channelId");
