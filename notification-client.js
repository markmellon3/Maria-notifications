(function() {
 'use strict';
 
 // ── Configuration ──────────────────────────────────────────
 const config = window.SMMARIA_NOTIF || {};
 const API_URL = config.apiUrl || 'https://notifications-production-4281.up.railway.app';
 const SW_PATH = config.swPath || '/sw.js';
 
 // Try to get the SMMARIA auth token
 function getToken() {
  if (config.getToken && typeof config.getToken === 'function') {
   return config.getToken();
  }
  // Try common token storage locations used by SMMARIA
  try {
   return (
    localStorage.getItem('smmmaria_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('smmaria_token') ||
    ''
   );
  } catch (e) {
   return '';
  }
 }
 
 // ── Feature detection ─────────────────────────────────────
 function pushSupported() {
  return (
   'serviceWorker' in navigator &&
   'PushManager' in window &&
   'Notification' in window
  );
 }
 
 // ── API helper ────────────────────────────────────────────
 async function apiFetch(path, method, body) {
  const token = getToken();
  const headers = {
   'Content-Type': 'application/json'
  };
  if (token) {
   headers['Authorization'] = 'Bearer ' + token;
  }
  const opts = { method: method || 'GET', headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  return res.json();
 }
 
 // ── Check server-side subscription status ─────────────────
 async function isSubscribed() {
  try {
   const r = await apiFetch('/api/subscription/status', 'GET');
   return r.success && r.subscribed === true;
  } catch (e) {
   return false;
  }
 }
 
 // ── Get VAPID public key ──────────────────────────────────
 async function getVapidKey() {
  try {
   const r = await apiFetch('/api/config', 'GET');
   return r.vapidPublicKey || null;
  } catch (e) {
   return null;
  }
 }
 
 // ── Base64 URL to Uint8Array ──────────────────────────────
 function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
   outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
 }
 
 // ── Register service worker ───────────────────────────────
 async function registerSW() {
  try {
   const reg = await navigator.serviceWorker.register(SW_PATH, {
    scope: '/'
   });
   return reg;
  } catch (e) {
   console.warn('[SMMARIA-Notif] SW registration failed:', e.message);
   return null;
  }
 }
 
 // ── Subscribe to push ─────────────────────────────────────
 async function subscribeToPush() {
  const reg = await registerSW();
  if (!reg) return false;
  
  const vapidKey = await getVapidKey();
  if (!vapidKey) {
   console.warn('[SMMARIA-Notif] VAPID key not available');
   return false;
  }
  
  let subscription;
  try {
   subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey)
   });
  } catch (e) {
   console.warn('[SMMARIA-Notif] Push subscription failed:', e.message);
   return false;
  }
  
  // Send subscription to backend
  const device = {
   browser: getBrowserName(),
   platform: navigator.platform || 'unknown'
  };
  
  try {
   const r = await apiFetch('/api/subscribe', 'POST', {
    subscription: subscription,
    device: device
   });
   return r.success === true;
  } catch (e) {
   console.warn('[SMMARIA-Notif] Failed to send subscription:', e.message);
   return false;
  }
 }
 
 function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Unknown';
 }
 
 // ── Card UI ────────────────────────────────────────────────
 function createCard() {
  const card = document.createElement('div');
  card.id = 'smmaria-notif-card';
  card.style.cssText = [
   'position:fixed',
   'bottom:20px',
   'right:20px',
   'max-width:340px',
   'width:calc(100% - 40px)',
   'background:#0A1530',
   'border:1px solid #D4AF37',
   'padding:20px',
   'z-index:99998',
   'font-family:Inter,system-ui,sans-serif',
   'box-shadow:0 8px 32px rgba(0,0,0,0.4)'
  ].join(';');
  
  card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div style="font-size:16px;font-weight:700;color:#F4D068;">🔔 Stay Updated</div>
        <button id="smmaria-notif-close" style="background:none;border:none;color:rgba(245,240,225,0.4);font-size:20px;cursor:pointer;line-height:1;padding:0 4px;">&times;</button>
      </div>
      <p style="font-size:13px;color:rgba(245,240,225,0.7);line-height:1.5;margin:0 0 16px 0;">
        Get important SMMARIA updates, account alerts, order notifications and announcements.
      </p>
      <button id="smmaria-notif-enable" style="background:#D4AF37;color:#0A1530;border:none;padding:10px 20px;font-weight:700;font-size:14px;cursor:pointer;width:100%;">
        Enable Notifications
      </button>
    `;
  
  document.body.appendChild(card);
  
  document.getElementById('smmaria-notif-close').addEventListener('click', function() {
   card.remove();
  });
  
  document.getElementById('smmaria-notif-enable').addEventListener('click', onEnableClick);
  
  return card;
 }
 
 async function onEnableClick() {
  const btn = document.getElementById('smmaria-notif-enable');
  if (!btn) return;
  btn.textContent = 'Requesting permission...';
  btn.disabled = true;
  
  try {
   const permission = await Notification.requestPermission();
   
   if (permission !== 'granted') {
    btn.textContent = 'Permission denied';
    btn.style.background = '#FE2C55';
    btn.style.color = '#fff';
    setTimeout(function() {
     const card = document.getElementById('smmaria-notif-card');
     if (card) card.remove();
    }, 2000);
    return;
   }
   
   btn.textContent = 'Subscribing...';
   
   const success = await subscribeToPush();
   
   if (success) {
    btn.textContent = 'Subscribed successfully!';
    btn.style.background = '#25D366';
    btn.style.color = '#050B1F';
    setTimeout(function() {
     const card = document.getElementById('smmaria-notif-card');
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
 
 // ── Main initialization ───────────────────────────────────
 async function init() {
  // 1. Check if push is supported
  if (!pushSupported()) return;
  
  // 2. Check if user is authenticated
  const token = getToken();
  if (!token) return; // Not logged in — don't show card
  
  // 3. Check if permission was permanently denied
  if (Notification.permission === 'denied') return;
  
  // 4. Check server-side subscription status
  const subscribed = await isSubscribed();
  if (subscribed) return; // Already subscribed — don't show card
  
  // 5. Show the card
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
   document.addEventListener('DOMContentLoaded', createCard);
  } else {
   createCard();
  }
 }
 
 // ── Start ──────────────────────────────────────────────────
 // Wrap in try-catch to NEVER break the SMMARIA website
 try {
  init();
 } catch (e) {
  console.warn('[SMMARIA-Notif] Initialization error:', e.message);
 }
})();