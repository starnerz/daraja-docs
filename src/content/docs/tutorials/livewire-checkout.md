---
title: M-Pesa checkout with Livewire
description: A Livewire component that pushes an M-Pesa prompt and updates itself when the payment lands.
faq:
    - question: How do I build an M-Pesa checkout with Livewire?
      answer: >-
        Push the prompt from a Livewire action, store the attempt with its
        CheckoutRequestID, and poll the attempt's state with wire:poll while it
        is pending. The callback listener updates the row from Safaricom's
        confirmation, and the next poll picks the change up.
    - question: Should a Livewire component wait for the M-Pesa callback?
      answer: >-
        It should poll its own database row rather than wait on Safaricom. The
        callback arrives on a separate HTTP request from Safaricom's servers,
        possibly minutes later, and holding a request open for it ties up a PHP
        worker and still fails when the callback never comes.
---

An M-Pesa payment does not resolve while the customer is looking at your page.
The prompt goes to their handset, they take as long as they take, and the
answer arrives at your server on a completely separate request.

So a checkout component has two jobs: send the prompt, then watch its own
database row for the outcome it will never receive directly.

This builds that as one Livewire component, with a timeout and the failure
states filled in.

If you have not sent a prompt before, [Accept M-Pesa payments](../stk-push/)
covers the integration this component sits on top of.

## What it does

1. Takes a phone number and pushes a prompt.
2. Stores the attempt, keyed on Safaricom's `CheckoutRequestID`.
3. Polls that row every three seconds while it is pending.
4. Stops on success, failure, or a timeout it decides for itself.

Nothing in it marks a payment as received. That belongs to the callback
listener, which is the only part of the system Safaricom has actually spoken to.

## The component

```php
namespace App\Livewire;

use App\Models\PaymentAttempt;
use Livewire\Attributes\Validate;
use Livewire\Component;
use Starnerz\LaravelDaraja\Exceptions\DarajaException;
use Starnerz\LaravelDaraja\Facades\Daraja;

class Checkout extends Component
{
    #[Validate('required|string')]
    public string $phone = '';

    public ?int $attemptId = null;

    public ?string $error = null;

    /** Seconds before the component stops waiting. */
    public const TIMEOUT = 90;

    public function pay(Order $order): void
    {
        $this->validate();
        $this->error = null;

        try {
            $response = Daraja::stk()->push(
                phone: $this->phone,
                amount: $order->total,
                accountReference: $order->reference,
                description: 'Order '.$order->id,
            );
        } catch (DarajaException $exception) {
            // An unusable phone number, or Safaricom refusing the request.
            $this->error = 'That number could not be prompted. Check it and try again.';

            return;
        }

        $this->attemptId = PaymentAttempt::create([
            'checkout_request_id' => $response->checkoutRequestId,
            'order_id' => $order->id,
            'amount' => $order->total,
            'phone' => $this->phone,
        ])->id;
    }

    public function attempt(): ?PaymentAttempt
    {
        return $this->attemptId ? PaymentAttempt::find($this->attemptId) : null;
    }

    /**
     * Called by wire:poll, and only while something is worth polling for.
     */
    public function check(): void
    {
        $attempt = $this->attempt();

        if (! $attempt || $attempt->state !== 'pending') {
            return;
        }

        if ($attempt->created_at->diffInSeconds(now()) < self::TIMEOUT) {
            return;
        }

        // Nothing has arrived in a minute and a half. Ask Safaricom directly
        // rather than leaving the customer watching a spinner.
        $status = Daraja::stk()->query($attempt->checkout_request_id);

        $attempt->update($status->paid()
            ? ['state' => 'paid']
            : ['state' => 'failed', 'failure_reason' => $status->resultDescription]);
    }

    public function render()
    {
        return view('livewire.checkout', ['attempt' => $this->attempt()]);
    }
}
```

## The view

