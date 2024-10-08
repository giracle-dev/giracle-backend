import { Elysia, t } from "elysia";

export const userService = new Elysia({ name: "user/service" })
  .model({
    signIn: t.Object({
      username: t.String({ minLength: 1 }),
      password: t.String({ minLength: 4 }),
    }),
    session: t.Cookie(
      {
        token: t.String(),
      },
    ),
  })
  .model((model) => ({
    ...model,
    optionalSession: t.Optional(model.session),
  })
);