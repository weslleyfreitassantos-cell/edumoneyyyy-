import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, LogIn, ArrowRight, ShieldCheck, GraduationCap, Users, UserCog, UserCheck, HelpCircle } from 'lucide-react';
import { UserRole } from '../types';
import { USERS } from '../data';

interface LoginScreenProps {
  onLogin: (role: UserRole) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const handleRoleQuickSelect = (role: UserRole) => {
    const user = USERS[role];
    if (user) {
      setUsername(user.email);
      setPassword('12345678');
      setError('');
      // Smooth auto-submit or just prefill
      setTimeout(() => {
        onLogin(role);
      }, 500);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    // Check credentials matching our roles
    const matchedRole = Object.keys(USERS).find(
      (key) => USERS[key].email.toLowerCase() === username.toLowerCase()
    );

    if (matchedRole) {
      onLogin(matchedRole as UserRole);
    } else {
      // Default to student if unrecognized but has something
      onLogin('student');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-radial from-[#f7f9ff] to-[#ebeef4]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[440px]"
      >
        {/* Brand Logo & Title */}
        <div className="mb-8 text-center" id="brand-header">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-[#1a73e8]/10 rounded-xl flex items-center justify-center border border-[#c1c6d6] shadow-sm">
              <img 
                className="w-14 h-14 object-contain rounded-md" 
                alt="EduManager Pro Logo" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB3jBMtB1-bQJ3XheNtLq4ixoOm-GYPhtNPnFF28saRuNjZqV-lbqGhkDyBntp_wlqB1P_uadmYGJlfV4GetLcUVfjqzKPVUluNsUl5yZTpLkflLm-e0lcrKnY4zK_FLbKTQ-AYRROs6nWN5tRqa6BO6NLl01Li9Bd1mgbo_NsnpKW8Xr1T6Dwyqjzq1To27WaG5cv4-xFegQWI3rZlw6TmkiLc1ynrZqjlzS_9GqYjyeoX6QN5ZR2iuvsu4Z8m5dG4xv9W0Gk8zbMq"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#181c20]" id="app-title">EduManager Pro</h1>
          <p className="text-sm text-[#414754] font-medium mt-1">Administração Acadêmica</p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white border border-[#dfe3e8] rounded-xl p-8 shadow-sm login-card mb-6" id="login-form-card">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Username/Email Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#414754]" htmlFor="username">
                E-mail ou Nome de Usuário
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#727785]">
                  <Mail className="w-5 h-5" />
                </span>
                <input 
                  type="text"
                  id="username"
                  name="username"
                  placeholder="exemplo@escola.com.br"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 bg-[#ffffff] border border-[#c1c6d6] rounded-lg text-sm text-[#181c20] focus:border-[#005bbf] focus:ring-1 focus:ring-[#005bbf] outline-none transition-all placeholder:text-[#727785]/60 font-medium"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#414754]" htmlFor="password">
                Senha
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#727785]">
                  <Lock className="w-5 h-5" />
                </span>
                <input 
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-10 pr-12 bg-[#ffffff] border border-[#c1c6d6] rounded-lg text-sm text-[#181c20] focus:border-[#005bbf] focus:ring-1 focus:ring-[#005bbf] outline-none transition-all placeholder:text-[#727785]/60 font-medium"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#727785] hover:text-[#414754] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group select-none">
                <input 
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#c1c6d6] text-[#005bbf] focus:ring-[#005bbf] cursor-pointer transition-all"
                />
                <span className="text-xs font-medium text-[#414754] group-hover:text-[#181c20] transition-colors">
                  Lembrar-me
                </span>
              </label>
              <a href="#" className="text-xs font-semibold text-[#005bbf] hover:underline transition-all">
                Esqueceu a senha?
              </a>
            </div>

            {error && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-[#ba1a1a] font-medium"
              >
                {error}
              </motion.p>
            )}

            {/* Action Button */}
            <button 
              type="submit"
              className="w-full h-12 bg-[#005bbf] hover:bg-[#1a73e8] text-white text-sm font-semibold rounded-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
              id="btn-login-submit"
            >
              Entrar
              <LogIn className="w-5 h-5" />
            </button>
          </form>

          {/* Help TI Support */}
          <div className="mt-6 pt-5 border-t border-[#dfe3e8] text-center">
            <p className="text-xs font-medium text-[#414754]">Precisa de ajuda para acessar?</p>
            <a 
              href="#" 
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#006e2c] hover:text-[#00722f] transition-colors"
              id="link-ti-support"
            >
              <ShieldCheck className="w-4 h-4" />
              Suporte de TI da Instituição
            </a>
          </div>
        </div>

        {/* Quick Demo Selector */}
        <div className="bg-[#f1f4fa] border border-[#dfe3e8] rounded-xl p-5 mb-6" id="quick-demo-container">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#414754] mb-3 text-center">
            Acesso Rápido para Avaliação
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleRoleQuickSelect('teacher')}
              className="flex items-center gap-2 p-2.5 bg-white border border-[#c1c6d6] hover:border-[#005bbf] hover:bg-[#f7f9ff] text-[#181c20] text-xs font-bold rounded-lg transition-all text-left shadow-2xs"
            >
              <div className="p-1 rounded bg-[#005bbf]/10 text-[#005bbf]">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <p className="leading-tight">Professor</p>
                <p className="text-[10px] text-[#414754] font-normal">Dr. Ricardo Silva</p>
              </div>
            </button>

            <button
              onClick={() => handleRoleQuickSelect('student')}
              className="flex items-center gap-2 p-2.5 bg-white border border-[#c1c6d6] hover:border-[#005bbf] hover:bg-[#f7f9ff] text-[#181c20] text-xs font-bold rounded-lg transition-all text-left shadow-2xs"
            >
              <div className="p-1 rounded bg-emerald-500/10 text-emerald-600">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="leading-tight">Aluno</p>
                <p className="text-[10px] text-[#414754] font-normal">Gabriel Silva</p>
              </div>
            </button>

            <button
              onClick={() => handleRoleQuickSelect('director')}
              className="flex items-center gap-2 p-2.5 bg-white border border-[#c1c6d6] hover:border-[#005bbf] hover:bg-[#f7f9ff] text-[#181c20] text-xs font-bold rounded-lg transition-all text-left shadow-2xs"
            >
              <div className="p-1 rounded bg-amber-500/10 text-amber-600">
                <UserCog className="w-4 h-4" />
              </div>
              <div>
                <p className="leading-tight">Diretor</p>
                <p className="text-[10px] text-[#414754] font-normal">Painel do Diretor</p>
              </div>
            </button>

            <button
              onClick={() => handleRoleQuickSelect('parent')}
              className="flex items-center gap-2 p-2.5 bg-white border border-[#c1c6d6] hover:border-[#005bbf] hover:bg-[#f7f9ff] text-[#181c20] text-xs font-bold rounded-lg transition-all text-left shadow-2xs"
            >
              <div className="p-1 rounded bg-purple-500/10 text-purple-600">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="leading-tight">Responsável</p>
                <p className="text-[10px] text-[#414754] font-normal">Ricardo Oliveira</p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center flex flex-col items-center gap-3" id="login-footer">
          <p className="text-xs text-[#727785]">
            © 2024 EduManager Pro. Todos os direitos reservados.
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-xs text-[#414754] hover:text-[#005bbf] transition-colors font-medium">Políticas de Privacidade</a>
            <a href="#" className="text-xs text-[#414754] hover:text-[#005bbf] transition-colors font-medium">Termos de Uso</a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
