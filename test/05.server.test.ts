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
    expect(resultJson.message).toBe("Server config updated");
    expect(resultJson.data.introduction).toBe("Test changing server info.");
    expect(resultJson.data.id).toBe(undefined);
  });

});