```blade
<div @if ($attempt?->state === 'pending') wire:poll.3s="check" @endif>
    @if (! $attempt)
        <form wire:submit="pay">
            <label for="phone">M-Pesa number</label>
            <input id="phone" type="tel" wire:model="phone" placeholder="0712345678">

            @error('phone') <p class="error">{{ $message }}</p> @enderror
            @if ($error) <p class="error">{{ $error }}</p> @endif

            <button type="submit" wire:loading.attr="disabled">
                <span wire:loading.remove wire:target="pay">Pay with M-Pesa</span>
                <span wire:loading wire:target="pay">Sending…</span>
            </button>
        </form>
    @elseif ($attempt->state === 'pending')
        <p>Check your phone. Enter your M-Pesa PIN to confirm.</p>
        <p class="muted">This page updates itself — you do not need to refresh.</p>
    @elseif ($attempt->state === 'paid')
        <p>Payment received. Receipt {{ $attempt->order->payment->receipt }}.</p>
    @else
        <p>That payment did not go through.</p>
        <button wire:click="$set('attemptId', null)">Try again</button>
    @endif
</div>
```

Two details in that template do most of the work.

**The poll is conditional.** `wire:poll` only renders while the attempt is
pending, so a finished checkout stops making requests instead of hitting your
server every three seconds until the tab closes.

**The button disables itself while pushing.** Safaricom locks a subscriber
while a session is open, so a double click produces result code `1001` and a
confused customer. Preventing the second push is easier than explaining it.

## The listener that actually decides

The component never marks anything paid. This does, on a separate request,
whenever Safaricom gets round to it:

```php
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
                'failure_reason' => $callback->resultCode,
            ]);

            return;
        }

        Payment::updateOrCreate(
            ['receipt' => $callback->receipt()],
            [
                'checkout_request_id' => $callback->checkoutRequestId,
                'amount' => $callback->amount(),
                'msisdn' => $callback->phoneNumber(),
                'paid_at' => $callback->transactionDate(),
            ],
        );

        $attempt?->update(['state' => 'paid']);
    }
}
```

The component's next poll sees `paid` and re-renders. There is no websocket, no
broadcast and no shared state — just a row that two different requests agree
on.

If you already run Reverb or Pusher, dispatching an event from this listener and
listening with `wire:stream` or an Echo listener removes the polling entirely.
Polling is the version that works everywhere, which is why it is the one shown.

## Testing it

Livewire's test helpers and `Http::fake()` cover the whole component without a
phone or a network:

```php
use Livewire\Livewire;

it('pushes a prompt and starts waiting', function () {
    Http::fake([
        '*/oauth/*' => Http::response(['access_token' => 'test', 'expires_in' => '3599']),
        '*/mpesa/stkpush/*' => Http::response([
            'CheckoutRequestID' => 'ws_CO_191220191020363925',
            'ResponseCode' => '0',
        ]),
    ]);

    $order = Order::factory()->create(['total' => 1500]);

    Livewire::test(Checkout::class, ['order' => $order])
        ->set('phone', '0712345678')
        ->call('pay', $order)
        ->assertSee('Check your phone');

    expect(PaymentAttempt::sole()->checkout_request_id)
        ->toBe('ws_CO_191220191020363925');
});

it('shows the receipt once the callback has landed', function () {
    $attempt = PaymentAttempt::factory()->create(['state' => 'pending']);

    Livewire::test(Checkout::class, ['order' => $attempt->order])
        ->set('attemptId', $attempt->id)
        ->assertSee('Check your phone');

    // What the callback listener does, on its own request.
    $attempt->update(['state' => 'paid']);

    Livewire::test(Checkout::class, ['order' => $attempt->order])
        ->set('attemptId', $attempt->id)
        ->call('check')
        ->assertSee('Payment received');
});
```

The second test is the one worth keeping. It proves the component reflects a
change made by something it never spoke to, which is the entire design.

## What to get right

- **Never mark paid in `pay()`.** The push response is an acknowledgement that
  the prompt was sent, nothing more.
- **Always have a timeout.** A customer whose phone was off should see an
  outcome, not a spinner. Ninety seconds is a reasonable default.
- **Stop polling when there is nothing to poll for.** An unconditional
  `wire:poll` on a checkout page is a slow, self-inflicted load test.
- **Disable the button while a push is in flight**, or `1001` will teach you
  the same lesson more expensively.
- **Do not poll Safaricom.** Poll your own row. `Daraja::stk()->query()` is a
  fallback for when the callback did not arrive, not a status endpoint to hit
  every three seconds.

## Next

The component is the easy half. What happens when a callback never arrives at
all is [Reconciling payments](../../guides/reconciliation/).
