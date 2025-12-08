import { app } from "../src";

export async function FETCH({
  path,
  method,
  body,
  excludeCredential = false,
}: {
  path: `/${string}`;
  method: "GET" | "POST" | "PUT" | "DELETE";
  // biome-ignore lint/suspicious/noExplicitAny: データの型は不定
  body?: { [key: string]: any };
  excludeCredential?: boolean;
}): Promise<Response> {
  return await app
    .handle(
      new Request(`http://localhost${path}`, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Cookie: excludeCredential ? "" : "token=TESTUSERTOKEN",
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
