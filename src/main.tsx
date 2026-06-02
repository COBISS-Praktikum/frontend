import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './config/i18n.ts'
import App from './App.tsx'
import { ApolloProvider } from "@apollo/client/react";
import client from './config/apollo-client.ts';
import { BrowserRouter as Router } from 'react-router-dom';
import { RateLimitProvider } from './context/RateLimitContext.tsx';
import { CaptchaModal } from './components/CaptchaModal.tsx';
import { HelmetProvider } from 'react-helmet-async';
import { Auth0Provider } from '@auth0/auth0-react'; // 1. Import Auth0

// Get env values safely
const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HelmetProvider>
        <ApolloProvider client={client}>
          {/* 2. Wrap everything inside Apollo with Auth0Provider */}
          <Auth0Provider
              domain={domain}
              clientId={clientId}
              authorizationParams={{
                redirect_uri: window.location.origin + '/frontend/',
                audience: audience,
              }}
              cacheLocation="localstorage"
          >
            <Router>
              <RateLimitProvider>
                <App />
                <CaptchaModal />
              </RateLimitProvider>
            </Router>
          </Auth0Provider>
        </ApolloProvider>
      </HelmetProvider>
    </StrictMode>,
)