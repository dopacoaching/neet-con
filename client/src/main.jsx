import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: { background: '#001e5f', color: '#fff', borderRadius: '12px' },
            success: { iconTheme: { primary: '#002ef4', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
