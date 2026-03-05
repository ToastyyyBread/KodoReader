import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * CustomDropdown — reusable dropdown using a portal so it's never clipped.
 * Props:
 *   items     – [{ value, label }]
 *   value     – currently selected value
 *   onChange  – (value) => void
 *   direction – 'down' (default) | 'up'
 *   className – optional wrapper class
 */
const CustomDropdown = ({ items, value, onChange, direction = 'down', className = '' }) => {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0, bottom: 0 });
    const triggerRef = useRef();
    const menuRef = useRef();

    const openMenu = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setMenuPos({
                top: rect.bottom + 6,
                bottom: window.innerHeight - rect.top + 6,
                left: rect.left,
                width: rect.width,
            });
        }
        setOpen(true);
    };

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target) &&
                menuRef.current && !menuRef.current.contains(e.target)
            ) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Auto-scroll to active item
    useEffect(() => {
        if (open && menuRef.current) {
            const activeEl = menuRef.current.querySelector('.dropdown-item.active');
            if (activeEl) activeEl.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
    }, [open]);

    const activeItem = items.find(i => i.value === value);
    const activeIndex = items.findIndex(i => i.value === value);

    const isUp = direction === 'up';
    const menuStyle = {
        position: 'fixed',
        left: menuPos.left,
        minWidth: menuPos.width,
        animation: isUp ? 'dropdownSlideUp2 0.18s ease' : 'dropdownSlideDown 0.18s ease',
        zIndex: 99999,
        ...(isUp
            ? { bottom: menuPos.bottom }
            : { top: menuPos.top }),
    };

    const menu = open && createPortal(
        <div ref={menuRef} className="custom-dropdown-menu" style={menuStyle}>
            <div style={{ overflowY: 'auto', maxHeight: '188px', borderRadius: 8 }}>
                {items.map((item, i) => (
                    <button
                        type="button"
                        key={item.value}
                        className={`dropdown-item${i === activeIndex ? ' active' : ''}`}
                        onClick={() => { onChange(item.value); setOpen(false); }}
                    >
                        <span className="dropdown-item-text">{item.label}</span>
                        {i === activeIndex && (
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="3" style={{ flexShrink: 0 }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>
                ))}
            </div>
        </div>,
        document.body
    );

    return (
        <div ref={triggerRef} className={className} style={{ position: 'relative' }}>
            <button
                type="button"
                className="custom-dropdown-trigger"
                onClick={() => open ? setOpen(false) : openMenu()}
                style={{ width: '100%' }}
            >
                <span className="custom-dropdown-value">
                    {activeItem?.label || '—'}
                </span>
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                    style={{
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        flexShrink: 0,
                        marginLeft: 'auto',
                    }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 15l-7-7-7 7" />
                </svg>
            </button>
            {menu}
        </div>
    );
};

export default CustomDropdown;
