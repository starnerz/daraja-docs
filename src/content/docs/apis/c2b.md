---
title: Customer to Business
description: Receive notifications when customers pay your short code directly.
---

C2B covers payments a customer initiates themselves — through the M-Pesa app,
USSD, SIM toolkit or a scanned QR code. You register two URLs and Safaricom
notifies you when money arrives.

<div class="endpoint"><span class="verb">POST</span> mpesa/c2b/v2/registerurl</div>

## Register your URLs

```php
Daraja::c2b()->registerUrls(
    confirmationUrl: 'https://your-domain/daraja/c2b/confirmation',
    validationUrl: 'https://your-domain/daraja/c2b/validation',
);
```

Both default to the configured URLs, so with `DARAJA_C2B_CONFIRMATION_URL` and
`DARAJA_C2B_VALIDATION_URL` set you can call it bare, or use the command:

```bash
php artisan daraja:register-urls
```

:::caution[Production registration is one-time]
In production this succeeds once. To change the URLs, delete them under
**Self Services → URL Management** on the Daraja portal and register again.
Sandbox lets you overwrite freely.
:::

### Response type

`responseType` decides what M-Pesa does when your validation URL is unreachable:

| Value | Behaviour |
|---|---|
| `Completed` | Accept the payment anyway (default) |
| `Cancelled` | Reject the payment |

Spelling and case are exact — Safaricom rejects anything else.

## Confirmation

Fires after a successful payment:

```php
use Starnerz\LaravelDaraja\Events\C2BPaymentReceived;

public function handle(C2BPaymentReceived $event): void
{
    $transaction = $event->transaction;

    Payment::create([
        'receipt' => $transaction->transactionId,
        'amount' => $transaction->amount,
        'account' => $transaction->billReferenceNumber,
        'payer' => $transaction->fullName(),
        'phone' => $transaction->msisdn,          // masked: 2547 ***** 126
    ]);
}
```

The MSISDN is **masked** in v2. v1 sent a SHA-256 hash instead; neither gives
you the full number.

## Validation

Validation is optional and **disabled by default** — email
`apisupport@safaricom.co.ke` to enable it on your short code. Once on, Safaricom
asks permission before completing each payment and waits roughly **8 seconds**.

Because that is synchronous, it uses a decision callback rather than an event:

```php
// In a service provider's boot method
use Starnerz\LaravelDaraja\Data\Callbacks\C2BTransaction;
use Starnerz\LaravelDaraja\Facades\Daraja;

Daraja::validateC2BUsing(function (C2BTransaction $transaction): bool|string {
    $invoice = Invoice::where('reference', $transaction->billReferenceNumber)->first();

    if (! $invoice) {
        return 'C2B00012';   // Invalid Account Number
    }

    if ((float) $transaction->amount < $invoice->balance) {
        return 'C2B00013';   // Invalid Amount
    }

    return true;
});
```

Return `true` to accept, `false` to reject generically, or a specific code:

| Code | Meaning |
|---|---|
| `C2B00011` | Invalid MSISDN |
| `C2B00012` | Invalid Account Number |
| `C2B00013` | Invalid Amount |
| `C2B00014` | Invalid KYC Details |
| `C2B00015` | Invalid Short code |
| `C2B00016` | Other Error |

Keep the callback fast. Queue anything slow — a timeout falls back to your
`responseType`.

## Simulate a payment

Sandbox only. The package throws if `mode` is `live`.

```php
Daraja::c2b()->simulatePayBill('0712345678', 500, 'INV-77');
Daraja::c2b()->simulateBuyGoods('0712345678', 500);
```

## Missed notifications

If your endpoint was down, [Pull Transactions](../pull-transactions/) retrieves
anything from the last 48 hours.
