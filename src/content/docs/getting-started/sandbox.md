---
title: Sandbox credentials
description: Getting a sandbox app and testing against it.
faq:
    - question: What are the Daraja sandbox test credentials?
      answer: >-
        The Test Credentials page in the Safaricom developer portal supplies the
        sandbox short code, initiator name, initiator password and M-Pesa
        Express passkey. They are shared sandbox values rather than secrets. The
        usual short code is 174379, with initiator name testapi and initiator
        short code 600000.
    - question: Which phone number works in the Daraja sandbox?
      answer: >-
        Safaricom's sandbox accepts 254708374149 for most APIs. Real numbers
        work for M-Pesa Express in sandbox and will genuinely ring the handset,
        though the payment never completes.
    - question: Why does Daraja return "Invalid API call as no apiproduct match found"?
      answer: >-
        Products are attached per app. That error means the product you are
        calling is not attached to the app whose consumer key and secret
        generated the token.
    - question: Do sandbox callbacks still need a public URL?
      answer: >-
        Yes. Sandbox permits plain HTTP, but Safaricom must still be able to
        reach your host from the internet.
---

## Create a sandbox app

1. Sign in at [developer.safaricom.co.ke](https://developer.safaricom.co.ke).
2. Go to **My Apps** and create an app, selecting the products you need.
3. Copy the **Consumer Key** and **Consumer Secret** into your `.env`.

Products are per-app. If a call returns `Invalid API call as no apiproduct match
found`, the product is not attached to the app you generated the token with.

## Test credentials

The portal's **Test Credentials** page supplies the sandbox short code,
initiator name, initiator password and the M-Pesa Express passkey. These are
shared sandbox values, not secrets.

```dotenv
DARAJA_MODE=sandbox
DARAJA_STK_SHORTCODE=174379
DARAJA_INITIATOR_NAME=testapi
DARAJA_INITIATOR_SHORTCODE=600000
```

## Verify the credentials

```bash
php artisan daraja:token
```

## Test numbers

Safaricom's sandbox accepts `254708374149` for most APIs. Real numbers work for
M-Pesa Express in sandbox and will genuinely ring the handset — the payment does
not complete, but the prompt appears.

## What sandbox will not do

- **C2B simulation is sandbox-only.** The package throws a `DarajaException` if
  you call `simulatePayBill()` or `simulateBuyGoods()` while `mode` is `live`.
- **Callbacks still need a public URL.** Sandbox permits HTTP, but Safaricom
  must still be able to reach your host from the internet.
- **Some APIs are production-only.** M-Pesa Ratiba and B2B Express Checkout are
  commercial products requiring a signed agreement, so sandbox coverage is
  limited.

## Testing without Safaricom

Most of the time you should not be hitting sandbox at all. The package is built
on Laravel's HTTP client, so `Http::fake()` intercepts everything — see
[Testing](../../guides/testing/).
