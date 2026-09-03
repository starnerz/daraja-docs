---
title: Receive Paybill and till payments
description: Take M-Pesa payments customers start themselves — register the URLs, record the money, and match it to an invoice.
faq:
    - question: How do I receive M-Pesa Paybill payments in Laravel?
      answer: >-
        Register a confirmation URL against your short code, then listen for the
        C2BPaymentReceived event the package dispatches when Safaricom posts a
        payment to it. Store the payment keyed on its M-Pesa receipt number
        before trying to match it to anything, because a payment you cannot
        match is still money that arrived.
    - question: Why is the phone number masked in the M-Pesa C2B callback?
      answer: >-
        The C2B v2 API masks the MSISDN, sending something like 2547 ***** 149
        rather than the full number. Version 1 sent a SHA-256 hash instead.
        Neither gives you a number you can call or pay back, so refunding a C2B
        payment means getting the full number from the M-Pesa organisation
        portal or asking the customer.
    - question: How do I match an M-Pesa payment to an invoice?
      answer: >-
        On the account number the customer typed, which arrives as
        BillRefNumber. Because customers mistype it, normalise both sides before
        comparing — uppercase, strip spaces and punctuation — and keep the
        payments that still match nothing in a queue a person reviews, rather
        than discarding them.
---

An STK Push is a payment you asked for. A Paybill payment is one the customer
decides to make on their own — through the M-Pesa menu, the app, or a number
printed on an invoice.

Nothing on your side starts it. Money arrives, and Safaricom tells you about it
afterwards.

That changes the problem. There is no attempt row waiting, no checkout request
to match against, and the only thing linking the money to an invoice is an
account number the customer typed by hand.

This page builds the whole path: registering the URLs, recording every payment
safely, and matching them to invoices without losing the ones that do not
match.

## Before you start

- A Pay Bill or Buy Goods short code. Sandbox gives you one — see
  [Sandbox credentials](../../getting-started/sandbox/).
- A URL Safaricom can reach. Your laptop is not one;
  [Testing callbacks on localhost](../callbacks-localhost/) covers the ways
  around that.
- The package installed and configured. [Accept M-Pesa payments](../stk-push/)
  covers the install if you have not done it.

## Register the URLs

Safaricom needs somewhere to post. Two URLs, registered once against your short
code.

```dotenv
DARAJA_ROUTES_ENABLED=true
DARAJA_C2B_CONFIRMATION_URL=https://your-domain/daraja/c2b/confirmation
DARAJA_C2B_VALIDATION_URL=https://your-domain/daraja/c2b/validation
```

```bash
php artisan daraja:register-urls
```

:::caution[Production registration happens once]
In sandbox you can overwrite freely. In production the call succeeds once, and
changing the URLs afterwards means deleting them under **Self Services → URL
Management** on the Daraja portal and registering again.

Registering a tunnel URL you will not have next week is the mistake that costs
a support ticket.
:::

The command takes a `--response-type`, which decides what M-Pesa does when your
validation URL cannot be reached:

| Value | Behaviour |
|---|---|
| `Completed` | Accept the payment anyway — the default |
| `Cancelled` | Reject the payment |

`Cancelled` sounds safer and usually is not. It means an outage on your side
turns into customers being told their payment failed.

## Where payments go

One table, and one rule about it.

```php
Schema::create('payments', function (Blueprint $table) {
    $table->id();
    $table->string('receipt')->unique();            // RKTQDM7W6S
    $table->decimal('amount', 12, 2);
    $table->string('account_reference')->nullable()->index();
    $table->string('payer_name')->nullable();
    $table->string('msisdn')->nullable();           // masked: 2547 ***** 149
    $table->foreignId('invoice_id')->nullable()->constrained();
    $table->timestamp('paid_at');
    $table->timestamps();
});
```

**Store the payment before you understand it.** `invoice_id` is nullable on
purpose.

A payment whose account number matches nothing is still money in your account.
Dropping it because it did not fit is how a business ends up reconciling in a
spreadsheet.

