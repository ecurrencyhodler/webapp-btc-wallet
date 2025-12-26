import { Buffer } from 'buffer';

// Polyfill Buffer on the window object
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}
