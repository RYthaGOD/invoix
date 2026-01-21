# Disaster Recovery Plan

**Document Version**: 1.0  
**Last Updated**: 2026-01-20  
**Owner**: DevOps Team  
**Review Frequency**: Quarterly

---

## Executive Summary

This Disaster Recovery Plan (DRP) outlines procedures for recovering the Invoix platform from various disaster scenarios. The plan ensures business continuity, data integrity, and minimal downtime.

**Key Metrics**:
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Maximum Acceptable Downtime**: 24 hours

---

## 1. Backup Strategy

### 1.1 Database Backups

**Primary Database**: PostgreSQL (Supabase)

**Backup Schedule**:
- **Frequency**: Daily at 2:00 AM UTC
- **Retention**: 30 days
- **Type**: Full database dump
- **Storage**: Primary (Supabase) + Off-site (S3/R2)

**Automated Backup Script**:
```bash
# Run via cron or GitHub Actions
npm run backup
```

**Backup Verification**:
- Daily automated integrity checks
- Weekly test restores to staging environment
- Monthly full recovery drills

**Supabase Native Backups**:
- Supabase provides automatic daily backups (retained for 7 days on Pro plan)
- Point-in-time recovery available (last 7 days)
- Access via Supabase Dashboard → Database → Backups

### 1.2 Code and Configuration Backups

**Version Control**: GitHub
- All code changes committed and pushed
- Protected main branch with required reviews
- Tagged releases for production deployments

**Environment Variables**:
- Stored in Railway/Neon secrets (encrypted)
- Backup copy in secure password manager (1Password/Bitwarden)
- Never committed to version control

### 1.3 Blockchain Data

**Solana Blockchain**:
- All transactions are permanently stored on-chain
- No backup needed (immutable public ledger)
- Can reconstruct invoice/payment history from blockchain

**NFT Metadata**:
- Stored on Arweave (permanent storage)
- Backup copies in S3/R2
- Metadata URIs stored in database

---

## 2. Recovery Procedures

### 2.1 Database Corruption

**Scenario**: Database becomes corrupted or inaccessible

**Detection**:
- Health check endpoint returns errors
- Database connection failures in logs
- Sentry alerts for database errors

**Recovery Steps**:

1. **Stop Application** (prevent further corruption)
   ```bash
   railway down
   # or
   systemctl stop invoix
   ```

2. **Assess Damage**
   ```bash
   # Check database connectivity
   psql $DATABASE_URL -c "SELECT 1;"
   
   # Check for corruption
   psql $DATABASE_URL -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database;"
   ```

3. **Restore from Backup**
   ```bash
   # Download latest backup
   aws s3 cp s3://invoix-backups/backup-latest.sql ./
   
   # Create new database
   createdb invoix_recovery
   
   # Restore backup
   psql invoix_recovery < backup-latest.sql
   
   # Verify data integrity
   psql invoix_recovery -c "SELECT COUNT(*) FROM invoices;"
   psql invoix_recovery -c "SELECT COUNT(*) FROM payments;"
   ```

4. **Update Connection String**
   ```bash
   # Update DATABASE_URL in Railway/Neon
   railway variables set DATABASE_URL=postgresql://...
   ```

5. **Restart Application**
   ```bash
   railway up
   ```

6. **Verify Recovery**
   - Check health endpoint: `curl https://app.invoix.com/health`
   - Test invoice creation
   - Test payment processing
   - Review error logs

**Estimated Recovery Time**: 2-4 hours

---

### 2.2 Complete Infrastructure Failure

**Scenario**: Supabase platform outage or catastrophic failure

**Recovery Steps**:

1. **Provision New Infrastructure**
   - Create new Supabase project or switch to backup provider
   - Provision PostgreSQL database
   - Provision Redis instance (if using job queue)

2. **Restore Database**
   ```bash
   # Download latest backup from S3
   aws s3 cp s3://invoix-backups/backup-latest.sql ./
   
   # Restore to new Supabase database
   psql $NEW_DATABASE_URL < backup-latest.sql
   ```

