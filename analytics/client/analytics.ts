/**
 * Comprehensive Analytics Utility (Shared)
 * Handles device detection, fingerprinting, session tracking, and more
 * Configurable prefix for multi-site support
 */

export interface AnalyticsConfig {
  prefix?: string; // session storage key prefix (default: "lzl")
}

const DEFAULT_PREFIX = 'lzl';

// Session ID management
export function getOrCreateSessionId(config: AnalyticsConfig = {}): string {
  if (typeof window === 'undefined') return '';
  const prefix = config.prefix || DEFAULT_PREFIX;

  const SESSION_KEY = `${prefix}_session_id`;
  const SESSION_COUNT_KEY = `${prefix}_session_page_count`;

  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
    sessionStorage.setItem(SESSION_COUNT_KEY, '0');
  }
  return sessionId;
}

export function incrementSessionPageCount(config: AnalyticsConfig = {}): number {
  if (typeof window === 'undefined') return 0;
  const prefix = config.prefix || DEFAULT_PREFIX;
  const SESSION_COUNT_KEY = `${prefix}_session_page_count`;

  const count = parseInt(sessionStorage.getItem(SESSION_COUNT_KEY) || '0', 10) + 1;
  sessionStorage.setItem(SESSION_COUNT_KEY, count.toString());
  return count;
}

export function isNewVisitor(config: AnalyticsConfig = {}): boolean {
  if (typeof window === 'undefined') return true;
  const prefix = config.prefix || DEFAULT_PREFIX;
  const VISITED_KEY = `${prefix}_visited`;

  const hasVisited = localStorage.getItem(VISITED_KEY);
  if (!hasVisited) {
    localStorage.setItem(VISITED_KEY, 'true');
    return true;
  }
  return false;
}

// Device Detection
interface DeviceInfo {
  deviceType: string;
  deviceBrand: string | null;
  deviceConfidence: number;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
}

export function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'unknown',
      deviceBrand: null,
      deviceConfidence: 0,
      browser: 'unknown',
      browserVersion: '',
      os: 'unknown',
      osVersion: '',
    };
  }

  const ua = navigator.userAgent;
  const uaLower = ua.toLowerCase();

  // Device type detection
  let deviceType = 'desktop';
  let deviceConfidence = 80;

  if (/mobile|android|iphone|ipod|blackberry|windows phone|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile';
    deviceConfidence = 95;
  } else if (/ipad|tablet|playbook|silk|kindle/i.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua))) {
    deviceType = 'tablet';
    deviceConfidence = 90;
  } else if (/smart-tv|smarttv|googletv|appletv|hbbtv|pov_tv|netcast|roku|viera|nettv|philipstv|webos/i.test(ua)) {
    deviceType = 'tv';
    deviceConfidence = 85;
  } else if (/playstation|xbox|nintendo/i.test(ua)) {
    deviceType = 'console';
    deviceConfidence = 95;
  }

  // Brand detection
  let deviceBrand: string | null = null;
  if (/iphone|ipad|ipod|macintosh/i.test(ua)) deviceBrand = 'Apple';
  else if (/samsung/i.test(ua)) deviceBrand = 'Samsung';
  else if (/huawei/i.test(ua)) deviceBrand = 'Huawei';
  else if (/xiaomi|redmi|poco/i.test(ua)) deviceBrand = 'Xiaomi';
  else if (/oneplus/i.test(ua)) deviceBrand = 'OnePlus';
  else if (/pixel/i.test(ua)) deviceBrand = 'Google';
  else if (/oppo/i.test(ua)) deviceBrand = 'OPPO';
  else if (/vivo/i.test(ua)) deviceBrand = 'Vivo';
  else if (/realme/i.test(ua)) deviceBrand = 'Realme';
  else if (/nokia/i.test(ua)) deviceBrand = 'Nokia';
  else if (/sony/i.test(ua)) deviceBrand = 'Sony';
  else if (/lg/i.test(ua)) deviceBrand = 'LG';
  else if (/htc/i.test(ua)) deviceBrand = 'HTC';
  else if (/motorola|moto/i.test(ua)) deviceBrand = 'Motorola';
  else if (/lenovo/i.test(ua)) deviceBrand = 'Lenovo';
  else if (/asus/i.test(ua)) deviceBrand = 'ASUS';

  // Browser detection - check in-app browsers first
  let browser = 'Unknown';
  let browserVersion = '';

  if (uaLower.includes('instagram')) {
    browser = 'Instagram';
    browserVersion = ua.match(/Instagram[/ ](\d+(\.\d+)?)/i)?.[1] || '';
  } else if (uaLower.includes('fbav') || uaLower.includes('fban') || (uaLower.includes('fb_iab') && uaLower.includes('fbios'))) {
    browser = 'Facebook';
    browserVersion = ua.match(/FBAV\/(\d+(\.\d+)?)/i)?.[1] || '';
  } else if (uaLower.includes('tiktok')) {
    browser = 'TikTok';
    browserVersion = ua.match(/TikTok[/ ](\d+(\.\d+)?)/i)?.[1] || '';
  } else if (uaLower.includes('snapchat')) {
    browser = 'Snapchat';
    browserVersion = ua.match(/Snapchat[/ ](\d+(\.\d+)?)/i)?.[1] || '';
  } else if (uaLower.includes('twitter') || uaLower.includes(' x/')) {
    browser = 'Twitter';
    browserVersion = '';
  } else if (uaLower.includes('linkedin')) {
    browser = 'LinkedIn';
    browserVersion = '';
  } else if (uaLower.includes('pinterest')) {
    browser = 'Pinterest';
    browserVersion = '';
  } else if (uaLower.includes('edg/')) {
    browser = 'Edge';
    browserVersion = ua.match(/Edg\/(\d+(\.\d+)?)/)?.[1] || '';
  } else if (uaLower.includes('chrome') && !uaLower.includes('edg')) {
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/(\d+(\.\d+)?)/)?.[1] || '';
  } else if (uaLower.includes('safari') && !uaLower.includes('chrome')) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/(\d+(\.\d+)?)/)?.[1] || '';
  } else if (uaLower.includes('firefox')) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/(\d+(\.\d+)?)/)?.[1] || '';
  } else if (uaLower.includes('opera') || uaLower.includes('opr/')) {
    browser = 'Opera';
    browserVersion = ua.match(/(?:Opera|OPR)\/(\d+(\.\d+)?)/)?.[1] || '';
  }

  // OS detection
  let os = 'Unknown';
  let osVersion = '';

  if (/windows nt/i.test(ua)) {
    os = 'Windows';
    const ntVersion = ua.match(/Windows NT (\d+\.\d+)/)?.[1];
    if (ntVersion === '10.0') osVersion = '10/11';
    else if (ntVersion === '6.3') osVersion = '8.1';
    else if (ntVersion === '6.2') osVersion = '8';
    else if (ntVersion === '6.1') osVersion = '7';
    else osVersion = ntVersion || '';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
    osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
    osVersion = ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (/android/i.test(ua)) {
    os = 'Android';
    osVersion = ua.match(/Android (\d+(\.\d+)?)/)?.[1] || '';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  } else if (/cros/i.test(ua)) {
    os = 'ChromeOS';
  }

  return { deviceType, deviceBrand, deviceConfidence, browser, browserVersion, os, osVersion };
}

