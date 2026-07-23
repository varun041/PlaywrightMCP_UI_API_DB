import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import '../styles/LoginForm.css';

export function LoginForm({ onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const { login, register, loading, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password, email);
      }
      onSuccess?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="login-container">
      <div className="auth-panel">
        <h2>{isLogin ? 'Login' : 'Register'}</h2>
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            aria-label="Username"
            placeholder="User Name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          {!isLogin && (
            <input
              type="email"
              aria-label="Email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}

          <input
            type="password"
            aria-label="Password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <button
          className="toggle-btn"
          onClick={() => setIsLogin(!isLogin)}
          disabled={loading}
        >
          {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  );
}
