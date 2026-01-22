# Task: Invoix System Upgrade & AI Integration

## 🚨 Phase 1: Security & Foundation (Weeks 1-4)

### 🔴 Week 1: Critical Security Fixes (IMMEDIATE PRIORITY)

- [x] **[CRITICAL]** Fix Unauthenticated Metadata Access
    - [x] **[BLOCKING]** Update `/api/nft-metadata/:identifier` to require authentication (signature/session)
    - [x] Implement ACL: Only allow Invoicer, Invoicee, or authorized Buyer (if sold) to view full metadata
    - [x] If `isPrivate=true`, ensure the public endpoint returns ONLY the generic "Private Invoice" metadata (verified via hash), NOT the details
    - [x] **[BLOCKING]** Force redacted metadata for unauthenticated requests

- [x] **[CRITICAL]** Sanitize Private Invoice Metadata
    - [x] Scan `server/nft-service.ts` for `generateInvoiceMetadata`
    - [x] Update logic to strictly check `hideAmounts`, `hideParties` flags
    - [x] Ensure that even if a user IS authorized, the *generated JSON* respects these flags

- [x] **[CRITICAL]** Enforce Privacy Flag Enforcement
    - [x] Verify `hideAmounts` physically removes the amount from the JSON, not just the UI
    - [x] Verify `hideParties` physically removes the wallet addresses from the attributes/description

- [x] **[CRITICAL]** Prevent Receipt Data Exposure
    - [x] Update `generatePaymentReceiptMetadata`
    - [x] Ensure it checks the *parent invoice's* privacy settings before including `fromAddress` or `toAddress`

- [x] **[SECURITY]** Implement Rate Limiting & Audit Logging
    - [x] Add `express-rate-limit` to all metadata endpoints (e.g., 10 req/min per IP)
    - [x] Create `audit_logs` table in schema
    - [x] Log every access attempt to private metadata (User ID, Timestamp, Success/Failure, IP)
    - [x] Create `metadataLimiter` configuration (window: 1m, max: 10)
    - [x] Apply `metadataLimiter` to all `/api/nft-metadata/*` routes
    - [x] Create `server/utils/audit-logger.ts` service
    - [x] Implement `logMetadataAccess(user, resource, success, ip)`
    - [x] Call logger in `server/invoice-routes.ts` metadata endpoint (log both allowed and denied attempts)

- [x] **[VERIFICATION]** Test Security Fixes
    - [x] Database migration completed (audit_logs table created)
    - [ ] Test unauthenticated access to `/api/nft-metadata/:identifier` (should return 401)
    - [ ] Test unauthorized access (different wallet) to metadata (should return 403)
    - [ ] Test that `hideAmounts=true` properly redacts amounts in metadata JSON
    - [ ] Test that `hideParties=true` properly redacts wallet addresses in metadata JSON
    - [ ] Test rate limiting (11th request should fail with 429)
    - [ ] Verify audit logs are being written to database


### Week 2: Code Quality & Testing
- [ ] **Technical Debt Cleanup**
    - [ ] Audit dependencies with `depcheck`
    - [ ] Remove unused packages from `package.json`
    - [ ] Run `eslint --fix` on `server/` to remove unused imports
    - [ ] Run `eslint --fix` on `client/` to remove unused imports
- [ ] **TypeScript Hardening**
    - [ ] Set `"strict": true` in `tsconfig.json`
    - [ ] Fix server-side type errors (no implicit any)
    - [ ] Fix client-side type errors
- [ ] **Integration Tests**
    - [ ] Setup test database isolation
    - [ ] Create `tests/integration/security.test.ts` (Metadata auth, privacy flags)
    - [ ] Create `tests/integration/lifecycle.test.ts` (Invoice Create -> Pay -> Mint)

### Weeks 3-4: Enterprise Features
- [ ] **Multi-Signature Approvals**
    - [ ] Schema: Add `approval_workflows` and `approvers` tables
    - [ ] Backend: Create `server/routes/approval-routes.ts`
    - [ ] API: Implement `createWorkflow` and `approveInvoice` endpoints
    - [ ] Frontend: Add Approval Workflow management UI
