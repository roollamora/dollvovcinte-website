/**
 * Integration Test for Responsive Layout System
 * 
 * Tests the complete responsive layout system including ResponsiveManager
 * integration with ScrollVideoPlayer and proper viewport management.
 */

function testResponsiveIntegration() {
    console.log('=== Responsive Integration Test ===');
    
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

    // Test 1: All classes are available
    test('All required classes are available', () => {
        if (typeof PositionCalculator === 'undefined') throw new Error('PositionCalculator not available');
        if (typeof ResponsiveManager === 'undefined') throw new Error('ResponsiveManager not available');
        if (typeof ScrollVideoPlayer === 'undefined') throw new Error('ScrollVideoPlayer not available');
    });

    // Test 2: ResponsiveManager can be instantiated
    test('ResponsiveManager instantiation', () => {
        const mockVideo = document.createElement('video');
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        if (!manager.videoElement) throw new Error('Video element not set');
        if (!manager.viewportState) throw new Error('Viewport state not initialized');
        if (!manager.videoState) throw new Error('Video state not initialized');
    });

    // Test 3: ScrollVideoPlayer integrates ResponsiveManager
    test('ScrollVideoPlayer ResponsiveManager integration', () => {
        const mockVideo = document.createElement('video');
        const positionCalculator = new PositionCalculator();
        const responsiveManager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        const player = new ScrollVideoPlayer(mockVideo, positionCalculator, responsiveManager, { enableLogging: false });
        
        if (!player.responsiveManager) throw new Error('ResponsiveManager not integrated');
        if (player.responsiveManager !== responsiveManager) throw new Error('Wrong ResponsiveManager instance');
    });

    // Test 4: Auto-creation of ResponsiveManager
    test('Auto-creation of ResponsiveManager', () => {
        const mockVideo = document.createElement('video');
        const positionCalculator = new PositionCalculator();
        
        // Pass null for responsiveManager to trigger auto-creation
        const player = new ScrollVideoPlayer(mockVideo, positionCalculator, null, { enableLogging: false });
        
        if (!player.responsiveManager) throw new Error('ResponsiveManager not auto-created');
        if (!(player.responsiveManager instanceof ResponsiveManager)) throw new Error('Wrong ResponsiveManager type');
    });

    // Test 5: Viewport setup integration
    test('Viewport setup integration', () => {
        const mockVideo = document.createElement('video');
        mockVideo.videoWidth = 1920;
        mockVideo.videoHeight = 1080;
        
        const positionCalculator = new PositionCalculator();
        const responsiveManager = new ResponsiveManager(mockVideo, { enableLogging: false });
        const player = new ScrollVideoPlayer(mockVideo, positionCalculator, responsiveManager, { enableLogging: false });
        
        // Simulate metadata loaded event
        responsiveManager.setupViewport();
        
        if (!responsiveManager.isReady()) throw new Error('ResponsiveManager not ready after setup');
    });

    // Test 6: Resize handling integration
    test('Resize handling integration', () => {
        const mockVideo = document.createElement('video');
        const positionCalculator = new PositionCalculator();
        const responsiveManager = new ResponsiveManager(mockVideo, { enableLogging: false });
        const player = new ScrollVideoPlayer(mockVideo, positionCalculator, responsiveManager, { enableLogging: false });
        
        // Test that resize handling doesn't throw errors
        responsiveManager.handleResize();
        
        // Should complete without errors
    });

    // Test 7: Aspect ratio calculations
    test('Aspect ratio calculations', () => {
        const mockVideo = document.createElement('video');
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        // Set up test viewport and video dimensions
        manager.viewportState = { width: 1920, height: 1080, aspectRatio: 1920/1080, isInitialized: true };
        manager.videoState = { 
            naturalWidth: 1920, 
            naturalHeight: 1080, 
            aspectRatio: 1920/1080, 
            isMetadataLoaded: true,
            displayWidth: 0,
            displayHeight: 0
        };
        
        const optimalSize = manager.calculateOptimalVideoSize();
        
        if (!optimalSize.width || !optimalSize.height) throw new Error('Invalid optimal size calculated');
        if (optimalSize.width <= 0 || optimalSize.height <= 0) throw new Error('Optimal size must be positive');
        
        // Check aspect ratio preservation
        const calculatedAspectRatio = optimalSize.width / optimalSize.height;
        const expectedAspectRatio = 1920 / 1080;
        if (Math.abs(calculatedAspectRatio - expectedAspectRatio) > 0.01) {
            throw new Error('Aspect ratio not preserved');
        }
    });

    // Test 8: Fixed positioning styles
    test('Fixed positioning styles', () => {
        const mockVideo = document.createElement('video');
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        manager.applyFixedPositioning();
        
        if (mockVideo.style.position !== 'fixed') throw new Error('Position not set to fixed');
        if (mockVideo.style.top !== '50%') throw new Error('Top position not centered');
        if (mockVideo.style.left !== '50%') throw new Error('Left position not centered');
        if (!mockVideo.style.transform.includes('translate(-50%, -50%)')) throw new Error('Transform not applied');
    });

    // Test 9: Cleanup integration
    test('Cleanup integration', () => {
        const mockVideo = document.createElement('video');
        const positionCalculator = new PositionCalculator();
        const responsiveManager = new ResponsiveManager(mockVideo, { enableLogging: false });
        const player = new ScrollVideoPlayer(mockVideo, positionCalculator, responsiveManager, { enableLogging: false });
        
        // Test cleanup
        player.destroy();
        
        // ResponsiveManager should be cleaned up
        if (responsiveManager.viewportState.isInitialized) throw new Error('ResponsiveManager not properly cleaned up');
    });

    // Test 10: Different viewport scenarios
    test('Different viewport scenarios', () => {
        const mockVideo = document.createElement('video');
        const manager = new ResponsiveManager(mockVideo, { enableLogging: false });
        
        // Test landscape viewport with portrait video
        manager.viewportState = { width: 1920, height: 1080, aspectRatio: 1920/1080 };
        manager.videoState = { aspectRatio: 9/16, isMetadataLoaded: true }; // Portrait video
        
        let optimalSize = manager.calculateOptimalVideoSize();
        if (optimalSize.width <= 0 || optimalSize.height <= 0) throw new Error('Invalid size for portrait video');
        
        // Test portrait viewport with landscape video
        manager.viewportState = { width: 1080, height: 1920, aspectRatio: 1080/1920 };
        manager.videoState = { aspectRatio: 16/9, isMetadataLoaded: true }; // Landscape video
        
        optimalSize = manager.calculateOptimalVideoSize();
        if (optimalSize.width <= 0 || optimalSize.height <= 0) throw new Error('Invalid size for landscape video');
    });

    console.log(`\\nResponsive Integration Tests: ${testsPassed}/${testsTotal} passed`);
    return testsPassed === testsTotal;
}

// Make test function available globally
if (typeof window !== 'undefined') {
    window.testResponsiveIntegration = testResponsiveIntegration;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testResponsiveIntegration };
}