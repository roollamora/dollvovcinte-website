/**
 * Integration test for the scroll-controlled video player
 * Simulates browser environment and tests the complete functionality
 */

// Import components
const PositionCalculator = require('./position-calculator.js');

// Mock DOM environment
global.window = {
    scrollY: 0,
    innerHeight: 1000,
    addEventListener: function() {},
    removeEventListener: function() {}
};

global.document = {
    documentElement: {
        scrollHeight: 3000
    },
    getElementById: function(id) {
        return new MockVideoElement();
    }
};

global.performance = {
    now: function() { return Date.now(); }
};

global.requestAnimationFrame = function(callback) {
    return setTimeout(callback, 16);
};

global.cancelAnimationFrame = function(id) {
    clearTimeout(id);
};

global.CustomEvent = function(type, options) {
    this.type = type;
    this.detail = options ? options.detail : {};
};

// Mock video element
class MockVideoElement {
    constructor() {
        this.id = 'video-player';
        this.duration = 60; // 1 minute video
        this.currentTime = 0;
        this.videoWidth = 1920;
        this.videoHeight = 1080;
        this.muted = false;
        this.preload = 'none';
        this.controls = true;
        this.autoplay = false;
        this.error = null;
        this.style = {};
        this.eventListeners = new Map();
    }

    addEventListener(type, listener, options) {
        if (!this.eventListeners.has(type)) {
            this.eventListeners.set(type, []);
        }
        this.eventListeners.get(type).push({ listener, options });
    }

