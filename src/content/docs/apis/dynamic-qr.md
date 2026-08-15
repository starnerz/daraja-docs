---
title: Dynamic QR
description: Generate a QR code that captures the till and amount for the customer.
---

Generates a QR code M-Pesa app users scan to capture your till number and the
amount, then authorise payment. Unlike most of Daraja, this one is synchronous —
the code comes back in the response.

<div class="endpoint"><span class="verb">POST</span> mpesa/qrcode/v1/generate</div>

```php
use Starnerz\LaravelDaraja\Enums\QrTransactionType;

$qr = Daraja::qr()->generate(
    merchantName: 'Test Supermarket',
    reference: 'INV-9',
    amount: 1200,
    type: QrTransactionType::BuyGoods,
    size: 300,
);
```

## Using the image

The API returns base64 PNG data. Two helpers save you decoding it:

```php
// Embed straight into a Blade view
<img src="{{ $qr->dataUri() }}" alt="Scan to pay">

// Or store the raw bytes
Storage::put("qr/{$invoice->id}.png", $qr->png());
```

## Transaction types

| Enum | Code | Meaning |
|---|---|---|
| `QrTransactionType::BuyGoods` | `BG` | Pay merchant (buy goods) |
| `QrTransactionType::WithdrawAtAgent` | `WA` | Withdraw cash at an agent till |
| `QrTransactionType::PayBill` | `PB` | Pay bill or business number |
| `QrTransactionType::SendMoney` | `SM` | Send money to a mobile number |
| `QrTransactionType::SendToBusiness` | `SB` | Send to business, CPI in MSISDN format |

The credit party defaults to your configured short code. Override it when the
QR should point somewhere else:

```php
Daraja::qr()->generate('Shop', 'REF', 500,
    QrTransactionType::PayBill,
    creditPartyIdentifier: '174379',
);
```

:::caution[ResponseCode is not a status here]
Dynamic QR reuses the name `ResponseCode` for an identifier string such as
`AG_20191219_000043fdf61864fe9ff5`, not the usual `"0"`. There is deliberately
no `accepted()` helper on this response — check that `qrCode` is non-empty
instead.
:::

## Payment notification

Scanning produces an ordinary C2B payment, so the money arrives through your
[C2B confirmation URL](../c2b/#confirmation). This API only makes the image.
