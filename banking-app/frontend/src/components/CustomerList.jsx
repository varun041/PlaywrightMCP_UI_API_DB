import React, { useState, useEffect, useRef } from 'react';
import { customersAPI } from '../services/api';
import '../styles/CustomerList.css';

export function CustomerList({ onSelectCustomer, onAddClick }) {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const limit = 10;

  // Both fetchCustomers (fired on mount/offset change, and twice under React.StrictMode's
  // intentional double-invoke of effects) and handleSearch (fired by the user/test) write into
  // the same `customers` state. Without a sequencing guard, whichever request's response happens
  // to arrive last wins — e.g. a slow default-page-1 request completing after a search request
  // silently clobbers the search results with the unfiltered list. `requestIdRef` makes only the
  // most-recently-*started* request allowed to apply its result, regardless of resolution order.
  const requestIdRef = useRef(0);

  const fetchCustomers = async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await customersAPI.list(limit, offset);
      if (requestIdRef.current !== requestId) return; // superseded by a newer request
      setCustomers(response.data.customers);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err.response?.data?.error || 'Failed to fetch customers');
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchCustomers();
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await customersAPI.search(searchQuery, searchFilter || null);
      if (requestIdRef.current !== requestId) return; // superseded by a newer request
      setCustomers(response.data.customers);
      setOffset(0);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [offset]);

  return (
    <div className="customer-list-container">
      <div className="search-section">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            aria-label="Search customers"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            aria-label="Search field filter"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Fields</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
          <button type="submit" disabled={loading}>Search</button>
          <button type="button" onClick={onAddClick} className="add-btn">
            Add Customer
          </button>
        </form>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="customers-table">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : customers.length === 0 ? (
          <div className="no-data">No customers found</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.firstName} {customer.lastName}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone || 'N/A'}</td>
                  <td>
                    <button
                      className="view-btn"
                      onClick={() => onSelectCustomer(customer)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination">
        <button
          onClick={() => setOffset(Math.max(0, offset - limit))}
          disabled={offset === 0 || loading}
        >
          Previous
        </button>
        <button
          onClick={() => setOffset(offset + limit)}
          disabled={customers.length < limit || loading}
        >
          Next
        </button>
      </div>
    </div>
  );
}
