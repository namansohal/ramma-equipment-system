import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses  from './pages/Expenses';
import Stock     from './pages/Stock';

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
                <Route path="/expenses"  element={<PrivateRoute><Expenses /></PrivateRoute>} />
                <Route path="/stock"     element={<PrivateRoute><Stock /></PrivateRoute>} />
                <Route path="*"          element={<Navigate to="/login" />} />
            </Routes>
        </BrowserRouter>
    );
}