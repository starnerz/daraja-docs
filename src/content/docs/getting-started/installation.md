---
title: Installation
description: Install the package and publish its configuration.
---

## Requirements

- PHP 8.3 or higher
- Laravel 12 or 13
- The `openssl` and `json` extensions

## Install

```bash
composer require starnerz/laravel-daraja
```

The service provider and the `Daraja` facade are registered automatically.

## Publish the configuration

```bash
php artisan vendor:publish --tag=laravel-daraja-config
```

That writes `config/laravel-daraja.php`. Every value reads from an environment
variable, so you can also skip publishing and set only the `.env` keys below.

## Minimum environment

```dotenv
DARAJA_MODE=sandbox
DARAJA_CONSUMER_KEY=your-consumer-key
DARAJA_CONSUMER_SECRET=your-consumer-secret
```

That is enough for M-Pesa Express once you add the STK values:

```dotenv
DARAJA_STK_SHORTCODE=174379
DARAJA_STK_PASS_KEY=your-passkey
DARAJA_STK_CALLBACK_URL=https://your-domain.test/daraja/stk
```

APIs that move money on your behalf also need an initiator:

```dotenv
DARAJA_INITIATOR_NAME=testapi
DARAJA_INITIATOR_CREDENTIAL=your-initiator-password
DARAJA_INITIATOR_SHORTCODE=600000
```

See [Configuration](../configuration/) for the complete list.

## Verify it works

```bash
php artisan daraja:token
```

A successful run prints your mode and an access token, which confirms the
consumer key and secret are valid for that environment. Anything else raises a
`ConfigurationException` or `AuthenticationException` naming the problem.

## Certificates

The APIs that need a `SecurityCredential` — B2C, B2B, Reversal, Account Balance
and Transaction Status — encrypt your initiator password with a Safaricom
certificate.

**Nothing is required of you.** The package ships a certificate for each
environment and picks the one matching `DARAJA_MODE`.

To use your own copy instead:

```dotenv
DARAJA_CERTIFICATE_PATH=/full/path/to/production.cer
```
