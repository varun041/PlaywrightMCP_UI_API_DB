const express = require('express');
const { queryOne, run } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { generateId } = require('../utils/idGenerator');

const router = express.Router();

router.use(authenticateToken);

router.delete('/:id', async (req, res) => {
  try {
    const account = await queryOne('SELECT id FROM accounts WHERE id = ?', [req.params.id]);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await run('DELETE FROM transactions WHERE accountId = ?', [req.params.id]);
    await run('DELETE FROM accounts WHERE id = ?', [req.params.id]);

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transfer', async (req, res) => {
  try {
    const { fromAccountId, toAccountNumber, amount, description } = req.body;
    const transferAmount = parseFloat(amount);

    if (!fromAccountId || !toAccountNumber || !transferAmount || transferAmount <= 0) {
      return res.status(400).json({ error: 'From account, destination account number, and a positive amount are required' });
    }

    const fromAccount = await queryOne('SELECT * FROM accounts WHERE id = ?', [fromAccountId]);
    if (!fromAccount) {
      return res.status(404).json({ error: 'Source account not found' });
    }

    const toAccount = await queryOne('SELECT * FROM accounts WHERE accountNumber = ?', [toAccountNumber]);
    if (!toAccount) {
      return res.status(404).json({ error: 'Destination account not found' });
    }

    if (fromAccount.id === toAccount.id) {
      return res.status(400).json({ error: 'Cannot transfer to the same account' });
    }

    if (fromAccount.status !== 'ACTIVE' || toAccount.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Both accounts must be active' });
    }

    if (fromAccount.balance < transferAmount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    const now = new Date().toISOString();
    const reference = generateId('TRF');

    await run('UPDATE accounts SET balance = balance - ?, updatedAt = ? WHERE id = ?', [transferAmount, now, fromAccount.id]);
    await run('UPDATE accounts SET balance = balance + ?, updatedAt = ? WHERE id = ?', [transferAmount, now, toAccount.id]);

    const debitId = generateId('TXN') + '-D';
    const creditId = generateId('TXN') + '-C';
    const txDescription = description || `Transfer to account ${toAccount.accountNumber}`;

    await run(
      `INSERT INTO transactions (id, accountId, type, amount, description, reference, status, createdAt, updatedAt)
       VALUES (?, ?, 'TRANSFER', ?, ?, ?, 'COMPLETED', ?, ?)`,
      [debitId, fromAccount.id, transferAmount, txDescription, reference, now, now]
    );

    await run(
      `INSERT INTO transactions (id, accountId, type, amount, description, reference, status, createdAt, updatedAt)
       VALUES (?, ?, 'TRANSFER', ?, ?, ?, 'COMPLETED', ?, ?)`,
      [creditId, toAccount.id, transferAmount, description || `Transfer from account ${fromAccount.accountNumber}`, reference, now, now]
    );

    res.status(201).json({ message: 'Transfer completed successfully', reference });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