3. **Deploy Application**
   ```bash
   # Clone repository
   git clone https://github.com/invoix/invoix.git
   cd invoix
   
   # Install dependencies
   npm install
   
   # Set environment variables
   cp .env.example .env
   # Edit .env with new Supabase database URL, etc.
   
   # Run migrations (if needed)
   npm run db:migrate
   
   # Build and deploy
   npm run build
   railway up  # or your deployment platform
   ```

4. **Update DNS Records**
   - Point app.invoix.com to new infrastructure
   - Wait for DNS propagation (5-60 minutes)

5. **Verify All Services**
   - Test invoice creation
   - Test payments
   - Test NFT minting
   - Test marketplace
   - Test subscriptions

**Estimated Recovery Time**: 4-8 hours

---

### 2.3 Accidental Data Deletion

**Scenario**: User or admin accidentally deletes critical data

**Recovery Steps**:

1. **Identify Deletion Timestamp**
   ```sql
   -- Check audit logs
   SELECT * FROM audit_logs WHERE action = 'DELETE' ORDER BY created_at DESC LIMIT 100;
   ```

2. **Point-in-Time Recovery** (if using Neon)
   ```bash
   # Restore to point before deletion
   neon branches create --parent main --timestamp "2026-01-20T10:00:00Z"
   ```

3. **Selective Restore** (if using backups)
   ```bash
   # Restore backup to temporary database
   psql temp_db < backup-before-deletion.sql
   
   # Export deleted data
   psql temp_db -c "COPY (SELECT * FROM invoices WHERE id IN (...)) TO '/tmp/deleted_invoices.csv' CSV HEADER;"
   
   # Import to production
   psql $DATABASE_URL -c "COPY invoices FROM '/tmp/deleted_invoices.csv' CSV HEADER;"
   ```

4. **Verify Restored Data**
   - Check record counts
   - Verify data integrity
   - Test affected functionality

**Estimated Recovery Time**: 1-2 hours

---

### 2.4 Security Breach

**Scenario**: Unauthorized access, data breach, or hack

**Immediate Actions**:

1. **Isolate System**
   ```bash
   # Take application offline
   railway down
   
   # Revoke all API keys
   psql $DATABASE_URL -c "UPDATE waitlist_users SET api_key_hash = NULL;"
   ```

2. **Assess Breach**
   - Review access logs
   - Check for unauthorized transactions
   - Identify compromised accounts

3. **Notify Affected Users**
   - Email all users within 72 hours (GDPR requirement)
   - Provide details of breach and recommended actions
   - Offer credit monitoring if PII was exposed

4. **Rotate All Secrets**
   ```bash
   # Generate new secrets
   SESSION_SECRET=$(openssl rand -base64 32)
   WEBHOOK_ENCRYPTION_KEY=$(openssl rand -base64 32)
   
   # Update in Railway
   railway variables set SESSION_SECRET=$SESSION_SECRET
   railway variables set WEBHOOK_ENCRYPTION_KEY=$WEBHOOK_ENCRYPTION_KEY
   ```

5. **Restore from Clean Backup**
   - Use backup from before breach
   - Verify no malicious code injected

6. **Security Audit**
   - Conduct full security audit
   - Patch vulnerabilities
   - Implement additional security measures

**Estimated Recovery Time**: 8-24 hours

---

## 3. Communication Plan

### 3.1 Internal Communication

**Incident Response Team**:
- **Incident Commander**: Lead Developer
- **Technical Lead**: Senior Backend Engineer
- **Communications Lead**: Product Manager
- **Database Admin**: DevOps Engineer

**Communication Channels**:
- **Primary**: Discord #incidents channel
- **Backup**: Email thread
- **Emergency**: Phone tree

### 3.2 External Communication

**Status Page**: status.invoix.com (or Twitter/Discord)

**Incident Severity Levels**:

