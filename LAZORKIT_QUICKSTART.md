# LazorKit Integration - Quick Start Guide

## 🚀 How to Enable Passkey Authentication

### 1. Update `.env` File
Add these lines to your `.env` file:

```bash


# LazorKit endpoints (devnet defaults)
VITE_LAZORKIT_RPC_URL=https://api.devnet.solana.com
VITE_LAZORKIT_PORTAL_URL=https://portal.lazor.sh
VITE_LAZORKIT_PAYMASTER_URL=https://kora.devnet.lazorkit.com

# SECURITY CONFIGURATION
# LazorKit Program ID (Devnet default)
LAZORKIT_PROGRAM_ID=Gsuz7YcA5sbMGVRXT3xSYhJBessW4xFC4xYsihNCqMFh
# Set to 'true' to enforce strict cryptographic signature verification
LAZORKIT_STRICT_MODE=false
```

### 2. Usage in Your App

#### Option A: Use the Auth Mode Selector Component
```typescript
import { AuthModeSelector } from "@/components/auth-mode-selector";

function LoginPage() {
  return (
    <div>
      <h1>Sign In to Invoix</h1>
      <AuthModeSelector />
    </div>
  );
}
```

#### Option B: Programmatic Authentication
```typescript
import { useAuth } from "@/hooks/use-auth";

function CustomLoginButton() {
  const { login, authMode, isAuthenticated } = useAuth();

  const handlePasskeyLogin = async () => {
    await login('passkey');  // Triggers WebAuthn prompt
  };

  const handleWalletLogin = async () => {
    await login('traditional');  // Traditional wallet connect
  };

  if (isAuthenticated) {
    return <div>Logged in with {authMode} mode</div>;
  }

  return (
    <div>
      <button onClick={handlePasskeyLogin}>Sign in with Passkey</button>
      <button onClick={handleWalletLogin}>Connect Wallet</button>
    </div>
  );
}
```

### 3. Accessing Auth Mode in Protected Routes
```typescript
function InvoiceCreate() {
  const { authMode, walletAddress } = useAuth();

  // Check if user is using passkey authentication
  if (authMode === 'passkey') {
    // Use gasless transactions via paymaster
    console.log('Gasless mode enabled!');
  }

  return <div>Create Invoice</div>;
}
```

## 🧪 Testing Locally

1. **Start the dev server**:
   ```bash
   npm run dev
   ```



3. **Navigate to login page** and click "Sign in with Passkey"

4. **Complete WebAuthn prompt** (browser will ask for biometric or PIN)

5. **Verify session** - Check browser DevTools Network tab for:
   - `POST /api/auth/login/passkey` (status 200)
   - Session cookie created

## 🔐 Security Notes

- **Session keys**: Currently DISABLED for security review
- **Paymaster**: Using LazorKit's devnet paymaster (rate-limited)
- **Auth modes**: Isolated - no cross-contamination between traditional and passkey sessions
- **Backward compatible**: Existing sessions default to `traditional` mode

## 📊 Monitoring

All passkey auth events are logged with audit tags:
- `login_success_passkey` - Successful passkey authentication
- `wallet_access_granted` - Includes `authMode` field

## 🛠️ Troubleshooting

**LazorKit not loading?**
- Ensure `@lazorkit/wallet` is installed: `npm install @lazorkit/wallet`

**WebAuthn prompt not appearing?**
- Must use HTTPS or localhost
- Browser must support WebAuthn (Chrome, Safari, Firefox, Edge)
- Check browser console for errors

**Session not persisting?**
- Verify `SESSION_SECRET` is set in `.env`
- Check database connection for session storage
- Ensure cookies are enabled in browser

## 🎯 Next Steps

1. **Transaction Handling**: Integrate paymaster for gasless invoice creation
2. **Landing Page**: Update hero section with passkey messaging
3. **Testing**: Cross-browser WebAuthn compatibility testing
4. **Production**: Configure custom paymaster for mainnet