// Bot Detection
interface BotDetection {
  isBot: boolean;
  botType: string | null;
}

export function detectBot(): BotDetection {
  if (typeof window === 'undefined') {
    return { isBot: false, botType: null };
  }

  const ua = navigator.userAgent.toLowerCase();

  const botPatterns: { pattern: RegExp; type: string }[] = [
    { pattern: /googlebot/i, type: 'googlebot' },
    { pattern: /bingbot/i, type: 'bingbot' },
    { pattern: /slurp/i, type: 'yahoo' },
    { pattern: /duckduckbot/i, type: 'duckduckgo' },
    { pattern: /baiduspider/i, type: 'baidu' },
    { pattern: /yandexbot/i, type: 'yandex' },
    { pattern: /facebookexternalhit/i, type: 'facebook' },
    { pattern: /twitterbot/i, type: 'twitter' },
    { pattern: /linkedinbot/i, type: 'linkedin' },
    { pattern: /whatsapp/i, type: 'whatsapp' },
    { pattern: /telegrambot/i, type: 'telegram' },
    { pattern: /discordbot/i, type: 'discord' },
    { pattern: /slackbot/i, type: 'slack' },
    { pattern: /pinterest/i, type: 'pinterest' },
    { pattern: /bot|crawler|spider|scraper/i, type: 'crawler' },
    { pattern: /wget|curl|python-requests|axios|node-fetch/i, type: 'http-client' },
    { pattern: /headless|phantom|selenium|puppeteer|playwright/i, type: 'automation' },
  ];

  for (const { pattern, type } of botPatterns) {
    if (pattern.test(ua)) {
      return { isBot: true, botType: type };
    }
  }

  const isHeadless = !!(
    (window as any).callPhantom ||
    (window as any)._phantom ||
    (window as any).__nightmare ||
    navigator.webdriver ||
    (navigator as any).plugins?.length === 0
  );

  if (isHeadless) {
    return { isBot: true, botType: 'headless' };
  }

  return { isBot: false, botType: null };
}

// Hardware Info
interface HardwareInfo {
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio: number;
  colorDepth: number;
  touchPoints: number;
  orientation: string;
  hardwareCores: number;
  deviceMemory: number | null;
  connectionType: string | null;
}

