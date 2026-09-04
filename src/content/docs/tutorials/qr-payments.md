---
title: Take payment by QR code
description: Generate M-Pesa QR codes in Laravel, display them, and work out which one was actually paid.
faq:
    - question: How do I generate an M-Pesa QR code in Laravel?
      answer: >-
        Call Daraja::qr()->generate() with your merchant name, a reference, the
        amount and a transaction type. Unlike most of Daraja this call is
        synchronous — the image comes back as base64 PNG data in the response,
        ready to embed with dataUri() or store with png().
    - question: Does an M-Pesa QR code send a callback when it is paid?
      answer: >-
        No. The QR API only produces an image. A customer scanning it makes an
        ordinary C2B payment, so the money arrives at your C2B confirmation URL
        exactly as it would if they had typed the till number themselves, and
        nothing in that payload refers to the QR you generated.
    - question: Should I use an M-Pesa QR code or an STK push?
      answer: >-
        A QR code suits a customer standing in front of a screen or a printed
        invoice with their own phone in hand. For a checkout the customer is
        already browsing on their phone, an STK push is better — asking someone
        to scan a code displayed on the same device they are holding does not
        work.
---

A QR code is the shortest path from a price to a payment. The customer opens
the M-Pesa app, scans, and the till number and the amount are already filled
in. Nothing to read aloud, nothing to mistype.

It is also the API in this package that does the least. It makes an image. That
is the whole feature.

Everything interesting happens afterwards, when money arrives and you have to
work out which code it came from.

## When this is the right answer

QR works when the customer is looking at something that is not their own phone:
a counter screen, a printed invoice, a poster at a stall, a delivery note.

It does not work for a checkout page. Somebody browsing on their phone cannot
scan a code displayed on the device they are holding.

[Accept M-Pesa payments](../stk-push/) is the right tool there. The prompt goes
to the handset they already have in their hand.

The two are worth offering together on a desktop checkout: a QR for the phone
in their pocket, a phone-number field for the STK push.

## Generate one

```php
use Starnerz\LaravelDaraja\Enums\QrTransactionType;

$qr = Daraja::qr()->generate(
    merchantName: 'Riverside Supermarket',
    reference: $invoice->reference,
    amount: $invoice->total,
    type: QrTransactionType::PayBill,
    size: 400,
);
```

This one is synchronous. There is no callback and no acknowledgement to wait
on — the image comes back in the response.

| Type | Code | Pays |
|---|---|---|
| `PayBill` | `PB` | a Pay Bill or business number |
| `BuyGoods` | `BG` | a till (pay merchant) |
| `SendMoney` | `SM` | a mobile number |
| `SendToBusiness` | `SB` | a business number in MSISDN format |
| `WithdrawAtAgent` | `WA` | cash withdrawal at an agent till |

The credit party defaults to your configured short code. Amounts are whole
shillings — the API takes an integer, so cents are discarded rather than
rounded up.

:::caution[`ResponseCode` is not a status here]
Every other Daraja response uses `ResponseCode` for `"0"`. This one puts an
identifier in it, like `AG_20191219_000043fdf61864fe9ff5`.

There is deliberately no `accepted()` on this response for that reason. Check
that the code came back instead:

```php
if ($qr->qrCode === '') {
    // nothing usable was returned
}
```
:::

## Store the image

The response gives you base64 PNG data with two helpers on it:

```php
$qr->dataUri();   // data:image/png;base64,… for an <img> tag
$qr->png();       // raw bytes, for the filesystem
```

`dataUri()` is convenient and the wrong default for anything you show more than
once. It inflates the HTML by about a third of the image size and the browser
cannot cache it separately from the page.

Generate once, store, and serve the file:

```php
class InvoiceQr
{
    public function for(Invoice $invoice): string
    {
        $path = "qr/invoices/{$invoice->id}.png";

        if (! Storage::disk('public')->exists($path)) {
            $qr = Daraja::qr()->generate(
                merchantName: config('app.name'),
                reference: $invoice->reference,
                amount: $invoice->total,
                type: QrTransactionType::PayBill,
            );

            Storage::disk('public')->put($path, $qr->png());
        }

        return Storage::disk('public')->url($path);
    }
}
```

An invoice's QR never changes, because the amount is baked into it. Regenerating
it on every page view is an API call per refresh for an identical image.

If the amount changes, the old file is wrong — delete it when the invoice is
edited, or key the path on something that changes with the total.

## The part that is actually hard

Nothing about a scanned payment refers to the QR you made.

The customer scanning your code makes an ordinary C2B payment. It arrives at
your confirmation URL looking exactly like one from somebody who typed the till
number by hand — same payload, same fields, no marker saying which image
produced it.

