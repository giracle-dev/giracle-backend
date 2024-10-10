// test/index.test.ts
import { describe, expect, it } from "bun:test";
import { Cookie, Elysia } from "elysia";

import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { user } from "../src/components/User/user.module";

//テスト用DBのURLを設定
//Bun.env.DATABASE_URL = "file:./test.db";

describe("auth", async () => {
  //インスタンス生成
  const app = new Elysia().use(user);
  //テスト用DBインスタンス生成
  const dbTest = new PrismaClient({ datasources: { db: { url: "file:./test.db" } } });
  //DBのマイグレーション
  execSync("bunx prisma db push");

  //Prismaでuserデータにかかわるものをすべて削除
  await dbTest.token.deleteMany({});
  await dbTest.password.deleteMany({});
  await dbTest.user.deleteMany({});

  let resultJson: { success: boolean; message: string };
  let tokenTesting: string;

  it("auth :: sign-up", async () => {
    //不正リクエストを送信
    const responseError = await app.handle(
      new Request("http://localhost/user/sign-up", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "testuser", password: "" }),
      }),
    );

    expect(responseError.ok).toBe(false);

    //正しいリクエストを送信
    const response = await app.handle(
      new Request("http://localhost/user/sign-up", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "testuser", password: "testuser" }),
      }),
    );

    resultJson = await response.json();
    //console.log("auth.test :: sign-up : response", resultJson);
    expect(resultJson.message).toBe("User created");

    //正しいリクエストを送信
    const responseSameUsername = await app.handle(
      new Request("http://localhost/user/sign-up", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "testuser", password: "testuser" }),
      }),
    );

    resultJson = await responseSameUsername.json();
    //console.log("auth.test :: sign-up responseSameUsername", resultJson);
    expect(resultJson.message).toBe("User already exists");
  });

  it("auth :: sign-in", async () => {
    //不正リクエストを送信
    const responseError = await app.handle(
      new Request("http://localhost/user/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "testuser", password: null }),
      }),
    );

    resultJson = await responseError.json();
    //console.log("auth.test :: sign-in : responseError", resultJson);
    expect(responseError.ok).toBe(false);

    //間違ったパスワードでのリクエストを送信
    const responseWrongInfo = await app.handle(
      new Request("http://localhost/user/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "wrongpassword",
        }),
      }),
    );

    resultJson = await responseWrongInfo.json();
    //console.log("auth.test :: sign-in : responseWrongInfo", resultJson);
    expect(resultJson.message).toBe("Auth info is incorrect");

    //正しいリクエストを送信
    const response = await app.handle(
      new Request("http://localhost/user/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "testuser", password: "testuser" }),
      }),
    );

    resultJson = await response.json();
    //console.log("auth.test :: sign-in : response", response);
    expect(resultJson.message).toStartWith("Signed in as ");
    //クッキー確認
    expect(response.headers.getSetCookie()[0]).toStartWith("token=");
    //クッキーをsign-out用に保存
    tokenTesting = response.headers.getSetCookie()[0].split(";")[0].split("=")[1];
  });

  it("auth :: change-password", async () => {
    //間違ったリクエストを送信
    const responseWrong = await app.handle(
      new Request("http://localhost/user/change-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          currentPassword: "examplewrongpassword",
          newPassword: "asdf",
        })
      }),
    );

    resultJson = await responseWrong.json();
    //console.log("auth.test :: change-password : resultJson", resultJson);
    expect(resultJson.success).toBe(false);
    expect(resultJson.message).toBe("Current password is incorrect");

    //リクエストを送信
    const response = await app.handle(
      new Request("http://localhost/user/change-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          currentPassword: "testuser",
          newPassword: "asdf",
        })
      }),
    );

    resultJson = await response.json();
    //console.log("auth.test :: sign-out : responseError", resultJson);
    expect(resultJson.message).toBe("Password changed");
  });

  it("auth :: sign-out", async () => {
    //不正リクエストを送信
    const responseError = await app.handle(
      new Request("http://localhost/user/sign-out", {
        method: "GET",
        credentials: undefined,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    resultJson = await responseError.json();
    //console.log("auth.test :: sign-out : responseError", resultJson);
    expect(responseError.ok).toBe(false);

    //正しいリクエストを送信
    const response = await app.handle(
      new Request("http://localhost/user/sign-out",
        {
        method: "GET",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `token=${tokenTesting}`,
        },
      }),
    );

    resultJson = await response.json();
    //console.log("auth.test :: sign-out : response", resultJson);
    expect(resultJson.message).toBe("Signed out");
  });
});
