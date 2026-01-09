# Contributing to Invoix

Thank you for your interest in contributing to Invoix! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites
- Node.js v20+
- PostgreSQL (or use SQLite for local development)
- Solana CLI (optional, for smart contract work)

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/RYthaGOD/invoix.git
cd invoix

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

## 📋 Development Workflow

### Branch Naming
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring

### Commit Messages
We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add subscription cancellation flow
fix: resolve rate limiting bug in security.ts
docs: update API documentation
refactor: migrate console.log to structured logger
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run check
```

All PRs must pass:
- TypeScript compilation with 0 errors
- All existing tests

## 🏗️ Project Structure

```
├── client/          # React frontend (Vite)
├── server/          # Express backend
├── shared/          # Shared types and utilities
├── tests/           # Test files
├── migrations/      # Database migrations
├── scripts/         # Utility scripts
└── arcium-mxe/      # Arcium smart contract
```

## 🔒 Security

- Never commit `.env` files or private keys
- Report security vulnerabilities privately
- All inputs are sanitized (XSS protection enabled)

## 📝 Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use the structured logger instead of `console.log`
- Add JSDoc comments for public APIs

## 🤝 Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and type check
5. Submit a PR with a clear description

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.
