import React, { useState } from 'react';
import { customersAPI } from '../services/api';
import '../styles/AddCustomer.css';

export function AddCustomer({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('address_')) {
      const field = name.replace('address_', '');
      setFormData({
        ...formData,
        address: { ...formData.address, [field]: value }
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await customersAPI.create({
        ...formData,
        address: {
          street: formData.address.street,
          city: formData.address.city,
          state: formData.address.state,
          zipCode: formData.address.zipCode,
          country: formData.address.country
        }
      });
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Add New Customer</h2>
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="add-customer-first-name">First Name *</label>
            <input
              id="add-customer-first-name"
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="add-customer-last-name">Last Name *</label>
            <input
              id="add-customer-last-name"
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="add-customer-email">Email *</label>
            <input
              id="add-customer-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="add-customer-phone">Phone</label>
            <input
              id="add-customer-phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="add-customer-dob">Date of Birth</label>
            <input
              id="add-customer-dob"
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
            />
          </div>

          <div className="address-section">
            <h4>Address</h4>
            <div className="form-group">
              <label htmlFor="add-customer-street">Street</label>
              <input
                id="add-customer-street"
                type="text"
                name="address_street"
                value={formData.address.street}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="add-customer-city">City</label>
              <input
                id="add-customer-city"
                type="text"
                name="address_city"
                value={formData.address.city}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="add-customer-state">State</label>
              <input
                id="add-customer-state"
                type="text"
                name="address_state"
                value={formData.address.state}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="add-customer-zip">Zip Code</label>
              <input
                id="add-customer-zip"
                type="text"
                name="address_zipCode"
                value={formData.address.zipCode}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="add-customer-country">Country</label>
              <input
                id="add-customer-country"
                type="text"
                name="address_country"
                value={formData.address.country}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Customer'}
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
