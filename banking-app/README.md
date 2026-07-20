# Banking Customer Management Application

A full-stack web application for managing banking customers with CRUD operations, search functionality, and account/transaction viewing.

## Project Structure

```
banking-app/
├── backend/
│   ├── server.js           # Express server entry point
│   ├── db.js              # Database connection helpers
│   ├── routes/
│   │   ├── customers.js   # Customer CRUD endpoints
│   │   └── auth.js        # Authentication endpoints
│   ├── middleware/
│   │   └── auth.js        # JWT authentication middleware
│   ├── db/
│   │   └── banking.db     # SQLite database
│   ├── package.json
│   ├── .env
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginForm.jsx
│   │   │   ├── CustomerList.jsx
│   │   │   ├── CustomerDetails.jsx
│   │   │   └── AddCustomer.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── styles/
│   │   │   ├── LoginForm.css
│   │   │   ├── CustomerList.css
│   │   │   ├── CustomerDetails.css
│   │   │   └── AddCustomer.css
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

## Features

### Backend API
- **Customer Management**
  - `GET /api/customers` - List all customers (with pagination)
  - `GET /api/customers/:id` - Get customer details
  - `GET /api/customers/:id/accounts` - Get customer's bank accounts
  - `GET /api/customers/:id/transactions` - Get customer's transactions
  - `POST /api/customers` - Create new customer
  - `PUT /api/customers/:id` - Update customer
  - `DELETE /api/customers/:id` - Delete customer
  - `GET /api/customers/search?query=...&filter=...` - Search customers
  - `GET /api/routes` - List available API routes

- **Authentication**
  - `POST /api/auth/register` - Register new user
  - `POST /api/auth/login` - Login user

### Frontend
- User authentication with JWT
- Customer list with pagination
- Search and filter customers by name, email, or phone
- View detailed customer information
- View customer accounts and transaction history
- Add new customers with complete address information
- Responsive design for mobile and desktop

## Getting Started

### Prerequisites
- Node.js 14+ installed
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd banking-app/backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (or use provided `.env`):
```bash
cp .env.example .env
```

4. Start the server:
```bash
npm start
```

The API server will run on `http://localhost:3000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd banking-app/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
```

The frontend will run on `http://localhost:3001`

## API Usage Examples

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123",
    "email": "admin@banking.com"
  }'
```

### Login User
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

### Get All Customers (requires token)
```bash
curl http://localhost:3000/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Customer (requires token)
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "555-1234",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    }
  }'
```

### Search Customers (requires token)
```bash
curl "http://localhost:3000/api/customers/search?query=john&filter=email" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Database Schema

### Customers Table
- `id` - Unique identifier
- `firstName` - Customer first name
- `lastName` - Customer last name
- `email` - Email address (unique, indexed)
- `phone` - Phone number
- `dateOfBirth` - Date of birth
- `address_street` - Street address
- `address_city` - City
- `address_state` - State
- `address_zipCode` - ZIP code
- `address_country` - Country
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Accounts Table
- `id` - Unique identifier
- `customerId` - Foreign key to customers
- `accountNumber` - Account number (unique, indexed)
- `accountType` - Type of account
- `balance` - Current balance
- `currency` - Currency code
- `status` - Account status
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Transactions Table
- `id` - Unique identifier
- `accountId` - Foreign key to accounts
- `type` - Transaction type
- `amount` - Transaction amount
- `description` - Transaction description
- `reference` - Reference number
- `status` - Transaction status
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

## Development

### Running Both Backend and Frontend

Terminal 1 - Start Backend:
```bash
cd banking-app/backend
npm start
```

Terminal 2 - Start Frontend:
```bash
cd banking-app/frontend
npm run dev
```

Then visit `http://localhost:3001` in your browser.

### Test Credentials

After registering an account, use the same credentials to login.

## Technologies Used

### Backend
- Node.js
- Express.js
- SQLite3
- JWT (JSON Web Tokens)
- bcryptjs (Password hashing)
- CORS

### Frontend
- React 18
- Vite
- Axios
- React Router
- Context API
- CSS3

## Notes

- The SQLite database is pre-populated with sample customer, account, and transaction data
- Authentication tokens are stored in localStorage on the client
- All API endpoints (except auth) require a valid JWT token
- The backend runs on port 3000 and frontend on port 3001
- CORS is enabled for local development
