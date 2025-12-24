import { PrismaLibSql } from "@prisma/adapter-libsql";
import { app } from "../src";

export const adapter = new PrismaLibSql(
  { url: process.env.DATABASE_URL || "file:./test.db" },
  { timestampFormat: "unixepoch-ms" }
);

export async function FETCH({
  path,
  method,
  body,
  useSecondaryUser = false,
  excludeCredential = false,
}: {
  path: `/${string}`;
  method: "GET" | "POST" | "PUT" | "DELETE";
  // biome-ignore lint/suspicious/noExplicitAny: データの型は不定
  body?: { [key: string]: any };
  useSecondaryUser?: boolean;
  excludeCredential?: boolean;
}): Promise<Response> {
  //第２ユーザーのトークンを使うかどうかで切り替え
  const tokenUsing = useSecondaryUser ? "TESTUSER2TOKEN" : "TESTUSERTOKEN";

  return await app
    .handle(
      new Request(`http://localhost${path}`, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          //トークンを使用するかどうかで切り替え
          Cookie: excludeCredential ? "" : `token=${tokenUsing}`,
        },
        body: JSON.stringify(body),
      }),
    )
    .then(async (response) => {
      return response;
    })
    .catch((error) => {
      //console.error("FETCH error:", error);
      throw error;
    });
}
