import { useEffect, useState } from 'react';

export function StartupLoader({ onDone }) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const stepMs = 20;
        const timer = setInterval(() => {
            setProgress((prev) => {
                const next = prev + 1;
                if (next >= 100) {
                    clearInterval(timer);
                    setTimeout(onDone, 0);
                    return 100;
                }
                return next;
            });
        }, stepMs);

        return () => clearInterval(timer);
    }, [onDone]);

    return (
        <div className="loading-overlay active" aria-hidden="false">
            <div className="loading-spinner" role="status" aria-label="Loading"></div>
            <p>{`Loading ${progress}%`}</p>
        </div>
    );
}
