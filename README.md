# PayPilot

PayPilot is an invoice agent for a small studio. You describe the work, review the draft, and collect the exact total through a PayPal sandbox checkout. A single model, `gpt-4o-mini`, drafts invoices, writes payment reminders, and answers questions about the invoices in the workspace. It cannot move money.

The project uses Next.js, TypeScript, Convex, PayPal's Orders API, and that one model.

## What it does

- Dashboard of invoices with draft, approved, awaiting, overdue, paid, and discarded states.
- Natural-language invoice drafting, plus a blank invoice you can fill in yourself.
- Review and edit before approval. Approval locks the line items.
- PayPal sandbox order for the invoice total, then capture verification before the invoice is marked paid.
- Overdue detection when a sent or approved invoice passes its due date.
- Reminder drafts that stay pending until you approve them. Approval does not send email.
- Activity log of what the model suggested, what you approved, and what PayPal captured.
- Search, status filters, and a simple collected-by-month view.
- Demo invoices so the approval flow works before API keys are connected.

## Approval rules

These are enforced in Convex, not only in the interface:

1. A PayPal checkout cannot be created until the invoice is approved.
2. The order amount is the stored invoice total in USD. The model does not choose it.
3. The invoice becomes paid only when PayPal returns a `COMPLETED` capture for that same amount and currency, and the order belongs to that invoice.
4. Reminder suggestions stay pending until you approve or dismiss them.
5. Approving an invoice or a reminder does not move money.

Checkout is limited to the PayPal sandbox host `api-m.sandbox.paypal.com`.

## Tools

| Tool | How it is used |
| --- | --- |
| Next.js | App Router interface for the landing page, workspace, invoice editor, activity log, and PayPal return pages. |
| Convex | Invoices, line items, payments, reminders, assistant messages, and the activity log. Queries stay live as payments and approvals change. |
| PayPal Orders API v2 | Sandbox OAuth, `POST /v2/checkout/orders`, buyer approval, and `POST /v2/checkout/orders/{id}/capture`. |
| OpenAI `gpt-4o-mini` | The only model. It extracts a draft invoice, writes reminder copy, and answers questions about the workspace ledger. |

## Run it

Requirements: Node.js 20+, pnpm, a free Convex account, and optionally a PayPal sandbox REST app plus an OpenAI API key.

```bash
pnpm install
pnpm convex:dev
```

`pnpm convex:dev` logs you into Convex if needed, creates a dev deployment, and writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. Leave that process running. In a second terminal:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Convex environment variables

In the Convex dashboard for the dev deployment, set:

| Name | Value |
| --- | --- |
| `OPENAI_API_KEY` | An OpenAI key. PayPilot always calls `gpt-4o-mini`. |
| `PAYPAL_CLIENT_ID` | Sandbox client id from a PayPal REST app. |
| `PAYPAL_CLIENT_SECRET` | Sandbox secret from that same app. |
| `APP_URL` | `http://localhost:3000` |

`APP_URL` is used for the PayPal return and cancel URLs. The interface shows a notice when either integration is missing. You can still load demo invoices, edit drafts, and approve reminders without the keys. Drafting, the assistant, and checkout need the matching key.

Create the PayPal app at [developer.paypal.com](https://developer.paypal.com/). Use the sandbox business credentials as the API client, and a sandbox personal account as the buyer when the checkout opens.

### Suggested demo

1. Open the workspace and choose **Load demo invoices**.
2. Open **INV-1046 Brightline Labs**, which is already approved, and choose **Collect**.
3. Sign in with a PayPal sandbox personal account and approve the payment.
4. PayPilot returns to `/pay/return`, captures the order, checks the amount, and marks the invoice paid.
5. Open **Activity** and approve the sample Harbor & Co reminder. That approval does not send email.
6. With `OPENAI_API_KEY` set, describe a new invoice or ask the assistant which invoices are overdue.

The workspace key lives in this browser's local storage. Clearing site data starts a new empty workspace. This is a demo access model so the project can run without a separate login provider.

## Scripts

```bash
pnpm dev          # Next.js
pnpm convex:dev   # Convex dev deployment. Do not use `convex deploy` for local work.
pnpm lint
pnpm build
```

## License

MIT. See [LICENSE](./LICENSE).
