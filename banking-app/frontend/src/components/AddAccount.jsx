import React, { useState } from 'react';
import { customersAPI } from '../services/api';
import '../styles/AddCustomer.css';

export function AddAccount({ customerId, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    accountType: 'CHECKING',
    balance: '',
    currency: 'USD'
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
      await customersAPI.createAccount(customerId, {
        accountType: formData.accountType,
        balance: formData.balance ? parseFloat(formData.balance) : 0,
        currency: formData.currency
      });
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Add New Account</h2>
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="add-account-type">Account Type *</label>
            <select id="add-account-type" name="accountType" value={formData.accountType} onChange={handleChange} required>
              <option value="CHECKING">Checking</option>
              <option value="SAVINGS">Savings</option>
              <option value="BUSINESS">Business</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="add-account-balance">Initial Balance</label>
            <input
              id="add-account-balance"
              type="number"
              step="0.01"
              name="balance"
              value={formData.balance}
              onChange={handleChange}
              placeholder="0.00"
            />
          </div>

          <div className="form-group">
            <label htmlFor="add-account-currency">Currency</label>
            <input
              id="add-account-currency"
              type="text"
              name="currency"
              value={formData.currency}
              onChange={handleChange}
            />
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
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
