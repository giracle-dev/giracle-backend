-- AlterTable
ALTER TABLE "MessageUrlPreview" ADD COLUMN "videoLink" TEXT;

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emojiCode" TEXT NOT NULL,
    "messageId" TEXT,
    CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MessageReaction_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomEmoji" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "uploadedUserId" TEXT NOT NULL,
    CONSTRAINT "CustomEmoji_uploadedUserId_fkey" FOREIGN KEY ("uploadedUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "isSystemMessage" BOOLEAN NOT NULL DEFAULT false,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("channelId", "content", "createdAt", "id", "isSystemMessage", "userId") SELECT "channelId", "content", "createdAt", "id", "isSystemMessage", "userId" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_channelId_idx" ON "Message"("channelId");
CREATE INDEX "Message_userId_idx" ON "Message"("userId");
CREATE TABLE "new_RoleInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdUserId" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#fff',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manageServer" BOOLEAN NOT NULL DEFAULT false,
    "manageChannel" BOOLEAN NOT NULL DEFAULT false,
    "manageUser" BOOLEAN NOT NULL DEFAULT false,
    "manageRole" BOOLEAN NOT NULL DEFAULT false,
    "manageEmoji" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RoleInfo_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RoleInfo" ("color", "createdAt", "createdUserId", "id", "manageChannel", "manageRole", "manageServer", "manageUser", "name") SELECT "color", "createdAt", "createdUserId", "id", "manageChannel", "manageRole", "manageServer", "manageUser", "name" FROM "RoleInfo";
DROP TABLE "RoleInfo";
ALTER TABLE "new_RoleInfo" RENAME TO "RoleInfo";
CREATE UNIQUE INDEX "RoleInfo_name_key" ON "RoleInfo"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MessageReaction_channelId_idx" ON "MessageReaction"("channelId");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");

-- CreateIndex
CREATE INDEX "MessageReaction_userId_idx" ON "MessageReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomEmoji_code_key" ON "CustomEmoji"("code");

-- CreateIndex
CREATE INDEX "CustomEmoji_uploadedUserId_idx" ON "CustomEmoji"("uploadedUserId");

-- CreateIndex
CREATE INDEX "MessageFileAttached_messageId_idx" ON "MessageFileAttached"("messageId");
