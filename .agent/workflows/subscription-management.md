---
description: create and manage subscriptions
---

# Subscription Management Workflow

## Create New Subscription (Merchant)

1. Navigate to [http://localhost:5173/subscriptions](http://localhost:5173/subscriptions)
2. Click "New Subscription" button
3. Select subscription plan from dropdown
4. Enter customer wallet address
   - Must be valid Solana address (base58, 32-44 chars)
   - Validated in real-time
5. Review subscription summary
6. Click "Create Subscription"
7. Sign transaction in connected wallet
8. Wait for confirmation
9. **Result**: Subscription status changes to "Active"

## View Subscriptions

### As Merchant

Shows subscriptions you created:
- Navigate to `/subscriptions`
- Default view: "As Merchant"
- See all subscriptions where you're the invoicer
- Filter by status: All, Active, Cancelled, Pending

### As Customer

Shows subscriptions you're paying:
- Navigate to `/subscriptions`
- Toggle to "As Customer" view
- See all subscriptions where you're the customer
- View next billing

 dates
- Track payment history

## Subscription Detail View

Click any subscription card to view details:
- Subscription overview
- Billing information
- Current period dates
- Next billing date countdown
- Payment history
- Available actions

## Cancel Subscription

1. Open subscription detail page
2. Click "Cancel Subscription" button
3. Confirm in modal dialog
4. Sign cancellation transaction
5. Wait for confirmation
6. **Result**: Subscription status changes to "Cancelled"

**Note**: Only active subscriptions can be cancelled

## Manually Mint Invoice

For active subscriptions, you can mint an invoice manually:

1. Open active subscription detail page
2. Click "Mint Invoice Now"
3. Review invoice preview in modal
4. Sign minting transaction
5. Wait for confirmation
6. **Result**: 
   - New invoice created
   - Sent to customer
   - Billing cycle advanced

## Subscription Plans

### Available Plans

Plans are pre-configured by merchants:
- **Basic**: $9.99/month
- **Pro**: $29.99/month
- **Enterprise**: $99.99/year

### Creating Custom Plans

Requires backend API call (future UI):
```bash
POST /api/subscriptions/plans
{
  "name": "Custom Plan",
  "amount": "49.99",
  "currency": "USDC",
  "interval": "monthly",
  "intervalCount": 1
}
```

## Automated Billing

Subscriptions with `autoMint: true`:
- System checks daily for billing due dates
- Automatically mints invoices when period ends
- Sends invoice to customer
- Advances billing cycle

**Manual Billing**: Set `autoMint: false` and mint manually

## Status Meanings

- **Pending Confirmation**: Created, awaiting blockchain confirmation
- **Active**: Confirmed and billing
- **Cancelled**: Terminated, no future billing
- **Past Due**: Payment overdue (future feature)

## Troubleshooting

### "Invalid wallet address" error
- Ensure address is valid Solana base58 format
- Check for typos
- Address must be 32-44 characters

### "Subscription already exists" error
- Customer already has pending subscription for this plan
- Wait for confirmation or cancel pending subscription

### Transaction fails
- Ensure wallet has SOL for transaction fees
- Check wallet is connected
- Verify network (Devnet/Mainnet)
- Try again

### Can't cancel subscription
- Only active subscriptions can be cancelled
- Pending subscriptions expire automatically after 24h
- Already cancelled subscriptions can't be re-cancelled

## API Endpoints

For programmatic access:

```bash
# List subscriptions
GET /api/subscriptions?status=active

# Create subscription
POST /api/subscriptions

# Confirm subscription
POST /api/subscriptions/:id/confirm

# Cancel subscription
POST /api/subscriptions/:id/cancel-prepare
POST /api/subscriptions/:id/cancel-confirm

# Mint invoice
POST /api/subscriptions/:id/mint-invoice
POST /api/subscriptions/:id/mint-confirm
```

## Best Practices

1. **Test on Devnet first** before creating production subscriptions
2. **Verify customer wallet** with test transaction before subscription
3. **Set realistic billing cycles** matching customer expectations
4. **Monitor subscriptions regularly** via dashboard
5. **Communicate changes** to customers before cancelling
