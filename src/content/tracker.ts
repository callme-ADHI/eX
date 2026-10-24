/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX1 Security Extension Panel
 *  Copyright (c) Aevoarx. All rights reserved.
 *  
 *  Brand: Aevoarx
 *  Product: eX1 Suite
 *  Website: https://aevoarx.com
 *  
 *  This software contains proprietary designs and cyber intelligence engines
 *  developed by Aevoarx. Unauthorized copying, modification, or distribution
 *  of this file, via any medium, is strictly prohibited.
 * ─────────────────────────────────────────────────────────────────────────────
 */

(() => {
  let cameraCount = 0;
  let micCount = 0;
  let fetchCount = 0;

  const reportAccess = () => {
    window.dispatchEvent(new CustomEvent('ex1:api_access', {
      detail: { cameraCount, micCount, fetchCount }
    }));
  };

  // Intercept getUserMedia
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      if (constraints) {
        if (constraints.video) cameraCount++;
        if (constraints.audio) micCount++;
        reportAccess();
      }
      return origGetUserMedia(constraints);
    };
  }

  // Intercept fetch
  if (window.fetch) {
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
      fetchCount++;
      reportAccess();
      return origFetch.apply(this, args);
    };
  }

  // Intercept XHR
  if (window.XMLHttpRequest) {
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      fetchCount++;
      reportAccess();
      return (origOpen as any).apply(this, [method, url, ...args]);
    };
  }
})();
