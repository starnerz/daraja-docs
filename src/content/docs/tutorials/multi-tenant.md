---
title: One app, many short codes
description: Multi-tenant M-Pesa in Laravel — per-merchant credentials, scoped calls, and routing callbacks to the right tenant.
faq:
    - question: Can one Laravel application use several M-Pesa short codes?
      answer: >-
        Yes. Every API in the package reads its credentials from configuration
        at call time rather than caching them, so setting the configuration
        around a call scopes it to one merchant. The OAuth token cache is keyed
        by a fingerprint of the consumer key, so tenants never share a token.
    - question: How do I know which tenant an M-Pesa callback belongs to?
      answer: >-
        Resolve it from your own record, not from the payload. An STK callback
        carries no short code at all — only the CheckoutRequestID — so the
        attempt row you wrote when you sent the prompt is what identifies the
        tenant. C2B confirmations do carry BusinessShortCode, but the same rule
        is simpler to apply everywhere.
    - question: Where should per-merchant M-Pesa credentials be stored?
      answer: >-
        In your database, on the tenant record, with Laravel's encrypted casts.
        They are somebody else's API credentials rather than your own, and a
        consumer secret in a log line or a database export is a real incident.
---

A marketplace, a billing SaaS, a booking platform run for several venues: each
merchant has their own Pay Bill, their own Daraja app, and their own money.

One application, many short codes.

The package supports this, though it does not advertise it. Everything reads
from configuration *at call time* rather than holding credentials, so setting
the configuration around a call scopes it to one merchant.

This page builds that properly — including the part everybody gets wrong, which
is not sending the payment but working out whose callback just arrived.

## Why it works

Two facts, both worth checking rather than trusting:

**Nothing memoises credentials.** Every API class reads
`config('laravel-daraja.*')` through an injected repository on each call, so a
value changed a microsecond ago is the value used.

**Tokens are already isolated.** `TokenRepository` builds its cache key from a
fingerprint of the consumer key, so two merchants never share an access token
even though they share a cache store.

Nothing else in the package holds state between calls. Security credentials are
encrypted freshly per request, because Safaricom's padding is randomised.

## Store the credentials

```php
Schema::create('merchants', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('mpesa_mode')->default('sandbox');   // sandbox | live
    $table->string('short_code')->nullable();
    $table->text('consumer_key')->nullable();
    $table->text('consumer_secret')->nullable();
    $table->text('pass_key')->nullable();
    $table->string('initiator_name')->nullable();
    $table->text('initiator_credential')->nullable();
    $table->timestamps();
});
```

```php
protected function casts(): array
{
    return [
        'consumer_secret' => 'encrypted',
        'pass_key' => 'encrypted',
        'initiator_credential' => 'encrypted',
    ];
}
```

:::danger[These are not your credentials]
A consumer secret in a log line, a database export or an exception page is a
real incident with somebody else's name on it. Encrypt them at rest, keep them
out of anything you serialise, and never put them in a queued job's payload.
:::

`mpesa_mode` is per merchant on purpose. One merchant in sandbox while the rest
are live is the normal state of a platform that is still onboarding.

## Scope a call

One helper, and the `finally` block is the whole point of it.

```php
namespace App\Support;

use Closure;
use Illuminate\Support\Facades\Config;

class Tenanted
{
    /** Run a callback with one merchant's Daraja credentials in place. */
    public static function run(Merchant $merchant, Closure $callback): mixed
    {
        $previous = Config::get('laravel-daraja');

        Config::set('laravel-daraja.mode', $merchant->mpesa_mode);
        Config::set('laravel-daraja.consumer_key', $merchant->consumer_key);
        Config::set('laravel-daraja.consumer_secret', $merchant->consumer_secret);
        Config::set('laravel-daraja.stk.short_code', $merchant->short_code);
        Config::set('laravel-daraja.stk.pass_key', $merchant->pass_key);
        Config::set('laravel-daraja.initiator.name', $merchant->initiator_name);
        Config::set('laravel-daraja.initiator.credential', $merchant->initiator_credential);
        Config::set('laravel-daraja.initiator.short_code', $merchant->short_code);

        try {
            return $callback();
        } finally {
            Config::set('laravel-daraja', $previous);
        }
    }
}
```

```php
$response = Tenanted::run($merchant, fn () => Daraja::stk()->push(
    phone: $order->phone,
    amount: $order->total,
    accountReference: $order->reference,
));
```

**Restore in `finally`, not after the call.** An exception thrown inside the
closure would otherwise leave another merchant's credentials in place for
whatever runs next.

On a long-lived worker — Octane, a queue process — "next" means the next job,
which could belong to anyone.

That is the failure worth being paranoid about: it does not error, it does not
log, it just sends the wrong merchant's money.

## The queue trap

Configuration set during a web request does not exist inside a queued job. The
job runs later, in a different process, with the framework's own configuration.

So scope inside the job, from the model it carries:

