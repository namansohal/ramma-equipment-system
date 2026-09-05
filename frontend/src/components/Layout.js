import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { colors } from './ui';

export default function Layout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'owner' || user.role === 'manager';

    const logout = () => {
        localStorage.clear();   
        navigate('/login');
    };

    const navItems = [
        { path: '/dashboard', label: 'Dashboard', icon: '▦' },
        { path: '/expenses', label: 'Expenses', icon: '₵' },
        { path: '/stock', label: 'Spare Parts', icon: '⚙' },
        { path: '/machines', label: 'Machines', icon: '⬢' },
        { path: '/downtime', label: 'Downtime', icon: '◔' },
    ];
    if (isAdmin) {
        navItems.push({ path: '/users', label: 'Employees', icon: '◈' });
    }

    return (
        <div style={styles.shell}>
            <aside style={styles.sidebar}>
                <div style={styles.brand}>
                    <img src="/logo_r.jpeg" alt="Ramma" style={styles.logoImg} />
                    <div>
                        <div style={styles.brandName}>Ramma</div>
                        <div style={styles.brandSub}>Equipment Co.</div>
                    </div>
                </div>
                <nav style={styles.nav}>
                    {navItems.map(item => {
                        const active = location.pathname === item.path;
                        return (
                            <div
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                style={active ? styles.navItemActive : styles.navItem}
                            >
                                <span style={styles.navIcon}>{item.icon}</span>
                                {item.label}
                            </div>
                        );
                    })}
                </nav>
                <div style={styles.sidebarFooter}>
                    <div onClick={() => navigate('/change-password')} style={styles.navItem}>
                        <span style={styles.navIcon}>⚿</span>
                        Password
                    </div>
                </div>
            </aside>

            <div style={styles.main}>
                <header style={styles.topbar}>
                    <div style={styles.pageTitle}>
                        {navItems.find(n => n.path === location.pathname)?.label ||
                         (location.pathname === '/change-password' ? 'Change Password' : '')}
                    </div>
                    <div style={styles.userArea}>
                        <div style={styles.userDetails}>
                            <div style={styles.userName}>{user.full_name}</div>
                            <div style={styles.userRole}>{user.role}</div>
                        </div>
                        <div style={styles.avatar}>
                            {(user.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <button onClick={logout} style={styles.logout}>Logout</button>
                    </div>
                </header>
                <div style={styles.content}>
                    {children}
                </div>
            </div>
        </div>
    );
}

const styles = {
    shell: { display: 'flex', minHeight: '100vh', backgroundColor: colors.page, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    sidebar: { width: '210px', backgroundColor: '#fff', borderRight: `0.5px solid ${colors.border}`, display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', left: 0, top: 0 },
    brand: { display: 'flex', alignItems: 'center', gap: '11px', padding: '18px 20px 16px' },
    logoImg: { width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' },
    brandName: { color: colors.ink, fontWeight: '500', fontSize: '16px', letterSpacing: '-0.3px', lineHeight: '1.2' },
    brandSub: { color: colors.muted, fontSize: '11px' },
    nav: { padding: '4px 14px', flex: 1 },
    navItem: { display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 12px', color: colors.inkSoft, borderRadius: '8px', cursor: 'pointer', marginBottom: '2px', fontSize: '13px', fontWeight: '400' },
    navItemActive: { display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 9px', color: colors.ink, backgroundColor: '#f5f3f0', borderRadius: '8px', cursor: 'pointer', marginBottom: '2px', fontSize: '13px', fontWeight: '500', borderLeft: `3px solid ${colors.accent}` },
    navIcon: { fontSize: '15px', width: '18px', textAlign: 'center' },
    sidebarFooter: { padding: '14px', borderTop: `0.5px solid ${colors.border}` },
    main: { flex: 1, marginLeft: '210px', display: 'flex', flexDirection: 'column' },
    topbar: { height: '60px', backgroundColor: '#fff', borderBottom: `0.5px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', position: 'sticky', top: 0, zIndex: 10 },
    pageTitle: { fontSize: '17px', fontWeight: '500', color: colors.ink },
    userArea: { display: 'flex', alignItems: 'center', gap: '14px' },
    userDetails: { textAlign: 'right' },
    userName: { fontSize: '13px', fontWeight: '500', color: colors.ink },
    userRole: { fontSize: '11px', color: colors.muted, textTransform: 'capitalize' },
    avatar: { width: '34px', height: '34px', backgroundColor: colors.accent, color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', fontSize: '14px' },
    logout: { padding: '7px 14px', backgroundColor: '#fff', color: colors.inkSoft, border: `0.5px solid ${colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
    content: { padding: '28px 32px', flex: 1 },
};