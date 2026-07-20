import React, { useState, useEffect, useRef } from 'react';
import { customersAPI, accountsAPI } from '../services/api';
import { AddAccount } from './AddAccount';
import { TransferFunds } from './TransferFunds';
import '../styles/CustomerDetails.css';

export function CustomerDetails({ customerId, onBack, onEdit }) {
  const [customer, setCustomer] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [transferAccount, setTransferAccount] = useState(null);
  const [actionError, setActionError] = useState(null);

  // fetchDetails runs on mount (twice under React.StrictMode's intentional double-invoke of
  // effects) and again after every add-account/transfer success. Without a sequencing guard, an
  // older in-flight fetch that happens to resolve after a newer one can overwrite freshly
  // created data (e.g. a just-added account) with the stale snapshot it read before that account
  // existed. requestIdRef ensures only the most-recently-*started* fetch is allowed to apply its
  // result, regardless of resolution order.
  const requestIdRef = useRef(0);

  const fetchDetails = async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [customerRes, accountsRes, transactionsRes] = await Promise.all([
        customersAPI.get(customerId),
        customersAPI.getAccounts(customerId),
        customersAPI.getTransactions(customerId)
      ]);

      if (requestIdRef.current !== requestId) return; // superseded by a newer request

      setCustomer(customerRes.data);
      setAccounts(accountsRes.data.accounts);
      setTransactions(transactionsRes.data.transactions);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err.response?.data?.error || 'Failed to fetch details');
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [customerId]);

  const handleAddAccountSuccess = () => {
    setShowAddAccount(false);
    fetchDetails();
  };

  const handleTransferSuccess = () => {
    setTransferAccount(null);
    fetchDetails();
  };

  const handleDeleteAccount = async (account) => {
    if (!window.confirm(`Delete account ${account.accountNumber}? This cannot be undone.`)) {
      return;
    }
    setActionError(null);
    try {
      await accountsAPI.delete(account.id);
      fetchDetails();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to delete account');
    }
  };

  if (loading) return <div className="loading">Loading customer details...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!customer) return <div>Customer not found</div>;

  return (
    <div className="customer-details-container">
      <button onClick={onBack} className="back-btn">← Back</button>

      <div className="customer-info">
        <h2>{customer.firstName} {customer.lastName}</h2>
        <div className="info-grid">
          <div>
            <label>Email:</label>
            <p>{customer.email}</p>
          </div>
          <div>
            <label>Phone:</label>
            <p>{customer.phone || 'N/A'}</p>
          </div>
          <div>
            <label>Date of Birth:</label>
            <p>{customer.dateOfBirth || 'N/A'}</p>
          </div>
          <div>
            <label>Address:</label>
            <p>
              {customer.address_street && `${customer.address_street}, `}
              {customer.address_city && `${customer.address_city}, `}
              {customer.address_state && `${customer.address_state} `}
              {customer.address_zipCode && `${customer.address_zipCode}`}
            </p>
          </div>
        </div>
        <button onClick={() => onEdit(customer)} className="edit-btn">
          Edit Customer
        </button>
      </div>

      <div className="accounts-section">
        <div className="section-header">
          <h3>Accounts ({accounts.length})</h3>
          <button onClick={() => setShowAddAccount(true)} className="add-btn">
            Add Account
          </button>
        </div>
        {actionError && <div className="error">{actionError}</div>}
        {accounts.length === 0 ? (
          <p className="no-data">No accounts found</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Account Number</th>
                <th>Type</th>
                <th>Balance</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.accountNumber}</td>
                  <td>{account.accountType}</td>
                  <td>${account.balance.toFixed(2)}</td>
                  <td>{account.currency}</td>
                  <td>{account.status}</td>
                  <td className="account-actions">
                    <button onClick={() => setTransferAccount(account)} className="transfer-btn">
                      Transfer
                    </button>
                    <button onClick={() => handleDeleteAccount(account)} className="delete-btn">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="transactions-section">
        <h3>Transactions ({transactions.length})</h3>
        {transactions.length === 0 ? (
          <p className="no-data">No transactions found</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td>{tx.type}</td>
                  <td>${tx.amount.toFixed(2)}</td>
                  <td>{tx.description}</td>
                  <td>{tx.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddAccount && (
        <AddAccount
          customerId={customerId}
          onSuccess={handleAddAccountSuccess}
          onCancel={() => setShowAddAccount(false)}
        />
      )}

      {transferAccount && (
        <TransferFunds
          fromAccount={transferAccount}
          onSuccess={handleTransferSuccess}
          onCancel={() => setTransferAccount(null)}
        />
      )}
    </div>
  );
}
