import { ElysiaWS } from "elysia/dist/ws";
import JoinChannel from "./channel/JoinChannel";

export default async function ChannelHandler(
  ws: ElysiaWS<any, any, any>,
  signal: string,
  data: any,
) {
  
  //signal内容によって処理を分岐
  switch (signal) {

    //プロフィール更新
    case "channel::JoinChannel":
      JoinChannel(ws, data);
      break;

      
  }
}
