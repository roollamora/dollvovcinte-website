/**
 * ResponsiveManager Component
 * 
 * Manages responsive layout and viewport sizing for the scroll-controlled video player.
 * Handles initial viewport setup, calculates optimal video dimensions for different 
 * screen sizes, maintains aspect ratio while filling viewport, and manages window resize events.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 1.3
 */
class ResponsiveManager {
    /**
     * Initialize ResponsiveManager with video element and configuration
     * 
     * @param {HTMLVideoElement} videoElement - Video element to manage
     * @param {Object} options - Configuration options
     */
    constructor(videoElement, options = {}) {
        // Validate video element
        if (!videoElement || typeof videoElement !== 'object') {
            throw new Error('Valid video element required');
        }
        this.videoElement = videoElement;

        // Configuration options
        this.options = {
            enableLogging: options.enableLogging || false,
            minWidth: options.minWidth || 320,
            minHeight: options.minHeight || 180,
            maxWidth: options.maxWidth || null,
            maxHeight: options.maxHeight || null,
            maintainAspectRatio: options.maintainAspectRatio !== false, // Default true
            fillViewport: options.fillViewport !== false, // Default true
            ...options
        };

        // Viewport state
        this.viewportState = {
            width: 0,
            height: 0,
            aspectRatio: 16 / 9, // Default viewport aspect ratio
            isInitialized: false
        };

        // Video state
        this.videoState = {
            naturalWidth: 0,
            naturalHeight: 0,
            aspectRatio: 16 / 9, // Default video aspect ratio
            displayWidth: 0,
            displayHeight: 0,
            isMetadataLoaded: false
        };

        // Resize handling
        this.resizeTimeout = null;
        this.isResizing = false;

        // Event listeners storage for cleanup
        this.eventListeners = new Map();

        this.log('ResponsiveManager initialized');
    }

    /**
     * Set up initial viewport sizing and video layout
     * Called when video metadata is loaded or component is initialized
     * 
     * Requirements: 5.1, 5.2, 5.3
     */
    setupViewport() {
        this.log('Setting up viewport');

        // Update viewport dimensions
        this.updateViewportDimensions();

        // Update video metadata if available
        this.updateVideoMetadata();

        // Calculate and apply optimal video size
        const optimalSize = this.calculateOptimalVideoSize();
        this.applyVideoSize(optimalSize);

        // Apply fixed positioning styles
        this.applyFixedPositioning();

        // Mark as initialized
        this.viewportState.isInitialized = true;

        this.log(`Viewport setup complete - Video: ${optimalSize.width}x${optimalSize.height}`);
        
        // Dispatch custom event
        this.dispatchCustomEvent('viewportSetup', {
            viewport: { ...this.viewportState },
            video: { ...this.videoState },
            optimalSize
        });
    }

    /**
     * Handle window resize events with immediate recalculation
     * Updates video dimensions on viewport changes while maintaining fixed positioning
     * 
     * Requirements: 5.4, 1.3
     */
    handleResize() {
        // Prevent multiple simultaneous resize operations
        if (this.isResizing) {
            return;
        }

        this.isResizing = true;
        this.log('Handling window resize');

        // Clear any pending resize timeout
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        // Use requestAnimationFrame for smooth resize handling
        requestAnimationFrame(() => {
            try {
                // Update viewport dimensions
                this.updateViewportDimensions();

                // Recalculate optimal video size
                const optimalSize = this.calculateOptimalVideoSize();
                
                // Apply new video size immediately
                this.applyVideoSize(optimalSize);

                // Ensure fixed positioning is maintained
                this.applyFixedPositioning();

                this.log(`Resize complete - New size: ${optimalSize.width}x${optimalSize.height}`);

                // Dispatch custom event
                this.dispatchCustomEvent('resize', {
                    viewport: { ...this.viewportState },
                    video: { ...this.videoState },
                    optimalSize
                });

            } catch (error) {
                this.log(`Error during resize: ${error.message}`, 'error');
            } finally {
                this.isResizing = false;
            }
        });
    }

