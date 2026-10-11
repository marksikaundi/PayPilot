export const APPROVAL_RULES = [
  {
    title: "Drafts stay drafts",
    body: "PayPal checkout stays closed until you approve the invoice.",
  },
  {
    title: "The total is locked",
    body: "Checkout charges the invoice total in USD. The model does not choose the amount.",
  },
  {
    title: "Paid means captured",
    body: "An invoice turns paid only after PayPal reports a COMPLETED capture for that same total.",
  },
  {
    title: "Reminders wait for you",
    body: "The assistant can draft a reminder. It stays pending until you approve the wording.",
  },
  {
    title: "Approval is not a payment",
    body: "Approving an invoice or a reminder does not move money. Only the PayPal checkout does.",
  },
];

export function RulesList() {
  return (
    <ol className="space-y-4">
      {APPROVAL_RULES.map((rule, index) => (
        <li key={rule.title} className="grid grid-cols-[auto_1fr] gap-3">
          <span className="font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <p className="font-medium">{rule.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{rule.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
