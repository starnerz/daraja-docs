---
title: Accept M-Pesa payments
description: A complete STK Push integration in Laravel — from credentials to a payment you can prove arrived.
faq:
    - question: How do I integrate M-Pesa STK Push in Laravel?
      answer: >-
        Install starnerz/laravel-daraja, set your consumer key, secret, short
        code and passkey in .env, and call Daraja::stk()->push() with the phone
        number and amount. Safaricom acknowledges the prompt immediately and
        sends the outcome later to your callback URL, which arrives as an
        StkCallbackReceived event.
    - question: Why is my M-Pesa payment not marked as paid?
      answer: >-
        Because the response to the push is only an acknowledgement that
        Safaricom sent the prompt. The customer has not paid at that point. The
        payment is confirmed by the callback, which arrives at a public URL
        seconds or minutes later — so an application that marks orders paid on
        the push response marks unpaid orders paid.
    - question: What does M-Pesa result code 1032 mean?
      answer: >-
        The customer cancelled the prompt, or it timed out on the handset. 1037
        means the prompt never reached the phone, 1031 means no PIN was entered
        in time, 2001 is a wrong PIN, and 1001 means another session is already
        open for that number.
---

An STK Push sends a payment prompt to a customer's phone. They enter their
M-Pesa PIN, and the money lands in your short code.

This page builds the whole path: the prompt, the callback that says what
happened, a screen that tells the customer, and the failures that are waiting
for you in production.

By the end you will have a payment you can prove arrived — which is a different
and much smaller claim than a payment you assumed arrived.

## Before you start

- Sandbox credentials from the Daraja portal. See
  [Sandbox credentials](../../getting-started/sandbox/).
- PHP 8.3 or higher, and Laravel 12 or 13.
- A URL Safaricom can reach from the public internet. Your laptop is not one —
  [Testing callbacks on localhost](../callbacks-localhost/) is the whole story
  on that, and worth reading first if you have never done it.

## Install

```bash
composer require starnerz/laravel-daraja
php artisan vendor:publish --tag=laravel-daraja-config
```

```dotenv
DARAJA_MODE=sandbox
DARAJA_CONSUMER_KEY=your-consumer-key
DARAJA_CONSUMER_SECRET=your-consumer-secret
DARAJA_STK_SHORTCODE=174379
DARAJA_STK_PASS_KEY=your-passkey
DARAJA_STK_CALLBACK_URL=https://your-public-url/daraja/stk
DARAJA_ROUTES_ENABLED=true
```

`DARAJA_ROUTES_ENABLED` registers the package's own callback endpoints, which
parse Safaricom's payloads and dispatch typed events. You can point your own
controllers at the same parsers instead — see
[Handling callbacks](../../guides/callbacks/) — but start here.

Check the credentials before writing any code:

```bash
php artisan daraja:token
```

## Where payments are stored

Two tables, and the split matters.

```php
Schema::create('payment_attempts', function (Blueprint $table) {
    $table->id();
    $table->string('checkout_request_id')->unique();
    $table->foreignId('order_id')->constrained();
    $table->decimal('amount', 12, 2);
    $table->string('phone');
    $table->string('state')->default('pending');   // pending | paid | failed
    $table->string('failure_code')->nullable();    // 1032
    $table->string('failure_reason')->nullable();  // Request cancelled by user
    $table->timestamps();
});

Schema::create('payments', function (Blueprint $table) {
    $table->id();
    $table->string('receipt')->unique();           // NLJ7RT61SV
    $table->string('checkout_request_id')->nullable()->index();
    $table->decimal('amount', 12, 2);
    $table->string('msisdn')->nullable();
    $table->timestamp('paid_at');
    $table->timestamps();
});
```

An **attempt** is a prompt you sent. A **payment** is money that arrived. They
are not the same thing and most of the trouble in M-Pesa integrations comes
from treating them as one.

Attempts outnumber payments — people cancel, phones are off, PINs are
mistyped. And a payment can exist with no attempt at all, if a customer pays
your Pay Bill directly rather than through your checkout.

The unique index on `receipt` is what makes the whole thing safe to retry.
M-Pesa's receipt number is the only identifier both you and Safaricom agree on.

## Send the prompt

```php
use Starnerz\LaravelDaraja\Facades\Daraja;

$response = Daraja::stk()->push(
    phone: $order->phone,
    amount: $order->total,
    accountReference: $order->reference,   // 12 characters, shown to the customer
    description: 'Order '.$order->id,      // 13 characters
);

PaymentAttempt::create([
    'checkout_request_id' => $response->checkoutRequestId,
    'order_id' => $order->id,
    'amount' => $order->total,
    'phone' => $order->phone,
]);
```

Any Kenyan format works for the phone number — `0712345678`,
`+254712345678`, `254712345678`, even with spaces. An invalid number raises a
`DarajaException` before anything is sent.

