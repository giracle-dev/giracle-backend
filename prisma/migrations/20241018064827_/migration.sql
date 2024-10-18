-- CreateTable
CREATE TABLE "MessageUrlPreview" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "faviconLink" TEXT,
    "imageLink" TEXT,
    CONSTRAINT "MessageUrlPreview_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServerConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "introduction" TEXT NOT NULL,
    "RegisterAvailable" BOOLEAN NOT NULL DEFAULT true,
    "RegisterInviteOnly" BOOLEAN NOT NULL DEFAULT true,
    "MessageMaxLength" INTEGER NOT NULL DEFAULT 3000
);
