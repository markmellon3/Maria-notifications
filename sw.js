/**
 * SMMARIA NOTIFICATIONS — Service Worker
 *
 * This file MUST be served from the SMMARIA website origin:
 *   https://smmaria.site/sw.js
 *
 * A service worker hosted on a different origin (like the
 * notification API domain) cannot control smmaria.site.
 *
 * IF an existing service worker already exists on the SMMARIA
 * website, do NOT overwrite it. Instead, merge the `push` and
 * `notificationclick` handlers below into the existing file,
 * preserving all existing caching, fetch, install, activate,
 * PWA, and offline functionality.
 *
 * Handles:
 *  - push event (parse payload, display notification)
 *  - notificationclick event (open URL, focus existing tab)
 *  - Click analytics tracking
 */

// ═══════════════════════════════════════════════════════════════
//  CONFIG — Change this to your notification backend URL
// ═══════════════════════════════════════════════════════════════
const NOTIF_API_URL = 'https://notification-api.smmaria.site';

// ═══════════════════════════════════════════════════════════════
//  PUSH EVENT
// ═══════════════════════════════════════════════════════════════

self.addEventListener('push', function(event) {
 let payload = {};
 
 try {
  if (event.data) {
   payload = event.data.json();
  }
 } catch (e) {
  // Payload might be plain text — use as body
  try {
   payload = { title: 'SMMARIA', body: event.data ? event.data.text() : '' };
  } catch (e2) {
   payload = { title: 'SMMARIA', body: 'You have a new notification' };
  }
 }
 
 const title = payload.title || 'SMMARIA';
 const body = payload.body || '';
 
 // Build notification options — only include supported fields
 const options = {
  body: body,
  requireInteraction: false,
  data: {
   url: payload.url || 'https://smmaria.site',
   notificationId: payload.notificationId || null,
   actionText: payload.actionText || null
  }
 };
 
 // Add icon if provided
 if (payload.icon) options.icon = payload.icon;
 
 // Add badge if provided
 if (payload.badge) options.badge = payload.badge;
 
 // Add image if provided (supported on Chrome, Edge, Android)
 if (payload.image) options.image = payload.image;
 
 // Add action button if provided (limited support — works on
 // Chrome/Edge desktop and Android, not on iOS Safari)
 if (payload.actionText) {
  options.actions = [
   { action: 'activate', title: payload.actionText },
   { action: 'close', title: 'Dismiss' }
  ];
 }
 
 // Add tag to prevent duplicate notifications
 if (payload.notificationId) {
  options.tag = payload.notificationId;
  options.renotify = true;
 }
 
 event.waitUntil(
  self.registration.showNotification(title, options)
 );
});

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATION CLICK EVENT
// ═══════════════════════════════════════════════════════════════

self.addEventListener('notificationclick', function(event) {
 const notif = event.notification;
 const data = notif.data || {};
 const url = data.url || 'https://smmaria.site';
 const notificationId = data.notificationId;
 const isActionClick = !!event.action && event.action !== 'close';
 
 // If the user clicked "Dismiss", just close
 if (event.action === 'close') {
  notif.close();
  return;
 }
 
 // Determine event type for analytics
 const eventType = isActionClick ? 'action_click' : 'notification_click';
 const actionName = event.action || null;
 
 // Send analytics (non-blocking, fire-and-forget)
 if (notificationId) {
  try {
   fetch(`${NOTIF_API_URL}/api/analytics/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
     notificationId: notificationId,
     event: eventType,
     action: actionName
    }),
    keepalive: true
   }).catch(function() {
    // Silently fail — analytics must not block URL opening
   });
  } catch (e) {
   // Silently fail
  }
 }
 
 // Close the notification
 notif.close();
 
 // Open or focus the SMMARIA tab
 event.waitUntil(
  (async function() {
   try {
    const allClients = await clients.matchAll({
     type: 'window',
     includeUncontrolled: true
    });
    
    // Look for an existing SMMARIA tab
    for (let i = 0; i < allClients.length; i++) {
     const client = allClients[i];
     if (client.url.includes('smmaria.site')) {
      // Focus the existing tab
      await client.focus();
      // Try to navigate it to the destination URL
      // (client.navigate only works if the client is
      // controlled by this service worker)
      if (client.navigate) {
       try {
        await client.navigate(url);
       } catch (e) {
        // If navigation fails (cross-origin etc.),
        // the focused tab remains — user can navigate manually
       }
      }
      return;
     }
    }
    
    // No existing SMMARIA tab found — open a new one
    await clients.openWindow(url);
   } catch (e) {
    // Fallback — try to open a new window
    try {
     await clients.openWindow(url);
    } catch (e2) {
     console.warn('[sw] Failed to open window:', e2.message);
    }
   }
  })()
 );
});

// ═══════════════════════════════════════════════════════════════
//  INSTALL & ACTIVATE (minimal — does not interfere with existing SW)
// ═══════════════════════════════════════════════════════════════

self.addEventListener('install', function(event) {
 // Activate immediately — don't wait for existing tabs to close
 self.skipWaiting();
});

self.addEventListener('activate', function(event) {
 // Take control of all clients immediately
 event.waitUntil(clients.claim());
});