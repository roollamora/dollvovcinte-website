/**
 * Test suite for performance optimizations in ScrollVideoPlayer
 * Tests scroll event debouncing, throttling, and event listener management
 */

// Mock performance.now for testing
let mockTime = 0;
const originalPerformanceNow = performance.now;
performance.now = () => mockTime;

// Mock requestAnimationFrame
let rafCallbacks = [];
let rafId = 1;
const originalRAF = window.requestAnimationFrame;
window.requestAnimationFrame = (callback) => {
    const id = rafId++;
    rafCallbacks.push({ id, callback });
    return id;
};

const originalCancelRAF = window.cancelAnimationFrame;
window.cancelAnimationFrame = (id) => {
    rafCallbacks = rafCallbacks.filter(item => item.id !== id);
};

// Mock setTimeout/clearTimeout
let timeouts = [];
let timeoutId = 1;
const originalSetTimeout = setTimeout;
const originalClearTimeout = clearTimeout;
window.setTimeout = (callback, delay) => {
    const id = timeoutId++;
    timeouts.push({ id, callback, delay, createdAt: mockTime });
    return id;
};
window.clearTimeout = (id) => {
    timeouts = timeouts.filter(item => item.id !== id);
};

// Test helper to advance time and trigger timeouts
function advanceTime(ms) {
    mockTime += ms;
    
    // Trigger expired timeouts
    const expiredTimeouts = timeouts.filter(t => mockTime >= t.createdAt + t.delay);
    timeouts = timeouts.filter(t => mockTime < t.createdAt + t.delay);
    
    expiredTimeouts.forEach(t => t.callback());
}

// Test helper to trigger RAF callbacks
function triggerRAF() {
    const callbacks = [...rafCallbacks];
    rafCallbacks = [];
    callbacks.forEach(({ callback }) => callback());
}

// Mock video element
const mockVideoElement = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    currentTime: 0,
    duration: 100,
    videoWidth: 1920,
    videoHeight: 1080
};

// Mock position calculator
const mockPositionCalculator = {
    getScrollProgress: (scrollY, docHeight, viewHeight) => {
        const maxScroll = Math.max(0, docHeight - viewHeight);
        return maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;
    },
    getVideoTime: (progress, duration) => progress * duration
};

