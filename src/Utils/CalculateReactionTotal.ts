import {PrismaClient} from "@prisma/client";
import { db } from "..";

/**
 * メッセージのリアクション総数を自分のがあるかを調べつつ計算する
 * @param messageId 調べるメッセージのId
 * @param myUserId 自分がリアクションしているかどうかを調べるためのユーザーId
 * @constructor
 */
export default async function CalculateReactionTotal(messageId: string, myUserId: string): Promise<
  {
    emojiCode: string,
    count: number,
    includingYou: boolean
  }[]
> {
  //結果用JSON
  const emojiTotalJson:{
    emojiCode: string,
    count: number,
    includingYou: boolean
  }[] = [];

  //絵文字リアクションを取得、総合数計算
  const reactionSummary = await db.messageReaction.groupBy({
    by: ['messageId', 'emojiCode'], // messageIdとemojiCodeでグループ化
    where: {
      messageId: { in: [messageId] }, // 取得したメッセージIDに限定
    },
    _count: {
      emojiCode: true, // 各emojiCodeの出現数をカウント
    },
  });
  //パースして配列にし、参照しやすいように
  for (const react of reactionSummary) {
    //自分がリアクションしていたかどうかを調べてそれも追加
    const didYouReact = await db.messageReaction.findFirst({
      where: {
        messageId: messageId,
        emojiCode: react.emojiCode,
        userId: myUserId,
      },
    });
    //結果に格納
    emojiTotalJson.push({
      emojiCode: react.emojiCode,
      count: react._count.emojiCode,
      includingYou: didYouReact !== null,
    });
  }

  return emojiTotalJson;
}