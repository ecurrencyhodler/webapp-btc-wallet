import "core-js/actual";
import { Buffer } from 'buffer';

// Polyfill Buffer, process, and global on the window object
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
  
  // Polyfill global
  if (typeof window.global === 'undefined') {
    (window as any).global = window;
  }

  // Polyfill process
  if (typeof (window as any).process === 'undefined') {
    (window as any).process = {
      env: {},
      version: '',
      nextTick: (cb: Function) => setTimeout(cb, 0),
      browser: true,
    };
  }
}
