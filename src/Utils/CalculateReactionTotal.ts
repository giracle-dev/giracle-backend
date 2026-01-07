import { db } from "..";

/**
 * メッセージのリアクション総数を自分のがあるかを調べつつ計算する
 * @param messageId 調べるメッセージのId
 * @param myUserId 自分がリアクションしているかどうかを調べるためのユーザーId
 * @constructor
 */
export default async function CalculateReactionTotal(
  messageId: string,
  myUserId: string,
): Promise<
  {
    emojiCode: string;
    count: number;
    includingYou: boolean;
  }[]
> {
  //結果用JSON
  const emojiTotalJson: {
    emojiCode: string;
    count: number;
    includingYou: boolean;
  }[] = [];

  //絵文字リアクションを取得、総合数計算
  const reactionSummary = await db.messageReaction.groupBy({
    by: ["messageId", "emojiCode"], // messageIdとemojiCodeでグループ化
    where: {
      messageId: { in: [messageId] }, // 取得したメッセージIDに限定
    },
    _count: {
      emojiCode: true, // 各emojiCodeの出現数をカウント
    },
  });

  //対象メッセージにおける自分のリアクションを一括で取得
  const myReactions = await db.messageReaction.findMany({
    where: {
      messageId: messageId,
      userId: myUserId,
    },
  });

  //パースして配列にし、参照しやすいように
  for (const react of reactionSummary) {
    //自分のリアクションがあるかどうか
    const hasMyReaction = myReactions.some((r) => r.emojiCode === react.emojiCode);
    //結果に格納
    emojiTotalJson.push({
      emojiCode: react.emojiCode,
      count: react._count.emojiCode,
      includingYou: hasMyReaction !== null, //自分が入るかどうかをboolで示す
    });
  }

  return emojiTotalJson;
}
