import React, { useState, useRef, useEffect } from 'react';
import { colors } from './ui';
import API from '../services/api';

export default function DescriptionInput({ value, onChange, source = 'expenses', placeholder }) {
    const [suggestions, setSuggestions] = useState([]);
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const wrapRef = useRef(null);

    useEffect(() => {
        API.get('/suggestions/descriptions', { params: { source } })
            .then(res => setSuggestions(res.data))
            .catch(() => setSuggestions([]));
    }, [source]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = value.trim().length >= 2
        ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())
        : [];

    useEffect(() => { setHighlight(0); }, [value]);

    const handleSelect = (text) => {
        onChange(text);
        setOpen(false);
    };

    const handleKeyDown = (e) => {
        if (!open || filtered.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(h => Math.min(h + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter' && filtered[highlight]) {
            e.preventDefault();
            handleSelect(filtered[highlight]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div ref={wrapRef} style={styles.wrap}>
            <input
                style={styles.input}
                type="text"
                value={value}
                onChange={e => { onChange(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                required
            />
            {open && filtered.length > 0 && (
                <div style={styles.dropdown}>
                    <div style={styles.hint}>Did you mean one of these?</div>
                    {filtered.slice(0, 8).map((s, i) => (
                        <div
                            key={s}
                            style={i === highlight ? styles.optionActive : styles.option}
                            onMouseEnter={() => setHighlight(i)}
                            onClick={() => handleSelect(s)}
                        >
                            {s}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const styles = {
    wrap: { position: 'relative', width: '100%' },
    input: {
        width: '100%', padding: '10px 12px', border: `0.5px solid ${colors.borderStrong}`,
        borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', color: colors.ink, outline: 'none',
    },
    dropdown: {
        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
        backgroundColor: '#fff', border: `0.5px solid ${colors.borderStrong}`, borderRadius: '8px',
        maxHeight: '220px', overflowY: 'auto', zIndex: 50,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    },
    hint: { padding: '8px 14px 4px', fontSize: '11px', color: colors.muted, fontWeight: '500' },
    option: { padding: '9px 14px', fontSize: '13px', color: colors.ink, cursor: 'pointer' },
    optionActive: { padding: '9px 14px', fontSize: '13px', color: colors.accent, backgroundColor: colors.accentSoft, cursor: 'pointer', fontWeight: '500' },
};