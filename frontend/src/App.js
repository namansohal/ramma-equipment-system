import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Stock from './pages/Stock';
import Users from './pages/Users';
import ChangePassword from './pages/ChangePassword';
import Machines from './pages/Machines';
import MachineDetail from './pages/MachineDetail';
import Downtime from './pages/Downtime';

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
                <Route path="/expenses" element={<PrivateRoute><Expenses /></PrivateRoute>} />
                <Route path="/stock" element={<PrivateRoute><Stock /></PrivateRoute>} />
                <Route path="/machines" element={<PrivateRoute><Machines /></PrivateRoute>} />
                <Route path="/machines/:id" element={<PrivateRoute><MachineDetail /></PrivateRoute>} />
                <Route path="/downtime" element={<PrivateRoute><Downtime /></PrivateRoute>} />
                <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
                <Route path="/change-password" element={<PrivateRoute><ChangePassword /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </BrowserRouter>
    );
}