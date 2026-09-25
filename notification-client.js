/**
 * SMMARIA NOTIFICATIONS — Universal Top Banner (No Login Required)
 *
 * Shows a full-width banner at the TOP of every page.
 * Works for ALL visitors — logged in or not.
 * Shows immediately — does NOT wait for backend to respond.
 */

(function () {
  'use strict';

  var config = window.SMMARIA_NOTIF || {};
  var API_URL = config.apiUrl || 'https://notifications-production-4281.up.railway.app';
  var SW_PATH = config.swPath || '/sw.js';

  // ── Token (optional) ─────────────────────────────────────────
  function getToken() {
    if (config.getToken && typeof config.getToken === 'function') {
      try { return config.getToken() || ''; } catch (e) { return ''; }
    }
    try {
      return (
        localStorage.getItem('smmmaria_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('smmaria_token') ||
        localStorage.getItem('access_token') ||
        ''
      );
    } catch (e) { return ''; }
  }

  // ── Feature detection ─────────────────────────────────────────
  function pushSupported() {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  // ── API helper ────────────────────────────────────────────────
  async function apiFetch(path, method, body) {
    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var opts = { method: method || 'GET', headers: headers };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(API_URL + path, opts);
    return res.json();
  }

  // ── Check local subscription ──────────────────────────────────
  async function hasLocalSubscription() {
    try {
      var reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;
      var sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch (e) { return false; }
  }

  // ── Get VAPID key ──────────────────────────────────────────────
  async function getVapidKey() {
    try {
      var r = await apiFetch('/api/config', 'GET');
      return r.vapidPublicKey || null;
    } catch (e) { return null; }
  }

  // ── Base64 to Uint8Array ───────────────────────────────────────
  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // ── Register service worker ──────────────────────────────────
  async function registerSW() {
    try {
      var reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
      return reg;
    } catch (e) { return null; }
  }

  // ── Subscribe to push ─────────────────────────────────────────
  async function subscribeToPush() {
    var reg = await registerSW();
    if (!reg) return false;
    var vapidKey = await getVapidKey();
    if (!vapidKey) return false;
    var subscription;
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
    } catch (e) { return false; }
    var device = {
      browser: getBrowserName(),
      platform: navigator.platform || 'unknown'
    };
    try {
      var r = await apiFetch('/api/subscribe', 'POST', {
        subscription: subscription, device: device
      });
      return r.success === true;
    } catch (e) { return false; }
  }

  function getBrowserName() {
    var ua = navigator.userAgent;
    if (ua.indexOf('Firefox') !== -1) return 'Firefox';
    if (ua.indexOf('Edg') !== -1) return 'Edge';
    if (ua.indexOf('Chrome') !== -1) return 'Chrome';
    if (ua.indexOf('Safari') !== -1) return 'Safari';
    return 'Unknown';
  }

  // ═══════════════════════════════════════════════════════════════
  //  BANNER — Full-width top bar
  // ═══════════════════════════════════════════════════════════════

  function createBanner() {
    // Don't create duplicates
    if (document.getElementById('smmaria-notif-banner')) return;

    // Inject CSS into the page head
    var style = document.createElement('style');
    style.textContent = `
      #smmaria-notif-banner {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100% !important;
        z-index: 2147483647 !important;
        background: #0A1530 !important;
        border-bottom: 2px solid #D4AF37 !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        box-sizing: border-box !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        transform: none !important;
      }
      #smmaria-notif-banner .sn-inner {
        max-width: 1200px !important;
        margin: 0 auto !important;
        padding: 14px 20px !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        box-sizing: border-box !important;
      }
      #smmaria-notif-banner .sn-icon {
        font-size: 20px !important;
        flex-shrink: 0 !important;
      }
      #smmaria-notif-banner .sn-text {
        flex: 1 !important;
        min-width: 0 !important;
      }
      #smmaria-notif-banner .sn-title {
        font-size: 14px !important;
        font-weight: 700 !important;
        color: #F4D068 !important;
        margin: 0 0 2px 0 !important;
        line-height: 1.3 !important;
      }
      #smmaria-notif-banner .sn-desc {
        font-size: 12px !important;
        color: rgba(245,240,225,0.7) !important;
        margin: 0 !important;
        line-height: 1.3 !important;
      }
      #smmaria-notif-banner .sn-btn {
        background: #D4AF37 !important;
        color: #0A1530 !important;
        border: none !important;
        padding: 10px 20px !important;
        font-weight: 700 !important;
        font-size: 13px !important;
        cursor: pointer !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
        font-family: inherit !important;
      }
      #smmaria-notif-banner .sn-btn:hover {
        background: #F4D068 !important;
      }
      #smmaria-notif-banner .sn-btn:disabled {
        opacity: 0.6 !important;
        cursor: default !important;
      }
      #smmaria-notif-banner .sn-close {
        background: none !important;
        border: none !important;
        color: rgba(245,240,225,0.4) !important;
        font-size: 22px !important;
        cursor: pointer !important;
        padding: 0 4px !important;
        flex-shrink: 0 !important;
        line-height: 1 !important;
        font-family: inherit !important;
      }
      #smmaria-notif-banner .sn-close:hover {
        color: #F5F0E1 !important;
      }
      @media (max-width: 600px) {
        #smmaria-notif-banner .sn-inner {
          flex-wrap: wrap !important;
          padding: 10px 14px !important;
        }
        #smmaria-notif-banner .sn-btn {
          width: 100% !important;
          margin-top: 4px !important;
          padding: 12px !important;
        }
        #smmaria-notif-banner .sn-close {
          position: absolute !important;
          top: 8px !important;
          right: 8px !important;
        }
        #smmaria-notif-banner .sn-inner {
          position: relative !important;
        }
      }
    `;
    document.head.appendChild(style);

    // Create the banner
    var banner = document.createElement('div');
    banner.id = 'smmaria-notif-banner';
    banner.innerHTML = `
      <div class="sn-inner">
        <div class="sn-icon">🔔</div>
        <div class="sn-text">
          <div class="sn-title">Stay Updated with SMMARIA</div>
          <div class="sn-desc">Get order alerts, new services, promotions and announcements.</div>
        </div>
        <button class="sn-btn" id="smmaria-notif-enable">Enable Notifications</button>
        <button class="sn-close" id="smmaria-notif-close">&times;</button>
      </div>
    `;

    // Insert at the very top of the body
    if (document.body) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      document.documentElement.appendChild(banner);
    }

    // Wire up buttons
    document.getElementById('smmaria-notif-close').addEventListener('click', function () {
      banner.remove();
      try { sessionStorage.setItem('smmaria_notif_dismissed', '1'); } catch (e) {}
    });

    document.getElementById('smmaria-notif-enable').addEventListener('click', onEnableClick);
  }

  async function onEnableClick() {
    var btn = document.getElementById('smmaria-notif-enable');
    if (!btn) return;
    btn.textContent = 'Requesting permission...';
    btn.disabled = true;

    try {
      var permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        btn.textContent = 'Permission denied';
        btn.style.background = '#FE2C55';
        btn.style.color = '#fff';
        setTimeout(function () {
          var b = document.getElementById('smmaria-notif-banner');
          if (b) b.remove();
        }, 2000);
        return;
      }

      btn.textContent = 'Subscribing...';
      var success = await subscribeToPush();

      if (success) {
        btn.textContent = '✓ Subscribed!';
        btn.style.background = '#25D366';
        btn.style.color = '#050B1F';
        setTimeout(function () {
          var b = document.getElementById('smmaria-notif-banner');
          if (b) b.remove();
        }, 1500);
      } else {
        btn.textContent = 'Failed — try again';
        btn.disabled = false;
        btn.style.background = '#FE2C55';
        btn.style.color = '#fff';
      }
    } catch (e) {
      btn.textContent = 'Error — try again';
      btn.disabled = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  INIT — Shows banner immediately, checks subscription async
  // ═══════════════════════════════════════════════════════════════

  async function init() {
    // 1. Check if push is supported
    if (!pushSupported()) return;

    // 2. Check if permission was permanently denied
    if (Notification.permission === 'denied') return;

    // 3. Check if user dismissed the banner this session
    try {
      if (sessionStorage.getItem('smmaria_notif_dismissed') === '1') return;
    } catch (e) {}

    // 4. Show banner IMMEDIATELY — don't wait for backend checks
    //    We'll remove it later if the user is already subscribed
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createBanner);
    } else {
      createBanner();
    }

    // 5. Async check — if already subscribed, remove the banner
    //    This runs in the background without blocking the banner
    (async function () {
      try {
        var localSub = await hasLocalSubscription();
        if (localSub) {
          var b = document.getElementById('smmaria-notif-banner');
          if (b) b.remove();
          return;
        }

        // If user is logged in, also check server-side
        var token = getToken();
        if (token) {
          var r = await apiFetch('/api/subscription/status', 'GET');
          if (r.success && r.subscribed === true) {
            var b2 = document.getElementById('smmaria-notif-banner');
            if (b2) b2.remove();
          }
        }
      } catch (e) {
        // Backend unavailable — keep the banner showing
      }
    })();
  }

  // ── Start — never breaks the website ──────────────────────────
  try {
    init();
  } catch (e) {}

  // ── Re-check when DOM becomes ready (for SPA navigation) ─────
  try {
    document.addEventListener('DOMContentLoaded', function () {
      if (!document.getElementById('smmaria-notif-banner')) {
        var dismissed = false;
        try { dismissed = sessionStorage.getItem('smmaria_notif_dismissed') === '1'; } catch (e) {}
        if (!dismissed && pushSupported() && Notification.permission !== 'denied') {
          hasLocalSubscription().then(function (sub) {
            if (!sub) createBanner();
          });
        }
      }
    });
  } catch (e) {}
})();
