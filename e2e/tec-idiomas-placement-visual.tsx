import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '../src/index.css';
import EnglishLearningPage from '../src/components/learning/EnglishLearningPage';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6">
      <EnglishLearningPage />
    </div>
  </BrowserRouter>,
);