// Test suite
function runPerformanceTests() {
    console.log('Running Performance Optimization Tests...\n');
    
    let testsPassed = 0;
    let testsTotal = 0;
    
    function test(name, testFn) {
        testsTotal++;
        try {
            testFn();
            console.log(`✓ ${name}`);
            testsPassed++;
        } catch (error) {
            console.log(`✗ ${name}: ${error.message}`);
        }
    }
    
    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
    
    // Reset mocks before each test
    function resetMocks() {
        mockTime = 0;
        rafCallbacks = [];
        timeouts = [];
        rafId = 1;
        timeoutId = 1;
        mockVideoElement.currentTime = 0;
    }
    
    // Test 1: 60fps throttling
    test('Scroll events are throttled to 60fps', () => {
        resetMocks();
        
        const player = new ScrollVideoPlayer(mockVideoElement, mockPositionCalculator, null, {
            enableLogging: false
        });
        
        // Simulate video metadata loaded
        player.videoState.isMetadataLoaded = true;
        player.videoState.duration = 100;
        player.enableScrollControl();
        
        let scrollCallCount = 0;
        const originalUpdateVideo = player.updateVideoFromScroll;
        player.updateVideoFromScroll = function() {
            scrollCallCount++;
            return originalUpdateVideo.call(this);
        };
        
        // Simulate rapid scroll events (every 5ms = 200fps)
        for (let i = 0; i < 10; i++) {
            player.handleScroll({});
            advanceTime(5);
        }
        
        // Should be throttled to much fewer calls
        assert(scrollCallCount <= 3, `Expected <= 3 scroll updates, got ${scrollCallCount}`);
        
        player.destroy();
    });
    
    // Test 2: RequestAnimationFrame usage
    test('Scroll updates use requestAnimationFrame', () => {
        resetMocks();
        
        const player = new ScrollVideoPlayer(mockVideoElement, mockPositionCalculator, null, {
            enableLogging: false
        });
        
        player.videoState.isMetadataLoaded = true;
        player.videoState.duration = 100;
        player.enableScrollControl();
        
        // Trigger scroll
        player.handleScroll({});
        
        // Should have pending RAF callback
        assert(rafCallbacks.length > 0, 'Expected requestAnimationFrame to be called');
        
        // Trigger RAF
        triggerRAF();
        
        // RAF should be cleared
        assert(rafCallbacks.length === 0, 'Expected RAF callbacks to be cleared after execution');
        
        player.destroy();
    });
    
    // Test 3: Event listener management
    test('Event listeners are properly tracked and cleaned up', () => {
        resetMocks();
        
        const player = new ScrollVideoPlayer(mockVideoElement, mockPositionCalculator, null, {
            enableLogging: false
        });
        
        // Check initial state
        assert(player.eventListeners.size >= 0, 'Event listeners map should be initialized');
        
        // Add some listeners
        const mockTarget = { addEventListener: () => {}, removeEventListener: () => {} };
        const mockListener = () => {};
        
        player.addEventListener(mockTarget, 'test', mockListener);
        assert(player.eventListeners.size > 0, 'Event listener should be tracked');
        
        // Check stats
        const stats = player.getEventListenerStats();
        assert(stats.total > 0, 'Stats should show active listeners');
        
        // Remove listener
        player.removeEventListener(mockTarget, 'test', mockListener);
        
        // Destroy should clean up everything
        const initialSize = player.eventListeners.size;
        player.destroy();
        
        assert(player.eventListeners.size === 0, 'All event listeners should be cleaned up after destroy');
        assert(player.isDestroyed === true, 'Component should be marked as destroyed');
        
        // Should prevent new listeners after destroy
        player.addEventListener(mockTarget, 'test2', mockListener);
        assert(player.eventListeners.size === 0, 'Should not add listeners after destroy');
    });
    
    // Test 4: Memory leak detection
    test('Memory leak detection works correctly', () => {
        resetMocks();
        
        const player = new ScrollVideoPlayer(mockVideoElement, mockPositionCalculator, null, {
            enableLogging: false
        });
        
        // Check clean state
        let analysis = player.checkMemoryLeaks();
        assert(analysis.isDestroyed === false, 'Should not be destroyed initially');
        assert(analysis.potentialLeaks.length === 0, 'Should have no leaks initially');
        
        // Add some listeners
        const mockTarget = { addEventListener: () => {}, removeEventListener: () => {} };
        player.addEventListener(mockTarget, 'test', () => {});
        
        // Destroy but simulate incomplete cleanup
        player.isDestroyed = true;
        
        // Check for leaks
        analysis = player.checkMemoryLeaks();
        assert(analysis.potentialLeaks.length > 0, 'Should detect potential memory leaks');
        
        // Complete cleanup
        player.eventListeners.clear();
        analysis = player.checkMemoryLeaks();
        assert(analysis.activeListeners === 0, 'Should show no active listeners after cleanup');
    });
    
    // Test 5: Timeout cleanup
    test('Timeouts are properly cleaned up', () => {
        resetMocks();
        
        const player = new ScrollVideoPlayer(mockVideoElement, mockPositionCalculator, null, {
            enableLogging: false
        });
        
        player.videoState.isMetadataLoaded = true;
        player.enableScrollControl();
        
        // Trigger scroll to create throttle timeout
        player.handleScroll({});
        advanceTime(5); // Less than frame interval
        player.handleScroll({});
        
        // Should have pending timeout
        assert(timeouts.length > 0, 'Should have pending throttle timeout');
        
        // Destroy should clean up timeouts
        player.destroy();
        
        // Check that timeouts are cleared
        const analysis = player.checkMemoryLeaks();
        assert(!analysis.pendingTimeouts.scrollThrottleTimeout, 'Throttle timeout should be cleared');
        assert(!analysis.pendingTimeouts.frameRequestId, 'Frame request should be cleared');
    });
    
    // Test 6: Performance under rapid scrolling
    test('Performance remains stable under rapid scrolling', () => {
        resetMocks();
        
        const player = new ScrollVideoPlayer(mockVideoElement, mockPositionCalculator, null, {
            enableLogging: false
        });
        
        player.videoState.isMetadataLoaded = true;
        player.videoState.duration = 100;
        player.enableScrollControl();
        
        let updateCount = 0;
        const originalUpdate = player.updateVideoFromScroll;
        player.updateVideoFromScroll = function() {
            updateCount++;
            return originalUpdate.call(this);
        };
        
        const startTime = mockTime;
        
        // Simulate 1 second of rapid scrolling (every 1ms = 1000fps)
        for (let i = 0; i < 1000; i++) {
            player.handleScroll({});
            advanceTime(1);
            
            // Trigger any pending RAF callbacks periodically
            if (i % 16 === 0) { // ~60fps
                triggerRAF();
            }
        }
        
        const endTime = mockTime;
        const duration = endTime - startTime;
        
        // Should maintain reasonable update rate (not 1000 updates)
        assert(updateCount < 100, `Expected < 100 updates in ${duration}ms, got ${updateCount}`);
        assert(updateCount > 0, 'Should have some updates');
        
        player.destroy();
    });
    
    // Summary
    console.log(`\nPerformance Tests Complete: ${testsPassed}/${testsTotal} passed`);
    
    if (testsPassed === testsTotal) {
        console.log('✓ All performance optimization tests passed!');
        return true;
    } else {
        console.log('✗ Some performance tests failed');
        return false;
    }
}

// Restore original functions
function restoreMocks() {
    performance.now = originalPerformanceNow;
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCancelRAF;
    window.setTimeout = originalSetTimeout;
    window.clearTimeout = originalClearTimeout;
}

// Run tests if this file is executed directly
if (typeof module !== 'undefined' && require.main === module) {
    try {
        const success = runPerformanceTests();
        process.exit(success ? 0 : 1);
    } finally {
        restoreMocks();
    }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runPerformanceTests, restoreMocks };
}