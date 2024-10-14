import type { ElysiaWS } from "elysia/dist/ws";
import SendMessage from "./message/SendMessage";

export default async function MessageHandler(
  ws: ElysiaWS<any, any, any>,
  signal: string,
  data: any,
) {
  
  //signalｎ内容によって処理を分岐
  switch (signal) {

    //プロフィール更新
    case "message::SendMessage":
      SendMessage(ws, data);
      break;

      
  }
}