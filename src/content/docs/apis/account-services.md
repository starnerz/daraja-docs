---
title: Account services
description: Balances, transaction status queries and reversals.
---

Three account-level APIs, all asynchronous — each acknowledges immediately and
delivers the answer to your result URL.

## Account Balance

<div class="endpoint"><span class="verb">POST</span> mpesa/accountbalance/v1/query</div>

```php
Daraja::balance()->query('End of day reconciliation');
```

The balance arrives in the callback as a single packed string, which the package
parses for you:

```php
public function handle(ResultReceived $event): void
{
    if ($event->type !== 'balance') {
        return;
    }

    $balances = $event->result->balances();

    $balances->utility()['balance'];      // 228037.0
    $balances->working()['available'];    // 700000.0
    $balances->chargesPaid()['balance'];  // -1540.0
    $balances->names();                   // every account returned
}
```

Without that, you would be splitting this by hand:

```
Working Account|KES|700000.00|700000.00|0.00|0.00&Utility Account|KES|228037.00|…
```

### What the accounts mean

| Account | Purpose |
|---|---|
| Utility | Receives customer payments; funds B2C disbursement |
| Merchant | Receives till payments |
| Working (MMF) | Holds money awaiting settlement |
| Charges Paid | Accrues tariff charges — always negative |
| Organization Settlement | Moves balance to Working after charges |

:::note
You can only query your own short code. There are no callback retries — if your
result URL is unreachable, reconcile via Transaction Status or the portal.
:::

## Transaction Status

<div class="endpoint"><span class="verb">POST</span> mpesa/transactionstatus/v1/query</div>

Works for C2B, B2B, B2C, IMT and Reversal transactions.

```php
// By M-Pesa receipt
Daraja::transaction()->query('NEF61H8J60');

// By the OriginatorConversationID you sent, when no receipt exists
Daraja::transaction()->queryByConversationId('7071-4170-a0e5-8345632bad442144258');
```

Passing neither raises a `DarajaException` before a request is sent.

The result carries the transaction's lifecycle state:

| Stage | Values |
|---|---|
| Initial | `Initiated` |
| Intermediate | `Authorized`, `Pending Authorized` |
| Final | `Completed`, `Cancelled`, `Declined`, `Expired` |

:::note[Two parties, one key]
The result returns `DebitPartyName` **twice** — once per side of the
transaction. Use `$result->partyNames()` to get both; reading the key normally
gives you only the first.
:::

## Reversal

<div class="endpoint"><span class="verb">POST</span> mpesa/reversal/v1/request</div>

Reverses **C2B** transactions. B2C payouts cannot be reversed this way.

```php
Daraja::reversal()->reverse(
    transactionId: 'PDU91HIVIT',
    amount: 200,
    remarks: 'Duplicate payment',
);
```

| Result code | Meaning |
|---|---|
| `0` | Reversed |
| `R000001` | Already reversed |
| `R000002` | Invalid original transaction ID |
| `1` | Insufficient balance to reverse |
| `21` | Initiator lacks the Org Reversals Initiator role |
| `2001` | Invalid initiator information |

:::caution[Result codes are strings here]
Reversal returns codes like `"R000002"`, while B2C returns numeric ones. Compare
as strings — the package casts them for you.
:::

In the callback, `TransactionID` is the **reversal's own** receipt;
`OriginalTransactionID` inside the parameters is the transaction that was
reversed.
