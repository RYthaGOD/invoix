---
description: local development setup and workflows
---

# Development Workflow

## Initial Setup

// turbo
1. Clone repository: `git clone https://github.com/RYthaGOD/invoix.git`
2. Navigate to directory: `cd invoix`
3. Install dependencies: `npm install`
4. Copy environment template: `cp .env.example .env`

## Environment Configuration

Edit `.env` and configure the following required variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/invoix

# Session
SESSION_SECRET=your-random-secret-key-here

# Solana & Arcium
ARCIUM_PROGRAM_ID=your-arcium-program-id
ENABLE_ARCIUM_ENCRYPTION=true
X402_PAYMENT_REQUIRED=true

# Optional
ENABLE_NFT_MINTING=true
```

// turbo
5. Push database schema: `npm run db:push`
6. Verify setup: `npm run check`

## Daily Development

// turbo
1. Start development server: `npm run dev`
2. Access frontend at: [http://localhost:5173](http://localhost:5173)
3. Backend API at: [http://localhost:5000](http://localhost:5000)

## Making Changes

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make code changes (hot reload is automatic)
3. Test changes: `npm run test`
4. Type check: `npm run check`
5. Commit: `git add . && git commit -m "feat: your feature"`
6. Push: `git push origin feature/your-feature`

## Database Management

// turbo
- View schema in studio: `npm run db:studio` (if available)
- Generate migration: `npm run db:generate`
- Push schema changes: `npm run db:push`
- Apply indexes: `npm run db:indexes`

## Debugging

- Check logs in terminal (structured JSON logging)
- Use browser DevTools for frontend issues
- Test API endpoints with `curl` or Postman
- Check health: `curl http://localhost:5000/api/health`

## Common Issues

**Port already in use**:
```bash
lsof -ti:5000 | xargs kill -9  # Kill process on port 5000
lsof -ti:5173 | xargs kill -9  # Kill process on port 5173
```

**Database connection issues**:
- Verify DATABASE_URL in `.env`
- Check PostgreSQL is running
- Test connection: `psql $DATABASE_URL -c "SELECT 1"`

**TypeScript errors**:
- Run `npm run check` to see all errors
- Clear cache: `rm -rf node_modules/.vite`
- Reinstall: `rm -rf node_modules && npm install`
