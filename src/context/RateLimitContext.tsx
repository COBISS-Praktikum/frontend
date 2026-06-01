import { createContext, useContext, useState, useCallback, useRef } from 'react';

const RATE_LIMIT_THRESHOLD = 10; // searches per minute
const TIME_WINDOW = 60000; // 1 minute in ms

interface RateLimitContextType {
  checkRateLimit: () => boolean; // returns true if under limit, false if exceeded
  recordRequest: () => void;
  isVerified: boolean;
  setIsVerified: (verified: boolean) => void;
  showCaptchaModal: boolean;
  setShowCaptchaModal: (show: boolean) => void;
}

const RateLimitContext = createContext<RateLimitContextType | undefined>(undefined);

export function RateLimitProvider({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState(() => {
    return sessionStorage.getItem('captcha_verified') === 'true';
  });

  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const requestTimestampsRef = useRef<number[]>([]);

  const checkRateLimit = useCallback(() => {
    // If already verified via CAPTCHA, allow all requests
    if (isVerified) {
      return true;
    }

    // Clean up expired timestamps
    const now = Date.now();
    requestTimestampsRef.current = requestTimestampsRef.current.filter(
      (ts) => now - ts < TIME_WINDOW
    );

    // If under threshold, allow
    if (requestTimestampsRef.current.length < RATE_LIMIT_THRESHOLD) {
      return true;
    }

    // Exceeded limit and not verified - trigger modal
    setShowCaptchaModal(true);
    return false;
  }, [isVerified]);

  const recordRequest = useCallback(() => {
    // Clean up expired timestamps
    const now = Date.now();
    requestTimestampsRef.current = requestTimestampsRef.current.filter(
      (ts) => now - ts < TIME_WINDOW
    );

    // Add current request
    requestTimestampsRef.current.push(Date.now());
  }, []);

  return (
    <RateLimitContext.Provider
      value={{
        checkRateLimit,
        recordRequest,
        isVerified,
        setIsVerified,
        showCaptchaModal,
        setShowCaptchaModal,
      }}
    >
      {children}
    </RateLimitContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useRateLimit() {
  const context = useContext(RateLimitContext);
  if (!context) {
    throw new Error('useRateLimit must be used within RateLimitProvider');
  }
  return context;
}