export function getHardwareInfo(): HardwareInfo {
  if (typeof window === 'undefined') {
    return {
      screenWidth: 0,
      screenHeight: 0,
      viewportWidth: 0,
      viewportHeight: 0,
      pixelRatio: 1,
      colorDepth: 24,
      touchPoints: 0,
      orientation: 'unknown',
      hardwareCores: 1,
      deviceMemory: null,
      connectionType: null,
    };
  }

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  return {
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
    colorDepth: screen.colorDepth,
    touchPoints: navigator.maxTouchPoints || 0,
    orientation: screen.orientation?.type?.includes('portrait') ? 'portrait' : 'landscape',
    hardwareCores: navigator.hardwareConcurrency || 1,
    deviceMemory: (navigator as any).deviceMemory || null,
    connectionType: connection?.effectiveType || null,
  };
}

// UTM Parameters
interface UTMParams {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

export function getUTMParams(): UTMParams {
  if (typeof window === 'undefined') {
    return { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
    utmContent: params.get('utm_content'),
    utmTerm: params.get('utm_term'),
  };
}

// Fingerprinting
export async function generateFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return '';

  const components: string[] = [];

  // Screen info
  components.push(`${screen.width}x${screen.height}`);
  components.push(`${screen.colorDepth}`);
  components.push(`${window.devicePixelRatio || 1}`);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Language
  components.push(navigator.language);

  // Platform
  components.push(navigator.platform);

  // Hardware
  components.push(`${navigator.hardwareConcurrency || 0}`);
  components.push(`${(navigator as any).deviceMemory || 0}`);
  components.push(`${navigator.maxTouchPoints || 0}`);

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 100, 50);
      ctx.fillStyle = '#069';
      ctx.fillText('LozzalingoAnalytics', 2, 2);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Analytics', 4, 17);
      components.push(canvas.toDataURL().slice(-50));
    }
  } catch (e) {
    components.push('canvas-error');
  }

  // WebGL fingerprint
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
      }
    }
  } catch (e) {
    components.push('webgl-error');
  }

  // Hash the components
  const data = components.join('|');
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

// Page Load Timing
export function getPageLoadTime(): number {
  if (typeof window === 'undefined' || !window.performance) return 0;

  const timing = performance.timing;
  if (timing.loadEventEnd && timing.navigationStart) {
    return timing.loadEventEnd - timing.navigationStart;
  }

  const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (entries.length > 0) {
    return Math.round(entries[0].loadEventEnd);
  }

  return 0;
}

// Referrer Categorization
export function categorizeReferrer(referrer: string): string {
  if (!referrer) return 'Direct';

  const ref = referrer.toLowerCase();

  if (/google\.|bing\.|yahoo\.|duckduckgo\.|baidu\.|yandex\.|ecosia\.|ask\./i.test(ref)) {
    return 'Organic Search';
  }

  if (/facebook\.|fb\.|instagram\.|twitter\.|x\.com|linkedin\.|pinterest\.|reddit\.|tiktok\.|youtube\.|snapchat\.|whatsapp\.|telegram\.|discord\./i.test(ref)) {
    return 'Social Media';
  }

  if (/mail\.|gmail\.|outlook\.|yahoo\.com\/mail|mailchimp\.|campaign-archive/i.test(ref)) {
    return 'Email';
  }

  if (/googleads\.|doubleclick\.|googlesyndication\.|adwords\.|adsense\.|facebook\.com\/ads|ads\.|ad\./i.test(ref)) {
    return 'Paid Ads';
  }

  if (/bbc\.|cnn\.|theguardian\.|nytimes\.|forbes\.|huffpost\.|buzzfeed\.|medium\.com/i.test(ref)) {
    return 'News/Media';
  }

  return 'Referral';
}

// Collect all analytics data
export async function collectAnalyticsData(config: AnalyticsConfig = {}) {
  const device = detectDevice();
  const bot = detectBot();
  const hardware = getHardwareInfo();
  const utm = getUTMParams();
  const sessionId = getOrCreateSessionId(config);
  const sessionPageCount = incrementSessionPageCount(config);
  const fingerprint = await generateFingerprint();
  const newVisitor = isNewVisitor(config);

  return {
    // Session
    sessionId,
    sessionPageCount,
    isNewVisitor: newVisitor,

    // Device & Browser
    userAgent: navigator.userAgent,
    deviceType: device.deviceType,
    deviceBrand: device.deviceBrand,
    deviceConfidence: device.deviceConfidence,
    browser: device.browser,
    browserVersion: device.browserVersion,
    os: device.os,
    osVersion: device.osVersion,

    // Hardware
    ...hardware,

    // Fingerprinting
    fingerprint,

    // Bot detection
    isBot: bot.isBot,
    botType: bot.botType,
    jsEnabled: true,

    // UTM
    ...utm,

    // Page
    path: window.location.pathname,
    referrer: document.referrer,
    referrerCategory: categorizeReferrer(document.referrer),

    // Timing
    pageLoadTime: getPageLoadTime(),

    // Event type
    eventType: 'page_view',
  };
}
