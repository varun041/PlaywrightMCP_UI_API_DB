import React, { useState } from 'react';
import { accountsAPI } from '../services/api';
import '../styles/AddCustomer.css';

export function TransferFunds({ fromAccount, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    toAccountNumber: '',
    amount: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await accountsAPI.transfer({
        fromAccountId: fromAccount.id,
        toAccountNumber: formData.toAccountNumber,
        amount: parseFloat(formData.amount),
        description: formData.description || undefined
      });
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Transfer Funds</h2>
        {error && <div className="error">{error}</div>}

        <p>
          From account <strong>{fromAccount.accountNumber}</strong> (Balance: ${fromAccount.balance.toFixed(2)})
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="transfer-to-account">Destination Account Number *</label>
            <input
              id="transfer-to-account"
              type="text"
              name="toAccountNumber"
              value={formData.toAccountNumber}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="transfer-amount">Amount *</label>
            <input
              id="transfer-amount"
              type="number"
              step="0.01"
              min="0.01"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="transfer-description">Description</label>
            <input
              id="transfer-description"
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Optional"
            />
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Transferring...' : 'Transfer'}
            </button>
            <button type="button" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
