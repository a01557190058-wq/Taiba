import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AdminApp from './AdminApp.jsx';
import { AdminAuthProvider } from './lib/admin-auth.jsx';
import { AdminFeedbackProvider } from './components/admin/feedback.jsx';
import './styles/admin.css';
import './styles/admin-react.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <AdminAuthProvider>
        <AdminFeedbackProvider>
          <AdminApp />
        </AdminFeedbackProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  </StrictMode>
);
