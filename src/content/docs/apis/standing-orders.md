---
title: M-Pesa Ratiba
description: Create standing orders for recurring collections.
---

M-Pesa Ratiba creates a standing order on a customer's wallet so payments repeat
without a prompt each time. Useful for subscriptions, loan repayments, SACCO
contributions and insurance premiums.

<div class="endpoint"><span class="verb">POST</span> standingorder/v1/createStandingOrderExternal</div>

:::caution[Commercial API]
Ratiba requires a signed commercial agreement before go-live. Charges are 5% of
transaction value capped at KES 5 per execution, exclusive of VAT, plus the
usual C2B tariff on the credited short code.
:::

## Create one

```php
use Starnerz\LaravelDaraja\Enums\StandingOrderFrequency;

Daraja::standingOrder()->create(
    name: 'Gym membership',
    phone: '0712345678',
    amount: 3500,
    startDate: now(),
    endDate: now()->addYear(),
    accountReference: 'MEMBER-114',
    frequency: StandingOrderFrequency::Monthly,
);
```

Dates accept a `DateTimeInterface` or a `Ymd` string.

The customer receives an STK prompt to authorise the order. If they are not
already opted in to Ratiba, Safaricom opts them in as part of the flow.

:::danger[Names must be unique per customer]
A customer cannot hold two standing orders with the same name. A duplicate
returns `1050`. Include something distinguishing — a plan ID or member number —
rather than a generic label.
:::

## Frequency

| Enum | Value |
|---|---|
| `OneOff` | 1 |
| `Daily` | 2 |
| `Weekly` | 3 |
| `BiWeekly` | 4 |
| `Monthly` | 5 |
| `BiMonthly` | 6 |
| `Quarterly` | 7 |
| `HalfYearly` | 8 |
| `Yearly` | 9 |

## Pay bill or till

The transaction type follows your configured `initiator.type`, or an explicit
`receiverType`. Pay bill sends `Standing Order Pay Bill External Third Party`;
a till sends `Standing Order Pay Merchant External Third Party`.

## Response

Ratiba does not follow Daraja's usual envelope. It nests everything under
`ResponseHeader`/`ResponseBody` and uses HTTP-style codes:

```php
$response->accepted();      // true for 200 (sync) or 0 (callback)
$response->responseCode;    // "200"
$response->responseRefId;
```

`accepted()` treats both `200` and `0` as success because the synchronous
response and the callback disagree on which to use.

## Error codes

| Code | Meaning |
|---|---|
| `1037` | Prompt never reached the handset |
| `1031` | User did not respond in time |
| `1032` | Cancelled by the user |
| `2001` | Wrong M-Pesa PIN |
| `1001` | An existing USSD session is open |
| `1050` | Duplicate standing order name |
| `1051` | Bad request — a payload field is invalid |
