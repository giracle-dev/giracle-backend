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
  await dbTest.channel.deleteMany({});
  // -----------------------------------------------------------

  let resultJson: {
    success: boolean;
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
