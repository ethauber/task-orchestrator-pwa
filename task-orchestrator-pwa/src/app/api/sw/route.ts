import { NextResponse } from 'next/server'

export async function GET() {
  const swContent = `
// Simple Service Worker for Task Orchestrator PWA
const CACHE_NAME = 'task-orchestrator-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Don't cache Next.js static assets - let them load normally
const STATIC_ASSETS = [
  '/_next/static/',
  '/_next/webpack-hmr',
  '/_next/on-demand-entries'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip caching for Next.js static assets and API routes
  if (STATIC_ASSETS.some(path => url.pathname.startsWith(path)) || 
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/_next/')) {
    return;
  }
  
  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(request)
      .then((response) => {
        return response || fetch(request);
      })
      .catch(() => {
        // If both cache and network fail, return a basic offline page
        if (request.destination === 'document') {
          return caches.match('/');
        }
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
`

  return new NextResponse(swContent, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
    },
  })
}
