import { PrismaClient } from "@prisma/client";
import Elysia, { t } from "elysia";
import type { ElysiaWS } from "elysia/dist/ws";

const db = new PrismaClient();

//ユーザーごとのWSインスタンス管理 ( Map <UserId, WSインスタンス>)
export const userWSInstance = new Map<string, ElysiaWS<any, any>[]>();

/**
 * WebSocket用 ハンドラ
 */
export const wsHandler = new Elysia().ws("/ws", {
  body: t.Object({
    signal: t.String({ minLength: 1 }),
    data: t.String({ minLength: 1 }),
  }),
  query: t.Object({
    token: t.Optional(t.String({ minLength: 1 })),
  }),

  message(ws, { signal }) {
    //pingを受け取ったらpongを返す
    if (signal === "ping") {
      ws.send({
        signal: "pong",
        data: "pong",
      });
      return;
    }
  },

  async open(ws) {
    //トークンを取得して有効か調べる
    const token = ws.data.cookie?.token?.value || ws.data.query.token;
    if (!token) {
      ws.send({
        signal: "ERROR",
        data: "token not valid",
      });
      ws.close();
      return;
    }

    const user = await db.user.findFirst({
      where: {
        Token: {
          some: {
            token: token,
          },
        },
      },
      include: {
        ChannelJoin: true,
      },
    });
    if (!user) {
      ws.send({
        signal: "ERROR",
        data: "token not valid",
      });
      ws.close();
      return;
    }

    //ハンドラのリンク
    ws.subscribe(`user::${user.id}`);
    ws.subscribe("GLOBAL");
    //チャンネル用ハンドラのリンク
    for (const channelData of user.ChannelJoin) {
      ws.subscribe(`channel::${channelData.channelId}`);
    }

    //このユーザーWSインスタンス保存
    //userWSInstance.set(user.id, ws);
    WSaddUserInstance(user.id, ws);
    //ユーザー接続通知
    ws.publish(
      "GLOBAL",
      JSON.stringify({
        signal: "user::Connected",
        data: user.id,
      }),
    );

    //console.log("index :: 新しいWS接続");
  },

  async close(ws) {
    //console.log("ws :: WS切断");

    //トークンを取得して有効か調べる
    const token = ws.data.cookie?.token?.value || ws.data.query?.token;
    if (!token) {
      return;
    }

    const userToken = await db.token.findFirst({
      where: {
            token: token,
          },
    });
    if (!userToken) {
      return;
    }

    //このユーザーWSインスタンス削除
    WSremoveUserInstance(userToken.userId, ws);

    if (!userWSInstance.has(userToken.userId)) {
      //ユーザー接続通知
      ws.publish(
        "GLOBAL",
        JSON.stringify({
          signal: "user::Disconnected",
          data: userToken.userId,
        }),
      );
    }
  },
});

/**
 * WSインスタンスマップにユーザーのインスタンスを新しく追加
 * @param userId
 * @param ws
 * @returns
 */
// biome-ignore lint/suspicious/noExplicitAny: どのwsインスタンスでも受け付けるためにany
function WSaddUserInstance(userId: string, ws: ElysiaWS<any, any>) {
  const currentInstance = userWSInstance.get(userId);
  //存在しない場合普通にset
  if (!currentInstance) {
    userWSInstance.set(userId, [ws]);
    return;
  }
  userWSInstance.set(userId, [...currentInstance, ws]);
}

/**
 * WSインスタンスマップからユーザーのインスタンスを削除
 * @param userId
 * @param ws
 * @returns
 */
// biome-ignore lint/suspicious/noExplicitAny: どのwsインスタンスでも受け付けるためにany
function WSremoveUserInstance(userId: string, ws: ElysiaWS<any, any>) {
  const currentInstance = userWSInstance.get(userId);
  //存在しない場合スルー
  if (!currentInstance) {
    return;
  }
  const socketTokenRemoving = ws.data.cookie.token;
  userWSInstance.set(
    userId,
    currentInstance.filter(v => {
      //console.log("WSremoveUserInstance :: v.data.cookie.token", v.data.cookie, socketTokenRemoving.initial.value);
      return v.data.cookie.token.value !== socketTokenRemoving.initial.value;
    }),
  );

  //もしインスタンスが0になったら削除
  if (userWSInstance.get(userId)?.length === 0) {
    userWSInstance.delete(userId);
  }
}

/**
 * 指定のユーザーIdのWSインスタンスすべてに対し指定のWSチャンネルから登録させる
 * @param userId
 * @param wsChannel
 * @returns
 */
export function WSSubscribe(userId: string, wsChannel: `${string}::${string}`) {
  const currentInstance = userWSInstance.get(userId);
  //存在しない場合スルー
  if (!currentInstance) {
    return;
  }
  for (const ws of currentInstance) {
    ws.subscribe(wsChannel);
  }
}

/**
 * 指定のユーザーIdのWSインスタンスすべてに対し指定のWSチャンネルから登録解除させる
 * @param userId
 * @param wsChannel
 * @returns
 */
export function WSUnsubscribe(
  userId: string,
  wsChannel: `${string}::${string}`,
) {
  const currentInstance = userWSInstance.get(userId);
  //存在しない場合スルー
  if (!currentInstance) {
    return;
  }
  for (const ws of currentInstance) {
    ws.unsubscribe(wsChannel);
  }
}
