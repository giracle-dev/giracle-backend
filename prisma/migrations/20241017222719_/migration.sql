/*
  Warnings:

  - The primary key for the `RoleLink` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `RoleLink` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RoleLink" (
    "roleId" TEXT NOT NULL,
    "roleLinkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "roleId"),
    CONSTRAINT "RoleLink_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RoleInfo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoleLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RoleLink" ("roleId", "roleLinkedAt", "userId") SELECT "roleId", "roleLinkedAt", "userId" FROM "RoleLink";
DROP TABLE "RoleLink";
ALTER TABLE "new_RoleLink" RENAME TO "RoleLink";
CREATE INDEX "RoleLink_userId_roleId_idx" ON "RoleLink"("userId", "roleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
