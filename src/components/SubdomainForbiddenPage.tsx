import { Login } from '../pages/Login';
import { ThemeProvider } from '../contexts/ThemeContext';

export function SubdomainForbiddenPage() {
  return (
    <ThemeProvider>
      <Login subdomainMismatch />
    </ThemeProvider>
  );
}
