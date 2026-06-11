/**
 * Test Suite for ResponsiveManager Component
 * 
 * Tests responsive layout functionality, viewport management,
 * aspect ratio preservation, and resize handling.
 */

// Test utilities
function createMockVideoElement(width = 1920, height = 1080) {
    return {
        videoWidth: width,
        videoHeight: height,
        style: {},
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() {}
    };
}

function setMockViewport(width, height) {
    // Mock window dimensions for testing
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width
    });
    Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: height
    });
}

// Test ResponsiveManager functionality
function runResponsiveManagerTests() {
    console.log('=== ResponsiveManager Tests ===');
    
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

    // Test 1: ResponsiveManager initialization
    test('ResponsiveManager initialization', () => {
        const mockVideo = createMockVideoElement();
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        if (!manager.videoElement) throw new Error('Video element not set');
        if (!manager.options) throw new Error('Options not initialized');
        if (!manager.viewportState) throw new Error('Viewport state not initialized');
        if (!manager.videoState) throw new Error('Video state not initialized');
    });

    // Test 2: Invalid video element handling
    test('Invalid video element handling', () => {
        try {
            new ResponsiveManager(null);
            throw new Error('Should have thrown error for null video element');
        } catch (error) {
            if (!error.message.includes('Valid video element required')) {
                throw new Error('Wrong error message for invalid video element');
            }
        }
    });

    // Test 3: Viewport dimensions update
    test('Viewport dimensions update', () => {
        setMockViewport(1920, 1080);
        const mockVideo = createMockVideoElement();
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        manager.updateViewportDimensions();
        
        if (manager.viewportState.width !== 1920) throw new Error('Viewport width not updated');
        if (manager.viewportState.height !== 1080) throw new Error('Viewport height not updated');
        if (Math.abs(manager.viewportState.aspectRatio - (1920/1080)) > 0.001) {
            throw new Error('Viewport aspect ratio not calculated correctly');
        }
    });

    // Test 4: Video metadata update
    test('Video metadata update', () => {
        const mockVideo = createMockVideoElement(1920, 1080);
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        manager.updateVideoMetadata();
        
        if (manager.videoState.naturalWidth !== 1920) throw new Error('Video width not updated');
        if (manager.videoState.naturalHeight !== 1080) throw new Error('Video height not updated');
        if (!manager.videoState.isMetadataLoaded) throw new Error('Metadata loaded flag not set');
        if (Math.abs(manager.videoState.aspectRatio - (1920/1080)) > 0.001) {
            throw new Error('Video aspect ratio not calculated correctly');
        }
    });

    // Test 5: Optimal video size calculation - fit to width
    test('Optimal video size calculation - fit to width', () => {
        setMockViewport(1920, 1200); // Viewport taller than video
        const mockVideo = createMockVideoElement(1920, 1080);
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        manager.updateViewportDimensions();
        manager.updateVideoMetadata();
        
        const optimalSize = manager.calculateOptimalVideoSize();
        
        if (optimalSize.width !== 1920) throw new Error('Should fit to viewport width');
        if (optimalSize.height !== 1080) throw new Error('Height should maintain aspect ratio');
    });

    // Test 6: Optimal video size calculation - fit to height
    test('Optimal video size calculation - fit to height', () => {
        setMockViewport(1600, 1080); // Viewport wider than video
        const mockVideo = createMockVideoElement(1920, 1080);
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        manager.updateViewportDimensions();
        manager.updateVideoMetadata();
        
        const optimalSize = manager.calculateOptimalVideoSize();
        
        if (optimalSize.height !== 1080) throw new Error('Should fit to viewport height');
        if (Math.abs(optimalSize.width - 1920) > 1) throw new Error('Width should maintain aspect ratio');
    });

    // Test 7: Aspect ratio preservation with constraints
    test('Aspect ratio preservation with constraints', () => {
        setMockViewport(800, 600);
        const mockVideo = createMockVideoElement(1920, 1080);
        const manager = new ResponsiveManager(mockVideo, { 
            enableLogging: false,
            minWidth: 400,
            minHeight: 300
        });
        
        manager.updateViewportDimensions();
        manager.updateVideoMetadata();
        
        const optimalSize = manager.calculateOptimalVideoSize();
        
        if (optimalSize.width < 400) throw new Error('Should respect minimum width');
        if (optimalSize.height < 300) throw new Error('Should respect minimum height');
        
        // Check aspect ratio is maintained (within tolerance)
        const expectedAspectRatio = 1920 / 1080;
        const actualAspectRatio = optimalSize.width / optimalSize.height;
        if (Math.abs(actualAspectRatio - expectedAspectRatio) > 0.1) {
            throw new Error('Aspect ratio not preserved with constraints');
        }
    });

    // Test 8: Video size application
    test('Video size application', () => {
        const mockVideo = createMockVideoElement();
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        const testSize = { width: 800, height: 450 };
        manager.applyVideoSize(testSize);
        
        if (mockVideo.style.width !== '800px') throw new Error('Video width not applied');
        if (mockVideo.style.height !== '450px') throw new Error('Video height not applied');
        if (manager.videoState.displayWidth !== 800) throw new Error('Display width not updated');
        if (manager.videoState.displayHeight !== 450) throw new Error('Display height not updated');
    });

    // Test 9: Fixed positioning application
    test('Fixed positioning application', () => {
        const mockVideo = createMockVideoElement();
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        manager.applyFixedPositioning();
        
        if (mockVideo.style.position !== 'fixed') throw new Error('Position not set to fixed');
        if (mockVideo.style.top !== '50%') throw new Error('Top position not centered');
        if (mockVideo.style.left !== '50%') throw new Error('Left position not centered');
        if (mockVideo.style.transform !== 'translate(-50%, -50%)') throw new Error('Transform not applied');
        if (mockVideo.style.zIndex !== '10') throw new Error('Z-index not set');
    });

    // Test 10: Viewport setup integration
    test('Viewport setup integration', () => {
        setMockViewport(1920, 1080);
        const mockVideo = createMockVideoElement(1920, 1080);
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        manager.setupViewport();
        
        if (!manager.viewportState.isInitialized) throw new Error('Viewport not marked as initialized');
        if (manager.viewportState.width !== 1920) throw new Error('Viewport width not set');
        if (manager.viewportState.height !== 1080) throw new Error('Viewport height not set');
        if (mockVideo.style.position !== 'fixed') throw new Error('Fixed positioning not applied');
    });

    // Test 11: Resize handling
    test('Resize handling', () => {
        setMockViewport(1920, 1080);
        const mockVideo = createMockVideoElement(1920, 1080);
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        manager.setupViewport();
        
        // Change viewport size
        setMockViewport(1600, 900);
        
        // Simulate resize handling
        manager.handleResize();
        
        // Check that viewport state would be updated (in real scenario)
        // This test verifies the resize method runs without errors
        if (manager.isResizing) throw new Error('Resize flag should be cleared after handling');
    });

    // Test 12: State getters
    test('State getters', () => {
        const mockVideo = createMockVideoElement();
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        const viewportState = manager.getViewportState();
        const videoState = manager.getVideoState();
        
        if (!viewportState || typeof viewportState !== 'object') throw new Error('Invalid viewport state');
        if (!videoState || typeof videoState !== 'object') throw new Error('Invalid video state');
        
        // Ensure returned objects are copies, not references
        viewportState.width = 999;
        if (manager.viewportState.width === 999) throw new Error('Viewport state should be a copy');
    });

    // Test 13: Ready state check
    test('Ready state check', () => {
        const mockVideo = createMockVideoElement();
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        if (manager.isReady()) throw new Error('Should not be ready before initialization');
        
        manager.setupViewport();
        
        if (!manager.isReady()) throw new Error('Should be ready after viewport setup');
    });

    // Test 14: Cleanup and destroy
    test('Cleanup and destroy', () => {
        const mockVideo = createMockVideoElement();
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        manager.setupViewport();
        manager.destroy();
        
        if (manager.viewportState.isInitialized) throw new Error('Should reset initialization flag');
        if (manager.viewportState.width !== 0) throw new Error('Should reset viewport width');
        if (manager.videoState.displayWidth !== 0) throw new Error('Should reset video display width');
    });

    // Test 15: Edge case - zero viewport dimensions
    test('Edge case - zero viewport dimensions', () => {
        setMockViewport(0, 0);
        const mockVideo = createMockVideoElement();
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        manager.updateViewportDimensions();
        const optimalSize = manager.calculateOptimalVideoSize();
        
        if (optimalSize.width <= 0) throw new Error('Should handle zero viewport gracefully');
        if (optimalSize.height <= 0) throw new Error('Should handle zero viewport gracefully');
    });

    console.log(`\nResponsiveManager Tests: ${testsPassed}/${testsTotal} passed`);
    return testsPassed === testsTotal;
}

// Make test function available globally
if (typeof window !== 'undefined') {
    window.runResponsiveManagerTests = runResponsiveManagerTests;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runResponsiveManagerTests };
}