---
title: Business to Business
description: Pay other businesses, and top up your own B2C short code.
---

All three B2B operations share one endpoint and differ only by `CommandID`.

<div class="endpoint"><span class="verb">POST</span> mpesa/b2b/v1/paymentrequest</div>

Money moves from your **MMF/Working** account to the recipient's account.

## Pay another business

```php
// To a pay bill — credits their utility account
Daraja::b2b()->payBill(
    receiverShortCode: '123456',
    amount: 15000,
    accountReference: 'ACC-88',
    remarks: 'October supply',
);

// To a till or merchant store — credits their merchant account
Daraja::b2b()->buyGoods('654321', 4500);
```

`accountReference` is capped at 13 characters.

## Paying for a customer

Both accept an optional `requester`, the mobile number of the consumer you are
paying on behalf of:

```php
Daraja::b2b()->payBill('123456', 2000, 'ACC-88', requester: '0712345678');
```

## B2C Account Top Up

Loads funds into one of your own B2C short codes so it can disburse. This is the
API answer to "my B2C says insufficient balance but the money is in Working".

```php
Daraja::b2b()->accountTopUp(
    b2cShortCode: '600979',
    amount: 100000,
    accountReference: 'TOPUP-11',
);
```

:::note[A different operator role]
Top-up needs the **Org Business Pay to Bulk API initiator** role, which is
separate from the Pay Bill and Buy Goods roles. An initiator with only the
latter gets `21 The initiator is not allowed to initiate this request`.
:::

## Identifier types

Safaricom accepts only type `4` on both sides of this API, whatever the
destination. The package hard-codes it, so nothing is derived from your
configured `initiator.type` here.

## The result

```php
public function handle(ResultReceived $event): void
{
    if ($event->type !== 'b2b') {
        return;
    }

    $event->result->successful();
    $event->result->receipt();
}
```

Balance values in B2B results are not JSON. They arrive either pipe-delimited or
as a Java-style map literal:

```
Working Account|KES|346568.83|6186.83|340382.00|0.00
{Amount={CurrencyCode=KES, MinimumAmount=618683, BasicAmount=6186.83}}
```

The first form parses with `AccountBalances`; the second is exposed raw through
`$event->result->parameters`.

:::caution[Failure payloads change shape]
On failure `ResultParameter` degrades from an array to a single bare object, and
`TransactionID` becomes a placeholder like `OAK0000000`. Both are handled —
`hasRealTransactionId()` tells you whether the receipt is genuine.
:::
