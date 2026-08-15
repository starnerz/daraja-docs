---
title: Testing
description: Test M-Pesa integrations without touching Safaricom.
---

The package is built on Laravel's HTTP client, so `Http::fake()` intercepts
every Daraja call. You do not need sandbox credentials, a network, or a phone.

## Fake a push

```php
use Illuminate\Support\Facades\Http;
use Starnerz\LaravelDaraja\Facades\Daraja;

it('sends an STK push when an order is placed', function () {
    Http::fake([
        '*/oauth/*' => Http::response(['access_token' => 'test', 'expires_in' => '3599']),
        '*/mpesa/stkpush/*' => Http::response([
            'MerchantRequestID' => '29115-34620561-1',
            'CheckoutRequestID' => 'ws_CO_191220191020363925',
            'ResponseCode' => '0',
            'ResponseDescription' => 'Success',
            'CustomerMessage' => 'Success',
        ]),
    ]);

    $this->post('/orders', ['phone' => '0712345678', 'amount' => 1500])
        ->assertOk();

    Http::assertSent(fn ($request) => str_contains($request->url(), 'stkpush')
        && $request['Amount'] === '1500');
});
```

Always fake the OAuth endpoint too — the package fetches a token before the
first call.

:::caution[fake() merges, it does not replace]
Successive `Http::fake()` calls merge, and the **first matching stub wins**. A
fake inside a test cannot override one registered in `beforeEach`. Register each
test's stubs once, listing overrides first:

```php
function fakeDaraja(array $overrides = []): void
{
    Http::fake($overrides + [
        '*/oauth/*' => Http::response(['access_token' => 'test']),
        '*/mpesa/stkpush/*' => Http::response(['ResponseCode' => '0']),
    ]);
}
```
:::

## Test failures

```php
it('handles a rejected push', function () {
    Http::fake([
        '*/oauth/*' => Http::response(['access_token' => 'test']),
        '*/mpesa/stkpush/*' => Http::response([
            'requestId' => '11728-2929992-1',
            'errorCode' => '400.002.02',
            'errorMessage' => 'Bad Request - Invalid Amount',
        ], 400),
    ]);

    expect(fn () => Daraja::stk()->push('0712345678', 0, 'INV-1'))
        ->toThrow(ApiRequestException::class, 'Invalid Amount');
});
```

`ApiRequestException` exposes `errorCode`, `requestId`, `status` and the decoded
`payload`.

## Test your callback handling

Post a real payload at your route and assert on the event:

```php
use Starnerz\LaravelDaraja\Events\StkCallbackReceived;

it('marks the order paid', function () {
    Event::fake();

    $this->postJson('/daraja/stk', [
        'Body' => ['stkCallback' => [
            'MerchantRequestID' => '29115-34620561-1',
            'CheckoutRequestID' => 'ws_CO_191220191020363925',
            'ResultCode' => 0,
            'ResultDesc' => 'The service request is processed successfully.',
            'CallbackMetadata' => ['Item' => [
                ['Name' => 'Amount', 'Value' => 1500.0],
                ['Name' => 'MpesaReceiptNumber', 'Value' => 'NLJ7RT61SV'],
                ['Name' => 'PhoneNumber', 'Value' => 254712345678],
            ]],
        ]],
    ])->assertOk();

    Event::assertDispatched(StkCallbackReceived::class);
});
```

Test the failure payload too — it has **no `CallbackMetadata` at all**:

```php
'Body' => ['stkCallback' => [
    'MerchantRequestID' => '…',
    'CheckoutRequestID' => '…',
    'ResultCode' => 1032,
    'ResultDesc' => 'Request cancelled by user',
]],
```

## Assert what you sent

`Http::assertSent()` receives the decoded body, which is where the value is:

```php
Http::assertSent(function ($request) {
    $body = $request->data();

    expect($body['PartyA'])->toBe('254712345678')
        ->and($body['TransactionType'])->toBe('CustomerPayBillOnline');

    return true;
});
```

## Faking the token

The token is cached, so a test asserting request counts should flush first:

```php
beforeEach(fn () => cache()->flush());
```

Otherwise a token cached by an earlier test makes the OAuth call disappear and
your count is off by one.

## Sandbox testing

When you do need the real thing, see
[Sandbox credentials](../../getting-started/sandbox/). Remember that callbacks
require a publicly reachable URL even in sandbox.