| Level | Description | Response Time | Communication |
|-------|-------------|---------------|---------------|
| P0 - Critical | Complete outage | Immediate | Every 30 min |
| P1 - High | Major feature down | 15 minutes | Every hour |
| P2 - Medium | Minor feature down | 1 hour | Every 4 hours |
| P3 - Low | Performance degradation | 4 hours | Daily |

**Communication Template**:
```
[INCIDENT] Invoix Service Disruption

Status: [Investigating/Identified/Monitoring/Resolved]
Severity: [P0/P1/P2/P3]
Impact: [Description of affected services]
ETA: [Estimated time to resolution]

We are aware of an issue affecting [service]. Our team is actively working on a resolution.

Updates will be posted every [frequency].

Last updated: [timestamp]
```

---

## 4. Testing and Drills

### 4.1 Backup Testing

**Monthly**:
- Verify backup completion
- Test backup integrity
- Measure backup size and duration

**Quarterly**:
- Full restore to staging environment
- Verify all data restored correctly
- Test application functionality

### 4.2 Recovery Drills

**Quarterly Drill Schedule**:
- Q1: Database corruption recovery
- Q2: Infrastructure failover
- Q3: Data deletion recovery
- Q4: Security breach response

**Drill Procedure**:
1. Schedule drill with team (non-production hours)
2. Execute recovery procedure
3. Document time taken for each step
4. Identify bottlenecks and issues
5. Update DRP based on learnings

---

## 5. Monitoring and Alerting

### 5.1 Health Checks

**Endpoints**:
- `/health` - Overall system health
- `/health/live` - Liveness probe
- `/health/ready` - Readiness probe

**Monitoring Frequency**: Every 30 seconds

### 5.2 Alerts

**Critical Alerts** (PagerDuty/Email):
- Database connection failures
- Application crashes
- Error rate > 5%
- Response time > 2s (p95)
- Disk usage > 80%

**Warning Alerts** (Slack/Discord):
- Error rate > 1%
- Response time > 1s (p95)
- Disk usage > 60%
- Memory usage > 80%

---

## 6. Post-Incident Review

After every incident, conduct a post-mortem:

1. **Timeline**: Document incident timeline
2. **Root Cause**: Identify root cause
3. **Impact**: Assess user impact
4. **Response**: Evaluate response effectiveness
5. **Action Items**: Create tasks to prevent recurrence

**Post-Mortem Template**: `docs/post-mortems/YYYY-MM-DD-incident-name.md`

---

## 7. Contact Information

### Emergency Contacts

| Role | Name | Email | Phone |
|------|------|-------|-------|
| Incident Commander | [Name] | [Email] | [Phone] |
| Technical Lead | [Name] | [Email] | [Phone] |
| Database Admin | [Name] | [Email] | [Phone] |

### Service Providers

| Provider | Service | Support | SLA |
|----------|---------|---------|-----|
| Railway | App Hosting | support@railway.app | 99.9% |
| Supabase | Database | support@supabase.com | 99.9% |
| Cloudflare | CDN/DNS | support@cloudflare.com | 100% |
| Sentry | Monitoring | support@sentry.io | 99.9% |

---

## 8. Appendix

### A. Backup Script

See `scripts/backup-database.ts`

### B. Recovery Checklist

```
[ ] Incident detected and logged
[ ] Incident response team notified
[ ] Status page updated
[ ] Root cause identified
[ ] Recovery procedure selected
[ ] Backup retrieved (if needed)
[ ] System restored
[ ] Functionality verified
[ ] Users notified
[ ] Post-mortem scheduled
[ ] DRP updated (if needed)
```

### C. Useful Commands

```bash
# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Check table sizes
psql $DATABASE_URL -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Kill all connections
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();"

# Vacuum database
psql $DATABASE_URL -c "VACUUM ANALYZE;"
```

---

**Document Control**:
- **Version**: 1.0
- **Approved By**: [Name, Title]
- **Next Review Date**: 2026-04-20