    /**
     * Calculate optimal video dimensions for current viewport
     * Maintains aspect ratio while filling viewport appropriately
     * 
     * @returns {Object} Optimal video dimensions {width, height}
     * 
     * Requirements: 5.1, 5.2, 5.3
     */
    calculateOptimalVideoSize() {
        const viewport = this.viewportState;
        const video = this.videoState;

        // Use video's natural aspect ratio if available, otherwise default
        const videoAspectRatio = video.isMetadataLoaded ? video.aspectRatio : 16 / 9;
        const viewportAspectRatio = viewport.aspectRatio;

        let optimalWidth, optimalHeight;

        if (this.options.fillViewport) {
            // Fill viewport while maintaining aspect ratio
            if (viewportAspectRatio > videoAspectRatio) {
                // Viewport is wider than video - fit to height
                optimalHeight = viewport.height;
                optimalWidth = optimalHeight * videoAspectRatio;
            } else {
                // Viewport is taller than video - fit to width
                optimalWidth = viewport.width;
                optimalHeight = optimalWidth / videoAspectRatio;
            }
        } else {
            // Fit within viewport without necessarily filling it
            const scaleX = viewport.width / (video.naturalWidth || viewport.width);
            const scaleY = viewport.height / (video.naturalHeight || viewport.height);
            const scale = Math.min(scaleX, scaleY);

            optimalWidth = (video.naturalWidth || viewport.width) * scale;
            optimalHeight = (video.naturalHeight || viewport.height) * scale;
        }

        // Apply size constraints
        if (this.options.minWidth && optimalWidth < this.options.minWidth) {
            optimalWidth = this.options.minWidth;
            if (this.options.maintainAspectRatio) {
                optimalHeight = optimalWidth / videoAspectRatio;
            }
        }

        if (this.options.minHeight && optimalHeight < this.options.minHeight) {
            optimalHeight = this.options.minHeight;
            if (this.options.maintainAspectRatio) {
                optimalWidth = optimalHeight * videoAspectRatio;
            }
        }

        if (this.options.maxWidth && optimalWidth > this.options.maxWidth) {
            optimalWidth = this.options.maxWidth;
            if (this.options.maintainAspectRatio) {
                optimalHeight = optimalWidth / videoAspectRatio;
            }
        }

        if (this.options.maxHeight && optimalHeight > this.options.maxHeight) {
            optimalHeight = this.options.maxHeight;
            if (this.options.maintainAspectRatio) {
                optimalWidth = optimalHeight * videoAspectRatio;
            }
        }

        // Ensure dimensions are positive integers
        optimalWidth = Math.max(1, Math.round(optimalWidth));
        optimalHeight = Math.max(1, Math.round(optimalHeight));

        return {
            width: optimalWidth,
            height: optimalHeight,
            aspectRatio: optimalWidth / optimalHeight
        };
    }

    /**
     * Update viewport dimensions from current window size
     * 
     * Requirements: 5.1, 5.4
     */
    updateViewportDimensions() {
        this.viewportState.width = window.innerWidth;
        this.viewportState.height = window.innerHeight;
        this.viewportState.aspectRatio = this.viewportState.width / this.viewportState.height;

        this.log(`Viewport updated: ${this.viewportState.width}x${this.viewportState.height} (${this.viewportState.aspectRatio.toFixed(2)})`);
    }