So the linking has to come from the reference, and whether the reference
survives depends on what kind of short code you pointed the QR at.

**Pay Bill has a field for it.** A C2B confirmation for a Pay Bill carries
`BillRefNumber`, which is where an account number lands. That is the one field
you control end to end.

**A till does not.** Buy Goods payments arrive with `BillRefNumber` empty,
because tills have no account number for a customer to fill in.

:::caution[Verify this on your own short code]
Short codes differ, and this is cheap to establish rather than assume. Generate
a `PayBill` QR with a reference you will recognise, pay it in sandbox, and read
what arrives:

```php
Log::info('c2b', $event->transaction->raw);
```

If `BillRefNumber` comes back holding your reference, matching is solved. If it
is empty, you are in the next section.
:::

### If the reference does not survive

You are left with the amount, the time and the short code. That is enough for a
human and not enough for a machine.

Two things make it workable.

**Make the amount unique.** A cents-level suffix per invoice — 1,200.00 becomes
1,200 for one customer and 1,201 for the next — is an old trick and it does
work, until two customers are in the queue together.

**Match in a review screen instead.** Show the unmatched payment beside the
invoices open at that moment, and let whoever is at the counter pick.

That is the unmatched pile from [Paybill and till payments](../c2b-paybill/).
QR payments land in it for the same reason.

The honest position: a QR pointed at a till is a convenience for an attended
counter, not an automatic matching mechanism. If you need to know which invoice
was paid without a person deciding, use Pay Bill with a unique reference.

## Recording the payment

There is nothing QR-specific to write. The confirmation listener from
[Paybill and till payments](../c2b-paybill/) already handles it — same event,
same unique receipt, same matching job.

The only addition worth making is recording that the payment came from a code
you generated, when the reference tells you so:

```php
if ($invoice = Invoice::firstWhere('reference', $transaction->billReferenceNumber)) {
    $payment->update([
        'invoice_id' => $invoice->id,
        'source' => 'qr',
    ]);
}
```

Worth having when someone asks whether the QR at the counter is being used
enough to justify the screen it is displayed on.

## Screenshots do not expire

Your application generated an image. Safaricom is not holding a session, there
is no timer, and nothing invalidates it.

So a QR code screenshotted last month still scans, and still pays you — against
a reference for an invoice that is already settled.

Handle it as a payment arriving for a paid invoice rather than a bug:

```php
if ($invoice->isPaid()) {
    // credit the customer, or flag it for a refund decision.
    // Do not silently settle the same invoice twice.
}
```

Printed codes have the same property, more permanently. A price on a poster is a
commitment for as long as the poster is on the wall.

## Test it

The QR call is a normal HTTP request, so `Http::fake()` covers it. The `QRCode`
field is base64, and a fake needs to be decodable if your code calls `png()`:

```php
it('generates and stores a QR for an invoice', function () {
    Http::fake([
        '*/oauth/*' => Http::response(['access_token' => 'test', 'expires_in' => '3599']),
        '*/qrcode/*' => Http::response([
            'ResponseCode' => 'AG_20191219_000043fdf61864fe9ff5',
            'RequestID' => '16738-27456357-1',
            'ResponseDescription' => 'The service request is processed successfully.',
            'QRCode' => base64_encode('not-really-a-png'),
        ]),
    ]);

    Storage::fake('public');

    $invoice = Invoice::factory()->create(['total' => 1200]);

    app(InvoiceQr::class)->for($invoice);

    Storage::disk('public')->assertExists("qr/invoices/{$invoice->id}.png");
});
```

Then assert the second call does not hit the network, because that is the whole
point of storing it:

```php
app(InvoiceQr::class)->for($invoice);
app(InvoiceQr::class)->for($invoice);

Http::assertSentCount(2);   // the token and one generate, not two
```

The payment side is tested exactly as C2B is — post a confirmation payload at
the route and assert the invoice settles.

## What breaks in production

1. **Expecting a callback.** There is no QR callback. Code waiting for one waits
   forever.
2. **A till QR with a reference you rely on.** It arrives empty, and the
   matching that worked in your head does not work in the payload.
3. **Regenerating on every render.** An API call per page view for an image that
   cannot change.
4. **A stale image after a price change.** The old file is still on disk and
   still scannable, at the old amount.
5. **Old screenshots.** Payments for invoices closed weeks ago, which are real
   money you now have to decide about.
6. **QR on a mobile checkout.** The customer cannot scan the screen they are
   reading. It looks fine in testing on a desktop.

## Next

Scanned payments are C2B payments, so they go missing the same way and are
recovered the same way: [Reconciling payments](../../guides/reconciliation/).

The full parameter list, including the credit party override and every
transaction type, is on the [Dynamic QR](../../apis/dynamic-qr/) reference page.
