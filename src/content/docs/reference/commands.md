---
title: Artisan commands
description: Three commands for verifying configuration and registering URLs.
---

## daraja:token

Fetches an access token, which verifies your consumer key and secret against the
configured mode.

```bash
php artisan daraja:token
php artisan daraja:token --fresh   # discard the cached token first
```

```
Mode ............................................................... sandbox
Access token ..................................... c9SQxWWhmdVRlyh0zh8gZDTkubVF
```

The first thing to run after installing. A failure here names the cause rather
than surfacing later as a confusing 404.

## daraja:credential

Encrypts an initiator password into a `SecurityCredential`, for comparing
against the portal's own tool.

```bash
php artisan daraja:credential
php artisan daraja:credential "some-other-password"
```

```
Mode ................................................................. live
Certificate ................... /app/vendor/starnerz/laravel-daraja/certs/production.cer
```

It prints the certificate path, which is how you confirm you are encrypting for
the right environment — the usual cause of `2001 The initiator information is
invalid`.

The output differs every run. PKCS #1 v1.5 padding is randomised, so that is
expected.

## daraja:register-urls

Registers your C2B confirmation and validation URLs.

```bash
php artisan daraja:register-urls

php artisan daraja:register-urls \
    --confirmation=https://example.com/confirm \
    --validation=https://example.com/validate \
    --short-code=600000 \
    --response-type=Cancelled
```

Without options it uses `urls.c2b.confirmation` and `urls.c2b.validation` from
configuration.

`--response-type` decides what M-Pesa does when your validation URL is
unreachable: `Completed` accepts the payment anyway, `Cancelled` rejects it.

:::caution
In production this succeeds **once**. Changing the URLs afterwards means
deleting them under Self Services → URL Management on the portal and running the
command again.
:::
