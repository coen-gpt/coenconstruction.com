import { useEffect, useState } from 'react';

export function useTheme() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load theme preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('admin-theme');
    // Default to light — only go dark if user has explicitly chosen it
    const shouldBeDark = saved === 'dark';
    
    setIsDark(shouldBeDark);
    applyTheme(shouldBeDark);
    setMounted(true);
  }, []);

  const applyTheme = (dark) => {
    const html = document.documentElement;
    if (dark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem('admin-theme', newDark ? 'dark' : 'light');
    applyTheme(newDark);
  };

  return { isDark, toggleTheme, mounted };
}