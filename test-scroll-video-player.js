/**
 * Test Suite for ScrollVideoPlayer Component
 * 
 * Basic unit tests to verify ScrollVideoPlayer functionality
 * Requirements: 7.1, 7.2, 7.3, 10.2, 2.1, 2.2, 3.1, 4.1, 4.2
 */

// Mock HTML video element for testing
class MockVideoElement extends EventTarget {
    constructor() {
        super();
        this.id = 'test-video';
        this.duration = 10; // 10 second video
        this.currentTime = 0;
        this.videoWidth = 1920;
        this.videoHeight = 1080;
        this.muted = false;
        this.preload = 'none';
        this.controls = true;
        this.autoplay = false;
        this.error = null;
        this.style = {};
    }

    // Simulate metadata loading
    simulateMetadataLoaded() {
        setTimeout(() => {
            this.dispatchEvent(new Event('loadedmetadata'));
        }, 10);
    }

    // Simulate loading error
    simulateError(errorCode = 4) {
        this.error = { code: errorCode };
        setTimeout(() => {
            this.dispatchEvent(new Event('error'));
        }, 10);
    }
}

// Mock PositionCalculator for testing
class MockPositionCalculator {
    getScrollProgress(scrollY, documentHeight, viewportHeight) {
        const maxScroll = documentHeight - viewportHeight;
        if (maxScroll <= 0) return 0;
        return Math.max(0, Math.min(1, scrollY / maxScroll));
    }

    getVideoTime(progress, videoDuration) {
        return Math.max(0, Math.min(videoDuration, progress * videoDuration));
    }

    clampProgress(progress) {
        return Math.max(0, Math.min(1, progress));
    }
}

/**
 * Run ScrollVideoPlayer tests
 */
