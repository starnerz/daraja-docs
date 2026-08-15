---
title: Introduction
description: What the package does, and what Daraja expects of you.
---

Laravel Daraja wraps Safaricom's M-Pesa Daraja APIs so that taking a payment is
an ordinary method call rather than an exercise in assembling JSON.

## What it handles for you

**Authentication.** Daraja access tokens last an hour. The package fetches one,
caches it just short of expiry, and attaches it to every request. Nothing in
your code deals with tokens.

**Payload assembly.** Timestamps in East Africa Time, base64 passwords, phone
numbers normalised to `2547XXXXXXXX`, amounts rounded to whole shillings, and
the field-name inconsistencies Safaricom has accumulated — `Occasion` on one API
and `Occassion` on another, `RecieverIdentifierType` misspelled throughout.

**Responses.** Every call returns a readonly object with named properties
instead of a `stdClass` you have to guess your way around.

**Callbacks.** Optional routes turn Safaricom's payloads into typed events, and
the parsers cope with the shape changes Daraja makes between success and
failure.

## What Daraja still expects of you

The package cannot paper over these, and they surprise most people:

- **Callbacks need a publicly reachable HTTPS URL.** Safaricom will not call
  `localhost`, and the documentation explicitly warns that public tunnels such
  as ngrok are usually blocked, especially in production.
- **Most APIs are asynchronous.** You get an acknowledgement immediately; the
  actual outcome arrives later on your result URL. A `ResponseCode` of `0` means
  "queued", not "paid".
- **Going live is a business process.** Production credentials require a signed
  agreement, an M-Pesa organisation portal account and an API operator with the
  right role. See [Going live](../../guides/going-live/).

## Where things live

| Concern | Entry point |
|---|---|
| Sending requests | `Daraja::stk()`, `Daraja::c2b()`, `Daraja::b2c()`, … |
| Receiving callbacks | Events under `Starnerz\LaravelDaraja\Events` |
| Configuration | `config/laravel-daraja.php` |
| Failures | `Starnerz\LaravelDaraja\Exceptions\DarajaException` and subclasses |