- [ ] **Batch Processing**
    - [ ] Infra: Configure BullMQ with Redis
    - [ ] API: Create `/api/batch/upload` (CSV parsing)
    - [ ] Worker: Implement batch invoice creation processor
    - [ ] Frontend: Add Bulk Upload page

## 🤖 Phase 2: AI Foundation (Weeks 5-8)

### Week 5: API Modernization
- [ ] **API Versioning**
    - [ ] Refactor `server/index.ts` to use `/api/v1/` prefix
    - [ ] Implement `v1` routers for all core services
    - [ ] Add legacy route handlers for backward compatibility
- [ ] **Health Monitoring**
    - [ ] Add `/health/db` endpoint with deep connectivity check

### Weeks 6-8: Solana Agent Kit Integration
- [ ] **Core Setup**
    - [ ] Install `solana-agent-kit`
    - [ ] Setup `InvoixAIAgent` class with `TokenPlugin`, `DefiPlugin`
- [ ] **Smart Payments**
    - [ ] Implement `suggestPaymentRoute(invoice, userBalances)`
    - [ ] Create API `POST /api/ai/suggest-payment`
- [ ] **Auto-Reconciliation**
    - [ ] Implement background job to match on-chain txs to invoices
    - [ ] Create API `POST /api/ai/reconcile`
- [ ] **Treasury AI**
    - [ ] Implement `optimizeTreasuryYield()` (Auto-stake/Lend)
    - [ ] Create Treasury Dashboard UI

## 🏢 Phase 3: White Label & Expansion (Weeks 9-12)

### Weeks 9-10: White Labeling
- [ ] **Multi-Tenancy**
    - [ ] Schema: Add `tenants` and `domains` tables
    - [ ] Middleware: Add tenant resolver based on subdomain
- [ ] **Custom Branding**
    - [ ] API: Add endpoints to upload logo/colors
    - [ ] Frontend: Implement `TenantProvider` to inject custom theme variables

### Weeks 11-12: Eliza Framework Bots
- [ ] **Eliza Setup**
    - [ ] Install `@elizaos/core`
    - [ ] Configure `discord` and `telegram` adapters
- [ ] **Bot Features**
    - [ ] Implement Invoice Lookup command
    - [ ] Implement "My Subscriptions" command
    - [ ] Setup Payment Notification webhooks -> Bot alerts

## 🌐 Phase 4: Cross-Chain Intelligence (Weeks 13-16)

### Weeks 13-15: GOAT SDK
- [ ] **Integration**
    - [ ] Install `@goat-sdk` ecosystem
    - [ ] Setup Cross-Chain Payment Service
- [ ] **Bridges**
    - [ ] Implement EVM -> SVM payment bridging
    - [ ] UI: Add "Pay with ETH" button on invoices

### Week 16: Liquidity Pools
- [ ] **Defi**
    - [ ] Design "Invoice Financing" smart contract
    - [ ] Implement Liquidity Pool deposit/withdraw logic

## 🧠 Phase 5: Advanced AI (Weeks 17-20)

### Weeks 17-19: LLM Oracle
- [ ] **Oracle**
    - [ ] Integrate `solana-llm-oracle`
    - [ ] Implement Off-Chain Oracle Node
- [ ] **Credit Scoring**
    - [ ] Implement On-Chain Credit History analysis
    - [ ] Update Credit Score based on LLM inference

## 🔒 Phase 6: Privacy 2.0 & Launch (Weeks 21-24)

### Weeks 21-22: AgenC Privacy
- [ ] **Zero Knowledge**
    - [ ] Integrate `agenc` for ZK proofs
    - [ ] Implement Private Marketplace listings (proven valid without revealing data)

### Weeks 23-24: MagicBlock & Launch
- [ ] **High Performance**
    - [ ] Integrate Ephemeral Rollups for batch processing
- [ ] **Launch**
    - [ ] Final Security Audit
    - [ ] Production Deployment
