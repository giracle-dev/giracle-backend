import { describe, expect, it } from "bun:test";
import { Cookie, Elysia } from "elysia";

import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { user } from "../src/components/User/user.module";
import { wsHandler } from "../src/ws";

describe("ws", async () => {
  //インスタンス生成
  const app = new Elysia().use(user).use(wsHandler).listen(0);
  //テスト用DBインスタンス生成
  const dbTest = new PrismaClient({
    datasources: { db: { url: "file:./test.db" } },
  });

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

  it("ws :: connect", async () => {
    const ws = new WebSocket(
      `ws://localhost:${app.server?.port}/ws?token=${tokenTesting}`
    );
    await new Promise((resolve) => {
      ws.onopen = () => {
        console.log("ws.test :: connect : opened");
        resolve(null);
      };
      ws.onerror = (e) => {
        console.log("ws.test :: connect : error", e);
        resolve(null);
      };
    });

    //接続ができているとテスト
    expect(ws.readyState).toBe(WebSocket.OPEN);
    //console.log("ws.test :: connect : ws", ws.readyState);
    ws.close();
  });

});