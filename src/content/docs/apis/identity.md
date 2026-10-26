---
title: Identity checks
description: Check a number against an ID, see its last SIM swap, and confirm whose name is on a number or account before money moves.
---

Four APIs answer "who is this?" before money moves. Safaricom enables each one
per app, after a commercial agreement, so they fail on a default sandbox app.
Ask `apisupport@safaricom.co.ke` or your account manager.

| API | Call | What you get |
|---|---|---|
| Mobile Number Validation | `Daraja::mobileNumberValidation()->validate()` | Whether a number is registered to an ID |
| SIM Swap | `Daraja::simSwap()->query()` | The date of the last SIM swap |
| B2C Hakikisha | `Daraja::b2cHakikisha()->validate()` | The masked name on a number, before a payout |
| C2B Hakikisha | `Daraja::resolveC2BAccountUsing()` | Safaricom asks your app whose account a customer is paying |

:::caution[Identity data]
ID numbers and names are personal data. The package redacts `idNumber` and
the Hakikisha names from its log and from `DarajaRequestSending` and
`DarajaResponseReceived`. Store them yourself only when you must.
:::

## Mobile Number Validation

Checks whether a Safaricom number is registered to an ID, passport or
military ID.

```php
use Starnerz\LaravelDaraja\Enums\MobileIdType;
use Starnerz\LaravelDaraja\Facades\Daraja;

$result = Daraja::mobileNumberValidation()->validate(
    phone: '0712345678',
    idType: MobileIdType::NationalId,
    idNumber: '12345678',
);

if ($result->matches()) {
    // The number is registered to that ID.
}
```

| `MobileIdType` | Sent as |
|---|---|
| `NationalId` | `01` |
| `MilitaryId` | `02` |
| `Passport` | `05` |

The phone is normalised to `2547…`. The short code defaults to
`initiator.short_code`; pass `shortCode` to override it, and `requestRefId` to
use your own reference instead of a generated one.

`matches()` is true for response code `4000` ("Details match successfully")
and false for `4001` ("Details do not match"). The response also carries
`responseRefId`, `responseCode`, `responseMessage`, `status` and `raw`.

Safaricom bills each call. If the app is not enabled, the call throws an
`ApiRequestException` with error code `403.001`, `subscription_not_available`.

## SIM Swap

Returns when the SIM behind a number was last swapped. Safaricom looks back
three months; with no swap in that time, the date is `01-01-1900 00:00`.

```php
$result = Daraja::simSwap()->query('0712345678');

if ($result->successful()) {
    $result->lastSwapDate; // "01-01-1900 00:00"
}
```

`successful()` is true for response code `200`. A recent swap is one signal
for your own risk rules, such as holding a large payout or a password reset.

## B2C Hakikisha

Returns the masked registered name on a number, so you can show it before a
payout and let the user confirm it.

```php
$customer = Daraja::b2cHakikisha()->validate('0712345678');

if ($customer->successful()) {
    $name = trim("{$customer->firstName} {$customer->middleName} {$customer->lastName}");
}
```

The request carries a generated `requestID` and a Unix `timestamp`; pass
`requestId`, `timestamp` or `shortCode` to set them yourself.

## C2B Hakikisha

Here Safaricom calls you. Before a customer pays to your paybill, Safaricom
asks your app for the name on the account number they typed, so the customer
sees whose account they are paying.

Turn on the package routes and set the credentials you agree with Safaricom:

```dotenv
DARAJA_ROUTES_ENABLED=true
DARAJA_C2B_HAKIKISHA_USERNAME=
DARAJA_C2B_HAKIKISHA_PASSWORD=
```

Then register the lookup in a service provider's `boot()` method. Return the
account name, or `null` when the account does not belong to that short code:

```php
use Starnerz\LaravelDaraja\Facades\Daraja;

public function boot(): void
{
    Daraja::resolveC2BAccountUsing(
        fn (string $accountNumber, string $shortcode): ?string => Account::query()
            ->where('shortcode', $shortcode)
            ->where('number', $accountNumber)
            ->value('name'),
    );
}
```

Give Safaricom these two URLs (with the default `daraja` prefix):

| Purpose | Route |
|---|---|
| Token | `POST /daraja/c2b-hakikisha/token?grant_type=client_credentials` |
| Account lookup | `POST /daraja/c2b-hakikisha/validation` |

1. Safaricom asks for a token with HTTP Basic authentication, using the
   username and password above. The token lasts `DARAJA_C2B_HAKIKISHA_TOKEN_TTL`
   seconds (3599 by default).
2. It posts the account number and short code to the lookup route, with that
   token as a Bearer token:

   ```json
   {
     "requestId": "dcd1c2ab-7a26-4170-939d-9dc2e879b0e5",
     "timestamp": "1728897681",
     "accountNumber": "66925336",
     "shortcode": "415010"
   }
   ```

3. Your resolver's answer goes back with the request:

   ```json
   {
     "requestId": "dcd1c2ab-7a26-4170-939d-9dc2e879b0e5",
     "timestamp": 1793000000,
     "accountName": "Example Account",
     "accountNumber": "66925336",
     "shortcode": "415010"
   }
   ```

The lookup answers `401` without a valid token, `422` for a malformed body
and `400` when the resolver returns `null`.

Tokens are kept in the package's cache store. If the app runs on more than
one server, that store must be shared (Redis or the database), or a token
issued by one server is refused by the next.
