# SolanaInvoice Security Documentation

## Overview

This document provides comprehensive security information for the BurnBot platform. **User data protection is our #1 priority.** The platform implements defense-in-depth security with multiple layers of protection.

---

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Private Key Protection](#private-key-protection)
3. [Authentication & Authorization](#authentication--authorization)
4. [Network Security](#network-security)
5. [Rate Limiting & DDoS Protection](#rate-limiting--ddos-protection)
6. [Input Validation & Sanitization](#input-validation--sanitization)
7. [Audit Logging](#audit-logging)
8. [Environment Security](#environment-security)
9. [Database Security](#database-security)
10. [Security Best Practices](#security-best-practices)
11. [Incident Response](#incident-response)

---

## Security Architecture

### Defense-in-Depth Approach

BurnBot employs a multi-layered security architecture where each layer provides independent protection:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Network Security (HTTPS/TLS, Helmet Headers, CORS)│
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Rate Limiting & DDoS Protection                    │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Input Validation & Sanitization                    │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Authentication & Authorization                     │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Encrypted Data Storage (AES-256-GCM)              │
└─────────────────────────────────────────────────────────────┘
```

### Security Module

All security middleware and utilities are centralized in `server/security.ts`:
- `securityHeaders()` - Helmet.js security headers
- `globalRateLimit` - 100 req/15min per IP
- `strictRateLimit` - 10 req/15min for sensitive ops
- `authRateLimit` - 20 req/hour for authenticated ops
- `sanitizeInput()` - XSS and injection prevention
- `corsPolicy()` - Cross-origin request controls
- `validateSolanaAddresses()` - Blockchain address validation
- `auditLog()` - Security event logging
- `checkSecurityEnvVars()` - Startup security validation

---

## Private Key Protection

### Encryption Standard: AES-256-GCM

**Why AES-256-GCM?**
- Military-grade encryption (256-bit key size)
- Authenticated encryption (detects tampering)
- NIST recommended for classified information
- Resistant to known cryptographic attacks

**Encryption Process:**

```typescript
1. User submits private key via wallet-signed request
2. System generates unique 12-byte Initialization Vector (IV)
3. AES-256-GCM encrypts key using:
   - Master key from ENCRYPTION_MASTER_KEY env var
   - Unique IV (prevents pattern analysis)
4. Authentication tag computed (16 bytes)
5. Store in database:
   - Ciphertext (encrypted key)
   - IV (initialization vector)
   - Auth tag (tamper detection)
   - HMAC fingerprint (change detection)
6. Original plaintext key destroyed from memory
```

**Decryption Process (Scheduler Only):**

```typescript
1. Scheduler retrieves encrypted components from database
2. Validates authentication tag (rejects if tampered)
3. Decrypts using master key + IV
4. Uses private key for transaction signing
5. Immediately clears private key from memory
6. NEVER logs or persists decrypted key
```

**Security Properties:**
- ✅ Confidentiality: Keys unreadable without master key
- ✅ Integrity: Auth tags detect modification
- ✅ Isolation: Unique IV per key (no pattern leakage)
- ✅ Non-persistence: Plaintext never written to disk
- ✅ Access control: Only scheduler can decrypt
- ✅ Memory safety: Keys cleared after use

**Cache Security:**
- 5-minute TTL in-memory cache
- Reduces decryption operations
- Automatically expires
- Cleared on key updates/deletions

---

## Authentication & Authorization

### Wallet-Based Authentication

**No Passwords = No Password Database to Breach**

Users authenticate using cryptographic signatures from their Solana wallet:

**Authentication Flow:**

```
1. User connects wallet (Phantom/Solflare) via browser extension
2. User initiates sensitive operation (e.g., store keys, manual buyback)
3. System creates message: "{action} for project {id} at {timestamp}"
4. Wallet signs message (private key never leaves wallet)
5. System receives: signature + message + public key
6. Backend verifies:
   ✓ Signature is valid for message (tweetnacl.sign.detached.verify)
   ✓ Public key matches project owner
   ✓ Timestamp within 5-minute window
   ✓ Signature not previously used (replay prevention)
7. Operation authorized if all checks pass
```

**Replay Attack Prevention:**

Every signature hash is stored in the database:

```sql
CREATE TABLE used_signatures (
  id VARCHAR PRIMARY KEY,
  project_id VARCHAR NOT NULL,
  signature_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash
  message_timestamp TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,        -- Auto-cleanup after 24h
  created_at TIMESTAMP NOT NULL
);
```

**Security Benefits:**
- No credential stuffing attacks (no passwords)
- No phishing of passwords
- User retains full control via wallet
- Hardware wallet support (Ledger, Trezor)
- Time-bounded signatures (5-minute window)
- Replay prevention (signature hash storage)

---

## Network Security

### Transport Layer Security

**HTTPS/TLS:**
- All communications encrypted with TLS 1.3
- Certificate pinning for API calls (production)
- Secure WebSocket (WSS) for real-time updates
- No plaintext transmission of sensitive data

**Security Headers (Helmet.js):**

Implemented via `securityHeaders()` middleware:

```typescript
{
  // Force HTTPS for 1 year, including subdomains
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  
  // Prevent clickjacking
  frameguard: { action: "deny" },
  
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],  // Vite dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  },
  
  // Prevent MIME sniffing
  noSniff: true,
  
  // Hide server info
  hidePoweredBy: true,
  
  // XSS protection
  xssFilter: true
}
```

### CORS Policy

**Production:**
- Same-origin only
- Prevents unauthorized API access
- Whitelisted origins: `*.replit.app`, `*.replit.dev`

**Development:**
- Relaxed for local testing
- All origins allowed

**Preflight Handling:**
- OPTIONS requests properly handled
- 24-hour caching for efficiency
- Credentials allowed for authenticated requests

---

## Rate Limiting & DDoS Protection

### Three-Tier Rate Limiting

**1. Global Rate Limit (All API Routes)**
```typescript
- Window: 15 minutes
- Max requests: 100 per IP
- Applies to: /api/*
- Headers: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
- Response on exceed: 429 Too Many Requests
```

**2. Strict Rate Limit (Sensitive Operations)**
```typescript
- Window: 15 minutes
- Max requests: 10 per IP
- Applies to:
  - Payment verification endpoints
  - Project key management (set/delete)
  - Critical configuration changes
```

**3. Auth Rate Limit (Wallet Signature Operations)**
```typescript
- Window: 1 hour
- Max requests: 20 per IP
- Applies to:
  - Manual buyback execution
  - Private key storage
  - Private key deletion
  - PumpFun reward claims
```

**Implementation:**

```typescript
import { globalRateLimit, strictRateLimit, authRateLimit } from "./security";

// In server/index.ts
app.use("/api", globalRateLimit);

// In server/routes.ts
app.post("/api/execute-buyback/:projectId", authRateLimit, ...);
app.post("/api/projects/:id/keys", strictRateLimit, ...);
app.delete("/api/projects/:id/keys", strictRateLimit, ...);
```

**Benefits:**
- Prevents brute force attacks
- Mitigates DDoS attempts
- Protects against credential stuffing
- Reduces server load from abusive clients
- Transparent (rate limit headers inform clients)

---

## Input Validation & Sanitization

### Multi-Layer Input Protection

**1. Automatic Sanitization Middleware**

Applied to all requests before processing:

```typescript
export function sanitizeInput(req, res, next) {
  const sanitize = (obj) => {
    if (typeof obj === "string") {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+\s*=/gi, "")
        .trim();
    }
    // Recursively sanitize objects and arrays
  };
  
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  next();
}
```

**Protects Against:**
- ✅ Cross-Site Scripting (XSS)
- ✅ Script injection
- ✅ Event handler injection
- ✅ JavaScript URI injection

**2. Zod Schema Validation**

Every API endpoint validates input with Zod:

```typescript
// Example: Project creation
const validatedData = insertProjectSchema.parse(req.body);

// Zod automatically:
- Type checks all fields
- Validates required fields
- Enforces constraints (min/max, patterns)
- Rejects invalid data with detailed errors
```

**3. Solana Address Validation**

Blockchain addresses validated before processing:

```typescript
export function isValidSolanaAddress(address: string): boolean {
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

export function isValidSignature(signature: string): boolean {
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;
  return base58Regex.test(signature);
}
```

Applied via middleware:

```typescript
app.post("/api/projects", validateSolanaAddresses, async (req, res) => {
  // All Solana addresses already validated
});
```

**4. Request Size Limits**

```typescript
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
```

Prevents:
- ✅ Denial of Service via large payloads
- ✅ Memory exhaustion attacks
- ✅ JSON bomb attacks

**5. SQL Injection Prevention**

Using Drizzle ORM with parameterized queries:

```typescript
// Safe - parameters automatically escaped
await db.select().from(projects).where(eq(projects.id, projectId));

// NEVER directly interpolate user input in SQL
```

---

## Audit Logging

### Security Event Tracking

All sensitive operations are logged for security monitoring:

```typescript
export function auditLog(operation: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  const sanitizedDetails = { ...details };
  
  // NEVER log sensitive data
  delete sanitizedDetails.privateKey;
  delete sanitizedDetails.signature;
  delete sanitizedDetails.password;
  
  console.log(`[SECURITY AUDIT] ${timestamp} - ${operation}:`, sanitizedDetails);
}
```

**Logged Operations:**

1. **Manual Buyback Execution**
   ```
   [SECURITY AUDIT] 2025-10-22T12:34:56Z - Manual buyback execution attempted:
   { projectId: "abc-123", ip: "203.0.113.42" }
   ```

2. **Private Key Storage**
   ```
   [SECURITY AUDIT] 2025-10-22T12:35:12Z - Private keys update attempted:
   { projectId: "abc-123", ip: "203.0.113.42" }
   ```

3. **Private Key Deletion**
   ```
   [SECURITY AUDIT] 2025-10-22T12:36:45Z - Private keys deletion attempted:
   { projectId: "abc-123", ip: "203.0.113.42" }
   ```

**Audit Log Properties:**
- ✅ Timestamp (ISO 8601 format)
- ✅ Operation type
- ✅ Project ID
- ✅ IP address
- ✅ Success/failure status
- ❌ NO private keys
- ❌ NO signatures
- ❌ NO passwords

**Use Cases:**
- Security incident investigation
- Compliance audits
- Anomaly detection
- User activity tracking
- Breach forensics

---

## Environment Security

### Critical Environment Variables

**Startup Validation:**

```typescript
export function checkSecurityEnvVars(): void {
  const requiredVars = [
    "ENCRYPTION_MASTER_KEY",
    "SESSION_SECRET",
  ];

  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error("❌ SECURITY ERROR: Missing required environment variables");
    
    if (process.env.NODE_ENV === "production") {
      console.error("CRITICAL: Production deployment blocked");
      process.exit(1);  // Fail fast in production
    }
  }
  
  // Validate ENCRYPTION_MASTER_KEY strength
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  if (masterKey && masterKey.length < 64) {
    console.error("❌ ENCRYPTION_MASTER_KEY must be ≥64 characters");
    if (process.env.NODE_ENV === "production") process.exit(1);
  }
  
  console.log("✅ Security environment variables verified");
}
```

**Required Variables:**

| Variable | Purpose | Validation |
|----------|---------|------------|
| `ENCRYPTION_MASTER_KEY` | AES-256-GCM master key | ≥64 chars (32 bytes hex) |
| `SESSION_SECRET` | Session signing key | Required |
| `DATABASE_URL` | PostgreSQL connection | Required |
| `NODE_ENV` | Environment mode | production/development |

**Security Rules:**
- ✅ Never commit secrets to version control
- ✅ Use different keys per environment
- ✅ Rotate keys periodically
- ✅ Store in secure secret management system
- ✅ Production deployment fails if keys missing
- ✅ Development mode warns but continues

---

## Database Security

### Encrypted Storage

**Private Keys:**
- Table: `project_secrets`
- Encryption: AES-256-GCM
- Components stored separately:
  - `treasuryKeyCiphertext` - Encrypted key
  - `treasuryKeyIv` - Initialization vector
  - `treasuryKeyAuthTag` - Authentication tag
  - `treasuryKeyFingerprint` - HMAC for change detection

**Replay Attack Prevention:**
- Table: `used_signatures`
- Stores SHA-256 hashes of used signatures
- Unique constraint prevents reuse
- Auto-expires after 24 hours

**Access Controls:**
- Database credentials isolated per environment
- Least privilege principle for service accounts
- No direct database access from frontend
- All queries via Drizzle ORM

**Connection Security:**
- SSL/TLS for database connections
- Connection pooling with limits
- Automatic reconnection on failures
- Query timeout enforcement

---

## Security Best Practices

### For Users

**Wallet Security:**
1. Use hardware wallets (Ledger, Trezor) when possible
2. Never share your wallet's private key
3. Verify all signature requests before approving
4. Use strong passwords for software wallets
5. Enable two-factor authentication on wallet providers

**Treasury Management:**
1. Maintain sufficient SOL for operations + network fees
2. Monitor treasury balance regularly
3. Use dedicated treasury wallets (not your main wallet)
4. Verify all transaction signatures on blockchain explorers
5. Keep backup of treasury private keys in secure offline storage

**Platform Usage:**
1. Always verify you're on the correct URL
2. Check for HTTPS lock icon in browser
3. Log out from shared computers
4. Review transaction history regularly
5. Report suspicious activity immediately

### For Developers

**Code Security:**
1. Never log sensitive data (keys, signatures, passwords)
2. Always validate and sanitize user inputs
3. Use parameterized queries (never string concatenation)
4. Keep dependencies updated
5. Run security audits regularly

**Environment Management:**
1. Use separate environments (dev, staging, prod)
2. Different encryption keys per environment
3. Limit access to production secrets
4. Rotate keys periodically
5. Monitor for unauthorized access

---

## Incident Response

### Security Incident Procedure

**1. Detection**
- Monitor audit logs for anomalies
- Set up alerts for suspicious patterns
- Review failed authentication attempts
- Check rate limit violations

**2. Containment**
- Immediately rotate affected keys
- Block suspicious IP addresses
- Disable compromised accounts
- Preserve logs for forensics

**3. Investigation**
- Review audit logs
- Identify scope of breach
- Determine attack vector
- Document findings

**4. Remediation**
- Patch vulnerabilities
- Update security measures
- Notify affected users
- Implement additional controls

**5. Prevention**
- Conduct post-mortem analysis
- Update security procedures
- Train team on lessons learned
- Improve monitoring and detection

### Reporting Security Issues

**If you discover a security vulnerability:**

1. **DO NOT** publicly disclose the issue
2. **DO NOT** attempt to exploit the vulnerability
3. **DO** contact the security team immediately
4. **DO** provide detailed reproduction steps
5. **DO** allow reasonable time for patching

---

## Compliance & Standards

### Industry Standards

BurnBot's security architecture aligns with:

- **OWASP Top 10** - Protection against common web vulnerabilities
- **NIST Cybersecurity Framework** - Comprehensive security controls
- **CWE/SANS Top 25** - Mitigation of most dangerous software errors
- **SOC 2 Type II** - Security, availability, and confidentiality principles

### Security Certifications

- AES-256-GCM: NIST approved (FIPS 197)
- TLS 1.3: IETF standard (RFC 8446)
- Ed25519 Signatures: IETF standard (RFC 8032)

---

## Conclusion

BurnBot implements **defense-in-depth security** with:

✅ **Military-grade encryption** (AES-256-GCM)  
✅ **Wallet-based authentication** (no passwords)  
✅ **Multi-tier rate limiting** (DDoS protection)  
✅ **Comprehensive input validation** (XSS/injection prevention)  
✅ **Security headers** (Helmet.js)  
✅ **Audit logging** (security monitoring)  
✅ **Environment validation** (startup checks)  
✅ **Encrypted database storage** (sensitive data protection)  

**User data protection is our #1 priority.**

For security questions or to report vulnerabilities, please contact the security team.

---

*Last Updated: October 2025*  
*Security Documentation Version: 1.0*
