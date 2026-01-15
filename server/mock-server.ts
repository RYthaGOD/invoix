// Mock server for frontend-only development
import express from 'express';
import { setupVite } from './vite';
import { createServer } from 'http';

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Enable JSON parsing
app.use(express.json());

// Mock auth endpoints
app.get('/api/auth/me', (req, res) => {
  res.json({
    authenticated: false,
    walletAddress: null,
    authMode: null
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({
    success: true,
    walletAddress: req.body.walletAddress,
    authMode: 'traditional'
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// Mock health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Invoix Mock Server (Frontend Only)',
    mode: 'design'
  });
});

// Mock health endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/live', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/ready', (req, res) => {
  res.json({ status: 'ok' });
});

// Mock invoice endpoints
app.get('/api/invoices', (req, res) => {
  res.json([]);
});

app.get('/api/invoices/:id', (req, res) => {
  res.json({
    id: req.params.id,
    invoiceNumber: 'INV-001',
    status: 'draft',
    lineItems: [],
    total: 0
  });
});

// Mock customers endpoint
app.get('/api/customers', (req, res) => {
  res.json([]);
});

// Mock templates endpoint
app.get('/api/templates', (req, res) => {
  res.json([]);
});

// Mock subscriptions endpoint
app.get('/api/subscriptions', (req, res) => {
  res.json([]);
});

// Mock profile endpoint
app.get('/api/profile', (req, res) => {
  res.json({
    businessName: 'Demo Business',
    walletAddress: null
  });
});

// Mock stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    totalInvoices: 0,
    totalRevenue: 0,
    paidInvoices: 0,
    pendingInvoices: 0
  });
});

// Catch-all for other API endpoints
app.all('/api/*', (req, res) => {
  console.log(`[Mock] ${req.method} ${req.path}`);
  res.status(200).json({
    message: 'Mock endpoint',
    path: req.path,
    method: req.method
  });
});

// Create HTTP server
const server = createServer(app);

// Start server
server.listen(port, '0.0.0.0', async () => {
  console.log('🎨 Frontend-Only Mock Server');
  console.log(`📍 Running on: http://localhost:${port}`);
  console.log('⚡ All API calls will return mock data');
  console.log('✨ Perfect for UI/UX design work!\n');

  // Setup Vite for frontend
  await setupVite(app, server);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down mock server...');
  server.close(() => {
    console.log('Mock server closed');
    process.exit(0);
  });
});
