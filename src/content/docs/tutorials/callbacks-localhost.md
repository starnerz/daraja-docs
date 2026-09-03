---
title: Testing callbacks on localhost
description: Receive and test M-Pesa callbacks from a local Laravel application, with and without a tunnel.
faq:
    - question: Can M-Pesa callbacks reach localhost?
      answer: >-
        No. Safaricom calls your URL from its own servers, so the address has to
        resolve on the public internet. localhost, 127.0.0.1 and a .test domain
        are unreachable from Safaricom and the callback is simply never
        delivered — the push still succeeds, which is what makes it confusing.
    - question: How do I test M-Pesa callbacks locally?
      answer: >-
        Most of the time you do not need Safaricom at all: post the callback
        payload at your own route with a test or curl and assert on the result.
        When you need the real thing end to end, expose your local application
        with a tunnel such as ngrok, expose or cloudflared, or deploy a staging
        endpoint.
    - question: Why is my ngrok URL rejected as a Daraja callback URL?
      answer: >-
        Daraja rejects URLs containing the words mpesa, safaricom, exe, exec,
        cmd, sql or query, so a tunnel subdomain or route path with any of those
        in it is refused. Public tunnels are also frequently blocked outright in
        production, where a deployed HTTPS endpoint is the only reliable answer.
---

A push succeeds. Nothing else happens.

That is what a callback problem looks like from your side, and it is the most
common way a first M-Pesa integration stalls. Safaricom accepted the request,
the prompt reached the phone, the customer paid — and your application never
heard about it.

The cause is nearly always the same: Safaricom calls your callback URL from its
own servers, and `localhost` is not a place it can call.

## Start without a tunnel

The instinct is to reach for ngrok first. Don't — most callback work needs no
network at all.

Your callback route is an ordinary Laravel route, and the payload is ordinary
JSON. Post it yourself:

```bash
curl -X POST http://localhost:8000/daraja/stk \
  -H 'Content-Type: application/json' \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "29115-34620561-1",
        "CheckoutRequestID": "ws_CO_191220191020363925",
        "ResultCode": 0,
        "ResultDesc": "The service request is processed successfully.",
        "CallbackMetadata": {
          "Item": [
            { "Name": "Amount", "Value": 1500.0 },
            { "Name": "MpesaReceiptNumber", "Value": "NLJ7RT61SV" },
            { "Name": "PhoneNumber", "Value": 254712345678 }
          ]
        }
      }
    }
  }'
```

That exercises your listener, your database writes and your queue, in a loop
that takes a second rather than a minute. Do it as a test and it exercises them
on every commit as well:

```php
it('marks the order paid', function () {
    Event::fake();

    $this->postJson('/daraja/stk', $successfulStkPayload)->assertOk();

    Event::assertDispatched(StkCallbackReceived::class);
});
```

