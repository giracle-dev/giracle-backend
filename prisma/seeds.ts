import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
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
