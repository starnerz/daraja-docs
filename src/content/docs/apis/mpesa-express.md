---
title: M-Pesa Express (STK Push)
description: Prompt a customer to authorise a payment on their handset.
---

M-Pesa Express, commonly called STK Push, sends a payment prompt to a
customer's phone. They confirm with their M-Pesa PIN and the money lands in your
short code.

<div class="endpoint"><span class="verb">POST</span> mpesa/stkpush/v1/processrequest</div>

## Push a prompt

```php
use Starnerz\LaravelDaraja\Facades\Daraja;

$response = Daraja::stk()->push(
    phone: '0712345678',
    amount: 1500,
    accountReference: 'INV-001',
    description: 'Invoice 001',
);

$response->accepted();          // true — the prompt was sent
$response->checkoutRequestId;   // keep this; it identifies the attempt
$response->merchantRequestId;
$response->customerMessage;
```

Any Kenyan format works for `phone` — `0712345678`, `+254712345678`,
`254712345678`, even with spaces or dashes. Invalid numbers raise a
`DarajaException` before a request is sent.

:::note[This is only an acknowledgement]
`accepted()` means Safaricom pushed the prompt. Whether the customer paid
arrives later on your callback URL. Never mark an order paid here.
:::

## Field limits

| Field | Limit |
|---|---|
| `accountReference` | 12 characters — shown to the customer in the prompt |
| `description` | 13 characters, defaults to the account reference |
| `amount` | KES 1 to 250,000, rounded to whole shillings |

## Buy Goods

For a till, the short code and the credit party are **different numbers**:
`BusinessShortCode` is your HO or store number, `PartyB` is the till.

```php
use Starnerz\LaravelDaraja\Enums\TransactionType;

Daraja::stk()->push(
    phone: '0712345678',
    amount: 500,
    accountReference: 'ORDER-9',
    type: TransactionType::BuyGoods,
    partyB: '5678901',        // the till number
);
```

Omit `partyB` and it defaults to the short code, which is correct for Pay Bill
and wrong for Buy Goods.

## Query a push

<div class="endpoint"><span class="verb">POST</span> mpesa/stkpushquery/v1/query</div>

```php
$status = Daraja::stk()->query($response->checkoutRequestId);

$status->paid();             // ResultCode 0
$status->cancelledByUser();  // ResultCode 1032
$status->resultDescription;
```

Use this as a fallback when a callback never arrives, not as a polling loop.

## The callback

```php
use Starnerz\LaravelDaraja\Events\StkCallbackReceived;

class RecordPayment
{
    public function handle(StkCallbackReceived $event): void
    {
        $callback = $event->callback;

        if (! $callback->successful()) {
            return;
        }

        Order::where('checkout_request_id', $callback->checkoutRequestId)
            ->update([
                'mpesa_receipt' => $callback->receipt(),
                'amount_paid' => $callback->amount(),
                'paid_at' => now(),
            ]);
    }
}
```

`CallbackMetadata` is absent entirely when the payment fails, so `amount()` and
`receipt()` return empty values rather than throwing.

| Result code | Meaning |
|---|---|
| `0` | Paid |
| `1032` | Cancelled by the user, or the prompt timed out |
| `1037` | Prompt never reached the handset |
| `1031` | User did not enter a PIN in time |
| `2001` | Wrong M-Pesa PIN |
| `1001` | Another session is already open for that number |

:::caution[One push at a time per number]
Safaricom locks a subscriber while a session is open. Wait at least a minute
between pushes to the same number or you will get `1001`.
:::

## Reversing

Unlike B2C, M-Pesa Express transactions **can** be reversed through the
[Reversal API](../account-services/#reversal).
