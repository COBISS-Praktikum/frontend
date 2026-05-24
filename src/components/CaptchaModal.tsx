/// <reference types="../altcha.d.ts" />
import 'altcha';
import { useRef, useEffect } from 'react';
import { useRateLimit } from '@/context/RateLimitContext';
import './CaptchaModal.css';

function getVerificationUrl(): string {
  if (!import.meta.env.PROD) {
    return '/api/auth/verify-gateway';
  }

  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    console.error('VITE_API_URL environment variable not set.');
    return '/api/auth/verify-gateway';
  }

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

  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
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

    container.replaceChildren();

    const widget = document.createElement('altcha-widget') as HTMLElement & {
      challengeurl?: string;
      challengeUrl?: string;
    };

    widget.setAttribute('challengeurl', challengeUrl);
    widget.setAttribute('theme', 'default');
    widget.setAttribute('hidefooter', 'true');
    widget.challengeurl = challengeUrl;
    widget.challengeUrl = challengeUrl;

    const handleVerified = async (event: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = (event as any).detail?.payload;

      if (!payload) {
        console.error('No payload received from ALTCHA widget');
        alert('Verification failed: No payload. Please try again.');
        return;
      }

      try {
        console.log('Sending verification to:', verificationUrl);
        const response = await fetch(verificationUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        });

        console.log('Verification response status:', response.status);

        if (response.ok) {
          console.log('Verification successful!');
          sessionStorage.setItem('captcha_verified', 'true');
          setIsVerified(true);
          setShowCaptchaModal(false);
        } else {
          const responseText = await response.text();
          console.error('Verification failed with status:', response.status, 'Response:', responseText);
          alert('Verification failed. Please try again.');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (widget as any)?.state?.reset?.();
        }
      } catch (error) {
        console.error('Verification error:', error);
        alert('Connection error. Please try again.');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (widget as any)?.state?.reset?.();
      }
    };

    widget?.addEventListener('verified', handleVerified);
    container.appendChild(widget);

    return () => {
      widget?.removeEventListener('verified', handleVerified);
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





























