import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Airdrops from './pages/Airdrops';
import Portfolio from './pages/Portfolio';
import Alerts from './pages/Alerts';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="airdrops" element={<Airdrops />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="settings" element={<div className="p-6">Settings Page</div>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;