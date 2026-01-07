---
description: deploy invoix to production (Railway)
---

# Deployment Workflow

## Prerequisites

1. Railway account connected to GitHub
2. Supabase database provisioned
3. Railway project created
4. Environment variables configured

## Deploy to Railway

### Automatic Deployment

// turbo-all
1. Push to main branch: `git push origin main`
2. Railway auto-deploys from GitHub
3. Watch deployment logs in Railway dashboard
4. Wait for "Deployment successful" confirmation
5. Verify deployment: `curl https://your-app.railway.app/api/health`

### Manual Deployment

1. Go to Railway dashboard
2. Select your project
3. Click "Deploy"
4. Choose commit/branch
5. Monitor logs

## Environment Variables

Configure in Railway dashboard:

### Required Variables
```env
DATABASE_URL=postgresql://[supabase-connection-string]
SESSION_SECRET=[random-64-char-string]
ARCIUM_PROGRAM_ID=[your-program-id]
ENABLE_ARCIUM_ENCRYPTION=true
X402_PAYMENT_REQUIRED=true
NODE_ENV=production
```

### Optional Variables
```env
ENABLE_NFT_MINTING=true
VITE_API_URL=https://your-app.railway.app
```

## Post-Deployment Verification

// turbo
1. Check health endpoint: `curl https://your-app.railway.app/api/health`
2. Verify database connection (check health response)
3. Test API: Create test invoice
4. Check logs for errors
5. Verify NFT minting (if enabled)

## Rollback Procedure

If deployment fails:

1. Go to Railway dashboard
2. Navigate to "Deployments" tab
3. Find last successful deployment
4. Click "Redeploy"
5. Wait for redeployment
6. Verify health

## Database Migrations

// turbo
1. Test migration locally: `npm run db:push`
2. Commit schema changes
3. Push to main
4. Railway auto-applies migrations
5. Verify via health check

## Monitoring

**Health Check**: `https://your-app.railway.app/api/health`

**Metrics**: `https://your-app.railway.app/api/metrics`

**Logs**: Railway dashboard > Logs tab

## Troubleshooting

### Deployment Fails

- Check build logs in Railway
- Verify all environment variables set
- Ensure DATABASE_URL includes `?sslmode=require`
- Check Node.js version compatibility

### Database Connection Errors

- Verify Supabase connection string
- Check IPv4 pooler connection
- Test locally with same DATABASE_URL
- Ensure SSL mode enabled

### Application Not Starting

- Check memory limits (--max-old-space-size=460)
- Review startup logs
- Verify all required env vars present
- Check for TypeScript errors

### High Memory Usage

- Monitor via health endpoint  
- Check `memory.percentage` in health check
- Restart if >90%
- Investigate memory leaks

## Deployment Checklist

Before deploying to production:

- [ ] All tests passing locally
- [ ] TypeScript check passing
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Rollback plan ready
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment

## Emergency Commands

**Force restart**:
```bash
railway restart
```

**View logs**:
```bash
railway logs
```

**Connect to database**:
```bash
railway connect postgres
```

## Best Practices

1. Always deploy to staging first (if available)
2. Deploy during low-traffic hours
3. Monitor for 30 minutes post-deployment
4. Have rollback plan ready
5. Communicate with team before major deployments
