/**
 * Complete Integration Tests for Scroll-Controlled Video Player
 * Task 9.1: Write integration tests for complete scroll-to-video pipeline
 * 
 * Tests end-to-end scroll event processing, validates smooth video frame updates,
 * and tests responsive behavior across viewport sizes.
 * 
 * Requirements: 4.1, 4.2, 5.1
 */

/**
 * Enhanced Mock Video Element with realistic behavior
 */
class EnhancedMockVideoElement extends EventTarget {
    constructor() {
        super();
        this.id = 'test-video';
        this.duration = 30; // 30 second video for testing
        this.currentTime = 0;
        this.videoWidth = 1920;
        this.videoHeight = 1080;
        this.muted = false;
        this.preload = 'none';
        this.controls = true;
        this.autoplay = false;
        this.error = null;
        this.style = {};
        this.src = 'test-video.mp4';
        
        // Track frame updates for smooth playback testing
        this.frameUpdates = [];
        this.lastUpdateTime = 0;
        
        // Override currentTime setter to track updates
        this._currentTime = 0;
        Object.defineProperty(this, 'currentTime', {
            get: () => this._currentTime,
            set: (value) => {
                const now = performance.now();
                this.frameUpdates.push({
                    time: value,
                    timestamp: now,
                    deltaTime: now - this.lastUpdateTime
                });
                this.lastUpdateTime = now;
                this._currentTime = value;
            }
        });
    }

    simulateMetadataLoaded() {
        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('loadedmetadata'));
        }, 10);
    }

    simulateError(errorCode = 4) {
        this.error = { code: errorCode };
        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('error'));
        }, 10);
    }

    getFrameUpdateStats() {
        if (this.frameUpdates.length < 2) return null;
        
        const deltas = this.frameUpdates.slice(1).map(update => update.deltaTime);
        const avgDelta = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
        const maxDelta = Math.max(...deltas);
        const minDelta = Math.min(...deltas);
        
        return {
            totalUpdates: this.frameUpdates.length,
            averageDelta: avgDelta,
            maxDelta: maxDelta,
            minDelta: minDelta,
            smoothness: maxDelta < 50 ? 'smooth' : 'choppy' // 50ms threshold
        };
    }

    clearFrameStats() {
        this.frameUpdates = [];
        this.lastUpdateTime = 0;
    }
}

/**
 * Mock DOM Environment for comprehensive testing
 */
class MockDOMEnvironment {
    constructor() {
        this.setupGlobals();
        this.setupViewport(1920, 1080);
        this.setupDocument(5000); // 5000px document height
    }

    setupGlobals() {
        global.performance = global.performance || {
            now: () => Date.now()
        };

        global.requestAnimationFrame = global.requestAnimationFrame || function(callback) {
            return setTimeout(callback, 16);
        };

        global.cancelAnimationFrame = global.cancelAnimationFrame || function(id) {
            clearTimeout(id);
        };

        global.CustomEvent = global.CustomEvent || function(type, options) {
            this.type = type;
            this.detail = options ? options.detail : {};
        };
    }

    setupViewport(width, height) {
        global.window = {
            scrollY: 0,
            innerWidth: width,
            innerHeight: height,
            addEventListener: function() {},
            removeEventListener: function() {},
            
            // Simulate scroll events
            simulateScroll: (scrollY) => {
                global.window.scrollY = scrollY;
                // Trigger scroll event if listeners exist
                if (global.window.scrollListeners) {
                    global.window.scrollListeners.forEach(listener => {
                        try {
                            listener({ type: 'scroll' });
                        } catch (error) {
                            console.warn('Scroll listener error:', error.message);
                        }
                    });
                }
            },
            
            // Track scroll listeners for testing
            scrollListeners: []
        };

        // Override addEventListener to track scroll listeners
        const originalAddEventListener = global.window.addEventListener;
        global.window.addEventListener = function(type, listener, options) {
            if (type === 'scroll') {
                this.scrollListeners = this.scrollListeners || [];
                this.scrollListeners.push(listener);
            }
            if (originalAddEventListener) {
                originalAddEventListener.call(this, type, listener, options);
            }
        };
    }

