/**
 * SMMARIA NOTIFICATIONS — Universal Client (No Login Required)
 *
 * Shows the notification card to ALL visitors — logged in or not.
 * Checks local PushSubscription first, then server-side if token exists.
 * Anonymous subscriptions are stored under anonymous_{hash} in Firebase.
 */

(function () {
  'use strict';

  var config = window.SMMARIA_NOTIF || {};
  var API_URL = config.apiUrl || 'https://notifications-production-4281.up.railway.app';
  var SW_PATH = config.swPath || '/sw.js';

  // ── Token (optional — only used if user is logged in) ──────────
  function getToken() {
    if (config.getToken && typeof config.getToken === 'function') {
      try {
        return config.getToken() || '';
      } catch (e) {
        return '';
      }
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
    } catch (e) {
      return '';
    }
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
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    var opts = { method: method || 'GET', headers: headers };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(API_URL + path, opts);
    return res.json();
  }

  // ── Check local PushSubscription ─────────────────────────────
  async function hasLocalSubscription() {
    try {
      var reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;
      var sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch (e) {
      return false;
    }
  }

  // ── Check server-side subscription (only if logged in) ──────
  async function isSubscribedServerSide() {
    var token = getToken();
    if (!token) return false; // Not logged in — skip server check
    try {
      var r = await apiFetch('/api/subscription/status', 'GET');
      return r.success && r.subscribed === true;
    } catch (e) {
      return false;
    }
  }

  // ── Get VAPID public key ──────────────────────────────────────
  async function getVapidKey() {
    try {
      var r = await apiFetch('/api/config', 'GET');
      return r.vapidPublicKey || null;
    } catch (e) {
      return null;
    }
  }

  // ── Base64 URL to Uint8Array ──────────────────────────────────
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
    } catch (e) {
      return null;
    }
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
    } catch (e) {
      return false;
    }

    var device = {
      browser: getBrowserName(),
      platform: navigator.platform || 'unknown'
    };

    try {
      var r = await apiFetch('/api/subscribe', 'POST', {
        subscription: subscription,
        device: device
      });
      return r.success === true;
    } catch (e) {
      return false;
    }
  }

  function getBrowserName() {
    var ua = navigator.userAgent;
    if (ua.indexOf('Firefox') !== -1) return 'Firefox';
    if (ua.indexOf('Edg') !== -1) return 'Edge';
    if (ua.indexOf('Chrome') !== -1) return 'Chrome';
    if (ua.indexOf('Safari') !== -1) return 'Safari';
    return 'Unknown';
  }

  // ── Card UI ───────────────────────────────────────────────────
  function createCard() {
    // Don't create duplicate cards
    if (document.getElementById('smmaria-notif-card')) return;

    var card = document.createElement('div');
    card.id = 'smmaria-notif-card';
    card.style.cssText =
      'position:fixed;bottom:20px;right:20px;max-width:340px;width:calc(100% - 40px);' +
      'background:#0A1530;border:1px solid #D4AF37;padding:20px;z-index:99998;' +
      'font-family:Inter,system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4)';

    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">' +
      '<div style="font-size:16px;font-weight:700;color:#F4D068;">🔔 Stay Updated</div>' +
      '<button id="smmaria-notif-close" style="background:none;border:none;color:rgba(245,240,225,0.4);font-size:20px;cursor:pointer;line-height:1;padding:0 4px;">&times;</button>' +
      '</div>' +
      '<p style="font-size:13px;color:rgba(245,240,225,0.7);line-height:1.5;margin:0 0 16px 0;">' +
      'Get important SMMARIA updates, account alerts, order notifications and announcements.</p>' +
      '<button id="smmaria-notif-enable" style="background:#D4AF37;color:#0A1530;border:none;padding:10px 20px;font-weight:700;font-size:14px;cursor:pointer;width:100%;">' +
      'Enable Notifications</button>';

    document.body.appendChild(card);

    document.getElementById('smmaria-notif-close').addEventListener('click', function () {
      card.remove();
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
          var card = document.getElementById('smmaria-notif-card');
          if (card) card.remove();
        }, 2000);
        return;
      }

      btn.textContent = 'Subscribing...';

      var success = await subscribeToPush();

      if (success) {
        btn.textContent = 'Subscribed successfully!';
        btn.style.background = '#25D366';
        btn.style.color = '#050B1F';
        setTimeout(function () {
          var card = document.getElementById('smmaria-notif-card');
          if (card) card.remove();
        }, 1500);
      } else {
        btn.textContent = 'Subscription failed — try again';
        btn.disabled = false;
        btn.style.background = '#FE2C55';
      }
    } catch (e) {
      btn.textContent = 'Error — try again';
      btn.disabled = false;
    }
  }

  // ── Main initialization — UNIVERSAL (no login required) ──────
  async function init() {
    // 1. Check if push is supported
    if (!pushSupported()) return;

    // 2. Check if permission was permanently denied
    if (Notification.permission === 'denied') return;

    // 3. Check local PushSubscription (works for ALL users — logged in or not)
    var localSub = await hasLocalSubscription();
    if (localSub) return; // Already subscribed on this device — hide card

    // 4. If user IS logged in, also check server-side (for cross-device sync)
    var serverSubscribed = await isSubscribedServerSide();
    if (serverSubscribed) return; // Already subscribed — hide card

    // 5. All checks passed — show the card
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createCard);
    } else {
      createCard();
    }
  }

  // ── Start — wrapped in try-catch to NEVER break the website ──
  try {
    init();
  } catch (e) {
    // Silent fail
  }
})();
