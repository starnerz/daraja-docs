---
title: Accept M-Pesa payments
description: A complete STK Push integration in Laravel — from credentials to a payment you can prove arrived.
draft: true
---

<!--
    SKELETON — draft: true keeps this out of production builds. It renders in
    `npm run dev` only. Delete the flag when the prose is written, and add the
    sidebar entry in astro.config.mjs at the same time.

    Target queries: "mpesa laravel", "stk push laravel", "lipa na mpesa api laravel".
    Everything else on the site should link up to this page.
-->

## What you will build

A checkout that sends an M-Pesa prompt to a phone, waits for the customer to
enter their PIN, and records the payment when Safaricom confirms it — with the
failure cases handled rather than ignored.

Working demo: `TODO — public repo link`

## Before you start

- A Daraja account and sandbox credentials — see
  [Sandbox credentials](../../getting-started/sandbox/).
- PHP 8.3+ and Laravel 12 or 13.
- A callback URL Safaricom can reach. Localhost cannot receive callbacks;
  [Testing](../../guides/testing/) covers how to work without one.

## Install

```bash
composer require starnerz/laravel-daraja
php artisan vendor:publish --tag=laravel-daraja-config
```

```dotenv
DARAJA_MODE=sandbox
DARAJA_CONSUMER_KEY=
DARAJA_CONSUMER_SECRET=
DARAJA_STK_SHORTCODE=174379
DARAJA_STK_PASS_KEY=
DARAJA_STK_CALLBACK_URL=https://your-domain/daraja/stk
DARAJA_ROUTES_ENABLED=true
```

TODO: what each of these is, and which ones change when you go live.

## Where payments are stored

TODO: the table, and why the receipt is unique. Keep it the same shape as the
one in [Reconciling payments](../../guides/reconciliation/) so the two pages
agree.

```php
Schema::create('payments', function (Blueprint $table) {
    $table->id();
    $table->string('receipt')->unique();
    $table->string('checkout_request_id')->nullable()->index();
    $table->decimal('amount', 12, 2);
    $table->string('msisdn')->nullable();
    $table->timestamp('paid_at');
    $table->timestamps();
});
```

## Send the prompt

```php
$response = Daraja::stk()->push(
    phone: '0712345678',
    amount: 1500,
    accountReference: 'INV-001',
    description: 'Invoice 001',
);

$response->accepted();          // the prompt was sent
$response->checkoutRequestId;   // keep this — it identifies the attempt
```

TODO: `accepted()` means Safaricom took the request, not that anybody paid.
Store the attempt here; this is the row reconciliation needs later.

## Receive the callback

```php
use Starnerz\LaravelDaraja\Events\StkCallbackReceived;

class RecordPayment implements ShouldQueue
{
    public function handle(StkCallbackReceived $event): void
    {
        $callback = $event->callback;

        if (! $callback->successful()) {
            // 1032 cancelled, 1037 no response, 1 insufficient funds
            return;
        }

        Payment::updateOrCreate(
            ['receipt' => $callback->receipt()],
            [
                'checkout_request_id' => $callback->checkoutRequestId,
                'amount' => $callback->amount(),
                'msisdn' => $callback->phoneNumber(),
                'paid_at' => $callback->transactionDate(),
            ],
        );
    }
}
```

TODO: why the listener is queued, why `updateOrCreate` and not `create`, and
why the route always answers 200. Link to
[Handling callbacks](../../guides/callbacks/).

## Tell the customer what happened

TODO: the prompt is asynchronous and the browser is not. Polling on
`checkout_request_id` is the simple answer; broadcasting is the better one.
Show the simple one.

## Test it without a phone

TODO: `Http::fake()`, the shipped fixtures, and asserting the event fired.
Link to [Testing](../../guides/testing/).

## What breaks in production

TODO, in this order — each of these has cost somebody real money:

1. A callback URL Safaricom cannot reach. Accepted at push time, never called.
2. The prompt that concludes neither way. `Daraja::stk()->query()`.
3. Duplicate deliveries.
4. A handler that throws — the customer paid and got nothing.
5. Sandbox credentials still in production `.env`.

## Going live

TODO: short summary, then link to [Going live](../../guides/going-live/).

## Next

The payment that never reached your database is the subject of
[Reconciling payments](../../guides/reconciliation/).
