---
title: Pull Transactions
description: Recover C2B payments whose callbacks never arrived.
---

Pull Transactions is a reconciliation tool. When your confirmation endpoint was
down, this retrieves the C2B payments you missed.

:::caution[48 hours only]
Transactions are retained for 48 hours. Anything older has to come from the
M-Pesa organisation portal.
:::

## Register once

<div class="endpoint"><span class="verb">POST</span> pulltransactions/v1/register</div>

```php
Daraja::pull()->register(
    nominatedNumber: '0722000000',
    callbackUrl: 'https://your-domain/daraja/pull',
);
```

Both default to configuration. The nominated number is the MSISDN on your short
code's KYC record in the M-Pesa portal — not an arbitrary number.

| Code | Meaning |
|---|---|
| `1000` | Registered successfully |
| `1001` | Already registered |

Registration is one-time per short code, and the short code must be live in
production.

## Query

<div class="endpoint"><span class="verb">POST</span> pulltransactions/v1/query</div>

```php
$transactions = Daraja::pull()->query(
    from: now()->subDay(),
    to: now(),
);

foreach ($transactions as $transaction) {
    $transaction->transactionId;    // yzlyrEsRG1
    $transaction->date;             // 2020-08-05T10:13:00Z
    $transaction->msisdn;
    $transaction->amount;           // "168.00"
    $transaction->billReference;
    $transaction->transactionType;  // c2b-pay-bill-debit
    $transaction->organisationName;
}
```

Dates accept a `DateTimeInterface` or a `Y-m-d H:i:s` string. The return value is
a Laravel collection of `PulledTransaction` objects.

## Paging

`offset` is a **row offset**, not a page number:

```php
$page2 = Daraja::pull()->query(now()->subDay(), now(), offset: 100);
```

## Reconciling

```php
$missed = Daraja::pull()->query(now()->subHours(6), now())
    ->reject(fn ($pulled) => Payment::where('receipt', $pulled->transactionId)->exists());

foreach ($missed as $transaction) {
    RecordMissedPayment::dispatch($transaction);
}
```

:::note[Shape of the raw response]
The API nests its list one level deeper than you would expect — `Response` is an
array *of arrays* — and its keys are lowercase, unlike the rest of Daraja. The
package flattens and maps both, so neither reaches your code.
:::

## Limitations

- Only C2B transactions. B2C, B2B and reversals are not covered.
- Registration must happen before any query.
- Code `1001` on a query means no transactions in the period, not an error.
