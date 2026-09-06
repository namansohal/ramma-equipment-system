import React, { useState, useRef, useEffect } from 'react';
import { colors } from './ui';

export default function PartPicker({ parts, value, onChange, placeholder }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const wrapRef = useRef(null);
    const listRef = useRef(null);

    const selected = parts.find(p => p.part_id === value);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = query
        ? parts.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
        : parts;

    useEffect(() => {
        setHighlight(0);
    }, [query]);

    useEffect(() => {
        if (open && listRef.current) {
            const activeEl = listRef.current.children[highlight];
            if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
        }
    }, [highlight, open]);

    const handleSelect = (part) => {
        onChange(part.part_id);
        setQuery('');
        setOpen(false);
    };

    const handleKeyDown = (e) => {
        if (!open) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(h => Math.min(h + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[highlight]) handleSelect(filtered[highlight]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div ref={wrapRef} style={styles.wrap}>
            <div style={styles.displayBox} onClick={() => setOpen(true)}>
                {open ? (
                    <input
                        autoFocus
                        style={styles.searchInput}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type to search parts..."
                    />
                ) : (
                    <span style={selected ? styles.selectedText : styles.placeholderText}>
                        {selected ? selected.name : (placeholder || 'Select part')}
                    </span>
                )}
                <span style={styles.arrow}>▾</span>
            </div>
            {open && (
                <div style={styles.dropdown} ref={listRef}>
                    {filtered.length === 0 && (
                        <div style={styles.noResults}>No parts match "{query}"</div>
                    )}
                    {filtered.slice(0, 100).map((p, i) => (
                        <div
                            key={p.part_id}
                            style={i === highlight ? styles.optionActive : styles.option}
                            onMouseEnter={() => setHighlight(i)}
                            onClick={() => handleSelect(p)}
                        >
                            {p.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const styles = {
    wrap: { position: 'relative', width: '100%' },
    displayBox: {
        width: '100%', padding: '10px 12px', border: `0.5px solid ${colors.borderStrong}`,
        borderRadius: '8px', fontSize: '14px', backgroundColor: '#fff', color: colors.ink,
        cursor: 'text', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxSizing: 'border-box',
    },
    searchInput: { border: 'none', outline: 'none', fontSize: '14px', width: '100%', color: colors.ink },
    selectedText: { color: colors.ink },
    placeholderText: { color: colors.muted },
    arrow: { color: colors.muted, fontSize: '12px', marginLeft: '8px' },
    dropdown: {
        position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
        backgroundColor: '#fff', border: `0.5px solid ${colors.borderStrong}`, borderRadius: '8px',
        maxHeight: '260px', overflowY: 'auto', zIndex: 50,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    },
    option: { padding: '9px 14px', fontSize: '13px', color: colors.ink, cursor: 'pointer' },
    optionActive: { padding: '9px 14px', fontSize: '13px', color: colors.accent, backgroundColor: colors.accentSoft, cursor: 'pointer', fontWeight: '500' },
    noResults: { padding: '12px 14px', fontSize: '13px', color: colors.muted },
};