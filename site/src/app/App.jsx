import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from '@/router';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { loadCategories, CATEGORIES_EVENT } from '@/services/categories';

export default function App() {
  // Pages read the category lists while they draw, so draw again if the team's list differs from the built-in one.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(CATEGORIES_EVENT, bump);
    loadCategories();
    return () => window.removeEventListener(CATEGORIES_EVENT, bump);
  }, []);

  return (
    <ThemeProvider>
      <TooltipProvider>
        <RouterProvider key={version} router={router} />
        <Toaster position="top-right" richColors closeButton duration={3000} />
      </TooltipProvider>
    </ThemeProvider>
  );
}
