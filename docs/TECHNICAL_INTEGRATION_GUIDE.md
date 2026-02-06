# Invoix Technical Integration Guide

> **Date**: February 2026  
> **Version**: 1.0.0  
> **Network**: Solana Mainnet / Devnet  
> **Contact**: [@Invoix_solana](https://x.com/Invoix_solana)

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [API Specification](#3-api-specification)
4. [Transaction Building](#4-transaction-building)
5. [Supported Currencies](#5-supported-currencies)
6. [Security Model](#6-security-model)
7. [Integration Examples](#7-integration-examples)
8. [Testing Guide](#8-testing-guide)
9. [Contact & Support](#9-contact--support)

---

## 1. Executive Summary

**Invoix** is a B2B invoice settlement platform on Solana. This documentation provides everything needed to integrate Invoix invoice payments into wallet applications.

### What Invoix Does

- Businesses create invoices for their customers
- Customers receive a shareable link to pay
- Payment is settled on-chain in USDC, EURC, PYUSD, USDT, or SOL
- Automatic cNFT receipt minted as proof-of-payment

### Integration Opportunities

| Feature | Description |
|---------|---------|
| **In-Wallet Invoice Payments** | Users pay invoices directly within the wallet |
| **AI Assistant Integration** | Natural language command support ("Pay my invoice") |
| **Push Notifications** | Alert users when they receive an invoice |
| **Invoice Inbox** | Query pending invoices for a wallet |

---

## 2. Architecture Overview

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        INVOIX SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Business creates invoice → Stored in Invoix DB              │
│                    ↓                                             │
│  2. Customer receives link: https://invoix.app/i/{invoice-id}   │
│                    ↓                                             │
│  3. Wallet fetches Action metadata (GET /api/solana-pay/:id)    │
│                    ↓                                             │
│  4. User clicks "Pay" → Wallet POSTs account pubkey             │
│                    ↓                                             │
│  5. Server returns unsigned transaction (base64)                 │
│                    ↓                                             │
│  6. User signs → Wallet broadcasts → Solana settles             │
│                    ↓                                             │
│  7. Invoix confirms payment → Mints cNFT receipt                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/actions.json` | GET | Solana Actions discovery manifest |
| `/api/solana-pay/:id` | GET | Returns Action metadata (title, icon, buttons) |
| `/api/solana-pay/:id` | POST | Returns unsigned transaction for signing |
| `/api/invoices/:id` | GET | Full invoice details (authenticated) |
| `/api/invoices` | GET | List invoices for a wallet (authenticated) |

---

## 3. API Specification

### 3.1 Actions Discovery (`/actions.json`)

**Request:**
```http
GET https://invoix.app/actions.json
```

**Response:**
```json
{
  "rules": [
    {
      "pathPattern": "/i/**",
      "apiPath": "/api/solana-pay/**"
    }
  ]
}
```

This maps invoice URLs like `https://invoix.app/i/INV-2026-0042` to the Actions API.

---

### 3.2 Action Metadata (`GET /api/solana-pay/:id`)

Returns the "card" data for displaying the invoice payment action.

**Request:**
```http
GET https://invoix.app/api/solana-pay/INV-2026-0042
```

**Response (200 OK):**
```json
{
  "icon": "https://invoix.app/logo.png",
  "title": "Invoice #INV-2026-0042",
  "description": "Pay 500.00 USDC to 7xKX...9mPq",
  "label": "Pay 500.00 USDC",
  "links": {
    "actions": [
      {
        "label": "Pay 500.00 USDC",
        "href": "https://invoix.app/api/solana-pay/INV-2026-0042"
      }
    ]
  }
}
```

**Error Response (404):**
```json
{
  "error": "Invoice not found"
}
```

**Error Response (400 - Already Paid):**
```json
{
  "error": "Invoice already paid"
}
```

---

### 3.3 Transaction Request (`POST /api/solana-pay/:id`)

Returns a serialized, unsigned transaction for the wallet to sign.

**Request:**
```http
POST https://invoix.app/api/solana-pay/INV-2026-0042
Content-Type: application/json

{
  "account": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA9PNLMzEzUL9mP"
}
```

**Response (200 OK):**
```json
{
  "transaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAA...<base64>...AAAA==",
  "message": "Pay 500.00 USDC for Invoice #INV-2026-0042"
}
```

**Error Response (403 - Unauthorized Payer):**
```json
{
  "error": "Unauthorized: Only the designated recipient can pay this invoice"
}
```

**Error Response (400 - Missing Account):**
```json
{
  "error": "Missing 'account' field"
}
```

---

### 3.4 Invoice Details API (`GET /api/invoices/:id`)

For deeper integration, wallets can fetch full invoice details.

**Request:**
```http
GET https://invoix.app/api/invoices/INV-2026-0042
Cookie: session=<session-cookie>
```

**Response (200 OK):**
```json
{
  "id": "INV-2026-0042",
  "invoiceNumber": "INV-2026-0042",
  "status": "pending",
  "currency": "USDC",
  "totalAmount": "500.00",
  "remainingAmount": "500.00",
  "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "tokenDecimals": 6,
  "invoicerWalletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA9PNLMzEzUL9mP",
  "invoiceeWalletAddress": "9aB3dEfGhIjKlMnOpQrStUvWxYz1234567890AbCdEf",
  "dueDate": "2026-02-15T00:00:00.000Z",
  "createdAt": "2026-02-01T12:00:00.000Z",
  "lineItems": [
    {
      "description": "Consulting Services - January 2026",
      "quantity": 1,
      "unitPrice": "500.00"
    }
  ]
}
```

---

### 3.5 List Pending Invoices (`GET /api/invoices`)

Get all invoices for a wallet (useful for inbox/notifications).

**Request:**
```http
GET https://invoix.app/api/invoices?wallet=9aB3dEfGhIjKlMnOpQrStUvWxYz1234567890AbCdEf&status=pending
Cookie: session=<session-cookie>
```

**Response:**
```json
{
  "invoices": [
    {
      "id": "INV-2026-0042",
      "invoiceNumber": "INV-2026-0042",
      "totalAmount": "500.00",
      "currency": "USDC",
      "status": "pending",
      "dueDate": "2026-02-15T00:00:00.000Z",
      "invoicerWalletAddress": "7xKX..."
    }
  ],
  "total": 1,
  "page": 1
}
```

---

## 4. Transaction Building

### 4.1 Transaction Structure

Every invoice payment transaction contains:

```
┌─────────────────────────────────────────────────────────────┐
│                    TRANSACTION                               │
├─────────────────────────────────────────────────────────────┤
│ Instruction 1: Create Recipient ATA (if needed)             │
│ Instruction 2: Create Treasury ATA (if needed)              │
│ Instruction 3: Transfer to Recipient (99% of amount)        │
│ Instruction 4: Transfer to Treasury (1% platform fee)       │
├─────────────────────────────────────────────────────────────┤
│ Fee Payer: User (payer wallet)                              │
│ Signers Required: User only                                 │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Fee Structure

| Fee Type | Rate | Paid By |
|----------|------|---------|
| Platform Fee | 1% | Deducted from payment |
| Network Fee (Gas) | ~0.000005 SOL | Payer |
| ATA Creation (if needed) | ~0.002 SOL | Payer |

**Example:** For a 500 USDC invoice:
- Recipient receives: 495 USDC (99%)
- Treasury receives: 5 USDC (1%)
- Payer pays: 500 USDC + gas

### 4.3 ATA Handling

The transaction automatically creates Associated Token Accounts if they don't exist:

```typescript
// Pseudocode from our implementation
if (!recipientTokenAccountExists) {
  transaction.add(createAssociatedTokenAccountInstruction(
    payer,           // Fee payer (user)
    recipientATA,    // ATA to create
    recipientWallet, // Owner of ATA
    tokenMint,       // USDC/EURC/PYUSD mint
    tokenProgram     // Token or Token-2022
  ));
}
```

---

## 5. Supported Currencies

### 5.1 Mainnet Tokens

| Currency | Mint Address | Token Program | Decimals |
|----------|-------------|---------------|----------|
| **SOL** | `So11111111111111111111111111111111111111112` | Native | 9 |
| **USDC** | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | Token | 6 |
| **USDT** | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | Token | 6 |
| **EURC** | `HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr` | Token | 6 |
| **PYUSD** | `2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo` | Token-2022 | 6 |

### 5.2 Devnet Tokens

| Currency | Mint Address | Token Program | Decimals |
|----------|-------------|---------------|----------|
| **SOL** | `So11111111111111111111111111111111111111112` | Native | 9 |
| **USDC** | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | Token-2022 | 6 |

### 5.3 Token Program Detection

```typescript
// We detect token program from the invoice's tokenMint
const stablecoinConfig = getStablecoinConfig(invoice.currency);
const tokenProgramId = new PublicKey(stablecoinConfig.tokenProgramId);

// Token:      TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
// Token-2022: TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
```

---

## 6. Security Model

### 6.1 Authorization

Only the designated **invoicee** (customer) can pay an invoice:

```typescript
// From solana-pay-routes.ts
if (account !== invoice.invoiceeWalletAddress) {
  return res.status(403).json({
    error: "Unauthorized: Only the designated recipient can pay this invoice"
  });
}
```

### 6.2 CORS Configuration

Actions endpoints allow cross-origin requests:

```typescript
const isActionsRoute = req.path.startsWith('/api/solana-pay') || req.path === '/actions.json';

if (isActionsRoute) {
  res.setHeader("Access-Control-Allow-Origin", "*");
}
```

**CORS Headers for Actions:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

### 6.3 Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Global | 300 requests | 15 minutes |
| Authentication | 20 requests | 1 hour |
| Sensitive Ops | 10 requests | 15 minutes |

### 6.4 Input Validation

All inputs are validated via Zod schemas and sanitized for XSS:

- Wallet addresses: Base58, 32-44 characters
- Amounts: Positive numbers with max precision
- Invoice IDs: Alphanumeric with dashes

---

## 7. Integration Examples

### 7.1 Basic Blink Rendering

```typescript
// Fetch action metadata
const response = await fetch('https://invoix.app/api/solana-pay/INV-2026-0042');
const action = await response.json();

// Display card
console.log(action.title);       // "Invoice #INV-2026-0042"
console.log(action.description); // "Pay 500.00 USDC to 7xKX...9mPq"
console.log(action.label);       // "Pay 500.00 USDC"
console.log(action.icon);        // "https://invoix.app/logo.png"
```

### 7.2 Execute Payment

```typescript
// 1. Get transaction from Invoix
const txResponse = await fetch('https://invoix.app/api/solana-pay/INV-2026-0042', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: userWallet.publicKey.toBase58() })
});

const { transaction: base64Tx, message } = await txResponse.json();

// 2. Deserialize transaction
const transaction = Transaction.from(Buffer.from(base64Tx, 'base64'));

// 3. Sign with user's wallet
const signedTx = await wallet.signTransaction(transaction);

// 4. Broadcast to Solana
const signature = await connection.sendRawTransaction(signedTx.serialize());

// 5. Confirm
await connection.confirmTransaction(signature, 'confirmed');
```

### 7.3 AI Assistant Intent Example

```
User: "Pay my invoice from Invoix for 500 USDC"

AI Assistant should:
1. Query Invoix API for pending invoices: GET /api/invoices?wallet={user}&status=pending
2. Match by amount/description
3. Fetch action: GET /api/solana-pay/{invoice-id}
4. Build and present transaction to user
5. Execute on confirmation
```

---

## 8. Testing Guide

### 8.1 Devnet Environment

| Resource | Value |
|----------|-------|
| **Base URL** | `https://invoix-devnet.up.railway.app` |
| **Network** | Devnet |
| **Test USDC Faucet** | Circle Faucet |

### 8.2 Test Flow

```bash
# 1. Verify actions.json
curl https://invoix-devnet.up.railway.app/actions.json

# 2. Create test invoice (requires auth)
# Use the Invoix web app to create a test invoice

# 3. Test GET action metadata
curl https://invoix-devnet.up.railway.app/api/solana-pay/TEST-001

# 4. Test POST (get transaction)
curl -X POST https://invoix-devnet.up.railway.app/api/solana-pay/TEST-001 \
  -H "Content-Type: application/json" \
  -d '{"account": "YOUR_DEVNET_WALLET"}'
```

### 8.3 Test on dial.to

1. Go to https://dial.to
2. Enter: `https://invoix-devnet.up.railway.app/i/{invoice-id}`
3. Verify Blink renders correctly
4. Test payment flow with Devnet wallet

---

## 9. Contact & Support

### Primary Contacts

| Role | Contact |
|------|---------|
| **Project Lead** | Twitter: [@Invoix_solana](https://x.com/Invoix_solana) |
| **GitHub** | [github.com/RYthaGOD/invoix](https://github.com/RYthaGOD/invoix) |
| **Community** | [Invoix X Community](https://x.com/i/communities/1998417251041718386) |

### Technical Resources

| Resource | URL |
|----------|-----|
| **Live Production** | https://invoix.app |
| **Devnet Instance** | https://invoix-devnet.up.railway.app |
| **GitHub Repository** | https://github.com/RYthaGOD/invoix |
| **Protocol Docs** | [PROTOCOL.md](https://github.com/RYthaGOD/invoix/blob/main/PROTOCOL.md) |
| **Whitepaper** | [WHITEPAPER.md](https://github.com/RYthaGOD/invoix/blob/main/WHITEPAPER.md) |

### Quick Links

- **actions.json**: https://invoix.app/actions.json
- **Health Check**: https://invoix.app/api/health
- **API Docs Page**: https://invoix.app/docs

---

## Appendix A: Response Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request (missing fields, invalid format, already paid) |
| `403` | Unauthorized payer (not the invoicee) |
| `404` | Invoice not found |
| `429` | Rate limited |
| `500` | Server error |

---

## Appendix B: Example Invoice URL Patterns

```
Production:
https://invoix.app/i/INV-2026-0042
https://invoix.app/i/abc123

Devnet:
https://invoix-devnet.up.railway.app/i/TEST-001
```

---

*Built with ❤️ for the decentralized economy by the Invoix Team.*
