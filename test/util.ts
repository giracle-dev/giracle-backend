import { PrismaClient } from "@prisma/client";

const dbTest = new PrismaClient({
  datasources: { db: { url: "file:./test.db" } },
});

export const Userinfo = {};

export const getMyuserinfo = async () => {
  return await dbTest.user.findFirst({
    where: {
      name: "testuser",
    }
  });
}

export const joinAnyChannel = async () => {
  let channel = await dbTest.channel.findFirst();
  const user = await getMyuserinfo();

  //ユーザーがいない場合はエラー
  if (user === null) throw Error("No user");
  //チャンネルがない場合は作成する
  if (channel === null) {
    channel = await dbTest.channel.create({
      data: {
        name: "testchannel",
        createdUserId: user.id,
        description: "testchannel description",
      }
    });
  }

  return await dbTest.channelJoin.create({
    data: {
      userId: user.id,
      channelId: channel.id,
    }
  });
}