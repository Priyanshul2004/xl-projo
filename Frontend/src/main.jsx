import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './pages/App.jsx';
import { applyTheme, getInitialTheme, getNextTheme } from './utils/theme.js';
import './styles/global.css';

function Root() {
    const [theme, setTheme] = useState(() => getInitialTheme());

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => {
            const next = getNextTheme(prev);
            applyTheme(next);
            return next;
        });
    };

    return <App theme={theme} onToggleTheme={toggleTheme} />;
}

createRoot(document.getElementById('root')).render(<Root />);
