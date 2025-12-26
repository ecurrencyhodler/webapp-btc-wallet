import { Buffer } from 'buffer';

// Polyfill Buffer, process, and global on the window object
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
  
  // Polyfill global
  if (typeof window.global === 'undefined') {
    window.global = window as any;
  }

  // Polyfill process
  if (typeof window.process === 'undefined') {
    window.process = {
      env: {},
      version: '',
      nextTick: (cb: Function) => setTimeout(cb, 0),
      browser: true,
    } as any;
  }
}
