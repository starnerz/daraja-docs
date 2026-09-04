---
title: Subscriptions and recurring payments
description: Recurring M-Pesa billing in Laravel — M-Pesa Ratiba, and the scheduled prompt everyone builds instead.
faq:
    - question: How do I take recurring M-Pesa payments in Laravel?
      answer: >-
        Two ways. M-Pesa Ratiba creates a real standing order on the customer's
        wallet, but it is a commercial API needing a signed agreement. The
        alternative, which most applications use, is to store the subscription
        yourself and push a prompt on a schedule — the customer approves each
        charge on their handset.
    - question: Can you charge an M-Pesa customer without them approving it?
      answer: >-
        Only through M-Pesa Ratiba, where the customer authorises a standing
        order once and Safaricom executes it afterwards. There is no
        card-on-file equivalent otherwise. Without Ratiba, every charge needs a
        prompt the customer enters their PIN for.
    - question: How do I stop a subscription charging twice in one month?
      answer: >-
        Put a unique index on the subscription and the billing period together,
        and create that row before sending anything. A scheduler that runs twice
        — a redeploy, an overlapping run, a manual retry — then collides with
        itself instead of prompting the customer twice.
---

M-Pesa has no card on file. There is no token you keep and charge again next
month, and no way to move a customer's money because they agreed to it once in
your checkout.

So a subscription is one of two things: a standing order Safaricom executes for
you, or a prompt you send again every period.

Both are real. The first is better and harder to get; the second is what most
applications end up building. This page does both, and is honest about which
one you are likely to ship.

## Option one: M-Pesa Ratiba

Ratiba creates a standing order on the customer's own wallet. They authorise it
once, and Safaricom collects on schedule without you being involved.

That is genuinely what you want. The catch is commercial rather than technical:

:::caution[Ratiba needs a signed agreement]
It is not available by ticking a box in the portal. Go-live requires a
commercial agreement with Safaricom, and it charges 5% of transaction value
capped at KES 5 per execution, on top of the usual C2B tariff.

If you are pre-revenue or building a proof of concept, budget for this being a
conversation rather than an integration.
:::

```php
use Starnerz\LaravelDaraja\Enums\StandingOrderFrequency;

$response = Daraja::standingOrder()->create(
    name: "Gym membership {$member->number}",
    phone: $member->phone,
    amount: $plan->price,
    startDate: now()->addDay(),
    endDate: now()->addYear(),
    accountReference: $member->number,
    frequency: StandingOrderFrequency::Monthly,
);

$subscription->update([
    'standing_order_ref' => $response->responseRefId,
    'state' => $response->accepted() ? 'authorising' : 'failed',
]);
```

The customer gets a prompt to authorise the order. If they are not opted in to
Ratiba, Safaricom opts them in during the same flow.

Three details that catch people:

**The name must be unique per customer.** A customer cannot hold two standing
orders with the same name, and a duplicate returns `1050`. Put the member
number or plan id in it, not "Monthly subscription".

**The response envelope is different.** Ratiba nests everything under
`ResponseHeader` and uses HTTP-style codes — `200` synchronously, `0` in the
callback. `accepted()` treats both as success so you do not have to remember
which.

**The package creates standing orders; it does not cancel them.** Safaricom
exposes creation only here, so cancellation happens on the customer's handset.
Your application finds out when the money stops arriving, which is a good
reason to reconcile rather than assume.

`authorising` is a deliberate state. The order is not active until the customer
approves it, and some never will.

## Option two: the scheduled prompt

No agreement needed, works on any short code, and is what the majority of
Kenyan subscription products actually run.

The trade is that the customer approves every charge. Your job is to ask at a
sensible moment, exactly once, and to handle the ones who do not answer.

### The subscription

```php
Schema::create('subscriptions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('customer_id')->constrained();
    $table->string('phone');
    $table->decimal('amount', 12, 2);
    $table->string('state')->default('active');   // active|past_due|suspended|cancelled
    $table->date('next_charge_on');
    $table->unsignedTinyInteger('failed_runs')->default(0);
    $table->timestamps();
});

Schema::create('subscription_charges', function (Blueprint $table) {
    $table->id();
    $table->foreignId('subscription_id')->constrained();
    $table->string('period');                     // 2026-09
    $table->foreignId('payment_attempt_id')->nullable()->constrained();
    $table->timestamps();

    $table->unique(['subscription_id', 'period']);
});
```

That unique index is the whole safety mechanism, and it is worth more than any
amount of care in the scheduler.

Schedulers run twice. A deploy restarts a worker mid-run, someone triggers the
command by hand, two containers wake at the same second. The index turns every
one of those into a caught exception rather than a customer charged twice.

### The command

```php
class ChargeSubscriptions extends Command
{
    protected $signature = 'billing:charge';

    public function handle(): void
    {
        Subscription::where('state', 'active')
            ->whereDate('next_charge_on', '<=', today())
            ->each(fn (Subscription $subscription) => ChargeSubscription::dispatch($subscription));
    }
}
```

