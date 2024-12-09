import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { PrismaClient } from "@prisma/client";
import { message } from "../src/components/Message/message.module";
import { user } from "../src/components/User/user.module";
import { wsHandler } from "../src/ws";
import { getMyuserinfo, joinAnyChannel } from "./util";

describe("message", async () => {
  //インスタンス生成
  const app = new Elysia().use(user).use(wsHandler).use(message).listen(0);
  //テスト用DBインスタンス生成
  const dbTest = new PrismaClient({
    datasources: { db: { url: "file:./test.db" } },
  });

  let resultJson: {
    message: string;
    // biome-ignore lint/suspicious/noExplicitAny: データの型は不定
    data: { [key: string]: any };
  };

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

  /* -------------------------------------------- */
  // ユーザー情報取得 //
  const userinfo = await getMyuserinfo();
  //console.log("message.test :: userinfo->", userinfo);
  /* -------------------------------------------- */
  // メッセージテスト用の事前チャンネル参加 //
  const joinedChannel = await joinAnyChannel();
  /* -------------------------------------------- */
  // メッセージテスト用のId用変数
  let messageIdForTest = "";

  it("message :: send", async () => {
    const responseMissingChannel = await app.handle(
      new Request("http://localhost/message/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelId: "test",
          message: "test message",
        }),
      }),
    );
    //console.log("message.test :: send : responseMissingChannel->", responseMissingChannel);
    expect(responseMissingChannel.status).toBe(422);

    const responseBlank = await app.handle(
      new Request("http://localhost/message/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelId: "test",
          message: "  \n ",
        }),
      }),
    );
    //console.log("message.test :: send : responseBlank->", responseBlank);
    expect(responseBlank.status).toBe(422);

    const response = await app.handle(
      new Request("http://localhost/message/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelId: joinedChannel.channelId,
          message: "test message",
          fileIds: []
        }),
      }),
    );
    //console.log("message.test :: send : response->", responseMissingChannel);
    resultJson = await response.json();
    //console.log("message.test :: send : resultJson->", resultJson);
    expect(response.status).toBe(200);
    expect(resultJson.data.id).toBeString();
    // テスト用のIdを保存
    messageIdForTest = resultJson.data.id;
  });

  it("message :: fetch message", async () => {
    const response = await app.handle(
      new Request(`http://localhost/message/get/${messageIdForTest}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
      }),
    );
    //console.log("message.test :: fetch message : response->", response);
    resultJson = await response.json();
    //console.log("message.test :: fetch message : resultJson->", resultJson);
    expect(response.status).toBe(200);
    expect(resultJson.data.id).toBe(messageIdForTest);
  });

  it("message :: update readtime", async () => {
    const response = await app.handle(
      new Request("http://localhost/message/read-time/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          channelId: joinedChannel.channelId,
          readTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1日前の日付
        }),
      }),
    );
    //console.log("message.test :: update readtime : response->", response);
    resultJson = await response.json();
    //console.log("message.test :: update readtime : resultJson->", resultJson);
    expect(response.status).toBe(200);
    expect(resultJson.data.channelId).toBe(joinedChannel.channelId);
  });

  it("message :: check news", async () => {
    const response = await app.handle(
      new Request("http://localhost/message/get-new", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
      }),
    );
    //console.log("message.test :: update readtime : response->", response);
    resultJson = await response.json();
    //console.log("message.test :: update readtime : resultJson->", resultJson);
    expect(response.status).toBe(200);
    expect(resultJson.data[joinedChannel.channelId]).toBe(true);
  });
});
