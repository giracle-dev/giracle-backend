import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./generated/client";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
export const prisma = new PrismaClient({ adapter });

async function main() {
  const ServerConfig = await prisma.serverConfig.create({
    data: {
      name: "Giracle",
      introduction: "みんなで楽しめるチャットサーバー。",
    },
  });
  const SYSTEM = await prisma.user.create({
    data: {
      id: "SYSTEM",
      name: "SYSTEM",
      selfIntroduction: "This is a system user.",
    },
  });
  const HOST = await prisma.roleInfo.create({
    data: {
      id: "HOST",
      name: "Host",
      manageServer: true,
      createdUserId: "SYSTEM",
    },
  });
  const MEMBER = await prisma.roleInfo.create({
    data: {
      id: "MEMBER",
      name: "Member",
      manageServer: false,
      createdUserId: "SYSTEM",
    },
  });
  console.log("Created HOST role: ", HOST, MEMBER);
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