```php
// routes/console.php
Schedule::command('billing:charge')->dailyAt('09:00');
```

Nine in the morning, not three. A prompt that arrives while somebody is asleep
gets cancelled, and a cancellation counts against you in exactly the same way a
refusal does.

### The charge

```php
class ChargeSubscription implements ShouldQueue
{
    public function __construct(public Subscription $subscription) {}

    public function handle(): void
    {
        $period = $this->subscription->next_charge_on->format('Y-m');

        try {
            $charge = SubscriptionCharge::create([
                'subscription_id' => $this->subscription->id,
                'period' => $period,
            ]);
        } catch (UniqueConstraintViolationException) {
            return;     // this period is already handled
        }

        $response = Daraja::stk()->push(
            phone: $this->subscription->phone,
            amount: $this->subscription->amount,
            accountReference: "SUB-{$this->subscription->id}",
            description: 'Subscription',
        );

        $attempt = PaymentAttempt::create([
            'checkout_request_id' => $response->checkoutRequestId,
            'amount' => $this->subscription->amount,
            'phone' => $this->subscription->phone,
        ]);

        $charge->update(['payment_attempt_id' => $attempt->id]);
    }
}
```

**The charge row is written before the prompt is sent.** A row with no attempt
attached is a prompt that may or may not have gone out — recoverable, and
visible.

The reverse ordering loses the record of a charge that did happen.

**Nothing here advances `next_charge_on`.** The push is an acknowledgement, not
a payment, and a subscription that rolls forward on the acknowledgement bills
people who never paid.

### Tell them first

An unannounced payment prompt is alarming, and alarmed people press cancel.

Send a message the day before — "KES 3,500 for your membership will be
requested tomorrow morning" — and the approval rate stops being your biggest
problem. It costs one notification per subscriber per period.

Give them a cancel link in the same message. A customer who cannot find how to
stop paying you will find a way that is worse for both of you.

### Advance on the callback

```php
class RecordSubscriptionPayment implements ShouldQueue
{
    public function handle(StkCallbackReceived $event): void
    {
        $charge = SubscriptionCharge::whereRelation(
            'attempt',
            'checkout_request_id',
            $event->callback->checkoutRequestId,
        )->first();

        if (! $charge) {
            return;
        }

        $subscription = $charge->subscription;

        if (! $event->callback->successful()) {
            $subscription->increment('failed_runs');

            $subscription->update([
                'state' => $subscription->failed_runs >= 3 ? 'suspended' : 'past_due',
            ]);

            return;
        }

        $subscription->update([
            'state' => 'active',
            'failed_runs' => 0,
            'next_charge_on' => $subscription->next_charge_on->addMonth(),
        ]);
    }
}
```

The period only moves on a real payment. Everything else is a retry decision.

### Retrying

A failed charge is usually a customer who was in a meeting, not a customer who
has left. So retry — but slowly, and not many times.

| Attempt | When |
|---|---|
| 1 | on the due date |
| 2 | the next day |
| 3 | three days later |
| then | suspend, and tell them |

:::caution[Do not retry immediately]
Safaricom locks a subscriber while a session is open, so a prompt sent moments
after a cancelled one returns `1001` and never reaches the handset. A retry
loop with no delay produces a run of failures that look like refusals and are
not.
:::

Three attempts is a reasonable ceiling. After that the honest reading is that
they do not want to pay this month, and repeatedly prompting somebody for money
they have declined to send is a good way to be reported.

## Which to build

| | Ratiba | Scheduled prompt |
|---|---|---|
| Customer approves | once | every period |
| Needs a Safaricom agreement | yes | no |
| Extra cost | 5%, capped at KES 5 | none beyond the usual tariff |
| Works on any short code | no | yes |
| Collection rate | high | depends on your reminders |

Most products start with the scheduled prompt because it ships this week, and
move to Ratiba when the volume justifies the conversation. Building the
subscription model first means that move is a swap of one job, not a rewrite.

## What breaks in production

1. **A scheduler that runs twice.** Without the unique index this is a double
   charge and a refund you cannot make through the API.
2. **Advancing the period on the push.** Everybody who ignored the prompt is
   now paid up in your database.
3. **Retrying within the minute.** `1001`, three times, recorded as three
   refusals.
4. **Prompts at unsociable hours.** Cancellations that were never about money.
5. **No cancellation path.** Support tickets, chargebacks against your Pay Bill,
   and a reputation you did not need.
6. **Assuming a Ratiba order is still live.** Customers cancel standing orders
   on their handset and nothing tells you.

## Next

Every one of these charges is an STK push, so the callback rules from
[Accept M-Pesa payments](../stk-push/) apply unchanged.

And the month a scheduled run fails quietly is the month your books drift:
[Reconciling payments](../../guides/reconciliation/).
