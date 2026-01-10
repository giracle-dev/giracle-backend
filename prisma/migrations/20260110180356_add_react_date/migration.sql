-- CreateTable
CREATE TABLE "BlockedIPAddress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "address" TEXT NOT NULL,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latestAccess" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChannelJoin" (
    "channelJoinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "channelId"),
    CONSTRAINT "ChannelJoin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChannelJoin_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChannelJoin" ("channelId", "channelJoinedAt", "userId") SELECT "channelId", "channelJoinedAt", "userId" FROM "ChannelJoin";
DROP TABLE "ChannelJoin";
ALTER TABLE "new_ChannelJoin" RENAME TO "ChannelJoin";
CREATE INDEX "ChannelJoin_userId_idx" ON "ChannelJoin"("userId");
CREATE INDEX "ChannelJoin_channelId_idx" ON "ChannelJoin"("channelId");
CREATE TABLE "new_ChannelJoinOnDefault" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelId" TEXT NOT NULL,
    CONSTRAINT "ChannelJoinOnDefault_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChannelJoinOnDefault" ("channelId", "id") SELECT "channelId", "id" FROM "ChannelJoinOnDefault";
DROP TABLE "ChannelJoinOnDefault";
ALTER TABLE "new_ChannelJoinOnDefault" RENAME TO "ChannelJoinOnDefault";
CREATE UNIQUE INDEX "ChannelJoinOnDefault_channelId_key" ON "ChannelJoinOnDefault"("channelId");
CREATE TABLE "new_ChannelViewableRole" (
    "channelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    PRIMARY KEY ("channelId", "roleId"),
    CONSTRAINT "ChannelViewableRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RoleInfo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelViewableRole_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChannelViewableRole" ("channelId", "roleId") SELECT "channelId", "roleId" FROM "ChannelViewableRole";
DROP TABLE "ChannelViewableRole";
ALTER TABLE "new_ChannelViewableRole" RENAME TO "ChannelViewableRole";
CREATE INDEX "ChannelViewableRole_roleId_idx" ON "ChannelViewableRole"("roleId");
CREATE INDEX "ChannelViewableRole_channelId_idx" ON "ChannelViewableRole"("channelId");
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "isSystemMessage" BOOLEAN NOT NULL DEFAULT false,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "replyingMessageId" TEXT,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("channelId", "content", "createdAt", "id", "isEdited", "isSystemMessage", "userId") SELECT "channelId", "content", "createdAt", "id", "isEdited", "isSystemMessage", "userId" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_channelId_idx" ON "Message"("channelId");
CREATE INDEX "Message_userId_idx" ON "Message"("userId");
CREATE TABLE "new_MessageFileAttached" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actualFileName" TEXT NOT NULL,
    "savedFileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "messageId" TEXT,
    CONSTRAINT "MessageFileAttached_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageFileAttached_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MessageFileAttached_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MessageFileAttached" ("actualFileName", "channelId", "id", "messageId", "savedFileName", "size", "type", "userId") SELECT "actualFileName", "channelId", "id", "messageId", "savedFileName", "size", "type", "userId" FROM "MessageFileAttached";
DROP TABLE "MessageFileAttached";
ALTER TABLE "new_MessageFileAttached" RENAME TO "MessageFileAttached";
CREATE INDEX "MessageFileAttached_channelId_idx" ON "MessageFileAttached"("channelId");
CREATE INDEX "MessageFileAttached_messageId_idx" ON "MessageFileAttached"("messageId");
CREATE INDEX "MessageFileAttached_userId_idx" ON "MessageFileAttached"("userId");
CREATE TABLE "new_MessageReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emojiCode" TEXT NOT NULL,
    "messageId" TEXT,
    "reactedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageReaction_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MessageReaction" ("channelId", "emojiCode", "id", "messageId", "userId") SELECT "channelId", "emojiCode", "id", "messageId", "userId" FROM "MessageReaction";
DROP TABLE "MessageReaction";
ALTER TABLE "new_MessageReaction" RENAME TO "MessageReaction";
CREATE INDEX "MessageReaction_channelId_idx" ON "MessageReaction"("channelId");
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");
CREATE INDEX "MessageReaction_userId_idx" ON "MessageReaction"("userId");
CREATE TABLE "new_MessageReadTime" (
    "readTime" DATETIME NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("channelId", "userId"),
    CONSTRAINT "MessageReadTime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageReadTime_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MessageReadTime" ("channelId", "readTime", "userId") SELECT "channelId", "readTime", "userId" FROM "MessageReadTime";
DROP TABLE "MessageReadTime";
ALTER TABLE "new_MessageReadTime" RENAME TO "MessageReadTime";
CREATE INDEX "MessageReadTime_userId_idx" ON "MessageReadTime"("userId");
CREATE INDEX "MessageReadTime_channelId_idx" ON "MessageReadTime"("channelId");
CREATE TABLE "new_MessageUrlPreview" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "faviconLink" TEXT,
    "imageLink" TEXT,
    "videoLink" TEXT,
    CONSTRAINT "MessageUrlPreview_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MessageUrlPreview" ("description", "faviconLink", "id", "imageLink", "messageId", "title", "type", "url", "videoLink") SELECT "description", "faviconLink", "id", "imageLink", "messageId", "title", "type", "url", "videoLink" FROM "MessageUrlPreview";
DROP TABLE "MessageUrlPreview";
ALTER TABLE "new_MessageUrlPreview" RENAME TO "MessageUrlPreview";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BlockedIPAddress_address_key" ON "BlockedIPAddress"("address");
