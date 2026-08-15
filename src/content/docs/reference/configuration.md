---
title: Configuration reference
description: Every key in config/laravel-daraja.php.
---

| Key | Env | Default |
|---|---|---|
| `mode` | `DARAJA_MODE` | `sandbox` |
| `hosts.sandbox` | — | `https://sandbox.safaricom.co.ke` |
| `hosts.live` | — | `https://api.safaricom.co.ke` |
| `certificate_path` | `DARAJA_CERTIFICATE_PATH` | `null` — uses the bundled certificate |
| `consumer_key` | `DARAJA_CONSUMER_KEY` | `null` |
| `consumer_secret` | `DARAJA_CONSUMER_SECRET` | `null` |
| `initiator.name` | `DARAJA_INITIATOR_NAME` | `null` |
| `initiator.credential` | `DARAJA_INITIATOR_CREDENTIAL` | `null` |
| `initiator.short_code` | `DARAJA_INITIATOR_SHORTCODE` | `null` |
| `initiator.type` | `DARAJA_INITIATOR_TYPE` | `paybill` |
| `partner_name` | `DARAJA_PARTNER_NAME` | `null` |
| `pull.nominated_number` | `DARAJA_PULL_NOMINATED_NUMBER` | `null` |
| `bill_manager.app_key` | `DARAJA_BILL_MANAGER_APP_KEY` | `null` |
| `stk.short_code` | `DARAJA_STK_SHORTCODE` | `null` |
| `stk.pass_key` | `DARAJA_STK_PASS_KEY` | `null` |
| `stk.callback_url` | `DARAJA_STK_CALLBACK_URL` | `null` |
| `urls.c2b.confirmation` | `DARAJA_C2B_CONFIRMATION_URL` | `null` |
| `urls.c2b.validation` | `DARAJA_C2B_VALIDATION_URL` | `null` |
| `urls.result.b2c` | `DARAJA_B2C_RESULT_URL` | `null` |
| `urls.result.b2b` | `DARAJA_B2B_RESULT_URL` | `null` |
| `urls.result.b2b_express` | `DARAJA_B2B_EXPRESS_RESULT_URL` | `null` |
| `urls.result.pull` | `DARAJA_PULL_CALLBACK_URL` | `null` |
| `urls.result.bill_manager` | `DARAJA_BILL_MANAGER_CALLBACK_URL` | `null` |
| `urls.result.standing_order` | `DARAJA_STANDING_ORDER_CALLBACK_URL` | `null` |
| `urls.result.reversal` | `DARAJA_REVERSAL_RESULT_URL` | `null` |
| `urls.result.balance` | `DARAJA_BALANCE_RESULT_URL` | `null` |
| `urls.result.transaction_status` | `DARAJA_TRANSACTION_STATUS_RESULT_URL` | `null` |
| `urls.timeout.*` | `DARAJA_*_TIMEOUT_URL` | `null` |
| `http.timeout` | `DARAJA_HTTP_TIMEOUT` | `30` |
| `http.connect_timeout` | `DARAJA_HTTP_CONNECT_TIMEOUT` | `10` |
| `http.retries` | `DARAJA_HTTP_RETRIES` | `2` |
| `http.retry_delay` | `DARAJA_HTTP_RETRY_DELAY` | `250` |
| `cache.store` | `DARAJA_CACHE_STORE` | `null` — default store |
| `cache.prefix` | — | `daraja` |
| `cache.token_ttl` | `DARAJA_TOKEN_TTL` | `3540` |
| `logging.enabled` | `DARAJA_LOGGING_ENABLED` | `false` |
| `logging.channel` | `DARAJA_LOG_CHANNEL` | `null` — default channel |
| `routes.enabled` | `DARAJA_ROUTES_ENABLED` | `false` |
| `routes.prefix` | `DARAJA_ROUTES_PREFIX` | `daraja` |
| `routes.middleware` | — | `['api']` |
| `security.allowed_ips` | `DARAJA_ALLOWED_IPS` | `[]` — permits all |

## Notes

**Callback URLs accept route names.** Config files cannot call `route()`, so any
URL value may instead be the name of a route, which the package resolves at
request time.

**`cache.token_ttl` is deliberately under an hour.** Tokens live 3600 seconds;
caching for 3540 avoids using one in its final moments.

**`http.retries` only covers connection failures.** A 4xx means the request was
rejected, so retrying repeats the rejection.

**`security.allowed_ips` is a comma-separated env value**, parsed into an array.
Plain addresses and CIDR both work.
