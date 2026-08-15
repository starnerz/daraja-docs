---
title: Upgrading from v1 to v2
description: What changed, and how to migrate.
---

v2 is a rewrite. The facade, the class names and the configuration keys have all
changed.

:::caution[Staying on v1]
v1 requires Laravel 8 and is not maintained. If you cannot move to Laravel
12/13 and PHP 8.3, stay on `^1.0` — but be aware v1's STK push has a signature
bug that makes the documented example throw, and it calls `str_limit()`, removed
in Laravel 6.
:::

## Requirements

| | v1 | v2 |
|---|---|---|
| PHP | 7.3+ | 8.3+ |
| Laravel | 8 | 12 or 13 |

## The facade

```diff
- use Starnerz\LaravelDaraja\Facades\MpesaApi;
+ use Starnerz\LaravelDaraja\Facades\Daraja;
```

The `MpesaApi` alias is gone. `Requests\*` classes are replaced by `Apis\*`,
resolved through the facade rather than instantiated.

## Method mapping

| v1 | v2 |
|---|---|
| `MpesaApi::STK()->push($phone, $amount, $desc, $ref)` | `Daraja::stk()->push($phone, $amount, $ref, $desc)` |
| `MpesaApi::STK()->transactionStatus($id)` | `Daraja::stk()->query($id)` |
| `MpesaApi::c2b()->registerUrls($conf, $valid)` | `Daraja::c2b()->registerUrls($conf, $valid)` |
| `MpesaApi::c2b()->simulatePaymentToPaybill(…)` | `Daraja::c2b()->simulatePayBill(…)` |
| `MpesaApi::c2b()->simulatePaymentToTill(…)` | `Daraja::c2b()->simulateBuyGoods(…)` |
| `MpesaApi::b2c()->…` | `Daraja::b2c()->business()`, `->salary()`, `->promotion()` |
| `MpesaApi::balance()->…` | `Daraja::balance()->query()` |
| `MpesaApi::transaction()->…` | `Daraja::transaction()->query()` |
| `MpesaApi::reversal()->…` | `Daraja::reversal()->reverse()` |
| `new STK()` etc. | Resolve from the container, or use the facade |

Note the **argument order changed** on `push()`: the account reference now comes
before the description, since the description is optional and defaults to it.

## Configuration

Keys were reorganised. The file is still `config/laravel-daraja.php`.

| v1 | v2 |
|---|---|
| `stk_push.short_code` | `stk.short_code` |
| `stk_push.pass_key` | `stk.pass_key` |
| `stk_push.callback_url` | `stk.callback_url` |
| `c2b_url.confirmation` | `urls.c2b.confirmation` |
| `c2b_url.validation` | `urls.c2b.validation` |
| `result_url.b2c` | `urls.result.b2c` |
| `queue_timeout_url.b2c` | `urls.timeout.b2c` |
| `logs.enabled` | `logging.enabled` |
| `logs.level` | `logging.channel` |
| `mode` (hardcoded) | `mode` via `DARAJA_MODE` |

Republish the config, or copy the new file and re-enter your values:

```bash
php artisan vendor:publish --tag=laravel-daraja-config --force
```

## Responses

v1 returned `stdClass` from `json_decode()`. v2 returns readonly objects:

```diff
- $response = MpesaApi::STK()->push(…);
- $id = $response->CheckoutRequestID;
+ $response = Daraja::stk()->push(…);
+ $id = $response->checkoutRequestId;
+ $response->accepted();
```

The decoded array is still available on `$response->raw` if you need a field the
DTO does not expose.

## Exceptions

```diff
- use Starnerz\LaravelDaraja\Exceptions\MpesaApiRequestException;
+ use Starnerz\LaravelDaraja\Exceptions\ApiRequestException;
```

`ApiRequestException` now carries `errorCode`, `requestId`, `status` and
`payload`. Configuration problems raise `ConfigurationException` and token
failures `AuthenticationException`, both extending `DarajaException`.

## Endpoint versions

Several endpoints moved, which changes payloads Safaricom sends you:

| API | v1 | v2 |
|---|---|---|
| C2B | `mpesa/c2b/v1/*` | `mpesa/c2b/v2/*` |
| B2C | `mpesa/b2c/v1/paymentrequest` | `mpesa/b2c/v3/paymentrequest` |

**C2B v2 masks the MSISDN** (`2547 ***** 126`) where v1 sent a SHA-256 hash. Any
code matching customers on that value needs revisiting.

**B2C v3 requires `OriginatorConversationID`.** The package generates one; pass
your own to make retries idempotent.

## Certificates

v1 bundled a single `cert.cer`, which expired in March 2018. v2 expects one per
environment at `certs/sandbox.cer` and `certs/production.cer`, or a path in
`DARAJA_CERTIFICATE_PATH`. Download current copies from the portal.

## New in v2

- Cached OAuth tokens instead of a request per instantiation
- Dynamic QR, M-Pesa Ratiba, Bill Manager, Pull Transactions, Lipa na Bonga,
  B2B Express Checkout, B2C Account Top Up, Business to Pochi
- Opt-in callback routes with typed events
- `Http::fake()`-driven testing
- TLS verification in sandbox, which v1 disabled
