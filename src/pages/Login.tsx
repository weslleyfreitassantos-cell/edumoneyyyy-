import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (profile) {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">EduMoney</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Faça login para acessar o sistema</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">E-mail</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Senha</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                   className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
            <div className="mt-2 text-right">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-blue-700 hover:text-blue-800"
              >
                Esqueci minha senha
              </Link>
            </div>
          </div>
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}
          <button type="submit" disabled={loading}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm disabled:opacity-50">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