    /**
     * Update video metadata from video element
     * 
     * Requirements: 5.2, 5.3
     */
    updateVideoMetadata() {
        if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
            this.videoState.naturalWidth = this.videoElement.videoWidth;
            this.videoState.naturalHeight = this.videoElement.videoHeight;
            this.videoState.aspectRatio = this.videoState.naturalWidth / this.videoState.naturalHeight;
            this.videoState.isMetadataLoaded = true;

            this.log(`Video metadata updated: ${this.videoState.naturalWidth}x${this.videoState.naturalHeight} (${this.videoState.aspectRatio.toFixed(2)})`);
        } else {
            this.log('Video metadata not yet available');
        }
    }

    /**
     * Apply calculated video size to the video element
     * 
     * @param {Object} size - Video dimensions {width, height}
     * 
     * Requirements: 5.1, 5.2, 5.3
     */
    applyVideoSize(size) {
        if (!size || typeof size.width !== 'number' || typeof size.height !== 'number') {
            this.log('Invalid size provided to applyVideoSize', 'warn');
            return;
        }

        // Apply dimensions to video element
        this.videoElement.style.width = `${size.width}px`;
        this.videoElement.style.height = `${size.height}px`;

        // Update video state
        this.videoState.displayWidth = size.width;
        this.videoState.displayHeight = size.height;

        this.log(`Video size applied: ${size.width}x${size.height}`);
    }

    /**
     * Apply fixed positioning styles to ensure video stays in viewport
     * 
     * Requirements: 1.1, 1.3
     */
    applyFixedPositioning() {
        // Apply fixed positioning styles
        this.videoElement.style.position = 'fixed';
        this.videoElement.style.top = '50%';
        this.videoElement.style.left = '50%';
        this.videoElement.style.transform = 'translate(-50%, -50%)';
        this.videoElement.style.zIndex = '10';
        this.videoElement.style.objectFit = 'contain';

        // Ensure video doesn't exceed viewport bounds
        this.videoElement.style.maxWidth = '100vw';
        this.videoElement.style.maxHeight = '100vh';

        this.log('Fixed positioning applied');
    }

    /**
     * Get current viewport state
     * 
     * @returns {Object} Current viewport state
     */
    getViewportState() {
        return { ...this.viewportState };
    }

    /**
     * Get current video state
     * 
     * @returns {Object} Current video state
     */
    getVideoState() {
        return { ...this.videoState };
    }

    /**
     * Check if the manager is ready (viewport is initialized)
     * 
     * @returns {boolean} True if ready
     */
    isReady() {
        return this.viewportState.isInitialized;
    }

    /**
     * Add event listener and store reference for cleanup
     * 
     * @param {EventTarget} target - Event target
     * @param {string} type - Event type
     * @param {Function} listener - Event listener function
     * @param {Object} options - Event listener options
     */
    addEventListener(target, type, listener, options = {}) {
        target.addEventListener(type, listener, options);
        
        // Store for cleanup
        const key = `${target === window ? 'window' : target.id || 'element'}_${type}`;
        this.eventListeners.set(key, { target, type, listener, options });
    }

    /**
     * Remove event listener
     * 
     * @param {EventTarget} target - Event target
     * @param {string} type - Event type
     * @param {Function} listener - Event listener function
     */
    removeEventListener(target, type, listener) {
        target.removeEventListener(type, listener);
        
        // Remove from storage
        const key = `${target === window ? 'window' : target.id || 'element'}_${type}`;
        this.eventListeners.delete(key);
    }

    /**
     * Dispatch custom events for external listeners
     * 
     * @param {string} eventType - Event type
     * @param {Object} detail - Event detail data
     */
    dispatchCustomEvent(eventType, detail = {}) {
        try {
            const event = new CustomEvent(`responsive:${eventType}`, {
                detail: {
                    manager: this,
                    ...detail
                }
            });
            
            this.videoElement.dispatchEvent(event);
        } catch (error) {
            // Fallback for test environments or older browsers
            if (this.options.enableLogging) {
                this.log(`Custom event dispatched: responsive:${eventType}`, 'log');
            }
        }
    }

    /**
     * Logging utility
     * 
     * @param {string} message - Log message
     * @param {string} level - Log level (log, warn, error)
     */
    log(message, level = 'log') {
        if (this.options.enableLogging) {
            console[level](`[ResponsiveManager] ${message}`);
        }
    }

    /**
     * Clean up event listeners and resources
     * Should be called when the component is no longer needed
     * 
     * Requirements: 9.3, 9.4
     */
    destroy() {
        this.log('Destroying ResponsiveManager');

        // Clear resize timeout
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        // Remove all event listeners
        for (const [key, { target, type, listener }] of this.eventListeners) {
            target.removeEventListener(type, listener);
        }
        this.eventListeners.clear();

        // Reset state
        this.viewportState = {
            width: 0,
            height: 0,
            aspectRatio: 16 / 9,
            isInitialized: false
        };

        this.videoState = {
            naturalWidth: 0,
            naturalHeight: 0,
            aspectRatio: 16 / 9,
            displayWidth: 0,
            displayHeight: 0,
            isMetadataLoaded: false
        };

        this.log('ResponsiveManager destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResponsiveManager;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.ResponsiveManager = ResponsiveManager;
}