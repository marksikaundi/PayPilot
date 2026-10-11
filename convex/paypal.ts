import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { isRecord } from "./lib/fields";
import { centsToDecimal } from "./lib/money";
import {
  appUrl,
  isAlreadyCaptured,
  paypalAccessToken,
  paypalRequest,
  readCapture,
} from "./lib/paypalClient";

export const createCheckout = action({
  args: { accessKey: v.string(), invoiceId: v.id("invoices") },
  returns: v.object({
    approveUrl: v.string(),
    paypalOrderId: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ approveUrl: string; paypalOrderId: string }> => {
    const invoice = await ctx.runQuery(internal.invoices.payableForCheckout, {
      accessKey: args.accessKey,
      invoiceId: args.invoiceId,
    });
    const token = await paypalAccessToken();
    const origin = appUrl();
    const value = centsToDecimal(invoice.totalCents);
    const created = await paypalRequest("/v2/checkout/orders", token, {
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: invoice.invoiceId,
            custom_id: invoice.number,
            description: `Invoice ${invoice.number} for ${invoice.clientName}`.slice(0, 127),
            amount: { currency_code: "USD", value },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "PayPilot",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: `${origin}/pay/return`,
              cancel_url: `${origin}/pay/cancel?invoice=${invoice.invoiceId}`,
            },
          },
        },
      },
    });
    const link = approveLink(created);
    await ctx.runMutation(internal.invoices.recordCheckout, {
      workspaceId: invoice.workspaceId,
      invoiceId: invoice.invoiceId,
      paypalOrderId: link.id,
      amountCents: invoice.totalCents,
    });
    return { approveUrl: link.url, paypalOrderId: link.id };
  },
});

export const captureOrder = action({
  args: { accessKey: v.string(), paypalOrderId: v.string() },
  returns: v.object({
    invoiceId: v.id("invoices"),
    number: v.string(),
    alreadyPaid: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    invoiceId: Id<"invoices">;
    number: string;
    alreadyPaid: boolean;
  }> => {
    if (!/^[A-Za-z0-9-]{6,40}$/.test(args.paypalOrderId)) {
      throw new Error("That PayPal order id doesn't look valid.");
    }
    const payment = await ctx.runQuery(internal.invoices.paymentForCapture, {
      accessKey: args.accessKey,
      paypalOrderId: args.paypalOrderId,
    });
    if (payment.paymentStatus === "captured") {
      return {
        invoiceId: payment.invoiceId,
        number: payment.number,
        alreadyPaid: true,
      };
    }
    if (args.paypalOrderId.startsWith("DEMO-")) {
      throw new Error(
        "This checkout is demo data. Use Collect with PayPal to open a real sandbox order.",
      );
    }

    const token = await paypalAccessToken();
    let order: unknown;
    try {
      order = await paypalRequest(
        `/v2/checkout/orders/${args.paypalOrderId}/capture`,
        token,
        { method: "POST", body: {}, requestId: args.paypalOrderId },
      );
    } catch (error) {
      const payload = thrownPayload(error);
      if (isAlreadyCaptured(payload)) {
        order = await paypalRequest(`/v2/checkout/orders/${args.paypalOrderId}`, token, {
          method: "GET",
        });
      } else {
        const reason =
          error instanceof Error ? error.message : "PayPal could not capture this order.";
        await ctx.runMutation(internal.invoices.recordCaptureFailure, {
          workspaceId: payment.workspaceId,
          paypalOrderId: args.paypalOrderId,
          reason,
        });
        throw new Error(reason);
      }
    }

    const capture = readCapture(order);
    if (!capture) {
      const reason = "PayPal did not return a completed capture for this order.";
      await ctx.runMutation(internal.invoices.recordCaptureFailure, {
        workspaceId: payment.workspaceId,
        paypalOrderId: args.paypalOrderId,
        reason,
      });
      throw new Error(reason);
    }

    return await ctx.runMutation(internal.invoices.recordCapture, {
      workspaceId: payment.workspaceId,
      paypalOrderId: args.paypalOrderId,
      captureId: capture.captureId,
      amountCents: capture.amountCents,
      currency: capture.currency,
      payerEmail: capture.payerEmail,
      referenceId: capture.referenceId,
      customId: capture.customId,
      captureStatus: capture.captureStatus,
    });
  },
});

function thrownPayload(error: unknown): unknown {
  if (typeof error === "object" && error !== null && "payload" in error) {
    return error.payload;
  }
  return undefined;
}

function approveLink(order: unknown): { id: string; url: string } {
  if (!isRecord(order) || typeof order.id !== "string" || !Array.isArray(order.links)) {
    throw new Error("PayPal did not return a checkout link.");
  }
  for (const link of order.links) {
    if (!isRecord(link) || typeof link.href !== "string") continue;
    if (link.rel === "payer-action" || link.rel === "approve") {
      return { id: order.id, url: link.href };
    }
  }
  throw new Error("PayPal did not return a checkout link.");
}
