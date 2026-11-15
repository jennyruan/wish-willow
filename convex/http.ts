import { httpRouter } from "convex/server";
import { webhook } from "./whop";

const http = httpRouter();

http.route({ path: "/whop", method: "POST", handler: webhook });

export default http;
