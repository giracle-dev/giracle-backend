-- CreateTable
CREATE TABLE "RoleLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roleId" TEXT NOT NULL,
    "roleLinkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "RoleLink_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RoleInfo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoleLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdUserId" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#fff',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manageServer" BOOLEAN NOT NULL DEFAULT false,
    "manageChannel" BOOLEAN NOT NULL DEFAULT false,
    "manageUser" BOOLEAN NOT NULL DEFAULT false,
    "manageRole" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RoleInfo_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RoleLink_userId_roleId_idx" ON "RoleLink"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleInfo_name_key" ON "RoleInfo"("name");