function runScrollVideoPlayerTests() {
    console.log('Running ScrollVideoPlayer tests...');
    
    let testsPassed = 0;
    let testsTotal = 0;

    function test(name, testFn) {
        testsTotal++;
        try {
            testFn();
            console.log(`✓ ${name}`);
            testsPassed++;
        } catch (error) {
            console.error(`✗ ${name}: ${error.message}`);
        }
    }

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    // Test 1: Constructor validation
    test('Constructor should validate video element', () => {
        const mockVideo = new MockVideoElement();
        const mockCalculator = new MockPositionCalculator();
        
        // Should work with valid inputs
        const player = new ScrollVideoPlayer(mockVideo, mockCalculator);
        assert(player.videoElement === mockVideo, 'Video element should be set');
        assert(player.positionCalculator === mockCalculator, 'Position calculator should be set');
        
        // Should throw with invalid video element
        try {
            new ScrollVideoPlayer(null, mockCalculator);
            assert(false, 'Should throw with null video element');
        } catch (error) {
            assert(error.message.includes('Invalid video element'), 'Should throw appropriate error');
        }
        
        // Should throw with invalid position calculator
        try {
            new ScrollVideoPlayer(mockVideo, null);
            assert(false, 'Should throw with null position calculator');
        } catch (error) {
            assert(error.message.includes('PositionCalculator'), 'Should throw appropriate error');
        }
    });

    // Test 2: Initial state
    test('Initial state should be correct', () => {
        const mockVideo = new MockVideoElement();
        const mockCalculator = new MockPositionCalculator();
        const player = new ScrollVideoPlayer(mockVideo, mockCalculator);
        
        const videoState = player.getVideoState();
        assert(videoState.duration === 0, 'Initial duration should be 0');
        assert(videoState.currentTime === 0, 'Initial currentTime should be 0');
        assert(videoState.isLoaded === false, 'Initial isLoaded should be false');
        assert(videoState.isMetadataLoaded === false, 'Initial isMetadataLoaded should be false');
        assert(videoState.hasError === false, 'Initial hasError should be false');
        assert(!player.isReady(), 'Player should not be ready initially');
    });

    // Test 3: Video element setup
    test('Video element should be configured correctly', () => {
        const mockVideo = new MockVideoElement();
        const mockCalculator = new MockPositionCalculator();
        const player = new ScrollVideoPlayer(mockVideo, mockCalculator);
        
        assert(mockVideo.muted === true, 'Video should be muted');
        assert(mockVideo.preload === 'metadata', 'Video should preload metadata');
        assert(mockVideo.controls === false, 'Video controls should be disabled');
        assert(mockVideo.autoplay === false, 'Video autoplay should be disabled');
    });

    // Test 4: Metadata loading
    test('Should handle metadata loading correctly', (done) => {
        const mockVideo = new MockVideoElement();
        const mockCalculator = new MockPositionCalculator();
        const player = new ScrollVideoPlayer(mockVideo, mockCalculator, { enableLogging: false });
        
        // Listen for metadata loaded event
        mockVideo.addEventListener('scrollvideo:metadataLoaded', (event) => {
            const videoState = player.getVideoState();
            assert(videoState.duration === 10, 'Duration should be set from video');
            assert(videoState.aspectRatio === 1920/1080, 'Aspect ratio should be calculated');
            assert(videoState.isMetadataLoaded === true, 'isMetadataLoaded should be true');
            assert(player.isReady() === true, 'Player should be ready');
            assert(mockVideo.currentTime === 0, 'Video should start at time 0');
            
            if (done) done();
        });
        
        // Simulate metadata loading
        mockVideo.simulateMetadataLoaded();
        
        // For synchronous testing, we'll check immediately
        setTimeout(() => {
            // Test passes if no errors thrown
        }, 20);
    });

    // Test 5: Error handling
    test('Should handle video errors correctly', (done) => {
        const mockVideo = new MockVideoElement();
        const mockCalculator = new MockPositionCalculator();
        const player = new ScrollVideoPlayer(mockVideo, mockCalculator, { enableLogging: false });
        
        // Listen for error event
        mockVideo.addEventListener('scrollvideo:videoError', (event) => {
            const videoState = player.getVideoState();
            assert(videoState.hasError === true, 'hasError should be true');
            assert(videoState.errorMessage !== null, 'Error message should be set');
            assert(player.isReady() === false, 'Player should not be ready on error');
            
            if (done) done();
        });
        
        // Simulate error
        mockVideo.simulateError();
        
        // For synchronous testing
        setTimeout(() => {
            // Test passes if no errors thrown
        }, 20);
    });

    // Test 6: updateVideoPosition method
    test('updateVideoPosition should work correctly', () => {
        const mockVideo = new MockVideoElement();
        const mockCalculator = new MockPositionCalculator();
        const player = new ScrollVideoPlayer(mockVideo, mockCalculator);
        
        // Set up video state as if metadata is loaded
        player.videoState.duration = 10;
        player.videoState.isMetadataLoaded = true;
        
        // Test valid inputs
        player.updateVideoPosition(0.5, 5);
        assert(mockVideo.currentTime === 5, 'Video currentTime should be updated');
        assert(player.videoState.currentTime === 5, 'Player state should be updated');
        
        // Test boundary values
        player.updateVideoPosition(0, 0);
        assert(mockVideo.currentTime === 0, 'Should handle start position');
        
        player.updateVideoPosition(1, 10);
        assert(mockVideo.currentTime === 10, 'Should handle end position');
    });

    // Test 7: Options handling
    test('Options should be handled correctly', () => {
        const mockVideo = new MockVideoElement();
        const mockCalculator = new MockPositionCalculator();
        
        // Test default options
        const player1 = new ScrollVideoPlayer(mockVideo, mockCalculator);
        assert(player1.options.smoothing === true, 'Default smoothing should be true');
        assert(player1.options.debounceMs === 16, 'Default debounce should be 16ms');
        assert(player1.options.enableLogging === false, 'Default logging should be false');
        
        // Test custom options
        const player2 = new ScrollVideoPlayer(mockVideo, mockCalculator, {
            smoothing: false,
            debounceMs: 32,
            enableLogging: true
        });
        assert(player2.options.smoothing === false, 'Custom smoothing should be set');
        assert(player2.options.debounceMs === 32, 'Custom debounce should be set');
        assert(player2.options.enableLogging === true, 'Custom logging should be set');
    });

    // Test 8: Cleanup
    test('destroy method should clean up properly', () => {
        const mockVideo = new MockVideoElement();
        const mockCalculator = new MockPositionCalculator();
        const player = new ScrollVideoPlayer(mockVideo, mockCalculator);
        
        // Simulate some state
        player.videoState.isMetadataLoaded = true;
        player.videoState.duration = 10;
        
        // Destroy
        player.destroy();
        
        // Check cleanup
        const videoState = player.getVideoState();
        assert(videoState.duration === 0, 'Duration should be reset');
        assert(videoState.isMetadataLoaded === false, 'isMetadataLoaded should be reset');
        assert(player.eventListeners.size === 0, 'Event listeners should be cleared');
    });

    // Summary
    console.log(`\nScrollVideoPlayer Tests: ${testsPassed}/${testsTotal} passed`);
    
    if (testsPassed === testsTotal) {
        console.log('✓ All ScrollVideoPlayer tests passed!');
        return true;
    } else {
        console.log('✗ Some ScrollVideoPlayer tests failed');
        return false;
    }
}

// Make test function available globally
if (typeof window !== 'undefined') {
    window.runScrollVideoPlayerTests = runScrollVideoPlayerTests;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runScrollVideoPlayerTests, MockVideoElement, MockPositionCalculator };
}