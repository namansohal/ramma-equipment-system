import React from 'react';

const PATHS = {
    dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
    book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
    clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7v5l3 2',
    warn: 'M12 4l9 16H3zM12 10v4M12 17v.5',
    gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
    coins: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',
    truck: 'M3 16V8h10v8M13 11h4l4 4v1h-8M7 19a2 2 0 1 0 0-4a2 2 0 1 0 0 4zM17 19a2 2 0 1 0 0-4a2 2 0 1 0 0 4z',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    people: 'M9 11a4 4 0 1 0 0-8a4 4 0 1 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M22 21v-1a6 6 0 0 0-4-5.6',
    userplus: 'M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8zM4 21v-1a7 7 0 0 1 11-5.7M17 15v6M14 18h6',
    bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
    key: 'M8 15a4 4 0 1 0 0-8a4 4 0 1 0 0 8zM11 11h10M17 11v4M20 11v3',
    logout: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h11',
    arrow: 'M5 12h14M13 6l6 6-6 6',
};

export default function Icon({ name, size = 18 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={PATHS[name]} />
        </svg>
    );
}
