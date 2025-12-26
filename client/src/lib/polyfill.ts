import { Buffer } from 'buffer';

// Polyfill Buffer and process on the window object
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
  
  if (typeof window.process === 'undefined') {
    window.process = {
      env: {},
      version: '',
      nextTick: (cb: Function) => setTimeout(cb, 0),
      browser: true,
    } as any;
  }
}
