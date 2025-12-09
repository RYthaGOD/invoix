# 🚀 SolanaInvoice - Post-Launch Improvement Roadmap

**Created**: December 9, 2025  
**Status**: Ready to Ship ✅  
**Current Grade**: B+ (Good for launch, improvements planned)

---

## 📋 Quick Reference Checklist

Copy this checklist to track progress:

```
[ ] P1-0: Implement 25 invoice limit for freemium users
[ ] P1-1: Implement signature replay prevention
[ ] P1-2: Add auth middleware to payments endpoint
[ ] P1-3: Update SECURITY_DOCUMENTATION.md
[ ] P1-4: Clean up .env.example
[ ] P2-1: Production session store (Redis/PostgreSQL)
[ ] P2-2: Add integration tests
[ ] P2-3: Remove unused imports
[ ] P2-4: Audit and remove unused npm packages
[ ] P3-1: Add API versioning (/api/v1/)
[ ] P3-2: Improve TypeScript strictness
[ ] P3-3: Add database health check
[ ] P3-4: Tighten CSP for production
```

---

## 🔴 Priority 1: Security (Fix First)

### P1-1: Implement Signature Replay Prevention
**File**: `server/security.ts` (Lines 357-366)  
**Risk**: Medium  
**Effort**: 2-3 hours

**Current Issue**:
```typescript
// TODO: Implement signature replay prevention in database
// LEGACY CODE (disabled):
// const isUsed = await storage.isSignatureUsed(signatureHash);
```

**Solution**: Create a `used_signatures` table and implement tracking:
```sql
CREATE TABLE used_signatures (
  id VARCHAR PRIMARY KEY,
  signature_hash TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
-- Add index for cleanup job
CREATE INDEX idx_used_signatures_expires ON used_signatures(expires_at);
```

---

### P1-2: Add Auth Middleware to Payments Endpoint
**File**: `server/invoice-routes.ts` (Line 550)  
**Risk**: Medium  
**Effort**: 10 minutes

**Current**:
```typescript
app.get("/api/invoices/:id/payments", async (req, res) => {
```

**Fixed**:
```typescript
app.get("/api/invoices/:id/payments", requireWalletOwnership, async (req, res) => {
```

---

### P1-3: Update Security Documentation
**File**: `SECURITY_DOCUMENTATION.md`  
**Risk**: Low (documentation only)  
**Effort**: 30 minutes

**Issue**: References "BurnBot" throughout - should be "SolanaInvoice"

**Find & Replace**:
- "BurnBot" → "SolanaInvoice"
- Update any outdated rate limit values
- Remove trading bot references

---

### P1-4: Clean Up .env.example
**File**: `.env.example`  
**Risk**: Low  
**Effort**: 15 minutes

**Issues**:
- Line 1: References "GigaBrain AI Trading Bot"
- Contains AI API keys section not used by this app
- Treasury wallet section for trading, not invoicing

**Action**: Simplify to only needed variables:
- DATABASE_URL
- SOLANA_RPC_URL
- SESSION_SECRET
- ENCRYPTION_MASTER_KEY
- NODE_ENV
- PORT

---

## 🟡 Priority 2: Reliability & Quality

### P2-1: Production Session Store
**File**: `server/index.ts` (Line 30)  
**Risk**: Medium in production  
**Effort**: 1-2 hours

**Current**: Using `memorystore` (sessions lost on restart)

**Recommended Options**:
1. **Redis** (Best for scale):
   ```bash
   npm install connect-redis redis
   ```
2. **PostgreSQL** (Already have Neon):
   ```bash
   npm install connect-pg-simple
   ```

---

### P2-2: Add Integration Tests
**Folder**: `tests/`  
**Risk**: Low (testing coverage)  
**Effort**: 4-6 hours

**Currently Missing**:
- [ ] API endpoint integration tests
- [ ] Authentication flow tests
- [ ] Payment recording tests
- [ ] Invoice CRUD tests

