import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './config/i18n.ts';
import App from './App.tsx'
import { ApolloProvider } from "@apollo/client/react";
import client from './config/apollo-client.ts';
import { BrowserRouter as Router } from 'react-router-dom';
import { RateLimitProvider } from './context/RateLimitContext.tsx';
import { CaptchaModal } from './components/CaptchaModal.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <Router>
        <RateLimitProvider>
          <App />
          <CaptchaModal />
        </RateLimitProvider>
      </Router>
    </ApolloProvider>
  </StrictMode>,
)