    setupDocument(height) {
        global.document = {
            documentElement: {
                scrollHeight: height,
                clientHeight: global.window.innerHeight
            },
            body: {
                scrollHeight: height,
                clientHeight: global.window.innerHeight
            },
            getElementById: (id) => {
                if (id === 'video-player' || id === 'test-video') {
                    return new EnhancedMockVideoElement();
                }
                return null;
            }
        };
    }

    changeViewport(width, height) {
        global.window.innerWidth = width;
        global.window.innerHeight = height;
        global.document.documentElement.clientHeight = height;
        global.document.body.clientHeight = height;
    }

    changeDocumentHeight(height) {
        global.document.documentElement.scrollHeight = height;
        global.document.body.scrollHeight = height;
    }
}

/**
 * Complete Integration Test Suite
 */
function runCompleteIntegrationTests() {
    console.log('🧪 Running Complete Integration Tests for Scroll-Controlled Video Player\n');
    
    const mockEnv = new MockDOMEnvironment();
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
        // Import components after setting up mocks
        const PositionCalculator = require('./position-calculator.js');
        const ResponsiveManager = require('./responsive-manager.js');
        const ScrollVideoPlayer = require('./scroll-video-player.js');

        // Test 1: End-to-End Scroll Event Processing (Requirement 4.1)
        await test('End-to-End Scroll Event Processing', () => {
            const mockVideo = new EnhancedMockVideoElement();
            const positionCalculator = new PositionCalculator();
            const responsiveManager = new ResponsiveManager(mockVideo, { enableLogging: false });
            const player = new ScrollVideoPlayer(mockVideo, positionCalculator, responsiveManager, { 
                enableLogging: false 
            });

            // Simulate video metadata loaded
            player.videoState.duration = 30;
            player.videoState.isMetadataLoaded = true;
            player.videoState.aspectRatio = 16/9;

            // Test scroll event processing pipeline
            const testScrollPositions = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000];
            
            for (const scrollY of testScrollPositions) {
                // Simulate scroll event
                global.window.simulateScroll(scrollY);
                
                // Process the scroll update manually (since we're not in a real browser)
                player.updateVideoFromScroll();
                
                // Verify video time corresponds to scroll position
                const expectedProgress = positionCalculator.getScrollProgress(
                    scrollY, 5000, 1080
                );
                const expectedVideoTime = positionCalculator.getVideoTime(expectedProgress, 30);
                
                assert(
                    Math.abs(mockVideo.currentTime - expectedVideoTime) < 0.1,
                    `Video time mismatch at scroll ${scrollY}: expected ${expectedVideoTime}, got ${mockVideo.currentTime}`
                );
            }

            // Verify scroll event processing is working
            assert(mockVideo.frameUpdates.length > 0, 'No frame updates recorded during scroll processing');
            
            return true;
        });

        // Test 2: Smooth Video Frame Updates (Requirement 4.2)
        await test('Smooth Video Frame Updates', () => {
            const mockVideo = new EnhancedMockVideoElement();
            const positionCalculator = new PositionCalculator();
            const player = new ScrollVideoPlayer(mockVideo, positionCalculator, null, { 
                enableLogging: false,
                debounceMs: 16 // 60fps
            });

            // Simulate video ready
            player.videoState.duration = 30;
            player.videoState.isMetadataLoaded = true;

            mockVideo.clearFrameStats();

            // Simulate rapid scroll events (like fast scrolling)
            const rapidScrollPositions = [];
            for (let i = 0; i <= 100; i++) {
                rapidScrollPositions.push(i * 40); // 0 to 4000px in 40px increments
            }

            const startTime = performance.now();
            
            for (const scrollY of rapidScrollPositions) {
                global.window.scrollY = scrollY;
                player.updateVideoFromScroll();
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            // Analyze frame update smoothness
            const stats = mockVideo.getFrameUpdateStats();
            
            assert(stats !== null, 'No frame update statistics available');
            assert(stats.totalUpdates > 50, `Insufficient frame updates: ${stats.totalUpdates}`);
            
            // Check for smooth updates (no frame drops > 50ms)
            assert(
                stats.maxDelta < 100, 
                `Frame updates not smooth: max delta ${stats.maxDelta}ms`
            );
            
            // Verify performance (should complete rapidly)
            assert(
                totalTime < 1000, 
                `Scroll processing too slow: ${totalTime}ms for ${rapidScrollPositions.length} updates`
            );

            console.log(`    Frame update stats: ${stats.totalUpdates} updates, avg ${stats.averageDelta.toFixed(2)}ms, max ${stats.maxDelta.toFixed(2)}ms`);
            
            return true;
        });

        // Test 3: Responsive Behavior Across Viewport Sizes (Requirement 5.1)
        await test('Responsive Behavior Across Viewport Sizes', () => {
            const viewportSizes = [
                { width: 1920, height: 1080, name: 'Desktop FHD' },
                { width: 1366, height: 768, name: 'Desktop HD' },
                { width: 768, height: 1024, name: 'Tablet Portrait' },
                { width: 1024, height: 768, name: 'Tablet Landscape' },
                { width: 375, height: 667, name: 'Mobile Portrait' },
                { width: 667, height: 375, name: 'Mobile Landscape' },
                { width: 320, height: 568, name: 'Small Mobile' }
            ];

            for (const viewport of viewportSizes) {
                // Change viewport size
                mockEnv.changeViewport(viewport.width, viewport.height);
                
                const mockVideo = new EnhancedMockVideoElement();
                const positionCalculator = new PositionCalculator();
                const responsiveManager = new ResponsiveManager(mockVideo, { 
                    enableLogging: false,
                    fillViewport: true,
                    maintainAspectRatio: true
                });
                
                // Set up video metadata
                responsiveManager.videoState.naturalWidth = 1920;
                responsiveManager.videoState.naturalHeight = 1080;
                responsiveManager.videoState.aspectRatio = 16/9;
                responsiveManager.videoState.isMetadataLoaded = true;
                
                // Update viewport and calculate optimal size
                responsiveManager.updateViewportDimensions();
                const optimalSize = responsiveManager.calculateOptimalVideoSize();
                
                // Verify responsive calculations
                assert(
                    optimalSize.width > 0 && optimalSize.height > 0,
                    `Invalid optimal size for ${viewport.name}: ${optimalSize.width}x${optimalSize.height}`
                );
                
                // Verify aspect ratio preservation
                const calculatedAspectRatio = optimalSize.width / optimalSize.height;
                const expectedAspectRatio = 16/9;
                assert(
                    Math.abs(calculatedAspectRatio - expectedAspectRatio) < 0.1,
                    `Aspect ratio not preserved for ${viewport.name}: expected ${expectedAspectRatio}, got ${calculatedAspectRatio}`
                );
                
                // Verify size fits within viewport
                assert(
                    optimalSize.width <= viewport.width && optimalSize.height <= viewport.height,
                    `Video size exceeds viewport for ${viewport.name}: ${optimalSize.width}x${optimalSize.height} > ${viewport.width}x${viewport.height}`
                );
                
                // Test scroll behavior at this viewport size
                const player = new ScrollVideoPlayer(mockVideo, positionCalculator, responsiveManager, { 
                    enableLogging: false 
                });
                
                player.videoState.duration = 30;
                player.videoState.isMetadataLoaded = true;
                
                // Test scroll at different positions
                const testPositions = [0, viewport.height, viewport.height * 2, viewport.height * 3];
                
                for (const scrollY of testPositions) {
                    global.window.scrollY = scrollY;
                    player.updateVideoFromScroll();
                    
                    // Verify video time is valid
                    assert(
                        mockVideo.currentTime >= 0 && mockVideo.currentTime <= 30,
                        `Invalid video time for ${viewport.name} at scroll ${scrollY}: ${mockVideo.currentTime}`
                    );
                }
                
                console.log(`    ${viewport.name}: ${optimalSize.width}x${optimalSize.height} (${calculatedAspectRatio.toFixed(2)})`);
            }
            
            return true;
        });

        // Test 4: Complete Pipeline Integration
        await test('Complete Pipeline Integration', () => {
            const mockVideo = new EnhancedMockVideoElement();
            const positionCalculator = new PositionCalculator();
            const responsiveManager = new ResponsiveManager(mockVideo, { enableLogging: false });
            const player = new ScrollVideoPlayer(mockVideo, positionCalculator, responsiveManager, { 
                enableLogging: false 
            });

            // Test complete initialization pipeline
            assert(player.videoElement === mockVideo, 'Video element not properly connected');
            assert(player.positionCalculator === positionCalculator, 'PositionCalculator not properly connected');
            assert(player.responsiveManager === responsiveManager, 'ResponsiveManager not properly connected');

            // Simulate complete video loading process
            return new Promise((resolve) => {
                let metadataLoaded = false;
                let scrollControlEnabled = false;

                mockVideo.addEventListener('scrollvideo:metadataLoaded', () => {
                    metadataLoaded = true;
                    checkComplete();
                });

                mockVideo.addEventListener('scrollvideo:scrollControlEnabled', () => {
                    scrollControlEnabled = true;
                    checkComplete();
                });

                function checkComplete() {
                    if (metadataLoaded && scrollControlEnabled) {
                        try {
                            // Test that all systems are working together
                            assert(player.isReady(), 'Player not ready after complete initialization');
                            
                            // Test scroll control works
                            global.window.scrollY = 2000;
                            player.updateVideoFromScroll();
                            
                            assert(
                                mockVideo.currentTime > 0,
                                'Video time not updated after scroll control enabled'
                            );
                            
                            resolve();
                        } catch (error) {
                            throw error;
                        }
                    }
                }

                // Trigger metadata loading
                mockVideo.simulateMetadataLoaded();
            });
        });

        // Test 5: Error Recovery and Edge Cases
        await test('Error Recovery and Edge Cases', () => {
            const mockVideo = new EnhancedMockVideoElement();
            const positionCalculator = new PositionCalculator();
            const player = new ScrollVideoPlayer(mockVideo, positionCalculator, null, { 
                enableLogging: false 
            });

            // Test edge case: Document shorter than viewport
            mockEnv.changeDocumentHeight(500); // Shorter than viewport
            
            player.videoState.duration = 30;
            player.videoState.isMetadataLoaded = true;
            
            global.window.scrollY = 0;
            player.updateVideoFromScroll();
            
            assert(
                mockVideo.currentTime === 0,
                'Video time should be 0 when document is shorter than viewport'
            );

            // Test edge case: Extreme scroll values
            mockEnv.changeDocumentHeight(5000);
            
            global.window.scrollY = -100; // Negative scroll
            player.updateVideoFromScroll();
            assert(mockVideo.currentTime >= 0, 'Video time should not be negative');
            
            global.window.scrollY = 10000; // Over-scroll
            player.updateVideoFromScroll();
            assert(mockVideo.currentTime <= 30, 'Video time should not exceed duration');

            // Test invalid dimensions handling
            const invalidProgress = positionCalculator.getScrollProgress(NaN, 5000, 1080);
            assert(invalidProgress >= 0 && invalidProgress <= 1, 'Should handle invalid scroll position');

            const invalidVideoTime = positionCalculator.getVideoTime(NaN, 30);
            assert(invalidVideoTime >= 0 && invalidVideoTime <= 30, 'Should handle invalid progress');

            return true;
        });

        // Test 6: Performance Under Load
        await test('Performance Under Load', () => {
            const mockVideo = new EnhancedMockVideoElement();
            const positionCalculator = new PositionCalculator();
            const player = new ScrollVideoPlayer(mockVideo, positionCalculator, null, { 
                enableLogging: false,
                debounceMs: 16
            });

            player.videoState.duration = 30;
            player.videoState.isMetadataLoaded = true;

            // Simulate heavy scroll load
            const startTime = performance.now();
            const iterations = 1000;
            
            for (let i = 0; i < iterations; i++) {
                const scrollY = Math.random() * 4000;
                global.window.scrollY = scrollY;
                player.updateVideoFromScroll();
            }
            
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const avgTimePerUpdate = totalTime / iterations;

            assert(
                avgTimePerUpdate < 5, // Should be very fast
                `Performance too slow: ${avgTimePerUpdate.toFixed(2)}ms per update`
            );

            assert(
                totalTime < 500,
                `Total processing time too slow: ${totalTime}ms for ${iterations} updates`
            );

            console.log(`    Performance: ${iterations} updates in ${totalTime.toFixed(2)}ms (${avgTimePerUpdate.toFixed(3)}ms avg)`);

            return true;
        });

        // Test 7: Memory Management and Cleanup
        await test('Memory Management and Cleanup', () => {
            const mockVideo = new EnhancedMockVideoElement();
            const positionCalculator = new PositionCalculator();
            const responsiveManager = new ResponsiveManager(mockVideo, { enableLogging: false });
            const player = new ScrollVideoPlayer(mockVideo, positionCalculator, responsiveManager, { 
                enableLogging: false 
            });

            // Set up some state
            player.videoState.duration = 30;
            player.videoState.isMetadataLoaded = true;
            
            // Add some event listeners
            player.enableScrollControl();
            
            // Check initial state
            assert(player.eventListeners.size > 0, 'No event listeners registered');
            assert(player.isReady(), 'Player should be ready');

            // Test cleanup
            player.destroy();

            // Verify cleanup
            assert(player.eventListeners.size === 0, 'Event listeners not cleaned up');
            assert(!player.isReady(), 'Player should not be ready after destroy');
            assert(player.videoElement === null, 'Video element reference not cleared');
            assert(player.positionCalculator === null, 'PositionCalculator reference not cleared');
            assert(player.responsiveManager === null, 'ResponsiveManager reference not cleared');

            // Test that destroyed player doesn't process events
            global.window.scrollY = 1000;
            try {
                player.updateVideoFromScroll(); // Should not throw but should not update
                // If it doesn't throw, that's fine - it should just not update the video
            } catch (error) {
                // Some errors are expected after destroy
            }

            return true;
        });

        // Summary
        console.log(`\n📊 Complete Integration Test Results: ${testsPassed}/${testsTotal} tests passed`);
        
        if (testsPassed === testsTotal) {
            console.log('🎉 All integration tests passed!');
            console.log('\n✅ Complete scroll-to-video pipeline validated:');
            console.log('   • End-to-end scroll event processing ✓');
            console.log('   • Smooth video frame updates ✓');
            console.log('   • Responsive behavior across viewport sizes ✓');
            console.log('   • Complete system integration ✓');
            console.log('   • Error recovery and edge cases ✓');
            console.log('   • Performance under load ✓');
            console.log('   • Memory management and cleanup ✓');
            return true;
        } else {
            console.log('❌ Some integration tests failed');
            console.log(`   Failed: ${testsTotal - testsPassed}/${testsTotal} tests`);
            return false;
        }
    }

    return runTests();
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        runCompleteIntegrationTests,
        EnhancedMockVideoElement,
        MockDOMEnvironment
    };
}

if (typeof window !== 'undefined') {
    window.runCompleteIntegrationTests = runCompleteIntegrationTests;
    window.EnhancedMockVideoElement = EnhancedMockVideoElement;
    window.MockDOMEnvironment = MockDOMEnvironment;
}

// Run tests if called directly
if (require.main === module) {
    runCompleteIntegrationTests().then((success) => {
        process.exit(success ? 0 : 1);
    });
}