const PositionCalculator = require('./position-calculator.js');
const { runScrollVideoPlayerTests } = require('./test-scroll-video-player.js');

// Set up global environment for tests
global.EventTarget = class EventTarget {
  constructor() { this.listeners = {}; }
  addEventListener(type, listener) { 
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }
  removeEventListener(type, listener) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l !== listener);
    }
  }
  dispatchEvent(event) {
    if (this.listeners[event.type]) {
      this.listeners[event.type].forEach(listener => listener(event));
    }
  }
};

global.Event = class Event {
  constructor(type) { this.type = type; }
};

global.CustomEvent = class CustomEvent extends global.Event {
  constructor(type, options = {}) { 
    super(type); 
    this.detail = options.detail || {};
  }
};

global.performance = { now: () => Date.now() };
global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Mock window and document
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  scrollY: 0,
  innerHeight: 600,
  innerWidth: 800
};

global.document = {
  getElementById: (id) => null,
  documentElement: {
    scrollHeight: 2000
  }
};

// Load ScrollVideoPlayer
const ScrollVideoPlayer = require('./scroll-video-player.js');
global.ScrollVideoPlayer = ScrollVideoPlayer;

// Run tests
console.log('Running ScrollVideoPlayer tests...\n');
const result = runScrollVideoPlayerTests();

if (result) {
  console.log('\n✓ All tests passed successfully!');
  process.exit(0);
} else {
  console.log('\n✗ Some tests failed');
  process.exit(1);
}