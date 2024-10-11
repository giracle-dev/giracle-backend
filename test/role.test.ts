// test/index.test.ts
import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";

import { user } from "../src/components/User/user.module";
import { role } from "../src/components/Role/role.module";

//テスト用DBのURLを設定
//Bun.env.DATABASE_URL = "file:./test.db";

describe("role", async () => {
  //インスタンス生成
  const app = new Elysia()
    .use(user)
    .use(role);

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let resultJson: { success: boolean; message: string, data:{[key:string]: any} };
  let createdRoleId: string;

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

  it("role :: create", async () => {
    //不正リクエストを送信
    const responseError = await app.handle(
      new Request("http://localhost/role/create", {
        method: "PUT",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": `token=${tokenTesting}`,
        },
      }),
    );
    //resultJson = await responseError.json();
    expect(responseError.ok).toBe(false);

    //リクエストを送信
    const response = await app.handle(
      new Request("http://localhost/role/create", {
        method: "PUT",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          roleName: "モデレーター",
          rolePower: {
            manageRole: true,
            manageUser: true
          }
        }),
      }),
    );
    console.log("role.test : create : response", response);
    resultJson = await response.json();
    console.log("role.test :: create : resultJson", resultJson);
    expect(resultJson.success).toBe(true);
    expect(resultJson.data.roleId).toBeString();

    createdRoleId = resultJson.data.roleId;
  });

  it("role :: delete", async () => {
    //不正リクエストを送信
    const responseError = await app.handle(
      new Request("http://localhost/role/delete", {
        method: "DELETE",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          roleId: "存在しないロールId"
        }),
      }),
    );
    //resultJson = await responseError.json();
    expect(responseError.ok).toBe(false);

    //リクエストを送信
    const response = await app.handle(
      new Request("http://localhost/role/delete", {
        method: "DELETE",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          roleId: createdRoleId
        }),
      }),
    );
    //console.log("role.test : delete : response", response);
    resultJson = await response.json();
    //console.log("role.test :: delete : resultJson", resultJson);
    expect(resultJson.success).toBe(true);
    expect(resultJson.message).toBe("Role deleted");
  });
});
