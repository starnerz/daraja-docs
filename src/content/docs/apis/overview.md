---
title: API overview
description: Every supported API and the call that reaches it.
---

Seventeen Daraja APIs are supported. Each is reached through the `Daraja`
facade.

## Payments

| API | Call | Endpoint |
|---|---|---|
| M-Pesa Express | `Daraja::stk()->push()` | `mpesa/stkpush/v1/processrequest` |
| M-Pesa Express Query | `Daraja::stk()->query()` | `mpesa/stkpushquery/v1/query` |
| C2B Register URL | `Daraja::c2b()->registerUrls()` | `mpesa/c2b/v2/registerurl` |
| C2B Simulate | `Daraja::c2b()->simulatePayBill()` | `mpesa/c2b/v2/simulate` |
| Business Pay Bill | `Daraja::b2b()->payBill()` | `mpesa/b2b/v1/paymentrequest` |
| Business Buy Goods | `Daraja::b2b()->buyGoods()` | `mpesa/b2b/v1/paymentrequest` |
| B2C Account Top Up | `Daraja::b2b()->accountTopUp()` | `mpesa/b2b/v1/paymentrequest` |
| B2B Express Checkout | `Daraja::b2bExpress()->push()` | `v1/ussdpush/get-msisdn` |
| Dynamic QR | `Daraja::qr()->generate()` | `mpesa/qrcode/v1/generate` |
| M-Pesa Ratiba | `Daraja::standingOrder()->create()` | `standingorder/v1/createStandingOrderExternal` |
| Lipa na Bonga | `Daraja::bonga()->redeem()` | `v1/lipa/na/bonga/redeem-paybill` |

## Disbursement

| API | Call | Endpoint |
|---|---|---|
| Business to Customer | `Daraja::b2c()->business()` | `mpesa/b2c/v3/paymentrequest` |
| Business to Pochi | `Daraja::b2c()->pochi()` | `mpesa/b2pochi/v1/paymentrequest` |

## Account services

| API | Call | Endpoint |
|---|---|---|
| Account Balance | `Daraja::balance()->query()` | `mpesa/accountbalance/v1/query` |
| Transaction Status | `Daraja::transaction()->query()` | `mpesa/transactionstatus/v1/query` |
| Reversal | `Daraja::reversal()->reverse()` | `mpesa/reversal/v1/request` |
| Pull Transactions | `Daraja::pull()->query()` | `pulltransactions/v1/query` |
| Bill Manager | `Daraja::billManager()->invoice()` | `v1/billmanager-invoice/*` |

## Synchronous or asynchronous?

Only a few APIs answer with the actual outcome. Everything else acknowledges the
request and delivers the result to a callback later.

| Returns the outcome directly | Returns an acknowledgement |
|---|---|
| M-Pesa Express Query | M-Pesa Express push |
| Dynamic QR | C2B, B2C, B2B, Pochi |
| Pull Transactions | Balance, Transaction Status, Reversal |
| Lipa na Bonga calculate | Ratiba, B2B Express, Bill Manager |

For the asynchronous ones, a `ResponseCode` of `0` means Safaricom queued the
request. Whether money moved is decided later, in the callback.

## Not supported

**B2B Hakikisha** (organisation name and tariff lookup) is absent because
Safaricom's own documentation page for it returns a 404, so there is no
published endpoint or payload to implement against.

**Tax Remittance**, **Mobile Data Bundles**, **IoT SIM Management** and the
identity APIs (Swap, IMSI, Mobile Number Validation, Age on Network) are out of
scope for a payments package.

## Escape hatch

For anything unwrapped, the authenticated client is available directly:

```php
$response = Daraja::client()->post('mpesa/some/new/endpoint', [
    'Field' => 'value',
]);
```

It carries the cached token, base URL, timeouts, retries and error handling.
