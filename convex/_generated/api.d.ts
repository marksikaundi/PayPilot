/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as ai from "../ai.js";
import type * as crons from "../crons.js";
import type * as invoices from "../invoices.js";
import type * as lib_activityLog from "../lib/activityLog.js";
import type * as lib_fields from "../lib/fields.js";
import type * as lib_invoiceWrite from "../lib/invoiceWrite.js";
import type * as lib_money from "../lib/money.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_paypalClient from "../lib/paypalClient.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_workspace from "../lib/workspace.js";
import type * as messages from "../messages.js";
import type * as paypal from "../paypal.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  ai: typeof ai;
  crons: typeof crons;
  invoices: typeof invoices;
  "lib/activityLog": typeof lib_activityLog;
  "lib/fields": typeof lib_fields;
  "lib/invoiceWrite": typeof lib_invoiceWrite;
  "lib/money": typeof lib_money;
  "lib/openai": typeof lib_openai;
  "lib/paypalClient": typeof lib_paypalClient;
  "lib/validators": typeof lib_validators;
  "lib/workspace": typeof lib_workspace;
  messages: typeof messages;
  paypal: typeof paypal;
  workspaces: typeof workspaces;
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