:::danger[`accepted()` does not mean paid]
`$response->accepted()` means Safaricom pushed the prompt to the handset. The
customer has not done anything yet. Marking an order paid here is the single
most expensive mistake in this integration, and it is the default thing to do
if you have only ever worked with synchronous card APIs.
:::

Three limits worth knowing before your first rejected request:

| Field | Limit |
|---|---|
| `accountReference` | 12 characters — the customer sees this in the prompt |
| `description` | 13 characters |
| `amount` | KES 1 to 250,000, whole shillings |

For a till rather than a Pay Bill, the credit party is a different number from
the short code:

```php
use Starnerz\LaravelDaraja\Enums\TransactionType;

Daraja::stk()->push(
    phone: $order->phone,
    amount: $order->total,
    accountReference: $order->reference,
    type: TransactionType::BuyGoods,
    partyB: '5678901',        // the till number
);
```

## Receive the callback

The outcome arrives at your callback URL seconds or minutes later, as an event.

```php
use Illuminate\Contracts\Queue\ShouldQueue;
use Starnerz\LaravelDaraja\Events\StkCallbackReceived;

class RecordPayment implements ShouldQueue
{
    public function handle(StkCallbackReceived $event): void
    {
        $callback = $event->callback;

        $attempt = PaymentAttempt::firstWhere(
            'checkout_request_id',
            $callback->checkoutRequestId,
        );

        if (! $callback->successful()) {
            $attempt?->update([
                'state' => 'failed',
                'failure_code' => $callback->resultCode,
                'failure_reason' => $callback->resultDescription,
            ]);

            return;
        }

        $payment = Payment::updateOrCreate(
            ['receipt' => $callback->receipt()],
            [
                'checkout_request_id' => $callback->checkoutRequestId,
                'amount' => $callback->amount(),
                'msisdn' => $callback->phoneNumber(),
                'paid_at' => $callback->transactionDate(),
            ],
        );

        $attempt?->update(['state' => 'paid']);

        $order = $attempt?->order;
        $order?->markPaid($payment);
    }
}
```

Register it wherever you keep listeners:

```php
// bootstrap/app.php, or a service provider
Event::listen(RecordPayment::class);
```

Three decisions in that listener are load bearing:

- **It is queued.** Safaricom does not wait for you, and slow endpoints get
  spike arrested. The package's route answers `200` immediately and your work
  happens after.
- **`updateOrCreate` on the receipt.** Safaricom can deliver the same callback
  twice, and you will replay callbacks yourself while fixing things. The unique
  index turns a second delivery into an update instead of an exception.
- **The failure branch writes the code and the words.** `1032` and `1037` are
  different conversations with a customer, and a null column tells you neither.
  The code is what you count and branch on; the description is what makes the
  row readable six months later without anyone consulting a table.

| Result code | What happened |
|---|---|
| `0` | Paid |
| `1032` | Cancelled by the customer, or timed out on the handset |
| `1037` | The prompt never reached the phone |
| `1031` | No PIN entered in time |
| `2001` | Wrong M-Pesa PIN |
| `1001` | Another session is already open for that number |

:::caution[One prompt at a time per number]
Safaricom locks a subscriber while a session is open. Push twice to the same
number in quick succession and the second returns `1001`. Wait a minute, or
disable your pay button while an attempt is pending.
:::

### Three strings, not two

A failed payment produces three different pieces of text, and they have three
different audiences. Keeping them apart saves an argument later.

| | Comes from | Read by |
|---|---|---|
| `1032` | Safaricom, stable | your code — branch and count on this |
| `Request cancelled by user` | Safaricom, wording varies | you, reading the row months later |
| "You cancelled the payment." | you, derived from the code | the customer |

Store the first two. Derive the third:

```php
public function failureMessage(): string
{
    return match ($this->failure_code) {
        '1032' => 'You cancelled the payment. Try again when you are ready.',
        '1037', '1031' => 'The prompt timed out. Check your phone has signal and try again.',
        '2001' => 'That PIN was not accepted. Try again.',
        '1001' => 'There is already a payment in progress on that number. Wait a minute.',
        default => 'That payment did not go through. Try again, or use another number.',
    };
}
```

