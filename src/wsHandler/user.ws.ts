import { ElysiaWS } from "elysia/dist/ws";
import ProfileUpdate from "./user/ProfileUpdate";

export default async function UserHandler(
  ws: ElysiaWS<any, any, any>,
  signal: string,
  data: any,
) {
  
  //signalｎ内容によって処理を分岐
  switch (signal) {
    case "user::profileUpdate":
      ProfileUpdate(ws, data);
      break;
  }
}