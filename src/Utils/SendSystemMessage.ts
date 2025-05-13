import { PrismaClient } from "@prisma/client";
import type { Server } from "bun";

const db = new PrismaClient();

/**
 * システムメッセージを記録、送信する
 * @param _channelId 記録するチャンネルId
 * @param _targetUserId 通知される対象のユーザーId
 * @param _messageTerm 送信するメッセージ項目
 * @param _server WS通信をするためのServerインスタンス、なければWS通知をしない
 */
export default async function SendSystemMessage(
  _channelId: string,
  _targetUserId: string,
  _messageTerm: TSystemMessageTerm,
  _server: Server | null = null,
) {
  try {
    //メッセージ内容とするJSON
    const contentJson = {
      targetUserId: _targetUserId,
      messageTerm: _messageTerm,
    };
    //DBに記録、JSONは文字列化して保存
    const msg = await db.message.create({
      data: {
        channelId: _channelId,
        userId: "SYSTEM",
        isSystemMessage: true,
        content: JSON.stringify(contentJson),
      },
    });

    //Serverインスタンスが渡されて有効ならWSで通知
    if (_server) {
      _server.publish(
        `channel::${_channelId}`,
        JSON.stringify({
          signal: "message::SendMessage",
          data: msg,
        }),
      );
    }
  } catch (e) {
    console.error("SendSystemMessage :: エラー->", e);
  }
}

type TSystemMessageTerm =
  | "WELCOME"
  | "CHANNEL_JOIN"
  | "CHANNEL_LEFT"
  | "CHANNEL_INVITED"
  | "CHANNEL_KICKED";
