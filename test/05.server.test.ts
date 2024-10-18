import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { user } from "../src/components/User/user.module";
import { server } from "../src/components/Server/server.module";

describe("server", async () => {
  //インスタンス生成
  const app = new Elysia().use(user).use(server);

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

  let inviteIdTesting = 0;

  it("server :: fetch config", async () => {
    const response = await app.handle(
      new Request("http://localhost/server/config", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        }
      }),
    );
    //console.log("server.test :: fetch-config : response->", response);
    resultJson = await response.json();
    //console.log("server.test :: fetch-config : resultJson->", resultJson);
    expect(resultJson.message).toBe("Server config fetched");
    expect(resultJson.data.name).toBe("Giracle");
  });

  it("server :: update info", async () => {
    const response = await app.handle(
      new Request("http://localhost/server/change-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          name: "Giracle-改-",
          introduction: "Test changing server info.",
        }),
      }),
    );
    //console.log("server.test :: change-info : response->", response);
    resultJson = await response.json();
    //console.log("server.test :: change-info : resultJson->", resultJson);
    expect(resultJson.message).toBe("Server info updated");
    expect(resultJson.data.introduction).toBe("Test changing server info.");
    expect(resultJson.data.id).toBe(undefined);
  });

  it("server :: update config", async () => {
    const response = await app.handle(
      new Request("http://localhost/server/change-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          MessageMaxLength: 1234
        }),
      }),
    );
    //console.log("server.test :: change-info : response->", response);
    resultJson = await response.json();
    //console.log("server.test :: change-info : resultJson->", resultJson);
    expect(resultJson.message).toBe("Server config updated");
    expect(resultJson.data.RegisterInviteOnly).toBe(true);
    expect(resultJson.data.MessageMaxLength).toBe(1234);
  });

  it("server :: create invite", async () => {
    const response = await app.handle(
      new Request("http://localhost/server/create-invite", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          inviteCode: "招待作成のテスト"
        }),
      }),
    );
    //console.log("server.test :: create invite : response->", response);
    resultJson = await response.json();
    //console.log("server.test :: create invite : resultJson->", resultJson);
    expect(resultJson.message).toBe("Server invite created");
    expect(resultJson.data.inviteCode).toBe("招待作成のテスト");
  });

  it("server :: fetch invites", async () => {
    const response = await app.handle(
      new Request("http://localhost/server/get-invite", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        }
      }),
    );
    //console.log("server.test :: fetch invites : response->", response);
    resultJson = await response.json();
    //console.log("server.test :: fetch invites : resultJson->", resultJson);
    expect(resultJson.message).toBe("Server invites fetched");
    expect(resultJson.data[0].inviteCode).toBe("testinvite");
    //後で使うためのinviteIdを取得
    inviteIdTesting = resultJson.data[1].id;
  });

  it("server :: enable invites", async () => {
    //招待を有効にするリクエスト
    await app.handle(
      new Request("http://localhost/server/update-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          inviteId: inviteIdTesting,
          isActive: true
        }),
      }),
    ).then(async (res) => {
      const result = await res.json();
      console.log("server.test :: enable-invites : result->", result);
      expect(result.message).toBe("Server invite updated");
      expect(result.data.isActive).toBe(true);
    });
  });

  it("server :: test register with invite", async () => {
    //不正な招待コードでのリクエスト
    const responseError = await app.handle(
      new Request("http://localhost/user/sign-up", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          username: "testuser2",
          password: "testuser2",
          inviteCode: "errorcode"
        }),
      }),
    );
    //console.log("server.test :: test register-with-invite : responseError->", response);
    expect(responseError.status).toBe(400);

    //正常なリクエスト
    const response = await app.handle(
      new Request("http://localhost/user/sign-up", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
        body: JSON.stringify({
          username: "testuser2",
          password: "testuser2",
          inviteCode: "testinvite"
        }),
      }),
    );
    //console.log("server.test :: test register-with-invite : response->", response);
    resultJson = await response.json();
    //console.log("server.test :: test register-with-invite : resultJson->", resultJson);
    expect(resultJson.message).toBe("User created");
  });

  it("sever :: check invite count", async () => {
    await app.handle(
      new Request("http://localhost/server/get-invite", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          cookie: `token=${tokenTesting}`,
        },
      }),
    ).then(async (res) => {
      const result = await res.json();
      //console.log("server.test :: check-invite-count : result->", result);
      expect(result.data[0].usedCount).toBe(2); //auth.testとここで使ったので２回
    });
  });

});