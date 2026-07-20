const express = require('express');
const { query, queryOne, run } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { generateId } = require('../utils/idGenerator');

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const customers = await query(
      'SELECT * FROM customers LIMIT ? OFFSET ?',
      [limit, offset]
    );
    const total = await queryOne('SELECT COUNT(*) as count FROM customers');

    res.json({ customers, total: total.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { query: q, filter } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    let sql = 'SELECT * FROM customers WHERE ';
    const params = [];

    if (filter === 'email') {
      sql += 'email LIKE ?';
      params.push(`%${q}%`);
    } else if (filter === 'phone') {
      sql += 'phone LIKE ?';
      params.push(`%${q}%`);
    } else {
      sql += '(firstName LIKE ? OR lastName LIKE ? OR email LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const customers = await query(sql, params);
    res.json({ customers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const customer = await queryOne('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/accounts', async (req, res) => {
  try {
    const accounts = await query('SELECT * FROM accounts WHERE customerId = ?', [req.params.id]);
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/transactions', async (req, res) => {
  try {
    const transactions = await query(
      `SELECT t.* FROM transactions t
       JOIN accounts a ON t.accountId = a.id
       WHERE a.customerId = ?`,
      [req.params.id]
    );
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/accounts', async (req, res) => {
  try {
    const { accountType, balance, currency } = req.body;

    if (!accountType) {
      return res.status(400).json({ error: 'Account type is required' });
    }

    const customer = await queryOne('SELECT id FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const accountId = generateId('ACC');
    const accountNumber = String(Math.floor(1000000000 + Math.random() * 9000000000));
    const now = new Date().toISOString();

    await run(
      `INSERT INTO accounts (id, customerId, accountNumber, accountType, balance, currency, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        accountId,
        req.params.id,
        accountNumber,
        accountType,
        balance || 0,
        currency || 'USD',
        'ACTIVE',
        now,
        now
      ]
    );

    res.status(201).json({ id: accountId, accountNumber, message: 'Account created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, dateOfBirth, address } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const customerId = generateId('CUST');
    const now = new Date().toISOString();

    await run(
      `INSERT INTO customers (id, firstName, lastName, email, phone, dateOfBirth,
       address_street, address_city, address_state, address_zipCode, address_country,
       createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        firstName,
        lastName,
        email,
        phone || null,
        dateOfBirth || null,
        address?.street || null,
        address?.city || null,
        address?.state || null,
        address?.zipCode || null,
        address?.country || null,
        now,
        now
      ]
    );

    res.status(201).json({ id: customerId, message: 'Customer created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    // Falls back to `{}` (not a 404) for a non-existent id — existence-check behavior for this
    // route is a separately tracked gap (TestScenarios.md NEG-10/NEG-11); this fix is scoped to
    // the merge-vs-overwrite bug only.
    const existing = (await queryOne('SELECT * FROM customers WHERE id = ?', [req.params.id])) || {};

    const { firstName, lastName, email, phone, dateOfBirth, address } = req.body;
    const now = new Date().toISOString();

    await run(
      `UPDATE customers SET
       firstName = ?, lastName = ?, email = ?, phone = ?, dateOfBirth = ?,
       address_street = ?, address_city = ?, address_state = ?, address_zipCode = ?,
       address_country = ?, updatedAt = ?
       WHERE id = ?`,
      [
        firstName ?? existing.firstName,
        lastName ?? existing.lastName,
        email ?? existing.email,
        phone ?? existing.phone,
        dateOfBirth ?? existing.dateOfBirth,
        address?.street ?? existing.address_street,
        address?.city ?? existing.address_city,
        address?.state ?? existing.address_state,
        address?.zipCode ?? existing.address_zipCode,
        address?.country ?? existing.address_country,
        now,
        req.params.id
      ]
    );

    res.json({ message: 'Customer updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
