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
CREATE TABLE "new_ServerConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "introduction" TEXT NOT NULL,
    "RegisterAvailable" BOOLEAN NOT NULL DEFAULT true,
    "RegisterInviteOnly" BOOLEAN NOT NULL DEFAULT true,
    "RegisterAnnounceChannelId" TEXT NOT NULL DEFAULT '',
    "MessageMaxLength" INTEGER NOT NULL DEFAULT 3000
);
INSERT INTO "new_ServerConfig" ("MessageMaxLength", "RegisterAvailable", "RegisterInviteOnly", "id", "introduction", "name") SELECT "MessageMaxLength", "RegisterAvailable", "RegisterInviteOnly", "id", "introduction", "name" FROM "ServerConfig";
DROP TABLE "ServerConfig";
ALTER TABLE "new_ServerConfig" RENAME TO "ServerConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
