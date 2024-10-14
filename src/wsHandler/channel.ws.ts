import type { ElysiaWS } from "elysia/dist/ws";
import JoinChannel from "./channel/JoinChannel";
import LeaveChannel from "./channel/LeaveChannel";

export default async function ChannelHandler(
  ws: ElysiaWS<any, any, any>,
  signal: string,
  data: any,
) {
  
  //signal内容によって処理を分岐
  switch (signal) {

    //チャンネルへ参加
    case "channel::JoinChannel":
      JoinChannel(ws, data);
      break;

    //チャンネルから脱退する
    case "channel::LeaveChannel":
      LeaveChannel(ws, data);
      break;

      
  }
}
