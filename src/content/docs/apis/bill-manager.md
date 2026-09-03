---
title: Bill Manager
description: Send e-invoices, receive payments and reconcile them.
---

Bill Manager sends invoices by SMS, chases them with reminders, and pushes
payments back to you for reconciliation so customers get an e-receipt.

## Opt in first

<div class="endpoint"><span class="verb">POST</span> v1/billmanager-invoice/optin</div>

```php
$response = Daraja::billManager()->optIn(
    email: 'billing@example.com',
    officialContact: '0710000000',
    sendReminders: true,
);

$response->appKey;   // AG_2376487236_126732989KJ
```

:::danger[Store the app key immediately]
It is returned **once** and never again. Bulk invoicing sends it as an `appKey`
header, so put it in `DARAJA_BILL_MANAGER_APP_KEY` before you move on.
:::

Opt-in whitelists your short code; nothing else works until it succeeds. Update
the details later with `updateOptIn()`.

Reminders, when enabled, go out 7 days before the due date, 3 days before, and
on the day.

## Single invoice

<div class="endpoint"><span class="verb">POST</span> v1/billmanager-invoice/single-invoicing</div>

```php
Daraja::billManager()->invoice(
    externalReference: 'INV-100',
    billedFullName: 'John Doe',
    billedPhoneNumber: '0712345678',
    billedPeriod: 'August 2026',
    invoiceName: 'Water',
    dueDate: '2026-09-15',
    accountReference: 'ACC-1',
    amount: 800,
    items: [
        ['itemName' => 'Water', 'amount' => 700],
        ['itemName' => 'Standing charge', 'amount' => 100],
    ],
);
```

`externalReference` is your own identifier and must be unique — it is how you
and Bill Manager refer to the same invoice.

## Bulk invoicing

<div class="endpoint"><span class="verb">POST</span> v1/billmanager-invoice/bulk-invoicing</div>

Up to **1000** invoices per call. The package rejects an empty batch or an
oversized one before sending.

```php
Daraja::billManager()->bulkInvoice(
    $invoices->map(fn ($invoice) => [
        'externalReference' => $invoice->reference,
        'billedFullName' => $invoice->customer_name,
        'billedPhoneNumber' => $invoice->phone,
        'billedPeriod' => $invoice->period,
        'invoiceName' => $invoice->description,
        'dueDate' => $invoice->due_at->toDateString(),
        'accountReference' => $invoice->account,
        'amount' => $invoice->total,
    ])->all(),
);
```

## Reconciliation

Bill Manager pushes each payment to your callback URL and retries up to **five
times**. Acknowledge it so the customer receives their e-receipt:

```php
Daraja::billManager()->acknowledge(
    paymentDate: '2026-10-01',
    paidAmount: 800,
    accountReference: 'ACC-1',
    transactionId: 'PJB53MYR1N',
    phoneNumber: '0710000000',
    fullName: 'John Doe',
    invoiceName: 'Water',
    externalReference: 'INV-100',
);
```

## Cancelling

```php
Daraja::billManager()->cancelInvoice('INV-100');
Daraja::billManager()->cancelInvoices(['INV-101', 'INV-102']);
```

A partially or fully paid invoice cannot be cancelled — Safaricom answers
`rescode` `409`.

## Responses

Bill Manager uses its own envelope rather than Daraja's:

```php
$response->successful();     // rescode === "200"
$response->code;             // "200"
$response->message;          // "Success"
$response->statusMessage;    // "Invoice sent successfully"
$response->errors;
```
