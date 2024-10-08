import { Elysia, t } from "elysia";

export const userService = new Elysia({ name: "user/service" })
  .state({
    user: {} as Record<string, string>,
    session: {} as Record<number, string>,
  })
  .model({
    signIn: t.Object({
      username: t.String({ minLength: 1 }),
      password: t.String({ minLength: 8 }),
    }),
    session: t.Cookie(
      {
        token: t.Number(),
      },
    ),
  })
  .model((model) => ({
    ...model,
    optionalSession: t.Optional(model.session),
  }))
  .macro(({ onBeforeHandle }) => ({
    isSignIn(enabled: true) {
      if (!enabled) return;

      onBeforeHandle(({ error, cookie: { token }, store: { session } }) => {
        if (!token.value)
          return error(401, {
            success: false,
            message: "Unauthorized",
          });

        const username = session[token.value as unknown as number];

        if (!username)
          return error(401, {
            success: false,
            message: "Unauthorized",
          });
      });
    },
  }));

export const getUserId = new Elysia()
  .use(userService)
  .guard({
    isSignIn: true,
    cookie: "session",
  })
  .resolve(({ store: { session }, cookie: { token } }) => ({
    username: session[token.value],
  }))
  .as("plugin");