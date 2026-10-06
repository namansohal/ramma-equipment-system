import { useEffect, useState } from 'react';
import API from '../services/api';

const KEY = 'siteName';
const EVENT = 'ramma-site-changed';

const read = () => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } };

/** Name of the active site (e.g. "Kade"), cached for the browser session. */
export default function useSiteName() {
    const [name, setName] = useState(read());
    useEffect(() => {
        let alive = true;
        const load = () => API.get('/locations/').then(res => {
            const cur = res.data.find(l => l.is_current);
            const n = cur ? cur.name : '';
            try { sessionStorage.setItem(KEY, n); } catch { /* storage unavailable */ }
            if (alive) setName(n);
        }).catch(() => {});
        if (!read()) load();
        window.addEventListener(EVENT, load);
        return () => { alive = false; window.removeEventListener(EVENT, load); };
    }, []);
    return name;
}

/** Call after the active site changes so every page re-reads it. */
export const siteChanged = () => {
    try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event(EVENT));
};
