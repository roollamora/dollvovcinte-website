/**
 * Test suite for error handling and edge cases
 * Tests Task 7 implementation: video loading errors and boundary conditions
 * 
 * Requirements: 7.3, 10.2, 10.4, 8.3, 8.4
 */

// Mock DOM environment for testing
const createMockVideoElement = (options = {}) => {
    const mockVideo = {
        src: options.src || '',
        currentTime: 0,
        duration: options.duration || 10,
        videoWidth: options.videoWidth || 1920,
        videoHeight: options.videoHeight || 1080,
        muted: false,
        preload: 'none',
        controls: true,
        autoplay: false,
        error: options.error || null,
        
        // Event handling
        eventListeners: new Map(),
        addEventListener: function(type, listener, options) {
            if (!this.eventListeners.has(type)) {
                this.eventListeners.set(type, []);
            }
            this.eventListeners.get(type).push({ listener, options });
        },
        removeEventListener: function(type, listener) {
            if (this.eventListeners.has(type)) {
                const listeners = this.eventListeners.get(type);
                const index = listeners.findIndex(l => l.listener === listener);
                if (index !== -1) {
                    listeners.splice(index, 1);
                }
            }
        },
        dispatchEvent: function(event) {
            const type = event.type;
            if (this.eventListeners.has(type)) {
                this.eventListeners.get(type).forEach(({ listener }) => {
                    try {
                        listener(event);
                    } catch (error) {
                        console.error('Event listener error:', error);
                    }
                });
            }
        },
        load: function() {
            // Simulate loading behavior
            setTimeout(() => {
                if (this.error) {
                    this.dispatchEvent({ type: 'error' });
                } else {
                    this.dispatchEvent({ type: 'loadedmetadata' });
                }
            }, 10);
        }
    };
    
    return mockVideo;
};

