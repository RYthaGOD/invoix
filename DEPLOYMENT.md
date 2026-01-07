# Invoix Deployment Guide

## Complete Railway Deployment Guide

### Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Code hosted on GitHub
3. **Supabase Database**: PostgreSQL database ready
4. **Domain** (Optional): Custom domain for production

---

## Step 1: Create Railway Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click "Deploy from GitHub repo"
3. Authorize Railway to access your GitHub
4. Select `invoix` repository
5. Click "Deploy Now"

---

## Step 2: Configure Environment Variables

In Railway dashboard:

1. Go to your project
2. Click "Variables" tab
3. Add the following variables:

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host.supabase.co:5432/postgres?sslmode=require

# Application
NODE_ENV=production
SESSION_SECRET=generate-a-random-64-character-string-here

# Solana & Arcium
ARCIUM_PROGRAM_ID=your-arcium-program-id-here
ENABLE_ARCIUM_ENCRYPTION=true
X402_PAYMENT_REQUIRED=true

# Optional Features
ENABLE_NFT_MINTING=true
VITE_API_URL=${{RAILWAY_PUBLIC_DOMAIN}}
```

### How to Generate SESSION_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 3: Configure Build Settings

Railway auto-detects Node.js apps. Verify settings:

1. **Build Command**: `npm run build`
2. **Start Command**: `npm run start`
3. **Node Version**: 20.x (specified in package.json)

---

## Step 4: Deploy

1. After setting variables, Railway auto-deploys
2. Watch logs in "Deployments" tab
3. Wait for "Deployment successful"
4. Note your Railway URL: `https://your-app.up.railway.app`

---

## Step 5: Verify Deployment

### Test Health Endpoint

```bash
curl https://your-app.up.railway.app/api/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-08T...",
  "uptime": 123.45,
  "checks": {
    "database": { "status": "ok", "latency": 50 },
    "memory": { "status": "ok", "percentage": 45 }
  }
}
```

### Test Metrics Endpoint

```bash
curl https://your-app.up.railway.app/api/metrics
```

**Expected Response**:
```json
{
  "uptime": 123.45,
  "database": { "connected": true },
  "invoices": { "total": 0, "pending": 0, "paid": 0 },
  "subscriptions": { "total": 0, "active": 0 }
}
```

---

## Step 6: Configure Custom Domain (Optional)

1. Go to "Settings" tab
2. Click "Domains"
3. Click "Generate Domain" for free `.up.railway.app` domain
4. Or add custom domain:
   - Enter your domain (e.g., `invoix.app`)
   - Add DNS records provided by Railway 
   - Wait for DNS propagation (~10 minutes)
   - SSL certificate auto-generated

---

## Monitoring & Maintenance

### View Logs

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# View logs
railway logs
```

### Restart Application

In Railway dashboard:
1. Go to "Deployments"
2. Click "⋯" menu
3. Select "Restart"

### Rollback

1. Go to "Deployments"
2. Find previous successful deployment
3. Click "Redeploy"

---

## Database Migrations

Migrations run automatically on deployment via `npm run db:push` in build step.

**Manual migration**:
```bash
railway run npm run db:push
```

---

## Troubleshooting

### Build Fails

**Issue**: TypeScript errors during build

**Solution**:
```bash
# Test locally
npm run check
npm run build

# Fix errors
# Commit and push
```

### Database Connection Fails

**Issue**: `ECONNREFUSED` or timeout errors

**Solutions**:
1. Verify DATABASE_URL includes `?sslmode=require`
2. Use IPv4 connection pooler from Supabase
3. Check Supabase project is running
4. Test connection locally:
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1"
   ```

### Application Won't Start

**Issue**: Crashes on startup

**Solutions**:
1. Check all required env vars are set
2. Review startup logs for errors
3. Verify Node.js version compatibility
4. Check memory limits

### High Memory Usage

**Issue**: Memory >90%

**Solutions**:
1. Restart application
2. Check for memory leaks in logs
3. Upgrade Railway plan if needed
4. Monitor via `/api/health` endpoint

---

## Performance Optimization

### Enable Caching

Add to environment variables:
```env
CACHE_ENABLED=true
CACHE_TTL=3600
```

### Database Connection Pooling

Already configured via Supabase pooler. Verify:
```env
DATABASE_URL=postgresql://...@pooler.supabase.co:6543/...
```

### Monitor Response Times

Check metrics endpoint regularly:
```bash
curl https://your-app.up.railway.app/api/metrics
```

---

## Security Checklist

Pre-deployment security verification:

- [ ] SESSION_SECRET is random and ≥64 chars
- [ ] DATABASE_URL uses SSL (`?sslmode=require`)
- [ ] ARCIUM_PROGRAM_ID is correct for network
- [ ] No sensitive data in environment variable names
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] XSS protection active

---

## Deployment Checklist

Before each deployment:

- [ ] All tests passing: `npm run test`
- [ ] TypeScript check: `npm run check`
- [ ] No console.log in production code
- [ ] Environment variables configured
- [ ] Database migrations tested locally
- [ ] Monitoring alerts configured
- [ ] Rollback plan ready
- [ ] Team notified

---

## Production Best Practices

1. **Never deploy on Friday** (no weekend emergencies!)
2. **Deploy during low traffic** (typically 2-4 AM)
3. **Monitor for 30 minutes** post-deployment
4. **Have rollback plan** ready
5. **Test in staging** first (if available)
6. **Communicate** with team before major changes

---

## Emergency Procedures

### Application Down

1. Check Railway status page
2. View logs: `railway logs`
3. Check health endpoint
4. Restart if needed
5. Rollback if restart fails

### Database Issues

1. Check Supabase dashboard
2. Verify connection string
3. Test connection locally
4. Contact Supabase support if needed

### High Traffic

1. Monitor metrics endpoint
2. Check memory usage
3. Scale Railway plan if needed
4. Enable caching

---

## Support Resources

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Railway Discord**: [discord.gg/railway](https://discord.gg/railway)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Invoix GitHub**: Issues tab for bugs

---

## Next Steps After Deployment

1. Set up monitoring alerts (Railway notifications)
2. Configure backup strategy (Supabase auto-backup)
3. Create staging environment (optional)
4. Set up CI/CD (already auto-deployed from main)
5. Monitor metrics dashboards regularly

**Deployment Complete!** 🚀

Your Invoix instance is now live and ready for production use.
