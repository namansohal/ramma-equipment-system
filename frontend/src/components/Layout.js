import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { getUnreadAlertCount } from '../services/api';

const NAV_GROUPS = [
    {
        name: 'Daily work',
        items: [
            { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
            { path: '/mainbook', label: 'Mainbook', icon: 'book' , noViewer: true },
            { path: '/expenses', label: 'Expenses', icon: 'receipt' , noViewer: true },
            { path: '/momo', label: 'MOMO', icon: 'phone' , noViewer: true },
        ],
    },
    {
        name: 'Machines',
        items: [
            { path: '/runtime', label: 'Runtime', icon: 'clock' , noViewer: true },
            { path: '/downtime', label: 'Downtime', icon: 'warn' },
            { path: '/stock', label: 'Spare Parts', icon: 'gear' },
            { path: '/machines', label: 'Machines', icon: 'truck' },
            { path: '/machine-profit', label: 'Machine Profit', icon: 'chart', adminOnly: true },
        ],
    },
    {
        name: 'People & money',
        items: [
            { path: '/customers', label: 'Customers', icon: 'people', adminOnly: true },
            { path: '/loans', label: 'Loans', icon: 'coins' , noViewer: true },
            { path: '/reports', label: 'Reports', icon: 'chart' , noViewer: true },
        ],
    },
    {
        name: 'Admin',
        adminOnly: true,
        items: [
            { path: '/audit', label: 'Activity Log', icon: 'list' },
            { path: '/staff', label: 'Staff', icon: 'people' },
            { path: '/users', label: 'Users', icon: 'userplus' },
        ],
    },
];

const EXTRA_TITLES = { '/account': ['Account', 'My Account'], '/alerts': ['Notifications', 'Alerts'] };

export default function Layout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'owner' || user.role === 'manager';
    const isViewer = user.role === 'viewer';
    const [unread, setUnread] = useState(0);

    useEffect(() => {
        getUnreadAlertCount().then(res => setUnread(res.data.count || 0)).catch(() => {});
    }, [location.pathname]);

    const logout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const groups = NAV_GROUPS
        .filter(g => !g.adminOnly || isAdmin)
        .map(g => ({ ...g, items: g.items.filter(i => (!i.adminOnly || isAdmin) && !(i.noViewer && isViewer)) }))
        .filter(g => g.items.length > 0);

    // Detail pages (/machines/:id, /customers/:key) highlight their list page.
    const isActive = (path) => location.pathname === path ||
        ((path === '/machines' || path === '/customers') && location.pathname.startsWith(path + '/'));

    let eyebrow = '';
    let title = '';
    for (const g of groups) {
        const hit = g.items.find(i => isActive(i.path));
        if (hit) { eyebrow = g.name; title = hit.label; }
    }
    if (EXTRA_TITLES[location.pathname]) [eyebrow, title] = EXTRA_TITLES[location.pathname];
    // The dashboard draws its own greeting header.
    const showHeader = title && location.pathname !== '/dashboard';

    const roleName = (user.role || '').replace('_', ' ').replace(/^\w/, c => c.toUpperCase());

    const NavLink = ({ path, label, icon, badge }) => (
        <a
            href={path}
            className={`rs-link${isActive(path) ? ' active' : ''}`}
            aria-current={isActive(path) ? 'page' : undefined}
            onClick={e => { e.preventDefault(); navigate(path); }}
        >
            <Icon name={icon} />
            {label}
            {badge > 0 && <span className="rs-badge">{badge}</span>}
        </a>
    );

    return (
        <div className="rs-shell">
            <aside className="rs-side">
                <div className="rs-brand">
                    <img src="/logo_r.jpeg" alt="" className="rs-logo" />
                    <div>
                        <div className="rs-brand-name">Ramma</div>
                        <div className="rs-brand-sub">Equipment Co.</div>
                    </div>
                </div>

                <nav className="rs-nav" aria-label="Main">
                    {groups.map(g => (
                        <React.Fragment key={g.name}>
                            <div className="rs-group">{g.name}</div>
                            {g.items.map(item => <NavLink key={item.path} {...item} />)}
                        </React.Fragment>
                    ))}
                </nav>

                <div className="rs-foot">
                    <NavLink path="/alerts" label="Alerts" icon="bell" badge={unread} />
                    <NavLink path="/account" label="My Account" icon="key" />
                    <button type="button" className="rs-link" onClick={logout}>
                        <Icon name="logout" />
                        Log out
                    </button>
                    <div className="rs-who">
                        <div className="rs-avatar">{(user.full_name || 'U').charAt(0).toUpperCase()}</div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.full_name}</div>
                            <small>{roleName}</small>
                        </div>
                    </div>
                </div>
            </aside>

            <main className="rs-main">
                {showHeader && (
                    <div className="rs-head">
                        <div className="rs-eyebrow">{eyebrow}</div>
                        <h1 className="rs-title">{title}</h1>
                    </div>
                )}
                {children}
            </main>
        </div>
    );
}
