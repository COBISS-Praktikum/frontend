/// <reference types="../altcha.d.ts" />
import 'altcha';
import { useRef, useEffect } from 'react';
import { useRateLimit } from '@/context/RateLimitContext';
import './CaptchaModal.css';


const apiUrl = import.meta.env.VITE_API_URL;
const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
function getVerificationUrl(): string {
  if (!import.meta.env.PROD) {
    return '/api/auth/verify-gateway';
  }

  if (!apiUrl) {
    console.error('VITE_API_URL environment variable not set.');
    return '/api/auth/verify-gateway'; }

  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  return `${baseUrl}/api/auth/verify-gateway`;
}

function getChallengeUrl(): string {
  if (!import.meta.env.PROD) {
    return '/api/auth/captcha-challenge';
  }

  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    console.error('VITE_API_URL environment variable not set.');
    return '/api/auth/captcha-challenge';
  }

  return `${baseUrl}/api/auth/captcha-challenge`;
}

export function CaptchaModal() {
  const { showCaptchaModal, setShowCaptchaModal, setIsVerified } = useRateLimit();
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const verificationUrl = getVerificationUrl();
  const challengeUrl = getChallengeUrl();

  useEffect(() => {
    if (showCaptchaModal) {
      console.log('CAPTCHA modal opened. Challenge URL:', challengeUrl);
    }
  }, [showCaptchaModal, challengeUrl]);

useEffect(() => {
  if (!showCaptchaModal) return;

  const container = widgetContainerRef.current;
  if (!container) return;

const setupWidget = async () => {
  const res = await fetch(challengeUrl);
  const challenge = await res.json();

  container.innerHTML = `<altcha-widget 
    challenge='${JSON.stringify(challenge)}'
    hidefooter="true"
  ></altcha-widget>`;

  const widget = container.querySelector('altcha-widget') as any;

  // verifyFunction must return true/false — widget waits for the promise
  widget.verifyFunction = async (payload: string) => {
    try {
      const response = await fetch(verificationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  widget.addEventListener('verified', (event: Event) => {
      sessionStorage.setItem('captcha_verified', 'true');
      setIsVerified(true);
      setTimeout(() => setShowCaptchaModal(false), 1500);
  });
};

  setupWidget();

  return () => {
    container.replaceChildren();
  };
}, [showCaptchaModal, challengeUrl, verificationUrl, setIsVerified, setShowCaptchaModal]);

  if (!showCaptchaModal) return null;

  return (
    <div className="captcha-overlay">
      <div className="captcha-modal">
        <h2>Security Verification</h2>
        <p>You're making requests too quickly. Please verify you're human to continue.</p>

        <div ref={widgetContainerRef} />
      </div>
    </div>
  );
}





