// Mock DOM globals
global.window = {
    scrollY: 0,
    pageYOffset: 0,
    innerHeight: 600,
    innerWidth: 800,
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.document = {
    documentElement: {
        scrollHeight: 2000,
        scrollTop: 0,
        clientHeight: 600,
        offsetHeight: 600
    },
    body: {
        scrollHeight: 2000,
        scrollTop: 0,
        clientHeight: 600,
        offsetHeight: 600,
        appendChild: () => {},
        removeChild: () => {}
    },
    getElementById: (id) => createMockVideoElement()
};

global.performance = {
    now: () => Date.now()
};

global.requestAnimationFrame = (callback) => setTimeout(callback, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Load the components
const PositionCalculator = require('./position-calculator.js');
const ScrollVideoPlayer = require('./scroll-video-player.js');

/**
 * Test Suite 1: Video Loading Error Handling
 * Tests Requirements 7.3, 10.2, 10.4
 */
function testVideoErrorHandling() {
    console.log('\n=== Testing Video Error Handling ===');
    
    const tests = [
        {
            name: 'MEDIA_ERR_NETWORK error handling',
            setup: () => {
                const mockError = { code: 2 }; // MEDIA_ERR_NETWORK
                const videoElement = createMockVideoElement({ error: mockError });
                videoElement.error = { 
                    code: 2,
                    MEDIA_ERR_NETWORK: 2,
                    MEDIA_ERR_ABORTED: 1,
                    MEDIA_ERR_DECODE: 3,
                    MEDIA_ERR_SRC_NOT_SUPPORTED: 4
                };
                return { videoElement, expectedFallback: 'retry' };
            }
        },
        {
            name: 'MEDIA_ERR_DECODE error handling',
            setup: () => {
                const videoElement = createMockVideoElement();
                videoElement.error = { 
                    code: 3,
                    MEDIA_ERR_NETWORK: 2,
                    MEDIA_ERR_ABORTED: 1,
                    MEDIA_ERR_DECODE: 3,
                    MEDIA_ERR_SRC_NOT_SUPPORTED: 4
                };
                return { videoElement, expectedFallback: 'fallback' };
            }
        },
        {
            name: 'MEDIA_ERR_SRC_NOT_SUPPORTED error handling',
            setup: () => {
                const videoElement = createMockVideoElement();
                videoElement.error = { 
                    code: 4,
                    MEDIA_ERR_NETWORK: 2,
                    MEDIA_ERR_ABORTED: 1,
                    MEDIA_ERR_DECODE: 3,
                    MEDIA_ERR_SRC_NOT_SUPPORTED: 4
                };
                return { videoElement, expectedFallback: 'fallback' };
            }
        }
    ];

    let passed = 0;
    let total = tests.length;

    tests.forEach(test => {
        try {
            console.log(`\nTesting: ${test.name}`);
            const { videoElement, expectedFallback } = test.setup();
            
            const positionCalculator = new PositionCalculator();
            
            // Create player without ResponsiveManager to avoid dependency issues in tests
            const player = new ScrollVideoPlayer(videoElement, positionCalculator, null, {
                enableLogging: false
            });

            // Simulate error event
            setTimeout(() => {
                videoElement.dispatchEvent({ type: 'error' });
                
                // Check if error state is properly set
                const videoState = player.getVideoState();
                if (videoState.hasError && videoState.errorMessage && videoState.fallbackAction === expectedFallback) {
                    console.log(`✓ ${test.name} - Error handled correctly`);
                    passed++;
                } else {
                    console.log(`✗ ${test.name} - Error not handled properly`);
                    console.log(`  Expected fallback: ${expectedFallback}, Got: ${videoState.fallbackAction}`);
                }
            }, 20);

        } catch (error) {
            console.log(`✗ ${test.name} - Exception: ${error.message}`);
        }
    });

    setTimeout(() => {
        console.log(`\nVideo Error Handling Tests: ${passed}/${total} passed`);
    }, 100);
}

/**
 * Test Suite 2: Edge Cases and Boundary Conditions
 * Tests Requirements 8.3, 8.4
 */
function testEdgeCases() {
    console.log('\n=== Testing Edge Cases and Boundary Conditions ===');
    
    const positionCalculator = new PositionCalculator();
    
    const edgeCaseTests = [
        {
            name: 'Zero document height',
            input: { scrollY: 0, documentHeight: 0, viewportHeight: 600 },
            expectedProgress: 0
        },
        {
            name: 'Document shorter than viewport',
            input: { scrollY: 0, documentHeight: 400, viewportHeight: 600 },
            expectedProgress: 0
        },
        {
            name: 'Negative scroll position',
            input: { scrollY: -100, documentHeight: 2000, viewportHeight: 600 },
            expectedProgress: 0
        },
        {
            name: 'Scroll position exceeds maximum',
            input: { scrollY: 2000, documentHeight: 2000, viewportHeight: 600 },
            expectedProgress: 1
        },
        {
            name: 'Invalid numeric inputs (NaN)',
            input: { scrollY: NaN, documentHeight: NaN, viewportHeight: NaN },
            expectedProgress: 0
        },
        {
            name: 'Infinite values',
            input: { scrollY: Infinity, documentHeight: Infinity, viewportHeight: 600 },
            expectedProgress: 0
        },
        {
            name: 'Very large document height',
            input: { scrollY: 1000000, documentHeight: Number.MAX_SAFE_INTEGER, viewportHeight: 600 },
            expectedProgress: 0 // Should be very close to 0
        },
        {
            name: 'Floating point precision at boundaries',
            input: { scrollY: 1400, documentHeight: 2000, viewportHeight: 600 },
            expectedProgress: 1 // 1400 / (2000-600) = 1.0
        }
    ];

    let passed = 0;
    let total = edgeCaseTests.length;

    edgeCaseTests.forEach(test => {
        try {
            console.log(`\nTesting: ${test.name}`);
            const { scrollY, documentHeight, viewportHeight } = test.input;
            const progress = positionCalculator.getScrollProgress(scrollY, documentHeight, viewportHeight);
            
            // Check if progress is within valid bounds
            const isValidProgress = typeof progress === 'number' && 
                                  isFinite(progress) && 
                                  progress >= 0 && 
                                  progress <= 1;
            
            if (isValidProgress) {
                // For boundary tests, check if we get expected values
                if (test.expectedProgress !== undefined) {
                    const tolerance = 0.001;
                    if (Math.abs(progress - test.expectedProgress) <= tolerance) {
                        console.log(`✓ ${test.name} - Progress: ${progress.toFixed(3)} (expected: ${test.expectedProgress})`);
                        passed++;
                    } else {
                        console.log(`✗ ${test.name} - Progress: ${progress.toFixed(3)} (expected: ${test.expectedProgress})`);
                    }
                } else {
                    console.log(`✓ ${test.name} - Valid progress: ${progress.toFixed(3)}`);
                    passed++;
                }
            } else {
                console.log(`✗ ${test.name} - Invalid progress: ${progress}`);
            }
            
        } catch (error) {
            console.log(`✗ ${test.name} - Exception: ${error.message}`);
        }
    });

    console.log(`\nEdge Case Tests: ${passed}/${total} passed`);
}

/**
 * Test Suite 3: Video Time Calculation Edge Cases
 * Tests Requirements 8.3, 8.4
 */
function testVideoTimeEdgeCases() {
    console.log('\n=== Testing Video Time Calculation Edge Cases ===');
    
    const positionCalculator = new PositionCalculator();
    
    const videoTimeTests = [
        {
            name: 'Zero video duration',
            input: { progress: 0.5, videoDuration: 0 },
            expectedTime: 0
        },
        {
            name: 'Negative video duration',
            input: { progress: 0.5, videoDuration: -10 },
            expectedTime: 0
        },
        {
            name: 'Invalid progress (NaN)',
            input: { progress: NaN, videoDuration: 10 },
            expectedTime: 0
        },
        {
            name: 'Progress exceeds bounds (>1)',
            input: { progress: 1.5, videoDuration: 10 },
            expectedTime: 10 // Should be clamped to duration
        },
        {
            name: 'Progress below bounds (<0)',
            input: { progress: -0.5, videoDuration: 10 },
            expectedTime: 0 // Should be clamped to 0
        },
        {
            name: 'Very large video duration',
            input: { progress: 0.5, videoDuration: Number.MAX_SAFE_INTEGER / 1000 },
            expectedTime: (Number.MAX_SAFE_INTEGER / 1000) * 0.5
        },
        {
            name: 'Floating point precision at end',
            input: { progress: 1.0, videoDuration: 10 },
            expectedTime: 10
        },
        {
            name: 'Floating point precision at start',
            input: { progress: 0.0, videoDuration: 10 },
            expectedTime: 0
        }
    ];

    let passed = 0;
    let total = videoTimeTests.length;

    videoTimeTests.forEach(test => {
        try {
            console.log(`\nTesting: ${test.name}`);
            const { progress, videoDuration } = test.input;
            const videoTime = positionCalculator.getVideoTime(progress, videoDuration);
            
            // Check if video time is within valid bounds
            const maxDuration = Math.max(videoDuration, 0);
            const isValidTime = typeof videoTime === 'number' && 
                              isFinite(videoTime) && 
                              videoTime >= 0 && 
                              videoTime <= maxDuration;
            
            if (isValidTime) {
                const tolerance = 0.001;
                if (Math.abs(videoTime - test.expectedTime) <= tolerance) {
                    console.log(`✓ ${test.name} - Video time: ${videoTime.toFixed(3)} (expected: ${test.expectedTime})`);
                    passed++;
                } else {
                    console.log(`✗ ${test.name} - Video time: ${videoTime.toFixed(3)} (expected: ${test.expectedTime})`);
                }
            } else {
                console.log(`✗ ${test.name} - Invalid video time: ${videoTime}`);
            }
            
        } catch (error) {
            console.log(`✗ ${test.name} - Exception: ${error.message}`);
        }
    });

    console.log(`\nVideo Time Edge Case Tests: ${passed}/${total} passed`);
}

/**
 * Test Suite 4: Document Height Calculation Fallbacks
 * Tests Requirements 8.3, 8.4
 */
function testDocumentHeightFallbacks() {
    console.log('\n=== Testing Document Height Calculation Fallbacks ===');
    
    const positionCalculator = new PositionCalculator();
    
    // Test enhanced methods if available
    if (typeof positionCalculator.getDocumentHeight === 'function') {
        try {
            const height = positionCalculator.getDocumentHeight();
            if (typeof height === 'number' && height > 0 && isFinite(height)) {
                console.log(`✓ Document height calculation: ${height}px`);
            } else {
                console.log(`✗ Invalid document height: ${height}`);
            }
        } catch (error) {
            console.log(`✗ Document height calculation failed: ${error.message}`);
        }
    }

    if (typeof positionCalculator.getViewportHeight === 'function') {
        try {
            const height = positionCalculator.getViewportHeight();
            if (typeof height === 'number' && height > 0 && isFinite(height)) {
                console.log(`✓ Viewport height calculation: ${height}px`);
            } else {
                console.log(`✗ Invalid viewport height: ${height}`);
            }
        } catch (error) {
            console.log(`✗ Viewport height calculation failed: ${error.message}`);
        }
    }

    if (typeof positionCalculator.getCurrentScrollPosition === 'function') {
        try {
            const scrollY = positionCalculator.getCurrentScrollPosition();
            if (typeof scrollY === 'number' && scrollY >= 0 && isFinite(scrollY)) {
                console.log(`✓ Scroll position calculation: ${scrollY}px`);
            } else {
                console.log(`✗ Invalid scroll position: ${scrollY}`);
            }
        } catch (error) {
            console.log(`✗ Scroll position calculation failed: ${error.message}`);
        }
    }
}

/**
 * Run all tests
 */
function runAllTests() {
    console.log('Starting Error Handling and Edge Case Tests...');
    console.log('='.repeat(50));
    
    testVideoErrorHandling();
    
    setTimeout(() => {
        testEdgeCases();
        testVideoTimeEdgeCases();
        testDocumentHeightFallbacks();
        
        console.log('\n' + '='.repeat(50));
        console.log('All tests completed!');
    }, 200);
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    testVideoErrorHandling,
    testEdgeCases,
    testVideoTimeEdgeCases,
    testDocumentHeightFallbacks,
    runAllTests
};