---
title: M-Pesa checkout for a SPA or mobile app
description: Two Laravel endpoints and a polling client — an M-Pesa checkout for a Vue, React or Flutter front end.
faq:
    - question: How do I build an M-Pesa STK Push API for a Vue or React front end?
      answer: >-
        Two endpoints. One accepts a phone number, pushes the prompt and returns
        your own attempt identifier with a 202. The other returns that attempt's
        current state. The client polls the second until the state stops being
        pending, and the callback from Safaricom is what changes it.
    - question: Should the client know the M-Pesa CheckoutRequestID?
      answer: >-
        No. It is Safaricom's identifier for a prompt, not a payment reference,
        and it lets a client query things it has no business querying. Expose
        your own attempt id — a ULID rather than an incrementing integer — and
        keep Safaricom's identifiers on the server.
    - question: What happens if the customer closes the app before paying?
      answer: >-
        The payment still completes. The prompt lives on the handset and the
        callback arrives at your server regardless of whether the app is open,
        so the front end being present is a convenience. When the app reopens it
        asks for the attempt state and finds it already settled.
---

Your front end is Vue, React, or a phone app. Laravel is an API behind it.

The awkward part of M-Pesa in that arrangement is not the HTTP — it is that the
payment concludes on a request your front end never makes, from Safaricom's
servers to yours, possibly after the customer has closed the app.

So the client cannot be told the outcome. It has to ask.

This page builds that as two endpoints and one polling loop, with the
authorisation and rate limiting that a public payment endpoint needs.

The server side — the push, the callback, the tables — is
[Accept M-Pesa payments](../stk-push/). This page is the API surface on top of
it.

## The contract

Two endpoints. Resist the third.

| | |
|---|---|
| `POST /api/payments` | Push a prompt. Returns `202` and an attempt id. |
| `GET /api/payments/{attempt}` | The current state of that attempt. |

```json
// POST /api/payments  →  202 Accepted
{ "id": "01j8z4q2h9k3m5n7p9r1s3t5v7", "state": "pending" }
```

```json
// GET /api/payments/01j8z4q2h9k3m5n7p9r1s3t5v7  →  200 OK
{
    "id": "01j8z4q2h9k3m5n7p9r1s3t5v7",
    "state": "failed",
    "amount": "1500.00",
    "receipt": null,
    "failure_code": "1032",
    "message": "You cancelled the payment. Try again when you are ready."
}
```

Three decisions in that shape are worth defending.

**Safaricom's response never reaches the client.** The `CheckoutRequestID` is an
identifier for a prompt, not a payment reference, and `ResponseCode` says only
that the prompt was sent. Handing either to a front end invites it to draw a
conclusion neither supports.

**The id is a ULID.** An incrementing integer on a payment endpoint is an
invitation to walk it. Add `ulid` to the attempts table and bind on it:

```php
$table->ulid('public_id')->unique();
$table->foreignId('user_id')->constrained();
```

**`message` is yours, not Safaricom's.** The stored `failure_reason` is
Safaricom's own text — useful in your records, occasionally something like
`DS timeout user cannot be reached`, and never fit to render. Send a sentence
you wrote, derived from the code.

`failure_code` goes out alongside it so a client can behave differently for a
cancelled prompt than for a wrong PIN. That is a classification rather than an
identifier, which is why it is safe to publish when `CheckoutRequestID` is not.

## Start the payment

```php
class StartPaymentController
{
    public function __invoke(StartPaymentRequest $request, Order $order)
    {
        $this->authorize('pay', $order);

        $response = Daraja::stk()->push(
            phone: $request->string('phone'),
            amount: $order->total,
            accountReference: $order->reference,
            description: 'Order '.$order->id,
        );

        $attempt = PaymentAttempt::create([
            'public_id' => (string) Str::ulid(),
            'user_id' => $request->user()->id,
            'order_id' => $order->id,
            'checkout_request_id' => $response->checkoutRequestId,
            'amount' => $order->total,
            'phone' => $request->string('phone'),
        ]);

        return response()->json([
            'id' => $attempt->public_id,
            'state' => $attempt->state,
        ], 202);
    }
}
```

`202 Accepted` rather than `201`, and it is not pedantry. The status is the
whole message: something was started, nothing was completed.

An invalid phone number throws a `DarajaException` before any request is sent,
so catch it and answer `422` alongside your other validation failures.

```php
Route::middleware(['auth:sanctum', 'throttle:6,1'])->group(function () {
    Route::post('/payments/{order}', StartPaymentController::class);
    Route::get('/payments/{attempt:public_id}', ShowPaymentController::class);
});
```

:::danger[Throttle the push endpoint]
An open push endpoint is a machine for sending M-Pesa prompts to strangers,
with your merchant name on every one of them. Rate limit it per user, and per
phone number if your product allows unauthenticated checkout.
:::

## Report the state

```php
class ShowPaymentController
{
    public function __invoke(Request $request, PaymentAttempt $attempt)
    {
        abort_unless($attempt->user_id === $request->user()->id, 404);

        return response()->json([
            'id' => $attempt->public_id,
            'state' => $attempt->state,
            'amount' => $attempt->amount,
            'receipt' => $attempt->payment?->receipt,
            'failure_code' => $attempt->failure_code,
            'message' => $attempt->failureMessage(),
        ])->header('Cache-Control', 'no-store');
    }
}
```

`404` rather than `403` on a mismatch. A `403` confirms the attempt exists,
which is exactly what someone walking identifiers wants to learn.

