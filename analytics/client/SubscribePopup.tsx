'use client';

import { useState, useEffect, useCallback } from 'react';

export type SubscribePopupProps = {
  apiBaseUrl: string;
  delayMs?: number;       // Time before showing popup (default: 30s)
  exitIntent?: boolean;   // Show on mouse leave (default: true)
  scrollTrigger?: number; // Show at scroll % (default: 50, 0 to disable)
  dismissDays?: number;   // Days to remember dismissal (default: 7)
  storageKey?: string;    // localStorage key (default: "lzl_popup_dismissed")
  excludePaths?: string[]; // Paths where popup should not appear (e.g. ["/sign-up", "/unsubscribe"])
  heading?: string;
  buttonText?: string;
  brandColor?: string;
  marketingLabel?: string;
  termsUrl?: string;
  privacyUrl?: string;
};

type FormState = {
  email: string;
  firstName: string;
  lastName: string;
  marketingOptIn: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

export default function SubscribePopup({
  apiBaseUrl,
  delayMs = 30000,
  exitIntent = true,
  scrollTrigger = 50,
  dismissDays = 7,
  storageKey = 'lzl_popup_dismissed',
  excludePaths = [],
  heading = 'Sign Up',
  buttonText = 'Sign Up',
  brandColor = '#7c3aed',
  marketingLabel = 'I want to hear about updates and offers',
  termsUrl = '/terms',
  privacyUrl = '/privacy',
}: SubscribePopupProps) {
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState<FormState>({
    email: '',
    firstName: '',
    lastName: '',
    marketingOptIn: false,
    termsAccepted: false,
    privacyAccepted: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [formTs] = useState(() => Math.floor(Date.now() / 1000));

  const isDismissed = useCallback(() => {
    if (typeof window === 'undefined') return true;
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) return false;
    const dismissedAt = parseInt(dismissed, 10);
    const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    return daysSince < dismissDays;
  }, [dismissDays, storageKey]);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(storageKey, String(Date.now()));
  }, [storageKey]);

  // Hide on excluded paths (e.g. sign-up, unsubscribe)
  const isExcluded = typeof window !== 'undefined' &&
    excludePaths.some((p) => window.location.pathname.startsWith(p));

  useEffect(() => {
    if (isDismissed() || isExcluded) return;

    // Delay trigger
    const timer = setTimeout(() => {
      if (!isDismissed()) setVisible(true);
    }, delayMs);

    // Exit intent trigger
    const handleMouseLeave = (e: MouseEvent) => {
      if (exitIntent && e.clientY < 10 && !isDismissed()) {
        setVisible(true);
      }
    };

    // Scroll trigger
    const handleScroll = () => {
      if (!scrollTrigger) return;
      const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      if (scrollPercent > scrollTrigger && !isDismissed()) {
        setVisible(true);
      }
    };

    if (exitIntent) document.addEventListener('mouseleave', handleMouseLeave);
    if (scrollTrigger) window.addEventListener('scroll', handleScroll);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [delayMs, exitIntent, scrollTrigger, isDismissed]);

  const handleFormChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: Record<string, string> = {};
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!form.marketingOptIn) newErrors.marketingOptIn = 'This is required';
    if (!form.termsAccepted) newErrors.termsAccepted = 'You must agree to the terms';
    if (!form.privacyAccepted) newErrors.privacyAccepted = 'You must agree to the privacy policy';

    if (Object.keys(newErrors).length > 0) {
      console.error('[SubscribePopup] Validation failed:', newErrors);
      setErrors(newErrors);
      return;
    }

    console.log('[SubscribePopup] Submitting sign-up for:', form.email);
    setStatus('loading');
    try {
      const res = await fetch(`${apiBaseUrl}/api/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          marketingOptIn: form.marketingOptIn,
          source: 'popup',
          sourcePath: typeof window !== 'undefined' ? window.location.pathname : null,
          _ts: formTs,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        console.log('[SubscribePopup] Sign-up success:', data.message);
        setStatus('success');
        setMessage(data.message || 'You are in!');
        localStorage.setItem(storageKey, String(Date.now()));
        setTimeout(() => setVisible(false), 3000);
      } else {
        console.error('[SubscribePopup] Sign-up error:', data.error);
        setStatus('error');
        setMessage(data.error || 'Something went wrong');
      }
    } catch (err) {
      console.error('[SubscribePopup] Network error:', err);
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="relative bg-white shadow-2xl rounded-xl max-w-lg w-full p-8 border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="Close"
          data-action="popup_dismiss"
        >
          &times;
        </button>

        {status === 'success' ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-3">&#10003;</div>
            <p className="text-lg font-semibold">{message}</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              {heading}
            </h2>

            {(status === 'error' && message) && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Anti-spam honeypot */}
              <input
                type="text"
                name="website"
                autoComplete="off"
                tabIndex={-1}
                className="absolute -left-[9999px] opacity-0 h-0 w-0"
              />

              <div>
                <label htmlFor="popup-email" className="block text-sm font-medium text-gray-900 mb-1">
                  Email Address
                </label>
                <input
                  id="popup-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-opacity-20 outline-none transition text-gray-900"
                  style={{ ['--tw-ring-color' as string]: brandColor, borderColor: errors.email ? '#dc2626' : undefined }}
                  placeholder="you@example.com"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="popup-firstName" className="block text-sm font-medium text-gray-900 mb-1">
                    First Name
                  </label>
                  <input
                    id="popup-firstName"
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => handleFormChange('firstName', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-opacity-20 outline-none transition text-gray-900"
                    style={{ ['--tw-ring-color' as string]: brandColor, borderColor: errors.firstName ? '#dc2626' : undefined }}
                    placeholder="Jane"
                  />
                  {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label htmlFor="popup-lastName" className="block text-sm font-medium text-gray-900 mb-1">
                    Last Name
                  </label>
                  <input
                    id="popup-lastName"
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => handleFormChange('lastName', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-opacity-20 outline-none transition text-gray-900"
                    style={{ ['--tw-ring-color' as string]: brandColor, borderColor: errors.lastName ? '#dc2626' : undefined }}
                    placeholder="Smith"
                  />
                  {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2.5 pt-1">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.marketingOptIn}
                    onChange={(e) => handleFormChange('marketingOptIn', e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded"
                    style={{ accentColor: brandColor }}
                  />
                  <span className="text-sm text-gray-600">{marketingLabel}</span>
                </label>
                {errors.marketingOptIn && <p className="text-red-500 text-sm ml-7">{errors.marketingOptIn}</p>}

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.termsAccepted}
                    onChange={(e) => handleFormChange('termsAccepted', e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded"
                    style={{ accentColor: brandColor }}
                  />
                  <span className="text-sm text-gray-600">
                    I agree to the{' '}
                    <a href={termsUrl} className="underline hover:no-underline" style={{ color: brandColor }} data-action="popup_terms_link">
                      terms and conditions
                    </a>
                  </span>
                </label>
                {errors.termsAccepted && <p className="text-red-500 text-sm ml-7">{errors.termsAccepted}</p>}

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.privacyAccepted}
                    onChange={(e) => handleFormChange('privacyAccepted', e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded"
                    style={{ accentColor: brandColor }}
                  />
                  <span className="text-sm text-gray-600">
                    I agree to the{' '}
                    <a href={privacyUrl} className="underline hover:no-underline" style={{ color: brandColor }} data-action="popup_privacy_link">
                      privacy policy
                    </a>
                  </span>
                </label>
                {errors.privacyAccepted && <p className="text-red-500 text-sm ml-7">{errors.privacyAccepted}</p>}
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                data-action="popup_signup_submit"
                name="popup_signup_submit"
                className="w-full py-3.5 text-base font-bold text-white rounded-xl transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                style={{ backgroundColor: brandColor }}
              >
                {status === 'loading' ? 'Signing up...' : buttonText}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