    removeEventListener(type, listener) {
        if (this.eventListeners.has(type)) {
            const listeners = this.eventListeners.get(type);
            const index = listeners.findIndex(l => l.listener === listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    dispatchEvent(event) {
        if (this.eventListeners.has(event.type)) {
            const listeners = this.eventListeners.get(event.type);
            listeners.forEach(({ listener }) => {
                try {
                    listener(event);
                } catch (error) {
                    console.error('Event listener error:', error);
                }
            });
        }
    }

    // Simulate metadata loading
    simulateMetadataLoaded() {
        setTimeout(() => {
            const event = { type: 'loadedmetadata' };
            this.dispatchEvent(event);
        }, 10);
    }
}

// Import ScrollVideoPlayer after setting up mocks
const ScrollVideoPlayer = require('./scroll-video-player.js');

/**
 * Run integration tests
 */
function runIntegrationTests() {
    console.log('🧪 Running Integration Tests\n');
    
    let testsPassed = 0;
    let testsTotal = 0;
    
    function test(name, testFn) {
        testsTotal++;
        return new Promise((resolve) => {
            try {
                const result = testFn();
                if (result instanceof Promise) {
                    result.then(() => {
                        console.log(`✓ ${name}`);
                        testsPassed++;
                        resolve();
                    }).catch((error) => {
                        console.error(`✗ ${name}: ${error.message}`);
                        resolve();
                    });
                } else {
                    console.log(`✓ ${name}`);
                    testsPassed++;
                    resolve();
                }
            } catch (error) {
                console.error(`✗ ${name}: ${error.message}`);
                resolve();
            }
        });
    }

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    async function runTests() {
        // Test 1: Component initialization
        await test('Component initialization', () => {
            const mockVideo = new MockVideoElement();
            const positionCalculator = new PositionCalculator();
            const player = new ScrollVideoPlayer(mockVideo, positionCalculator, {
                enableLogging: false
            });
            
            assert(player.isReady() === false, 'Player should not be ready initially');
            assert(mockVideo.muted === true, 'Video should be muted');
            assert(mockVideo.controls === false, 'Video controls should be disabled');
            
            return true;
        });

        // Test 2: Scroll-to-video mapping
        await test('Scroll-to-video mapping', () => {
            const positionCalculator = new PositionCalculator();
            
            // Test various scroll positions
            const testCases = [
                { scrollY: 0, expectedProgress: 0, expectedVideoTime: 0 },
                { scrollY: 1000, expectedProgress: 0.5, expectedVideoTime: 30 },
                { scrollY: 2000, expectedProgress: 1, expectedVideoTime: 60 }
            ];
            
            for (const testCase of testCases) {
                const progress = positionCalculator.getScrollProgress(
                    testCase.scrollY, 3000, 1000
                );
                const videoTime = positionCalculator.getVideoTime(progress, 60);
                
                assert(
                    Math.abs(progress - testCase.expectedProgress) < 0.001,
                    `Progress mismatch for scrollY ${testCase.scrollY}: expected ${testCase.expectedProgress}, got ${progress}`
                );
                
                assert(
                    Math.abs(videoTime - testCase.expectedVideoTime) < 0.001,
                    `Video time mismatch for scrollY ${testCase.scrollY}: expected ${testCase.expectedVideoTime}, got ${videoTime}`
                );
            }
            
            return true;
        });

        // Test 3: Video position updates
        await test('Video position updates', () => {
            const mockVideo = new MockVideoElement();
            const positionCalculator = new PositionCalculator();
            const player = new ScrollVideoPlayer(mockVideo, positionCalculator, {
                enableLogging: false
            });
            
            // Simulate metadata loaded
            player.videoState.duration = 60;
            player.videoState.isMetadataLoaded = true;
            
            // Test position updates
            player.updateVideoPosition(0.5, 30);
            assert(mockVideo.currentTime === 30, 'Video currentTime should be updated');
            assert(player.videoState.currentTime === 30, 'Player state should be updated');
            
            // Test boundary conditions
            player.updateVideoPosition(0, 0);
            assert(mockVideo.currentTime === 0, 'Should handle start position');
            
            player.updateVideoPosition(1, 60);
            assert(mockVideo.currentTime === 60, 'Should handle end position');
            
            return true;
        });

        // Test 4: Error handling
        await test('Error handling', () => {
            const mockVideo = new MockVideoElement();
            const positionCalculator = new PositionCalculator();
            const player = new ScrollVideoPlayer(mockVideo, positionCalculator, {
                enableLogging: false
            });
            
            // Test invalid position updates
            player.updateVideoPosition(-0.5, -10); // Should be handled gracefully
            player.updateVideoPosition(1.5, 100); // Should be handled gracefully
            
            // Test invalid inputs to position calculator
            const progress1 = positionCalculator.getScrollProgress('invalid', 3000, 1000);
            assert(progress1 >= 0 && progress1 <= 1, 'Should handle invalid scrollY gracefully');
            
            const videoTime1 = positionCalculator.getVideoTime('invalid', 60);
            assert(videoTime1 >= 0 && videoTime1 <= 60, 'Should handle invalid progress gracefully');
            
            return true;
        });

        // Test 5: Responsive behavior simulation
        await test('Responsive behavior simulation', () => {
            const positionCalculator = new PositionCalculator();
            
            // Test different viewport sizes
            const viewportSizes = [
                { width: 1920, height: 1080 },
                { width: 768, height: 1024 },
                { width: 375, height: 667 }
            ];
            
            for (const viewport of viewportSizes) {
                global.window.innerHeight = viewport.height;
                
                // Test scroll mapping with different viewport heights
                const progress = positionCalculator.getScrollProgress(
                    viewport.height / 2, // Scroll to middle
                    viewport.height * 3, // Document is 3x viewport height
                    viewport.height
                );
                
                assert(
                    Math.abs(progress - 0.25) < 0.001, // Should be 25% through
                    `Responsive mapping failed for viewport ${viewport.width}x${viewport.height}`
                );
            }
            
            return true;
        });

        // Test 6: Performance characteristics
        await test('Performance characteristics', () => {
            const positionCalculator = new PositionCalculator();
            
            // Test rapid calculations (simulating fast scrolling)
            const startTime = performance.now();
            
            for (let i = 0; i < 1000; i++) {
                const scrollY = Math.random() * 2000;
                const progress = positionCalculator.getScrollProgress(scrollY, 3000, 1000);
                const videoTime = positionCalculator.getVideoTime(progress, 60);
                
                // Verify results are still valid
                assert(progress >= 0 && progress <= 1, 'Progress should remain valid under load');
                assert(videoTime >= 0 && videoTime <= 60, 'Video time should remain valid under load');
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            assert(duration < 100, `Performance test took too long: ${duration}ms`);
            console.log(`    Performance: 1000 calculations in ${duration.toFixed(2)}ms`);
            
            return true;
        });

        // Test 7: Edge cases
        await test('Edge cases', () => {
            const positionCalculator = new PositionCalculator();
            
            // Document shorter than viewport
            const progress1 = positionCalculator.getScrollProgress(0, 500, 1000);
            assert(progress1 === 0, 'Should handle short document');
            
            // Zero scroll
            const progress2 = positionCalculator.getScrollProgress(0, 2000, 1000);
            assert(progress2 === 0, 'Should handle zero scroll');
            
            // Maximum scroll
            const progress3 = positionCalculator.getScrollProgress(1000, 2000, 1000);
            assert(progress3 === 1, 'Should handle maximum scroll');
            
            // Over-scroll
            const progress4 = positionCalculator.getScrollProgress(1500, 2000, 1000);
            assert(progress4 === 1, 'Should clamp over-scroll');
            
            // Zero duration video
            const videoTime1 = positionCalculator.getVideoTime(0.5, 0);
            assert(videoTime1 === 0, 'Should handle zero duration');
            
            return true;
        });

        // Summary
        console.log(`\n📊 Integration Test Results: ${testsPassed}/${testsTotal} tests passed`);
        
        if (testsPassed === testsTotal) {
            console.log('🎉 All integration tests passed!');
            console.log('\n✅ Scroll-controlled video player is working correctly');
            return true;
        } else {
            console.log('❌ Some integration tests failed');
            return false;
        }
    }

    return runTests();
}

// Run tests
if (require.main === module) {
    runIntegrationTests().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { runIntegrationTests };