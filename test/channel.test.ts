// test/index.test.ts
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { user } from "../src/components/User/user.module";
import { channel } from "../src/components/Channel/channel.module";

//テスト用DBのURLを設定
//Bun.env.DATABASE_URL = "file:./test.db";

describe("channel", async () => {
  //インスタンス生成
  const app = new Elysia()
    .use(user)
    .use(channel);
  //テスト用DBインスタンス生成
  const dbTest = new PrismaClient({ datasources: { db: { url: "file:./test.db" } } });
  //DBのマイグレーション
  execSync("bunx prisma db push");

  //Prismaでuserデータにかかわるものをすべて削除
  await dbTest.channel.deleteMany({});

  let resultJson: { success: boolean; message: string };

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
  const tokenTesting = tokenRes.headers.getSetCookie()[0].split(";")[0].split("=")[1];

  it("channel :: create", async () => {
    //不正リクエストを送信
    const responseError = await app.handle(
      new Request("http://localhost/channel/create", {
        method: "PUT",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": `token=${tokenTesting}`,
        },
        body: JSON.stringify({ channelName: "", description: "これはテスト用のチャンネルです。" }),
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
          "Cookie": `token=${tokenTesting}`,
        },
        body: JSON.stringify({ channelName: "testChannel", description: "これはテスト用のチャンネルです。" }),
      }),
    );
    resultJson = await response.json();
    //console.log("auth.test :: sign-up : response", resultJson);
    expect(resultJson.message).toBe("Channel created");
  });
});
