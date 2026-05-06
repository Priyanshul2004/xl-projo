import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './pages/App.jsx';
import { StartupLoader } from './components/StartupLoader.jsx';
import { applyTheme, getInitialTheme, getNextTheme } from './utils/theme.js';
import './styles/global.css';

function Root() {
    const [booted, setBooted] = useState(false);
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

    return (
        <>
            {!booted ? <StartupLoader onDone={() => setBooted(true)} /> : null}
            <App theme={theme} onToggleTheme={toggleTheme} />
        </>
    );
}

createRoot(document.getElementById('root')).render(<Root />);