:::caution[Do not show Safaricom's description to a customer]
Some of it is fine. Some of it is `DS timeout user cannot be reached`. It is
written for whoever is debugging the integration, and it changes wording
without warning, so it belongs in your records rather than on a checkout page.

The same goes for `$response->customerMessage` on the push response, despite
the name. It says things like "Success. Request accepted for processing",
which is a sentence about an API call rather than about a payment.
:::

The package ships no enum for these codes — the full list is in
[Error codes](../../reference/error-codes/), and a `match` like the one above is
the whole of what most applications need.

## Tell the customer what happened

The prompt is asynchronous and the browser is not, so the page has to wait for
something that arrives elsewhere. Polling the attempt is the simplest honest
answer:

```php
Route::get('/checkout/{attempt}/state', function (PaymentAttempt $attempt) {
    return ['state' => $attempt->state];
});
```

```js
const poll = setInterval(async () => {
    const { state } = await fetch(`/checkout/${attemptId}/state`).then((r) => r.json());

    if (state !== 'pending') {
        clearInterval(poll);
        window.location.reload();
    }
}, 3000);
```

Stop polling after about ninety seconds and show the customer something useful
rather than a spinner that never resolves. If you would rather not write the
JavaScript, [M-Pesa checkout with Livewire](../livewire-checkout/) does the
same thing in a component.

When a callback never arrives at all, ask Safaricom directly:

```php
$status = Daraja::stk()->query($attempt->checkout_request_id);

$status->paid();
$status->cancelledByUser();
$status->resultDescription;
```

Use that as a fallback, not as a polling loop against Safaricom.

## Test it without a phone

The package is built on Laravel's HTTP client, so `Http::fake()` drives the
whole thing. No sandbox credentials, no network, no handset.

```php
it('pushes a prompt and records the attempt', function () {
    Http::fake([
        '*/oauth/*' => Http::response(['access_token' => 'test', 'expires_in' => '3599']),
        '*/mpesa/stkpush/*' => Http::response([
            'MerchantRequestID' => '29115-34620561-1',
            'CheckoutRequestID' => 'ws_CO_191220191020363925',
            'ResponseCode' => '0',
            'ResponseDescription' => 'Success',
            'CustomerMessage' => 'Success',
        ]),
    ]);

    $order = Order::factory()->create(['total' => 1500]);

    $this->post("/orders/{$order->id}/pay")->assertOk();

    expect($order->attempts()->sole()->checkout_request_id)
        ->toBe('ws_CO_191220191020363925');
});
```

Always fake the OAuth endpoint too — the package fetches a token before the
first call.

Then test the half that actually decides whether anybody gets their goods, by
posting a real callback payload at the route:

```php
it('records the payment when the callback says it succeeded', function () {
    $attempt = PaymentAttempt::factory()->create([
        'checkout_request_id' => 'ws_CO_191220191020363925',
    ]);

    $this->postJson('/daraja/stk', [
        'Body' => ['stkCallback' => [
            'MerchantRequestID' => '29115-34620561-1',
            'CheckoutRequestID' => 'ws_CO_191220191020363925',
            'ResultCode' => 0,
            'ResultDesc' => 'The service request is processed successfully.',
            'CallbackMetadata' => ['Item' => [
                ['Name' => 'Amount', 'Value' => 1500.0],
                ['Name' => 'MpesaReceiptNumber', 'Value' => 'NLJ7RT61SV'],
                ['Name' => 'PhoneNumber', 'Value' => 254712345678],
            ]],
        ]],
    ])->assertOk();

    expect($attempt->fresh()->state)->toBe('paid')
        ->and(Payment::firstWhere('receipt', 'NLJ7RT61SV'))->not->toBeNull();
});
```

Test the cancelled payload as well. It has **no `CallbackMetadata` at all**,
which is where handlers that assume the key exists fall over:

```php
'Body' => ['stkCallback' => [
    'MerchantRequestID' => '29115-34620561-1',
    'CheckoutRequestID' => 'ws_CO_191220191020363925',
    'ResultCode' => 1032,
    'ResultDesc' => 'Request cancelled by user',
]],
```

[Testing](../../guides/testing/) covers the rest, including the trap that
`Http::fake()` merges rather than replaces and the first matching stub wins.

## What breaks in production

In roughly the order it happens to people:

1. **A callback URL Safaricom cannot reach.** Accepted at push time, never
   called. Looks exactly like a customer who did not pay.
2. **Marking the order paid on `accepted()`.** Ships goods for prompts nobody
   ever confirmed.
3. **A handler that throws.** Safaricom delivers once. The customer paid and
   got nothing, and the only record is in your logs.
4. **The prompt that concludes neither way.** No callback, no failure — query
   it, or it sits pending forever and every count you have is slightly wrong.
5. **Sandbox credentials still in the production `.env`.** Every push is
   accepted and no money ever moves.

The first four are the same problem wearing different clothes: the callback is
the only thing that knows what happened, and it is the least reliable part of
the system.

## Going live

Switching `DARAJA_MODE` to `live` changes the API host and the certificate used
to encrypt security credentials. It does not change your consumer key and
secret, which are per-environment and have to be set separately.

Production callback URLs must be HTTPS, and there is a list of words Safaricom
rejects in them. [Going live](../../guides/going-live/) is the checklist.

## Next

You now have a working integration and one unanswered question: how do you know
your database matches Safaricom's?

That is [Reconciling payments](../../guides/reconciliation/), and it is the
page that stops a quiet failure becoming a wrong set of books.