The unique index on `receipt` is the same mechanism the rest of this site keeps
returning to. It is the only identifier you and Safaricom both hold.

## Record the confirmation

Safaricom posts to your confirmation URL after the money has moved. The package
parses the payload and dispatches an event.

```php
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Starnerz\LaravelDaraja\Events\C2BPaymentReceived;

class RecordC2BPayment implements ShouldQueue
{
    public function handle(C2BPaymentReceived $event): void
    {
        $transaction = $event->transaction;

        $payment = Payment::updateOrCreate(
            ['receipt' => $transaction->transactionId],
            [
                'amount' => (float) $transaction->amount,
                'account_reference' => $transaction->billReferenceNumber,
                'payer_name' => $transaction->fullName(),
                'msisdn' => $transaction->msisdn,
                'paid_at' => CarbonImmutable::createFromFormat(
                    'YmdHis',
                    $transaction->transactionTime,
                    'Africa/Nairobi',
                ),
            ],
        );

        MatchPaymentToInvoice::dispatch($payment);
    }
}
```

Three things there are worth pausing on.

**`amount` is a string.** Every field on the transaction is, because Safaricom
sends them that way. Cast it before it reaches a decimal column or a
comparison.

**`transactionTime` is a raw `YmdHis` timestamp** in East Africa Time, with no
separators and no zone. Parse it explicitly rather than handing
`20191122063845` to your database and hoping.

**Matching is a separate job.** The listener's only responsibility is that the
payment exists. If your matching logic throws, the money is still recorded.

## Match it to an invoice

This is where the real work is, and it is entirely about an account number a
human being typed.

```php
class MatchPaymentToInvoice implements ShouldQueue
{
    public function __construct(public Payment $payment) {}

    public function handle(): void
    {
        $reference = static::normalise($this->payment->account_reference);

        if ($reference === '') {
            return;
        }

        $invoice = Invoice::where('normalised_reference', $reference)
            ->where('status', 'unpaid')
            ->first();

        if (! $invoice) {
            return;             // stays unmatched; a person will look at it
        }

        $this->payment->update(['invoice_id' => $invoice->id]);

        $invoice->settle($this->payment);
    }

    /** INV-0042, inv 0042 and INV0042. all have to reach the same string. */
    public static function normalise(?string $reference): string
    {
        return preg_replace('/[^A-Z0-9]/', '', strtoupper((string) $reference)) ?? '';
    }
}
```

Store the normalised form on the invoice too, so the lookup is an indexed
column rather than a scan.

Customers will still get it wrong. In roughly descending order of frequency
they type their own phone number, their name, last month's invoice number, or
nothing at all.

None of those are bugs you can fix in code. What you can do is make the
unmatched pile visible:

```php
Payment::whereNull('invoice_id')
    ->where('paid_at', '<', now()->subHours(2))
    ->orderBy('paid_at')
    ->get();
```

A screen showing that list, with a box to attach each payment to an invoice, is
maybe an hour of work. Without it, someone does the same job by hand every week
forever.

:::note[One invoice, several payments]
Customers pay in instalments without telling you. Settle against a running
total on the invoice rather than assuming one payment closes it, or somebody
who pays half today and half tomorrow ends up with two half-settled records and
a phone call.
:::

## Validation, if you have it

Validation lets you refuse a payment *before* the money moves. Safaricom asks,
you answer, and a rejection means the customer keeps their money — much kinder
than taking it and refunding later.

Two things to know first.

It is **disabled by default**. You have to email `apisupport@safaricom.co.ke`
and ask for it on your short code. Until they enable it your validation URL is
never called, whatever you registered.

And it is **synchronous**. Safaricom waits about eight seconds, then falls back
to your response type. That is a hard budget for everything the callback does.

Because it has to answer rather than observe, it uses a closure rather than an
event:

