const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const customersRouter = require('./routes/customers');
const authRouter = require('./routes/auth');
const accountsRouter = require('./routes/accounts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/customers', customersRouter);
app.use('/api/auth', authRouter);
app.use('/api/accounts', accountsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'Banking API is running' });
});

app.get('/api/routes', (req, res) => {
  res.json({
    routes: [
      { method: 'GET', path: '/' },
      { method: 'GET', path: '/api/health' },
      { method: 'POST', path: '/api/auth/register' },
      { method: 'POST', path: '/api/auth/login' },
      { method: 'GET', path: '/api/customers' },
      { method: 'GET', path: '/api/customers/search' },
      { method: 'GET', path: '/api/customers/:id' },
      { method: 'GET', path: '/api/customers/:id/accounts' },
      { method: 'GET', path: '/api/customers/:id/transactions' },
      { method: 'POST', path: '/api/customers' },
      { method: 'PUT', path: '/api/customers/:id' },
      { method: 'DELETE', path: '/api/customers/:id' },
      { method: 'POST', path: '/api/customers/:id/accounts' },
      { method: 'DELETE', path: '/api/accounts/:id' },
      { method: 'POST', path: '/api/accounts/transfer' }
    ]
  });
});

app.get('/', (req, res) => {
  res.send('Banking API root. Use /api/health or /api/customers.');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`Banking API server running on port ${PORT}`);
});