The failure payload is the one worth keeping beside it, because it has **no
`CallbackMetadata` key at all**:

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_191220191020363925",
      "ResultCode": 1032,
      "ResultDesc": "Request cancelled by user"
    }
  }
}
```

Handlers that reach straight into `CallbackMetadata` work perfectly against
every successful payment and throw on the first cancellation. Which arrives at
2am, from a real customer, whose money is now somewhere between Safaricom and
your order table.

## When you do need Safaricom

Posting payloads proves your application. It does not prove that Safaricom can
reach you, that your URL is registered correctly, or that the payload shape you
invented matches the one Safaricom actually sends.

For that you need a public URL. Three ways, in ascending order of reliability.

### A tunnel

```bash
ngrok http 8000
```

Take the HTTPS address it prints and use it as your callback URL:

```dotenv
DARAJA_STK_CALLBACK_URL=https://a1b2c3d4.ngrok-free.app/daraja/stk
```

Laravel also needs to know it is being served from that host, or generated URLs
and CSRF checks disagree with reality:

```dotenv
APP_URL=https://a1b2c3d4.ngrok-free.app
```

`expose` and `cloudflared` do the same job. `cloudflared` is the one to reach
for if a corporate network blocks the others.

:::danger[Words Daraja will not accept in a URL]
A callback URL containing `mpesa`, `safaricom`, `exe`, `exec`, `cmd`, `sql` or
`query` is rejected — in any part of it, including the host. A tunnel
subdomain with `mpesa` in it, or a tidy-looking route like `/api/mpesa/callback`,
fails for a reason nothing in the error message explains.
:::

Two more things that catch people out with tunnels:

- **The URL changes every restart** on free plans. Register a URL, restart the
  tunnel, and callbacks go to an address that no longer exists.
- **Public tunnels are frequently blocked**, especially in production. Sandbox
  is usually tolerant; production is not. A tunnel is a development tool, never
  a deployment.

### A staging deployment

The version that always works: a real host with a real certificate, running the
same code. Any small VPS or platform will do — the requirement is only that it
is reachable and has HTTPS.

This is also the only way to test the case where your application is *down*
when the callback arrives, which is a real production scenario and one nobody
tests until it has already happened.

### Sandbox still needs a public URL

Sandbox permits plain HTTP, which is the only concession it makes. Safaricom
still has to reach your host from the internet, so a `.test` domain or
`127.0.0.1` fails in sandbox exactly as it fails in production.

## Registering the URL

For STK, the callback URL is sent with each push, so setting the config value is
enough:

```dotenv
DARAJA_STK_CALLBACK_URL=https://your-public-url/daraja/stk
```

C2B is different — those URLs are registered against your short code, once:

```bash
php artisan daraja:register-urls
```

The one people miss is that this registration is **per short code and
effectively permanent**. Register a tunnel URL that later disappears and every
C2B confirmation goes nowhere until you register again.

## Seeing what arrived

Turn on the package's logging while you are working:

```dotenv
DARAJA_LOGGING_ENABLED=true
DARAJA_LOG_CHANNEL=stack
```

Then watch it live:

```bash
php artisan pail
```

If your tunnel has a request inspector — ngrok's is at
`http://127.0.0.1:4040` — use it. It shows you what Safaricom actually sent,
including the requests your application rejected before any of your code ran.

## Nothing arrived. Now what?

Work down this list. It is ordered by how often each one turns out to be the
answer.

1. **Is the URL public?** Open it from your phone on mobile data, not from the
   machine running the tunnel.
2. **Does the URL contain a forbidden word?** `mpesa`, `safaricom`, `exe`,
   `exec`, `cmd`, `sql`, `query`.
3. **Is it the URL you actually registered?** Tunnel restarts change it. For
   C2B, re-run `daraja:register-urls`.
4. **Is `DARAJA_ROUTES_ENABLED` true**, and does `php artisan route:list`
   show the endpoint?
5. **Is something rejecting the request before your code?** A CSRF check on a
   POST route, an IP allow-list, a maintenance mode, a firewall.
6. **Did the callback arrive and your listener throw?** Check the log. This one
   looks identical to "nothing arrived" from the database's point of view, and
   it is the worst case, because the money moved.
7. **Ask Safaricom what it thinks happened**, with
   `Daraja::stk()->query($checkoutRequestId)`. If that says paid and you have
   no record, the callback is the broken part rather than the payment.

## A note on verifying callbacks

There is no signature on a Daraja callback and no shared secret. The only check
available is the source address:

```dotenv
DARAJA_ALLOWED_IPS=196.201.214.0/24,196.201.212.0/24
```

```php
use Starnerz\LaravelDaraja\Http\Middleware\VerifySafaricomIp;

Route::post('/daraja/stk', StkController::class)
    ->middleware(VerifySafaricomIp::class);
```

The list ships empty, which permits everything, and Safaricom issues its ranges
to partners rather than publishing them. Ask your account manager.

Even with it in place, treat a callback as a claim rather than proof. Before
releasing anything expensive, confirm independently — with
`Daraja::stk()->query()`, or with
[Transaction Status](../../apis/account-services/#transaction-status).

## Next

Once callbacks are arriving, the remaining question is what happens on the day
one does not.

[Reconciling payments](../../guides/reconciliation/) is how you find it before
your customer does.
