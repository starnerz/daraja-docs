---
title: Lipa na Bonga
description: Accept Safaricom loyalty points as payment.
---

Lipa na Bonga lets customers pay with Bonga points instead of cash. Points
redeem at **KES 0.20 each**.

## Calculate the value

<div class="endpoint"><span class="verb">POST</span> v1/lipa/na/bonga/calculate-points</div>

Show the customer what their points are worth before they commit:

```php
$quote = Daraja::bonga()->calculatePoints(400);

$quote->amount();   // "80"
$quote->points();   // "400"
$quote->rate();     // "0.2"
```

## Redeem

<div class="endpoint"><span class="verb">POST</span> v1/lipa/na/bonga/redeem-paybill</div>

```php
$response = Daraja::bonga()->redeem(
    phone: '0712345678',
    amount: 80,
    bongaPoints: 400,
    accountNumber: 'INV-22',
);

$response->successful();
$response->customerMessage;
```

The customer receives an STK prompt and authorises with their M-Pesa PIN. If
they have too few points, Safaricom tells them to choose another payment method.

:::note[The money arrives as C2B]
This API has no callback URL of its own. On success M-Pesa transfers funds to
your short code and the notification lands on your
[C2B confirmation URL](../c2b/#confirmation).
:::

## Responses

Bonga wraps everything in a `header`/`body` envelope with an integer response
code, unlike the rest of Daraja:

```php
$response->responseCode;      // 200 (int)
$response->responseMessage;
$response->customerMessage;
$response->requestRefId;
$response->timestamp;
```

`successful()` accepts both `200` and `6000`, because the portal's samples and
its result-code table disagree on which indicates success.

## Result codes

| Code | Meaning |
|---|---|
| `6000` | Success |
| `6001` | Fail |
| `6004` | Server error |
| `6005` | Invalid credentials |
| `6006` | Missing parts in the request body |
| `6007`–`6009` | CBS, STK or broker unavailable |
| `6011` | Database unavailable |
| `1037` | Customer has no STK applet — SIM needs updating |
| `1031` | Prompt timed out |
| `2001` | Wrong PIN |
| `17` | Reversal failed, account balance limit |

## Earning points

Customers earn 1 point per KES 10 spent on Safaricom services, and 1 point per
qualifying M-Pesa transaction charge of KES 100 or more. Nothing in this API
awards points — it only spends them.