```php
// In a service provider's boot method
use Starnerz\LaravelDaraja\Data\Callbacks\C2BTransaction;
use Starnerz\LaravelDaraja\Facades\Daraja;

Daraja::validateC2BUsing(function (C2BTransaction $transaction): bool|string {
    $invoice = Invoice::where(
        'normalised_reference',
        MatchPaymentToInvoice::normalise($transaction->billReferenceNumber),
    )->first();

    if (! $invoice) {
        return 'C2B00012';                  // Invalid Account Number
    }

    if ((float) $transaction->amount > $invoice->balance) {
        return 'C2B00013';                  // Invalid Amount
    }

    return true;
});
```

Return `true` to accept, `false` to reject generically, or one of Safaricom's
codes to say why:

| Code | Meaning |
|---|---|
| `C2B00011` | Invalid MSISDN |
| `C2B00012` | Invalid Account Number |
| `C2B00013` | Invalid Amount |
| `C2B00014` | Invalid KYC Details |
| `C2B00015` | Invalid Short code |
| `C2B00016` | Other Error |

Keep it to indexed lookups. No API calls, no waiting on a queue, no writes you
cannot afford to repeat — Safaricom may ask twice.

## Test it without a customer

Sandbox will pretend to be one:

```php
Daraja::c2b()->simulatePayBill('0712345678', 500, 'INV-0042');
Daraja::c2b()->simulateBuyGoods('0712345678', 500);
```

The package throws if `DARAJA_MODE` is `live`, so this cannot fire at a real
short code by accident.

Faster still, post the payload at your own route and leave Safaricom out of it:

```php
it('records a paybill payment and matches its invoice', function () {
    $invoice = Invoice::factory()->create([
        'normalised_reference' => 'INV0042',
        'balance' => 500,
    ]);

    $this->postJson('/daraja/c2b/confirmation', [
        'TransactionType' => 'Pay Bill',
        'TransID' => 'RKTQDM7W6S',
        'TransTime' => '20191122063845',
        'TransAmount' => '500.00',
        'BusinessShortCode' => '600638',
        'BillRefNumber' => 'inv-0042',
        'InvoiceNumber' => '',
        'OrgAccountBalance' => '49197.00',
        'ThirdPartyTransID' => '',
        'MSISDN' => '2547 ***** 149',
        'FirstName' => 'John',
        'MiddleName' => '',
        'LastName' => 'Doe',
    ])->assertOk();

    expect(Payment::sole())
        ->receipt->toBe('RKTQDM7W6S')
        ->invoice_id->toBe($invoice->id);
});
```

Send that payload twice in a test. It should produce one payment row and no
exception — the unique receipt doing its job, on the case Safaricom will
eventually hand you in production.

Test a `BillRefNumber` of `''` as well, which is what every Buy Goods payment
carries. Till payments have no account number at all, so a matcher that assumes
one falls over on the first of them.

## What the callback does not tell you

**The payer's phone number.** C2B v2 masks it — `2547 ***** 149`. Version 1
sent a SHA-256 hash. Neither can be dialled, and neither can be paid back.

So refunding a C2B payment means getting the full number from the M-Pesa
organisation portal, or asking the customer for it.

**Which of your systems it was for.** Two applications sharing a short code
share a confirmation URL. The account number is the only separator, so give
each system a distinct prefix before you need one.

**Anything trustworthy about the sender.** Callbacks carry no signature. Before
releasing goods against one, confirm it independently — the
[IP allowlist](../../guides/callbacks/#verifying-the-source) is the only check
the API offers, and it is weak.

## What breaks in production

1. **URLs registered against a tunnel that has since died.** Payments arrive,
   nothing is called, and you cannot re-register without the portal.
2. **Validation assumed to be on.** It is off until Safaricom turns it on, so a
   validator that rejects unknown accounts quietly does nothing at all.
3. **Unmatched payments discarded.** The money is real whether or not the
   account number was.
4. **A handler that throws.** Safaricom delivers once. Queue the listener, and
   keep the write that records the payment away from the logic that interprets
   it.
5. **Buy Goods payments with no reference.** Anything requiring an account
   number breaks the day somebody pays the till.

## Next

Confirmations go missing — a deploy, a timeout, a bad release. Pull
Transactions retrieves them for 48 hours, and C2B is the only thing it covers.

That is [Reconciling payments](../../guides/reconciliation/).
