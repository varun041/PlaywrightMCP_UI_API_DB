import React, { useState } from 'react';
import { LoginForm } from './components/LoginForm';
import { CustomerList } from './components/CustomerList';
import { CustomerDetails } from './components/CustomerDetails';
import { AddCustomer } from './components/AddCustomer';
import { useAuth } from './hooks/useAuth';
import './App.css';

function App() {
  const { isAuthenticated, logout } = useAuth();
  const [view, setView] = useState('list');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  if (!isAuthenticated) {
    return (
      <LoginForm
        onSuccess={() => {
          setView('list');
        }}
      />
    );
  }

  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setView('details');
  };

  const handleBack = () => {
    setSelectedCustomer(null);
    setView('list');
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    setView('list');
  };

  const handleEdit = (customer) => {
    setSelectedCustomer(customer);
    setView('details');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🏦 Banking Customer Management</h1>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="main-content">
        {view === 'list' && (
          <CustomerList
            onSelectCustomer={handleSelectCustomer}
            onAddClick={() => setShowAddModal(true)}
          />
        )}

        {view === 'details' && selectedCustomer && (
          <CustomerDetails
            customerId={selectedCustomer.id}
            onBack={handleBack}
            onEdit={handleEdit}
          />
        )}

        {showAddModal && (
          <AddCustomer
            onSuccess={handleAddSuccess}
            onCancel={() => setShowAddModal(false)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
