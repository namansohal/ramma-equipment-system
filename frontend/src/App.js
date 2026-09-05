import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Stock from './pages/Stock';
import Users from './pages/Users';
import Account from './pages/Account';
import Machines from './pages/Machines';
import MachineDetail from './pages/MachineDetail';
import Downtime from './pages/Downtime';
import Mainbook from './pages/Mainbook';
import Reports from './pages/Reports';
import Audit from './pages/Audit';
import Loans from './pages/Loans';
import Staff from './pages/Staff';

function PrivateRoute({ children }) {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" />;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/mainbook" element={<PrivateRoute><Mainbook /></PrivateRoute>} />
                <Route path="/expenses" element={<PrivateRoute><Expenses /></PrivateRoute>} />
                <Route path="/stock" element={<PrivateRoute><Stock /></PrivateRoute>} />
                <Route path="/loans" element={<PrivateRoute><Loans /></PrivateRoute>} />
                <Route path="/machines" element={<PrivateRoute><Machines /></PrivateRoute>} />
                <Route path="/machines/:id" element={<PrivateRoute><MachineDetail /></PrivateRoute>} />
                <Route path="/downtime" element={<PrivateRoute><Downtime /></PrivateRoute>} />
                <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
                <Route path="/audit" element={<PrivateRoute><Audit /></PrivateRoute>} />
                <Route path="/staff" element={<PrivateRoute><Staff /></PrivateRoute>} />
                <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
                <Route path="/account" element={<PrivateRoute><Account /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </BrowserRouter>
    );
}