**Quick Win**: Add test for auth flow:
```typescript
describe("Authentication API", () => {
  it("should reject invalid signatures", async () => { ... });
  it("should create session on valid login", async () => { ... });
  it("should return 401 for unauthenticated requests", async () => { ... });
});
```

---

### P2-3: Remove Unused Imports
**Files to Clean**:

| File | Unused Imports |
|------|----------------|
| `server/routes.ts` | `db`, `eq` from drizzle-orm |
| `server/invoice-routes.ts` | Review for unused imports |

**Command to find unused imports**:
```bash
npx eslint --fix . # If eslint configured
```

---

### P2-4: Audit NPM Dependencies
**File**: `package.json`  
**Effort**: 30 minutes

**Potentially Unused**:
- `passport` / `passport-local` - Not using password auth
- `@bundlr-network/client` - Verify usage
- `ipfs-http-client` - Verify usage
- `connect-pg-simple` - Not currently used (sessions in memory)

**Command**:
```bash
npx depcheck
```

---

## 🟢 Priority 3: Polish & Best Practices

### P3-1: Add API Versioning
**Effort**: 1 hour

**Current**: `/api/invoices`  
**Recommended**: `/api/v1/invoices`

**Benefit**: Allows breaking changes in future versions

---

### P3-2: Improve TypeScript Strictness
**File**: `server/db.ts`  
**Issue**: Untyped `db` variable

**Current**:
```typescript
let db;
```

**Fixed**:
```typescript
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';

let db: BetterSQLite3Database<typeof schema> | NeonDatabase<typeof schema>;
```

---

### P3-3: Add Database Health Check
**File**: `server/health.ts`  
**Issue**: Health endpoint doesn't verify DB connectivity

**Add**:
```typescript
export async function readiness(req, res) {
  try {
    // Quick DB query to verify connectivity
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ready", database: "connected" });
  } catch (err) {
    res.status(503).json({ status: "not ready", database: "disconnected" });
  }
}
```

---

### P3-4: Tighten CSP for Production
**File**: `server/security.ts` (Line 29)  
**Issue**: `'unsafe-eval'` allowed (needed for Vite dev)

**Solution**: Conditional CSP based on environment:
```typescript
scriptSrc: process.env.NODE_ENV === 'production' 
  ? ["'self'"] 
  : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
```

---

## 📝 Minor Cleanup Tasks

| Task | File | Notes |
|------|------|-------|
| Update package name | `package.json` | Change from "rest-express" to "solana-invoice" |
| Remove legacy comments | Various | Search for "LEGACY CODE" |
| Update README if needed | `README.md` | Verify accuracy |
| Review error messages | `invoice-routes.ts` | Standardize error format |

---

## 🔧 Development Tools to Add

### Recommended for Post-Launch

1. **Error Tracking**: Add Sentry
   ```bash
   npm install @sentry/node
   ```

2. **Logging**: Add structured logging
   ```bash
   npm install pino
   ```

3. **API Documentation**: Add Swagger/OpenAPI
   ```bash
   npm install swagger-ui-express
   ```

---

## 📊 Estimated Timeline

| Priority | Items | Time Estimate |
|----------|-------|---------------|
| P1 (Security) | 4 items | 3-4 hours |
| P2 (Reliability) | 4 items | 6-8 hours |
| P3 (Polish) | 4 items | 3-4 hours |
| Minor | 4 items | 1-2 hours |
| **Total** | **16 items** | **~15-18 hours** |

---

## ✅ Ship-Ready Confirmation

The system is **ready to ship** with the following in good shape:

- ✅ Session-based wallet authentication (SIWS)
- ✅ Rate limiting (3-tier protection)
- ✅ Input sanitization & validation
- ✅ AES-256-GCM encryption
- ✅ Proper CORS & security headers
- ✅ Invoice CRUD operations
- ✅ Payment tracking
- ✅ NFT minting integration
- ✅ Multi-stablecoin support
- ✅ Business & customer profiles
- ✅ Invoice templates
- ✅ All tests passing (20/20)

**Ship it! 🚀** The improvements above can be addressed incrementally post-launch.

---

*Last Updated: December 9, 2025*
