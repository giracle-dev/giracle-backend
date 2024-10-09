// test/index.test.ts
import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'

import { user } from '../src/components/User/user.module'
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

//テスト用DBのURLを設定
Bun.env.API_DATABASE_URL="file:./test.db";
//PrismaでスキーマからDBへプッシュしてテストで使えるようにする
execSync('npx prisma db push', { stdio: 'inherit' });

describe('auth', async () => {
  it('reponse test', async () => {
    const appTEMP = new Elysia().get('/', () => 'hi')

    const response = await appTEMP
      .handle(new Request('http://localhost'))
      .then((res) => res.text())

    console.log("auth.test :: reponse test : response", response);

    expect(response).toBe('hi')
  });

  //インスタンス生成
  const app = new Elysia().use(user)
  //テスト用DBインスタンス生成
  const dbTest = new PrismaClient();

  //Prismaでuserデータにかかわるものをすべて削除
  await dbTest.token.deleteMany({})
  await dbTest.password.deleteMany({})
  await dbTest.user.deleteMany({})

  let resultJson: {success:boolean, message:string};

  it('auth :: sign-up', async () => {
    //不正リクエストを送信
    const responseError = await app
      .handle(new Request('http://localhost/user/sign-up', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: '' })
      }))

    expect(responseError.ok).toBe(false)

    //正しいリクエストを送信
    const response = await app
      .handle(new Request('http://localhost/user/sign-up', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'testuser' })
      }))

    resultJson = await response.json();
    //console.log("auth.test :: sign-up : response", resultJson);
    expect(resultJson.message).toBe("User created")

    //正しいリクエストを送信
    const responseSameUsername = await app
      .handle(new Request('http://localhost/user/sign-up', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'testuser' })
      }))

    resultJson = await responseSameUsername.json();
    //console.log("auth.test :: sign-up responseSameUsername", resultJson);
    expect(resultJson.message).toBe("User already exists")
  });

  it('auth :: sign-in', async () => {
    //不正リクエストを送信
    const responseError = await app
      .handle(new Request('http://localhost/user/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: null })
      }))

    resultJson = await responseError.json();
    //console.log("auth.test :: sign-in : responseError", resultJson);
    expect(responseError.ok).toBe(false)

    //間違ったパスワードでのリクエストを送信
    const responseWrongInfo = await app
      .handle(new Request('http://localhost/user/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'wrongpassword' })
      }))

    resultJson = await responseWrongInfo.json();
    //console.log("auth.test :: sign-in : responseWrongInfo", resultJson);
    expect(resultJson.message).toBe("Auth info is incorrect")

    //正しいリクエストを送信
    const response = await app
      .handle(new Request('http://localhost/user/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'testuser' })
      }))

    resultJson = await response.json();
    //console.log("auth.test :: sign-in : response", response);
    expect(resultJson.message).toStartWith("Signed in as ")
    //クッキー確認
    expect(response.headers.getSetCookie()[0]).toStartWith("token=")
  });
})