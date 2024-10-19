-- CreateTable
CREATE TABLE "ChannelViewableRole" (
    "channelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    PRIMARY KEY ("channelId", "roleId"),
    CONSTRAINT "ChannelViewableRole_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChannelViewableRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RoleInfo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "inviteCode" TEXT NOT NULL,
    "createdUserId" TEXT NOT NULL,
    "expireDate" DATETIME NOT NULL DEFAULT (datetime('now', '+1 day')),
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Invitation_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_inviteCode_key" ON "Invitation"("inviteCode");