```php
class SendPrompt implements ShouldQueue
{
    public function __construct(public Order $order) {}

    public function handle(): void
    {
        $response = Tenanted::run($this->order->merchant, fn () => Daraja::stk()->push(
            phone: $this->order->phone,
            amount: $this->order->total,
            accountReference: $this->order->reference,
        ));

        PaymentAttempt::create([
            'merchant_id' => $this->order->merchant_id,
            'checkout_request_id' => $response->checkoutRequestId,
            'order_id' => $this->order->id,
            // …
        ]);
    }
}
```

The job carries an `Order`, which Laravel serialises as an id and reloads. The
credentials are read from the database when the job runs, so nothing sensitive
is ever written to the queue.

Note `merchant_id` on the attempt. That column is what makes the next section
work.

## Whose callback is this?

Here is the part that catches people out.

**An STK callback contains no short code.** The whole payload is
`MerchantRequestID`, `CheckoutRequestID`, `ResultCode`, `ResultDesc`, and — on
success — the metadata items. Nothing identifies the merchant.

So the tenant cannot come from the payload. It has to come from your record:

```php
class RecordPayment implements ShouldQueue
{
    public function handle(StkCallbackReceived $event): void
    {
        $attempt = PaymentAttempt::firstWhere(
            'checkout_request_id',
            $event->callback->checkoutRequestId,
        );

        if (! $attempt) {
            return;     // not ours, or a replay of something already gone
        }

        $merchant = $attempt->merchant;

        // …record against $merchant, in the tenant's own scope
    }
}
```

That is the general rule, and it holds for every asynchronous API:

| Callback | What identifies the tenant |
|---|---|
| STK | your attempt row, via `CheckoutRequestID` |
| C2B confirmation | `BusinessShortCode` in the payload, or the account reference |
| B2C / balance / reversal results | your own row, via `OriginatorConversationID` |

**Resolve the tenant from your own record.** The payload may or may not carry
something usable; your record always does, because you wrote it when you sent
the request.

C2B is the one case where the payload is enough, since `BusinessShortCode`
arrives with every confirmation. Even there, mapping short code to merchant is
a lookup you control rather than a field you hope is present.

### Or give each tenant its own URL

The alternative is a callback URL per merchant, which several APIs accept
directly:

```php
Daraja::stk()->push(
    phone: $order->phone,
    amount: $order->total,
    accountReference: $order->reference,
    callbackUrl: route('mpesa.stk', $merchant),
);

Daraja::c2b()->registerUrls(
    confirmationUrl: route('mpesa.c2b', $merchant),
    shortCode: $merchant->short_code,
);
```

It works, and the tenant is then in the route. Two things to know before
choosing it.

B2C and the other result callbacks take their URLs from configuration only, so
those still go through the scoped block.

And you are now on your own routes rather than the package's, which means
parsing the payload yourself — [Handling callbacks](../../guides/callbacks/)
covers doing that with the same DTOs.

For most platforms the record lookup is less machinery for the same outcome.

## Registering C2B URLs per merchant

Each short code is registered separately, and in production each one registers
once. Do it as part of onboarding rather than by hand:

```php
Tenanted::run($merchant, fn () => Daraja::c2b()->registerUrls(
    confirmationUrl: route('mpesa.c2b', $merchant),
    shortCode: $merchant->short_code,
));
```

Store the result. A merchant whose URLs were never registered looks exactly
like a merchant whose customers are not paying.

## Test the isolation

One test matters more than the rest: a callback for one merchant must not touch
another's records.

```php
it('records a callback against the merchant that sent the prompt', function () {
    $ours = Merchant::factory()->create(['short_code' => '111111']);
    $theirs = Merchant::factory()->create(['short_code' => '222222']);

    $attempt = PaymentAttempt::factory()->for($ours)->create([
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
            ]],
        ]],
    ])->assertOk();

    expect($ours->payments()->count())->toBe(1)
        ->and($theirs->payments()->count())->toBe(0);
});
```

And one that proves the scope closes:

```php
it('restores configuration when a tenanted call throws', function () {
    Config::set('laravel-daraja.consumer_key', 'platform-key');

    try {
        Tenanted::run(Merchant::factory()->create(), function () {
            throw new RuntimeException('anything');
        });
    } catch (RuntimeException) {
        // expected
    }

    expect(config('laravel-daraja.consumer_key'))->toBe('platform-key');
});
```

The second one looks like a formality until the day it fails.

## What breaks in production

1. **Configuration left set after an exception.** The next job in the worker
   uses the wrong merchant's credentials, silently.
2. **Credentials in the job payload.** Serialise the model, never the secrets.
3. **Assuming the STK callback identifies the merchant.** It does not, and the
   code that assumes it will work fine with one tenant.
4. **One merchant's URLs never registered.** Their customers pay and nothing
   arrives, and it looks like a code problem rather than an onboarding one.
5. **Sandbox and live mixed up per merchant.** Every push is accepted, no money
   moves, and only that merchant is affected — so it takes a while to notice.
6. **A shared cache with no store configured.** Tokens are fingerprinted by
   consumer key and safe, but anything *you* cache per merchant needs the same
   discipline.

## Next

Reconciliation gets harder with tenants, because "did our records match
Safaricom's" becomes that question per merchant, on separate credentials:
[Reconciling payments](../../guides/reconciliation/).
