/**
 * Centralized role/text/placeholder/attribute selector fragments.
 * The app has no `data-testid` attributes (confirmed across banking-app/frontend/src) — this module
 * is the single place to update if/when those attributes are added, so Controls/Widgets never
 * hardcode a selector string inline (PageObjectModel.md §12).
 */
export const Selectors = {
  header: {
    logoutButton: 'Logout',
  },
  login: {
    heading: (mode: 'Login' | 'Register') => mode,
    usernamePlaceholder: 'Username',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',
    submitButton: (mode: 'Login' | 'Register') => mode,
    toggleToRegisterText: "Don't have an account? Register",
    toggleToLoginText: 'Already have an account? Login',
  },
  customerList: {
    searchPlaceholder: 'Search by name, email, or phone...',
    searchButton: 'Search',
    addCustomerButton: 'Add Customer',
    viewButton: 'View',
    previousButton: 'Previous',
    nextButton: 'Next',
    noDataText: 'No customers found',
    loadingText: 'Loading...',
  },
  customerDetails: {
    backButton: '← Back',
    editButton: 'Edit Customer',
    addAccountButton: 'Add Account',
    transferButton: 'Transfer',
    deleteButton: 'Delete',
    noAccountsText: 'No accounts found',
    noTransactionsText: 'No transactions found',
    loadingText: 'Loading customer details...',
    deleteConfirmMessage: (accountNumber: string) =>
      `Delete account ${accountNumber}? This cannot be undone.`,
  },
  addCustomerModal: {
    heading: 'Add New Customer',
    submitButton: 'Create Customer',
    submittingButtonText: 'Creating...',
    cancelButton: 'Cancel',
    labels: {
      firstName: 'First Name *',
      lastName: 'Last Name *',
      email: 'Email *',
      phone: 'Phone',
      dateOfBirth: 'Date of Birth',
      street: 'Street',
      city: 'City',
      state: 'State',
      zipCode: 'Zip Code',
      country: 'Country',
    },
  },
  addAccountModal: {
    heading: 'Add New Account',
    submitButton: 'Create Account',
    submittingButtonText: 'Creating...',
    cancelButton: 'Cancel',
  },
  transferFundsModal: {
    heading: 'Transfer Funds',
    submitButton: 'Transfer',
    submittingButtonText: 'Transferring...',
    cancelButton: 'Cancel',
  },
} as const;
