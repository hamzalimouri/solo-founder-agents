import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast.js';
import Layout from './components/Layout.js';
import { getToken } from './api.js';

const LoginPage = lazy(() => import('./pages/LoginPage.js'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.js'));
const ChatPage = lazy(() => import('./pages/ChatPage.js'));
const AgentsPage = lazy(() => import('./pages/AgentsPage.js'));
const DraftsPage = lazy(() => import('./pages/DraftsPage.js'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.js'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

function Loader() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0b]">
      <div className="w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <Layout>
                    <Suspense fallback={<Loader />}>
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/chat" element={<ChatPage />} />
                        <Route path="/agents" element={<AgentsPage />} />
                        <Route path="/drafts" element={<DraftsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                </RequireAuth>
              }
            />
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}