`no-store` matters more than it looks. A response cached by a proxy or a service
worker turns a poll into the same answer forever.

Keep the vocabulary small and stable — `pending`, `paid`, `failed`. The client
should never have to know what `1032` means in order to render a screen, which
is what `failureMessage()` is for:
[Accept M-Pesa payments](../stk-push/#three-strings-not-two) has it.

## The client loop

```ts
type PaymentState = { state: 'pending' | 'paid' | 'failed'; receipt: string | null };

async function waitForPayment(
    id: string,
    signal: AbortSignal,
    deadline = 90_000,
): Promise<PaymentState> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < deadline) {
        const payment: PaymentState = await fetch(`/api/payments/${id}`, { signal })
            .then((response) => response.json());

        if (payment.state !== 'pending') {
            return payment;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error('timeout');
}
```

Three details do the work.

**A deadline.** Ninety seconds, then stop and show the customer something
honest. A spinner with no end is worse than a failure message.

**An `AbortSignal`.** Pass one and abort it when the component unmounts, or you
leave a loop polling for a screen nobody is looking at.

**Three seconds, not three hundred milliseconds.** The callback takes as long as
the customer takes. Polling faster does not make anyone type their PIN sooner.

On the timeout path, do not tell the customer the payment failed. Tell them it
has not confirmed yet — because it may still land, and the server will know
before they do.

## When the app goes away

It will. Android puts the M-Pesa prompt over your app and may background it. iOS
suspends timers in the background. The customer switches to their messages to
read the confirmation.

None of that stops the payment. The prompt lives on the handset and the callback
goes to your server, so the flow completes whether or not your front end is
running.

Which gives one rule: **the client is a viewer, never a participant.** When the
app comes back, ask for the state again rather than assuming the loop that was
running still knows anything.

```ts
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && attemptId) {
        refreshPaymentState(attemptId);
    }
});
```

For a native app, the same thing on foreground. And on cold start, if the last
attempt is still pending, ask once before showing a checkout screen — the
customer may have paid twenty minutes ago.

## If you would rather not poll

With Reverb or Pusher already running, the callback listener can broadcast and
the client can stop asking:

```php
class PaymentSettled implements ShouldBroadcast
{
    public function __construct(public PaymentAttempt $attempt) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("payments.{$this->attempt->public_id}");
    }
}
```

Authorise that channel against the attempt's owner, exactly as the endpoint
does. A private channel with a permissive callback is the same leak in a
different protocol.

Keep the polling anyway, as a fallback. Websockets drop on mobile networks
constantly, and a customer on a train should still see their receipt.

## Test it

```php
it('starts a payment and returns an attempt id', function () {
    Http::fake([
        '*/oauth/*' => Http::response(['access_token' => 'test', 'expires_in' => '3599']),
        '*/mpesa/stkpush/*' => Http::response([
            'CheckoutRequestID' => 'ws_CO_191220191020363925',
            'ResponseCode' => '0',
        ]),
    ]);

    $order = Order::factory()->create(['total' => 1500]);

    $this->actingAs($order->user)
        ->postJson("/api/payments/{$order->id}", ['phone' => '0712345678'])
        ->assertStatus(202)
        ->assertJsonPath('state', 'pending');
});

it('will not show another customer their neighbour\'s payment', function () {
    $attempt = PaymentAttempt::factory()->create();

    $this->actingAs(User::factory()->create())
        ->getJson("/api/payments/{$attempt->public_id}")
        ->assertNotFound();
});

it('reflects the callback on the next poll', function () {
    $attempt = PaymentAttempt::factory()->create([
        'checkout_request_id' => 'ws_CO_191220191020363925',
    ]);

    $this->postJson('/daraja/stk', [
        'Body' => ['stkCallback' => [
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

    $this->actingAs($attempt->user)
        ->getJson("/api/payments/{$attempt->public_id}")
        ->assertJsonPath('state', 'paid')
        ->assertJsonPath('receipt', 'NLJ7RT61SV');
});
```

The middle one is the test that survives a refactor. The last one is the design:
a request from Safaricom changes what a request from your customer returns, and
nothing in between had to be told.

## Browser SPAs on another origin

A front end served from a different domain than the API needs a decision about
authentication before any of this works.

Sanctum's cookie mode wants the two on the same site, plus
`SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN` and CORS with credentials allowed.
Token authentication avoids all of it and is usually the right answer for a
phone app.

Whichever you pick, settle it before debugging the payment flow. A cookie that
never arrives looks exactly like an authorisation bug in the endpoint.

## What breaks in production

1. **An unthrottled push endpoint.** Somebody finds it and your short code
   spends the afternoon prompting strangers.
2. **Sequential ids on the state endpoint.** Every other customer's payment
   state, one increment away.
3. **A client that decides success.** Trusting a `202` and rendering a receipt
   ships goods for prompts nobody confirmed.
4. **Polling with no deadline.** A tab left open all night, asking forever.
5. **A cached state response.** The poll works, the answer never changes, and
   nothing in your logs is wrong.
6. **Completion tied to the app being open.** Backgrounded on Android is the
   normal case, not the edge case.

## Next

Two endpoints and a loop will take a payment. Knowing your records match
Safaricom's is a different job: [Reconciling payments](../../guides/reconciliation/).

If the front end is Livewire rather than a separate application, the same flow
without any of the JavaScript is
[M-Pesa checkout with Livewire](../livewire-checkout/).
