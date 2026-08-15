---
title: Handling callbacks
description: Turn Safaricom's callbacks into typed events.
---

Most Daraja APIs answer asynchronously: you get an acknowledgement, and the real
outcome arrives later at a URL you nominated. You have two options for receiving
them.

## Option 1: the package's routes

Enable them and the package registers endpoints that parse each payload and
dispatch a typed event.

```dotenv
DARAJA_ROUTES_ENABLED=true
DARAJA_ROUTES_PREFIX=daraja
```

| Route | Event |
|---|---|
| `POST /daraja/stk` | `StkCallbackReceived` |
| `POST /daraja/c2b/validation` | `C2BValidationRequested` |
| `POST /daraja/c2b/confirmation` | `C2BPaymentReceived` |
| `POST /daraja/result/{type}` | `ResultReceived` |
| `POST /daraja/timeout/{type}` | `TimeoutReceived` |

`{type}` is whatever you put in the URL — `b2c`, `b2b`, `balance`, `reversal`,
`transaction-status` — and it comes back on the event so one listener can serve
them all.

```php
Event::listen(function (ResultReceived $event) {
    match ($event->type) {
        'b2c' => PayoutResult::record($event->result),
        'balance' => BalanceSnapshot::store($event->result->balances()),
        default => null,
    };
});
```

## Option 2: your own routes

Point your existing controllers at the same DTOs:

```php
use Starnerz\LaravelDaraja\Data\Callbacks\StkCallback;

public function __invoke(Request $request)
{
    $callback = StkCallback::fromArray($request->all());

    if ($callback->successful()) {
        Order::markPaid($callback->checkoutRequestId, $callback->receipt());
    }

    return response()->json(['ResultCode' => 0, 'ResultDesc' => 'Accepted']);
}
```

## Always answer 200

Safaricom retries or flags endpoints that error. The package's routes always
return `200` with an acknowledgement, and yours should too — application
failures belong in a queued listener, not in the response to Safaricom.

## Why the parsers exist

Daraja's result payloads change shape between success and failure. All of the
following are real:

- `ResultParameter` is an **array** on success and a **bare object** on failure.
  Same for `ReferenceItem`.
- Keys repeat. Transaction Status returns `DebitPartyName` twice, once per side.
- A pair can arrive with **no `Value` key at all**: `{"Key": "TransactionReason"}`.
- Casing differs per API — `Key`/`Value`, `Name`/`Value`, `name`/`value`.
- `ResultCode` is numeric in B2C, a string like `"R000002"` in Reversal.

`ResultParameters` absorbs all of it:

```php
$result->parameters->string('TransactionReceipt');
$result->parameters->float('TransactionAmount');
$result->parameters->all('DebitPartyName');   // both values
$result->parameters->has('TransactionReason');
```

## Verifying the source

Callbacks carry **no signature or shared secret**. The only check available is
the source address:

```dotenv
DARAJA_ALLOWED_IPS=196.201.214.0/24,196.201.212.0/24
```

Then apply the middleware to your callback routes:

```php
use Starnerz\LaravelDaraja\Http\Middleware\VerifySafaricomIp;

Route::post('/daraja/stk', StkController::class)
    ->middleware(VerifySafaricomIp::class);
```

The list ships empty, which permits everything. Safaricom issues its ranges to
partners rather than publishing them, so no addresses are bundled — ask your
account manager.

:::danger[Treat callbacks as unverified]
An address check is weak. Before releasing goods or funds, confirm the payment
independently with [Transaction Status](../../apis/account-services/#transaction-status).
:::

## URL requirements

- Production must be HTTPS. Sandbox allows HTTP.
- No `M-PESA`, `Safaricom`, `mpesa`, `exe`, `exec`, `cmd`, `sql` or `query` in
  the URL.
- Public tunnels such as ngrok are usually blocked, especially in production.

## Queue the slow work

Except for C2B validation, listeners should be queued. Safaricom does not wait
for you, and slow endpoints get spike-arrested.

```php
class RecordPayment implements ShouldQueue
{
    public function handle(StkCallbackReceived $event): void { /* … */ }
}
```
