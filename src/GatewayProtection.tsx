import React, { useState, useEffect, useRef } from 'react';
import 'altcha';

export function GatewayProtection({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState(() => {
    return sessionStorage.getItem('page_verified') === 'true';
  });

  const widgetRef = useRef<HTMLElement>(null);
  
  // 1. Define this at the component level so both the useEffect AND the JSX can read it
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080'; 

  useEffect(() => {
    if (isVerified) return;

    const widget = widgetRef.current;

    const handleVerified = async (event: any) => {
      const payload = event.detail.payload;

      // This part is perfect!
      const response = await fetch(`${apiUrl}api/auth/verify-gateway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });

      if (response.ok) {
        sessionStorage.setItem('page_verified', 'true');
        setIsVerified(true);
      } else {
        alert('Verification failed. Reloading challenge...');
        (widget as any)?.state?.reset(); 
      }
    };

    widget?.addEventListener('verified', handleVerified);
    return () => widget?.removeEventListener('verified', handleVerified);
  }, [isVerified, apiUrl]);

  if (isVerified) {
    return <>{children}</>;
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2>Security Check</h2>
        <p>Please wait a moment while we verify your connection.</p>
         
        {/* 2. Update the challengeurl prop here using template literals */}
        <altcha-widget
          ref={widgetRef as any}
          challengeurl={`${apiUrl}/api/auth/captcha-challenge`}
          theme="default"
          style={{ margin: '20px 0' }}
        ></altcha-widget>
      </div>
    </div>
  );
}

// Minimal inline styling for the gateway layout
const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
  backgroundColor: '#f3f4f6', display: 'flex', justifyContent: 'center', alignItems: 'center',
  zIndex: 9999
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff', padding: '30px', borderRadius: '8px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', textAlign: 'center', maxWidth: '400px'
};
