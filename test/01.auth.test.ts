import { describe, expect, it } from "bun:test";
import { Cookie, Elysia } from "elysia";

import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { user } from "../src/components/User/user.module";

describe("auth", async () => {
  //インスタンス生成
  const app = new Elysia().use(user);
  //テスト用DBインスタンス生成
  const dbTest = new PrismaClient({
    datasources: { db: { url: "file:./test.db" } },
  });
  //DBのマイグレーション
  execSync("bunx prisma db push --accept-data-loss");

  //Prismaでuserデータにかかわるものをすべて削除
  await dbTest.token.deleteMany({});
  await dbTest.password.deleteMany({});
  await dbTest.channelJoin.deleteMany({});
  await dbTest.message.deleteMany({});
  await dbTest.channel.deleteMany({});
  await dbTest.roleLink.deleteMany({});
  await dbTest.roleInfo.deleteMany({});
  await dbTest.invitation.deleteMany({});
  await dbTest.user.deleteMany({});
  await dbTest.serverConfig.deleteMany({});

  //DBの初期シード挿入
  execSync("bunx prisma db seed");
  //テスト用の招待コードをここで作成しておく
  await dbTest.invitation.create({
    data: {
      inviteCode: "testinvite",
      createdUserId: "SYSTEM",
      isActive: true
    },
  });

  let resultJson: {
    success: boolean;
    message: string;
    // biome-ignore lint/suspicious/noExplicitAny: データの型は不定
    data: { [key: string]: any };
  };
  let tokenTesting: string;
  let userIdTesting: string;

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

    //console.log("auth.test :: sign-up : response", response);
    resultJson = await response.json();
    //console.log("auth.test :: sign-up : response", resultJson);
    expect(resultJson.message).toBe("User created");

    //同じユーザー名でのリクエストを送信
    const responseSameUsername = await app.handle(
      new Request("http://localhost/user/sign-up", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "testuser",
          password: "testuser",
          inviteCode: "testinvite"
        }),
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
    expect(resultJson.data.userId).toBeString();
    //userIdを保存
    userIdTesting = resultJson.data.userId;
    //クッキー確認
    expect(response.headers.getSetCookie()[0]).toStartWith("token=");
    //クッキーをsign-out用に保存
    tokenTesting = response.headers
      .getSetCookie()[0]
      .split(";")[0]
      .split("=")[1];
  });

  it("auth :: verify-token", async () => {
    //クレデンシャル無しリクエストを送信
    const responseWithoutCookie = await app.handle(
      new Request("http://localhost/user/verify-token", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    //resultJson = await responseError.json();
    //console.log("auth.test :: vrify-token : responseError", responseError);
    //処理は401になるはず
    expect(responseWithoutCookie.status).toBe(401);

    //間違ったトークンでのリクエストを送信
    const responseWrong = await app.handle(
      new Request("http://localhost/user/verify-token", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: "token=wrongtoken",
        },
      }),
    );

    //console.log("auth.test :: vrify-token : responseError", responseWrong);
    //認証エラーになるはずだから401
    expect(responseWrong.status).toBe(401);

    //正しいリクエストを送信
    const response = await app.handle(
      new Request("http://localhost/user/verify-token", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
      }),
    );

    //console.log("auth.test :: vrify-token : response", response);
    resultJson = await response.json();
    //console.log("auth.test :: vrify-token : response", resultJson);
    expect(resultJson.message).toBe("Token is valid");
  });

  it("auth :: info", async () => {
    //間違ったトークンでのリクエストを送信
    const responseWrong = await app.handle(
      new Request("http://localhost/user/info/", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
      }),
    );

    //console.log("auth.test :: vrify-token : responseError", responseWrong);
    //認証エラーになるはずだから401
    expect(responseWrong.status).toBe(404);

    //正しいリクエストを送信
    const response = await app.handle(
      new Request(`http://localhost/user/info/${userIdTesting}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
      }),
    );

    //console.log("auth.test :: vrify-token : response", response);
    resultJson = await response.json();
    //console.log("auth.test :: vrify-token : response", resultJson);
    expect(resultJson.message).toBe("User info");
    expect(resultJson.data.name).toBe("testuser");
  });

  it("auth :: change-password", async () => {
    //間違ったリクエストを送信
    const responseWrong = await app.handle(
      new Request("http://localhost/user/change-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          currentPassword: "examplewrongpassword",
          newPassword: "asdf",
        }),
      }),
    );

    resultJson = await responseWrong.json();
    //console.log("auth.test :: change-password : resultJson", resultJson);
    expect(resultJson.message).toBe("Current password is incorrect");

    //リクエストを送信
    const response = await app.handle(
      new Request("http://localhost/user/change-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          currentPassword: "testuser",
          newPassword: "asdf",
        }),
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
      new Request("http://localhost/user/sign-out", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Cookie: `token=${tokenTesting}`,
        },
      }),
    );

    resultJson = await response.json();
    //console.log("auth.test :: sign-out : response", resultJson);
    expect(resultJson.message).toBe("Signed out");
  });
});
