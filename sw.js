"use strict";

const CACHE_NAME = "menengai-jmo-pos-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/app-icon.svg",
  "./icons/app-icon-192.png",
  "./icons/app-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("menengai-jmo-pos-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok && response.type === "basic") {
            await caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", response.clone()));
          }
          return response;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(async (response) => {
        if (response.ok && response.type === "basic") {
          await caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
