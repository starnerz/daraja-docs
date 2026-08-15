---
title: Configuration
description: Every configuration key and the environment variable behind it.
---

Every value in `config/laravel-daraja.php` reads from an environment variable,
so publishing the config file is optional.

## Mode and credentials

```dotenv
DARAJA_MODE=sandbox              # sandbox or live
DARAJA_CONSUMER_KEY=
DARAJA_CONSUMER_SECRET=
```

`mode` selects the API host and the bundled certificate. Anything other than
`sandbox` or `live` raises a `ConfigurationException` rather than silently
falling back.

| Mode | Host |
|---|---|
| `sandbox` | `https://sandbox.safaricom.co.ke` |
| `live` | `https://api.safaricom.co.ke` |

## Initiator

Required by B2C, B2B, Reversal, Account Balance and Transaction Status.

```dotenv
DARAJA_INITIATOR_NAME=testapi
DARAJA_INITIATOR_CREDENTIAL=your-plaintext-password
DARAJA_INITIATOR_SHORTCODE=600000
DARAJA_INITIATOR_TYPE=paybill    # paybill, till or msisdn
```

`credential` is the **plaintext** operator password. The package encrypts it per
request; you never store the encrypted form.

:::note
The API operator password expires every 90 days. When payouts start failing
with "The initiator information is invalid", this is usually why.
:::

## M-Pesa Express

```dotenv
DARAJA_STK_SHORTCODE=174379
DARAJA_STK_PASS_KEY=
DARAJA_STK_CALLBACK_URL=https://your-domain/daraja/stk
```

## Callback URLs

Each accepts either an absolute URL or the **name of a route** in your
application, which the package resolves with `route()`.

```dotenv
DARAJA_C2B_CONFIRMATION_URL=
DARAJA_C2B_VALIDATION_URL=

DARAJA_B2C_RESULT_URL=
DARAJA_B2C_TIMEOUT_URL=
DARAJA_B2B_RESULT_URL=
DARAJA_B2B_TIMEOUT_URL=
DARAJA_BALANCE_RESULT_URL=
DARAJA_BALANCE_TIMEOUT_URL=
DARAJA_TRANSACTION_STATUS_RESULT_URL=
DARAJA_TRANSACTION_STATUS_TIMEOUT_URL=
DARAJA_REVERSAL_RESULT_URL=
DARAJA_REVERSAL_TIMEOUT_URL=
```

:::caution[URL rules Safaricom enforces]
- Production URLs must be HTTPS. Sandbox allows HTTP.
- The URL must not contain `M-PESA`, `Safaricom`, `mpesa`, `exe`, `exec`,
  `cmd`, `sql` or `query`.
- Public tunnels such as ngrok, mockbin and requestbin are usually blocked.
:::

## Per-API settings

```dotenv
DARAJA_PARTNER_NAME=               # shown in the B2B Express prompt
DARAJA_PULL_NOMINATED_NUMBER=      # MSISDN on the short code's KYC record
DARAJA_BILL_MANAGER_APP_KEY=       # returned once, at Bill Manager opt-in
DARAJA_B2B_EXPRESS_RESULT_URL=
DARAJA_PULL_CALLBACK_URL=
DARAJA_BILL_MANAGER_CALLBACK_URL=
DARAJA_STANDING_ORDER_CALLBACK_URL=
```

## HTTP client

```dotenv
DARAJA_HTTP_TIMEOUT=30
DARAJA_HTTP_CONNECT_TIMEOUT=10
DARAJA_HTTP_RETRIES=2
DARAJA_HTTP_RETRY_DELAY=250
```

Retries apply only to connection failures. A 4xx from Daraja means the request
itself was rejected, so retrying it would just repeat the rejection.

## Token cache

```dotenv
DARAJA_CACHE_STORE=                # blank uses the default store
DARAJA_TOKEN_TTL=3540
```

Tokens are cached per consumer key and mode, so multiple short codes in one
application never share a token.

## Logging

```dotenv
DARAJA_LOGGING_ENABLED=false
DARAJA_LOG_CHANNEL=                # blank uses the default channel
```

`SecurityCredential`, `Password`, `InitiatorPassword`, `consumer_key` and
`consumer_secret` are replaced with `[redacted]` before anything is written.

## Callback routes

```dotenv
DARAJA_ROUTES_ENABLED=false
DARAJA_ROUTES_PREFIX=daraja
DARAJA_ALLOWED_IPS=                # comma separated, plain or CIDR
```

See [Handling callbacks](../../guides/callbacks/).

## Certificate

```dotenv
DARAJA_CERTIFICATE_PATH=           # blank uses the bundled certificate for the mode
```
