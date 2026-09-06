import React, { useState, useRef, useEffect } from 'react';
import { colors } from './ui';

export default function StyledSelect({ options, value, onChange, placeholder }) {
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const wrapRef = useRef(null);

    const selected = options.find(o => String(o.value) === String(value));

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (opt) => {
        onChange(opt.value);
        setOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(o => !o);
        } else if (open && e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(h => Math.min(h + 1, options.length - 1));
        } else if (open && e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
        } else if (open && e.key === 'Enter') {
            handleSelect(options[highlight]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div ref={wrapRef} style={styles.wrap} tabIndex={0} onKeyDown={handleKeyDown}>
            <div style={styles.displayBox} onClick={() => setOpen(o => !o)}>
                <span style={selected ? styles.selectedText : styles.placeholderText}>
                    {selected ? selected.label : (placeholder || 'Select')}
                </span>
                <span style={styles.arrow}>▾</span>
            </div>
            {open && (
                <div style={styles.dropdown}>
                    {options.map((o, i) => (
                        <div
                            key={o.value}
                            style={String(o.value) === String(value) ? styles.optionActive : styles.option}
                            onMouseEnter={() => setHighlight(i)}
                            onClick={() => handleSelect(o)}
                        >
                            {o.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const styles = {
    wrap: { position: 'relative', width: '100%', outline: 'none' },
    displayBox: {
        width: '100%', padding: '10px 12px', border: `0.5px solid ${colors.borderStrong}`,
        borderRadius: '8px', fontSize: '14px', backgroundColor: '#fff', color: colors.ink,
        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxSizing: 'border-box',
    },
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
};  