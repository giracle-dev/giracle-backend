import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { PrismaClient } from "@prisma/client";
import { channel } from "../src/components/Channel/channel.module";
import { user } from "../src/components/User/user.module";

describe("channel", async () => {
  //インスタンス生成
  const app = new Elysia().use(user).use(channel);

  // ----------------- テスト用DB整備 ---------------------------
  const dbTest = new PrismaClient({
    datasources: { db: { url: "file:./test.db" } },
  });
  await dbTest.message.deleteMany({});
  await dbTest.channel.deleteMany({});
  // -----------------------------------------------------------

  let resultJson: {
    message: string;
    // biome-ignore lint/suspicious/noExplicitAny: データの型は不定
    data: { [key: string]: any };
  };
  let createdChannelId: string;

  //ここでログインして処理
  const tokenRes = await app.handle(
    new Request("http://localhost/user/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "testuser",
        password: "asdf",
      }),
    }),
  );
  //console.log("channel.test :: sign-in : tokenRes->", await tokenRes.json());
  const tokenTesting = tokenRes.headers
    .getSetCookie()[0]
    .split(";")[0]
    .split("=")[1];

  it("channel :: create", async () => {
    //不正リクエストを送信
    const responseError = await app.handle(
      new Request("http://localhost/channel/create", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelName: "",
          description: "これはテスト用のチャンネルです。",
        }),
      }),
    );
    expect(responseError.ok).toBe(false);

    //正しいリクエストを送信
    const response = await app.handle(
      new Request("http://localhost/channel/create", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelName: "testChannel",
          description: "これはテスト用のチャンネルです。",
        }),
      }),
    );
    //console.log("channel.test : create : response", response);
    resultJson = await response.json();
    //console.log("auth.test :: sign-up : response", resultJson);
    expect(resultJson.message).toBe("Channel created");
    expect(resultJson.data.channelId).toBeString();

    //作成したチャンネルIDを保存
    createdChannelId = resultJson.data.channelId;

    //テスト用のサンプル履歴をここで作る
    await dbTest.message.create({
      data: {
        content: "これはテスト用のメッセージです。",
        channelId: createdChannelId,
        userId: "SYSTEM",
      },
    });
    await dbTest.message.create({
      data: {
        content: "これは２個目",
        channelId: createdChannelId,
        userId: "SYSTEM",
      },
    });
  });

  it("channel :: join", async () => {
    //不正リクエストを送信
    const responseError = await app.handle(
      new Request("http://localhost/channel/join", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelId: "asdf",
        }),
      }),
    );
    console.log("channel.test : join : responseError", responseError);
    expect(responseError.ok).toBe(false);
    expect(responseError.status).toBe(404);

    //正しいリクエストを送信
    const response = await app.handle(
      new Request("http://localhost/channel/join", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelId: createdChannelId,
        }),
      }),
    );
    //console.log("channel.test : create : response", response);
    resultJson = await response.json();
    //console.log("auth.test :: sign-up : response", resultJson);
    expect(resultJson.message).toBe("Channel joined");

    //また参加しようとしているリクエストを送信
    const responseAgain = await app.handle(
      new Request("http://localhost/channel/join", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelId: createdChannelId,
        }),
      }),
    );
    expect(responseAgain.ok).toBe(false);
    expect(responseAgain.status).toBe(400);
  });

  it("channel :: leave", async () => {
    //不正リクエストを送信
    const responseError = await app.handle(
      new Request("http://localhost/channel/leave", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelId: "asdf",
        }),
      }),
    );
    console.log("channel.test : leave : responseError", responseError);
    expect(responseError.ok).toBe(false);
    expect(responseError.status).toBe(400);

    //正しいリクエストを送信
    const response = await app.handle(
      new Request("http://localhost/channel/leave", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelId: createdChannelId,
        }),
      }),
    );
    //console.log("channel.test : create : response", response);
    resultJson = await response.json();
    //console.log("auth.test :: sign-up : response", resultJson);
    expect(resultJson.message).toBe("Channel left");

    //また脱退しようとしているリクエストを送信
    const responseAgain = await app.handle(
      new Request("http://localhost/channel/leave", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelId: createdChannelId,
        }),
      }),
    );
    expect(responseAgain.ok).toBe(false);
    expect(responseAgain.status).toBe(400);
  });

  it("channel :: get list", async () => {
    //正しいリクエストを送信
    const response = await app.handle(
      new Request("http://localhost/channel/list", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        }
      }),
    );
    resultJson = await response.json();
    //console.log("channel.test : get list : response", resultJson);
    expect(resultJson.message).toBe("Channel list ready");
    expect(resultJson.data[0].name).toBe("testChannel");
  });

  it("channel :: get history", async () => {
    //不正リクエストを送信
    const responseError = await app.handle(
      new Request(`http://localhost/channel/get-history/${createdChannelId}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          messageTimeFrom: "ErrorTimeString",
        })
      }),
    );
    //console.log("channel.test : get-history : response", response);
    expect(responseError.ok).toBe(false);
    expect(responseError.status).toBe(500);

    //不正リクエストを送信
    const responseUnknwown = await app.handle(
      new Request(`http://localhost/channel/get-history/${createdChannelId}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          messageTimeFrom: "2024-8-1",
        })
      }),
    );
    //console.log("channel.test : get-history : response", response);
    expect(responseUnknwown.ok).toBe(false);
    expect(responseUnknwown.status).toBe(404);
    
    //正しいリクエストを送信
    const response = await app.handle(
      new Request(`http://localhost/channel/get-history/${createdChannelId}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
      }),
    );
    //console.log("channel.test : get-history : response", response);
    resultJson = await response.json();
    //console.log("channel.test : get-history : response", resultJson);
    expect(resultJson.message).toBe("History fetched");

    const messageTimeForTesting: string = resultJson.data[1].createdAt;

    //正しいPart2、時間を指定しての取得
    const responseWithTime = await app.handle(
      new Request(`http://localhost/channel/get-history/${createdChannelId}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          messageTimeFrom: messageTimeForTesting,
        })
      }),
    );
    //console.log("channel.test : get-history : responseWithTime", responseWithTime);
    resultJson = await responseWithTime.json();
    //console.log("channel.test : get-history : responseWithTime json", resultJson);
    expect(resultJson.data.length).toBe(1);
  });

  it("channel :: delete", async () => {
    //不正リクエストを送信
    const responseError = await app.handle(
      new Request("http://localhost/channel/delete", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({ channelId: "asdf" }),
      }),
    );
    expect(responseError.ok).toBe(false);

    //正しいリクエストを送信
    const response = await app.handle(
      new Request("http://localhost/channel/delete", {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({ channelId: createdChannelId }),
      }),
    );
    resultJson = await response.json();
    //console.log("channel.test : delete : response", resultJson);
    expect(resultJson.message).toBe("Channel deleted");
  });
});
