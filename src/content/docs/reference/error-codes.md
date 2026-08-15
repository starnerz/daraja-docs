---
title: Error codes
description: Daraja's HTTP errors and per-API result codes in one place.
---

Daraja reports failure at two levels. **Error codes** mean the request was
rejected — you get them synchronously. **Result codes** mean the request was
accepted but the transaction did not complete — they arrive in the callback.

## HTTP error codes

| Code | Meaning | Fix |
|---|---|---|
| `400.002.02` | Bad request, invalid field | Check the payload; often a missing `Content-Type: application/json` |
| `400.002.05` | Invalid request payload | A field name or type is wrong |
| `400.003.01` / `401.002.01` / `404.001.03` | Invalid access token | Regenerate; tokens last an hour |
| `404.001.01` / `404.003.01` | Resource not found | Wrong endpoint |
| `404.001.04` | Invalid authenticator header | Every API is POST except Authorization |
| `405.001` | Method not allowed | Must be POST |
| `500.001.1001` | Merchant does not exist, or wrong credentials | Short code or password encoding |
| `500.002.1001` | Duplicate `OriginatorConversationID` | Use a unique ID per request |
| `500.003.02` | Spike arrest violation | Too many requests per second |
| `500.003.03` | Quota violation | Too many requests overall |
| `500.003.1001` | Internal server error, or URLs already registered | Retry, or delete existing C2B URLs |

## M-Pesa Express

| Code | Meaning |
|---|---|
| `0` | Paid |
| `1032` | Cancelled by user, or prompt timed out |
| `1037` | Prompt never reached the handset |
| `1031` | No PIN entered in time |
| `2001` | Wrong M-Pesa PIN |
| `1001` | Another session open for that number |

## B2C and Pochi

| Code | Meaning |
|---|---|
| `0` | Paid |
| `1` | Insufficient balance in the Utility account |
| `2` / `3` | Below minimum / above maximum |
| `4` | Would exceed the daily transfer limit |
| `8` | Would exceed the recipient's maximum balance |
| `11` | B2C account not active |
| `21` | Initiator lacks the required role |
| `2001` | Invalid initiator information |
| `2006` | Account status disallows the transaction |
| `2028` | Short code has no permission for this product |
| `2040` | Recipient is not registered |
| `8006` | Security credential is locked |
| `SFC_IC0003` | Operator does not exist — invalid phone number |

## Reversal

| Code | Meaning |
|---|---|
| `0` | Reversed |
| `R000001` | Already reversed |
| `R000002` | Invalid original transaction ID |
| `1` | Insufficient balance |
| `21` | Initiator lacks Org Reversals Initiator |

Codes here are **strings**, unlike B2C's numeric ones.

## C2B validation responses

Codes **you** return to accept or reject a payment:

| Code | Meaning |
|---|---|
| `0` | Accepted |
| `C2B00011` | Invalid MSISDN |
| `C2B00012` | Invalid Account Number |
| `C2B00013` | Invalid Amount |
| `C2B00014` | Invalid KYC Details |
| `C2B00015` | Invalid Short code |
| `C2B00016` | Other Error |

## M-Pesa Ratiba

| Code | Meaning |
|---|---|
| `1050` | Duplicate standing order name for that customer |
| `1051` | Bad request — a payload field is invalid |
| `1037` / `1031` / `1032` / `2001` / `1001` | As per M-Pesa Express |

## Lipa na Bonga

| Code | Meaning |
|---|---|
| `6000` / `6001` | Success / fail |
| `6004`–`6011` | Server, credential, payload or downstream system errors |
| `17` | Reversal failed, account balance limit |

## Pull Transactions

| Code | Meaning |
|---|---|
| `1000` | Success — registered, or transactions fetched |
| `1001` | Already registered, or no transactions in the period |
| `400.001` | Invalid short code |

## Bill Manager

Uses `rescode`: `200` success, `409` when cancelling a paid invoice.

## Reading codes safely

`ResultCode` is numeric in some APIs and a string in others, and the STK
callback disagrees with the STK query response. The package casts everything to
string, so compare as strings:

```php
if ($result->resultCode === '0') { /* … */ }
```
