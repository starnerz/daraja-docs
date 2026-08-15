---
title: Events
description: Events dispatched when callbacks arrive.
---

All under `Starnerz\LaravelDaraja\Events`. They fire only when the package's
callback routes are enabled; using your own routes means dispatching them
yourself, or skipping events entirely.

## StkCallbackReceived

An M-Pesa Express prompt concluded.

```php
public function handle(StkCallbackReceived $event): void
{
    $c = $event->callback;   // StkCallback

    $c->successful();
    $c->cancelledByUser();   // 1032
    $c->timedOut();          // 1037 or 1031
    $c->receipt();
    $c->amount();
    $c->phoneNumber();
    $c->transactionDate();
    $c->checkoutRequestId;
    $c->resultCode;          // always a string
}
```

## C2BPaymentReceived

A customer paid your short code and Safaricom confirmed it.

```php
$t = $event->transaction;    // C2BTransaction

$t->transactionId;
$t->amount;
$t->billReferenceNumber;
$t->msisdn;                  // masked
$t->fullName();
$t->isPayBill();
$t->isConfirmation();
```

## C2BValidationRequested

Safaricom is asking whether to accept a payment. **Informational only** — it
cannot decide the outcome, because Safaricom needs an answer in about eight
seconds. Use `Daraja::validateC2BUsing()` for the decision.

## ResultReceived

A result arrived for one of the asynchronous APIs.

```php
public function handle(ResultReceived $event): void
{
    $event->type;      // 'b2c', 'b2b', 'balance', 'reversal', 'transaction-status'
    $result = $event->result;   // ResultCallback

    $result->successful();
    $result->resultCode;
    $result->receipt();
    $result->amount();
    $result->receiverName();
    $result->recipientIsRegistered();
    $result->hasRealTransactionId();
    $result->balances();          // AccountBalances
    $result->partyNames();        // duplicate keys preserved
    $result->parameters;          // ResultParameters
    $result->reference;           // ResultParameters
}
```

`type` is the URL segment you registered, so one listener can serve every API.

## TimeoutReceived

Safaricom could not process a request in time.

```php
$event->type;      // the URL segment
$event->payload;   // raw array — the shape is not consistently documented
```

## Registering listeners

```php
// bootstrap/app.php or a service provider
Event::listen(function (StkCallbackReceived $event) {
    // …
});
```

Queue anything slow:

```php
class RecordPayment implements ShouldQueue
{
    public function handle(StkCallbackReceived $event): void { /* … */ }
}
```
