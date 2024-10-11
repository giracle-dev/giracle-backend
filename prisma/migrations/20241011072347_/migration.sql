-- CreateTable
CREATE TABLE "ChannelJoin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelJoinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ChannelJoin_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChannelJoin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChannelJoin_userId_channelId_idx" ON "ChannelJoin"("userId", "channelId");
