/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as comments from "../comments.js";
import type * as dms from "../dms.js";
import type * as files from "../files.js";
import type * as geo from "../geo.js";
import type * as http from "../http.js";
import type * as notifications from "../notifications.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as voice from "../voice.js";
import type * as whop from "../whop.js";
import type * as wishes from "../wishes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  comments: typeof comments;
  dms: typeof dms;
  files: typeof files;
  geo: typeof geo;
  http: typeof http;
  notifications: typeof notifications;
  seed: typeof seed;
  users: typeof users;
  voice: typeof voice;
  whop: typeof whop;
  wishes: typeof wishes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
