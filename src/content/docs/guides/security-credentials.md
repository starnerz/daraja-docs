---
title: Security credentials
description: How the initiator password is encrypted, and what breaks.
---

APIs that move money on your behalf — B2C, B2B, Reversal, Account Balance and
Transaction Status — authenticate with a `SecurityCredential`: your initiator
password encrypted with Safaricom's public certificate.

## How it works

1. Take the plaintext initiator password.
2. Encrypt it with the certificate using **RSA, PKCS #1 v1.5 padding** — not OAEP.
3. Base64-encode the result.

The package does this per request. You store only the plaintext password:

```dotenv
DARAJA_INITIATOR_CREDENTIAL=your-plaintext-password
```

:::note[A fresh value every time is expected]
PKCS #1 v1.5 padding is randomised, so the same password produces a different
credential on each call. That is correct — Safaricom accepts any valid
encryption. It also means you cannot compare or cache the encrypted form.
:::

## Certificates

There is a **different certificate per environment**. Download both from the
[developer portal](https://developer.safaricom.co.ke):

```
certs/sandbox.cer
certs/production.cer
```

Or keep them in your application:

```dotenv
DARAJA_CERTIFICATE_PATH=/full/path/to/production.cer
```

:::caution
The `production.cer` that shipped with v1 expired in **March 2018**. RSA
encryption still succeeds with an expired certificate because only the public
key is used, but download a current one before going live.
:::

## Generating one by hand

To check a credential against the portal's own tool:

```bash
php artisan daraja:credential
php artisan daraja:credential "some-other-password"
```

It prints the certificate path in use, so you can confirm which environment you
are encrypting for.

## What goes wrong

**`2001 The initiator information is invalid`** is the catch-all, and means one
of:

- the initiator **username** is wrong;
- the **password** is wrong;
- you encrypted with the **wrong certificate** — sandbox against production or
  the reverse;
- the API user is **dormant** rather than active.

**`8006 The security credential is locked`** — repeated failures lock the
operator. A Business Administrator unlocks it on the M-Pesa organisation portal.

**`21 The initiator is not allowed to initiate this request`** — the operator
exists but lacks the role for that API. Each API needs its own:

| API | Role |
|---|---|
| B2C | ORG B2C API Initiator |
| Business Pay Bill | Business Paybill Org API initiator |
| Business Buy Goods | Business Buy Goods Org API initiator |
| B2C Account Top Up | Org Business Pay to Bulk API initiator |
| Transaction Status | Transaction Status query ORG API |
| Account Balance | Balance Query ORG API |
| Reversals | Org Reversals Initiator |

:::danger[Passwords expire after 90 days]
The API operator password is valid for 90 days. When payouts that worked
yesterday start returning `2001`, this is the first thing to check.
:::

## Password characters

Safaricom accepts `#`, `&`, `%` and `$` as special characters. Brackets are
rejected. `@` is treated as an ordinary character, not a special one.

## Errors the package raises

A missing or unparseable certificate raises a `ConfigurationException` naming
the path and pointing at the portal, rather than a PHP warning:

```
The Safaricom public certificate could not be read at [/path/production.cer].
Download the current certificate from https://developer.safaricom.co.ke and
point [laravel-daraja.certificate_path] at it.
```
