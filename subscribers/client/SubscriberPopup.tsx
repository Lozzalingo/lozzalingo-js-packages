'use client';

import { useState, useEffect, useCallback } from 'react';

export type SubscriberPopupProps = {
  apiBaseUrl: string;
  delay?: number;
  exitIntent?: boolean;
  scrollTrigger?: number;
  dismissDays?: number;
  brandName?: string;
  primaryColor?: string;
};

export default function SubscriberPopup({
  apiBaseUrl,
  delay = 5000,
  exitIntent = true,
  scrollTrigger = 50,
  dismissDays = 7,
  brandName = 'our newsletter',
  primaryColor = '#3b82f6',
}: SubscriberPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [formTs] = useState(() => Math.floor(Date.now() / 1000));

  const COOKIE_KEY = 'lzl_subscriber_dismissed';

  const isDismissed = useCallback(() => {
    if (typeof window === 'undefined') return true;
    const dismissed = localStorage.getItem(COOKIE_KEY);
    if (!dismissed) return false;
    const dismissedAt = parseInt(dismissed);
    const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    return daysSince < dismissDays;
  }, [dismissDays]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    localStorage.setItem(COOKIE_KEY, Date.now().toString());
  }, []);

  useEffect(() => {
    if (isDismissed()) return;

    // Delay trigger
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    // Exit intent trigger
    const handleMouseLeave = (e: MouseEvent) => {
      if (exitIntent && e.clientY < 10 && !isDismissed()) {
        setIsVisible(true);
      }
    };

    // Scroll trigger
    const handleScroll = () => {
      const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      if (scrollPercent > scrollTrigger && !isDismissed()) {
        setIsVisible(true);
      }
    };

    if (exitIntent) document.addEventListener('mouseleave', handleMouseLeave);
    if (scrollTrigger) window.addEventListener('scroll', handleScroll);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [delay, exitIntent, scrollTrigger, isDismissed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      const res = await fetch(`${apiBaseUrl}/api/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'popup', _ts: formTs }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message || 'Subscribed successfully!');
        setTimeout(dismiss, 3000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to subscribe');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={dismiss}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '420px',
          width: '90%',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          data-action="subscriber_popup_close"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#6b7280',
          }}
        >
          ✕
        </button>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: '18px', fontWeight: '600', color: '#10b981' }}>{message}</p>
          </div>
        ) : (
          <>
            <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '600' }}>
              Subscribe to {brandName}
            </h3>
            <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: '14px' }}>
              Get the latest updates delivered to your inbox.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input type="text" name="website" autoComplete="off" tabIndex={-1} style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                data-action="subscriber_popup_subscribe"
                style={{
                  padding: '10px 20px',
                  background: primaryColor,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                {status === 'loading' ? '...' : 'Subscribe'}
              </button>
            </form>
            {status === 'error' && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>{message}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
