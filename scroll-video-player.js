/**
 * ScrollVideoPlayer Component
 * 
 * Main component that orchestrates scroll-controlled video playback.
 * Handles video element references, state management, metadata loading,
 * and error handling.
 * 
 * Requirements: 7.1, 7.2, 7.3, 10.2, 2.1, 2.2, 3.1, 4.1, 4.2
 */
class ScrollVideoPlayer {
    /**
     * Initialize ScrollVideoPlayer with video element and dependencies
     * 
     * @param {string|HTMLVideoElement} videoElementOrId - Video element or its ID
     * @param {PositionCalculator} positionCalculator - Position calculation component
     * @param {ResponsiveManager} responsiveManager - Responsive layout manager (optional)
     * @param {Object} options - Configuration options
     */
    constructor(videoElementOrId, positionCalculator, responsiveManager = null, options = {}) {
        // Get video element reference
        if (typeof videoElementOrId === 'string') {
            this.videoElement = document.getElementById(videoElementOrId);
            if (!this.videoElement) {
                throw new Error(`Video element with ID "${videoElementOrId}" not found`);
            }
        } else if (videoElementOrId && typeof videoElementOrId === 'object') {
            // Accept any object that looks like a video element (for testing)
            this.videoElement = videoElementOrId;
        } else {
            throw new Error('Invalid video element provided');
        }

        // Validate position calculator
        if (!positionCalculator || typeof positionCalculator.getScrollProgress !== 'function') {
            throw new Error('Valid PositionCalculator instance required');
        }
        this.positionCalculator = positionCalculator;

        // Configuration options - moved before ResponsiveManager setup
        this.options = {
            smoothing: (options && options.smoothing !== false) ? true : true, // Default true
            debounceMs: (options && options.debounceMs) || 16, // ~60fps
            enableLogging: (options && options.enableLogging) || false,
            ...(options || {})
        };

        // Set up responsive manager
        if (responsiveManager && typeof responsiveManager.setupViewport === 'function') {
            this.responsiveManager = responsiveManager;
        } else if (responsiveManager === null) {
            // Create default ResponsiveManager if none provided
            if (typeof ResponsiveManager !== 'undefined') {
                this.responsiveManager = new ResponsiveManager(this.videoElement, {
                    enableLogging: this.options.enableLogging
                });
            } else {
                this.responsiveManager = null;
                this.log('ResponsiveManager not available - responsive features disabled', 'warn');
            }
        } else {
            throw new Error('Invalid ResponsiveManager instance provided');
        }

        // Video state management - Requirements 7.1, 7.2
        this.videoState = {
            duration: 0,
            currentTime: 0,
            isLoaded: false,
            isMetadataLoaded: false,
            aspectRatio: 16 / 9, // Default aspect ratio
            hasError: false,
            errorMessage: null
        };

        // Scroll handling state - Requirements 4.1, 4.2, 4.3, 4.4
        this.scrollState = {
            isScrolling: false,
            lastScrollTime: 0,
            lastProgress: 0,
            frameRequestId: null,
            throttleTimeout: null,
            lastThrottleTime: 0,
            targetFPS: 60,
            frameInterval: 1000 / 60 // 16.67ms for 60fps
        };

        // Event listeners storage for cleanup - Requirements 9.1, 9.2, 9.3, 9.4
        this.eventListeners = new Map();
        this.eventListenerOptions = new Map(); // Store options for each listener
        this.isDestroyed = false; // Track component lifecycle

        // Initialize the component
        this.initialize().catch(error => {
            this.log(`Initialization error: ${error.message}`, 'error');
            this.videoState.hasError = true;
            this.videoState.errorMessage = 'Failed to initialize video player';
            this.displayErrorMessage(this.videoState.errorMessage, 'retry');
        });
    }

    /**
     * Initialize the ScrollVideoPlayer component
     * Sets up video element references, event listeners, and state management
     * 
     * Requirements: 7.1, 7.2, 7.3, 10.2
     */
    async initialize() {
        this.log('Initializing ScrollVideoPlayer');

        // Set up video element properties
        await this.setupVideoElement();

        // Set up event listeners for video loading and errors
        this.setupVideoEventListeners();

        // Set up scroll event listeners (will be enabled after metadata loads)
        this.setupScrollEventListeners();

        // Set up resize event listeners for responsive behavior
        this.setupResizeEventListeners();

        this.log('ScrollVideoPlayer initialized');
    }

    /**
     * Set up video element properties and initial state
     * 
     * Requirements: 10.2, 10.3, 10.4
     */
    async setupVideoElement() {
        // Ensure video is muted for autoplay policies
        this.videoElement.muted = true;
        
        // Set preload to metadata for faster initialization
        this.videoElement.preload = 'metadata';
        
        // Disable default controls since we're using scroll control
        this.videoElement.controls = false;
        
        // Prevent video from playing automatically
        this.videoElement.autoplay = false;

        // Validate video accessibility if source is already set
        if (this.videoElement.src) {
            const isAccessible = await this.validateVideoAccessibility(this.videoElement.src);
            if (!isAccessible) {
                this.videoState.hasError = true;
                this.videoState.errorMessage = 'Video file is not accessible or does not exist';
                this.displayErrorMessage(this.videoState.errorMessage, 'retry');
                return;
            }
        }

        this.log('Video element configured');
    }

    /**
     * Set up video event listeners for metadata loading and error handling
     * 
     * Requirements: 7.1, 7.2, 7.3, 10.2, 10.4
     */
    setupVideoEventListeners() {
        // Handle video metadata loaded
        const onLoadedMetadata = () => {
            this.log('Video metadata loaded');
            
            this.videoState.duration = this.videoElement.duration;
            this.videoState.aspectRatio = this.videoElement.videoWidth / this.videoElement.videoHeight;
            this.videoState.isMetadataLoaded = true;
            this.videoState.hasError = false;
            this.videoState.errorMessage = null;

            // Set initial video time to 0
            this.videoElement.currentTime = 0;
            this.videoState.currentTime = 0;

            // Set up responsive layout if ResponsiveManager is available
            if (this.responsiveManager) {
                this.responsiveManager.setupViewport();
            }

            // Enable scroll control now that metadata is loaded
            this.enableScrollControl();

            // Trigger custom event for external listeners
            this.dispatchCustomEvent('metadataLoaded', {
                duration: this.videoState.duration,
                aspectRatio: this.videoState.aspectRatio
            });

            this.log(`Video ready - Duration: ${this.videoState.duration}s, Aspect: ${this.videoState.aspectRatio}`);
        };

        // Handle video loading errors - Requirements 7.3, 10.2, 10.4
        const onError = (event) => {
            const error = this.videoElement.error;
            let errorMessage = 'Unknown video loading error';
            let fallbackAction = 'retry';

            if (error) {
                switch (error.code) {
                    case error.MEDIA_ERR_ABORTED:
                        errorMessage = 'Video loading was aborted by user or network';
                        fallbackAction = 'retry';
                        break;
                    case error.MEDIA_ERR_NETWORK:
                        errorMessage = 'Network error occurred while loading video. Please check your connection.';
                        fallbackAction = 'retry';
                        break;
                    case error.MEDIA_ERR_DECODE:
                        errorMessage = 'Video file is corrupted or in an unsupported format';
                        fallbackAction = 'fallback';
                        break;
                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMessage = 'Video format not supported or file not found. Please check the video file.';
                        fallbackAction = 'fallback';
                        break;
                    default:
                        errorMessage = `Video error (code: ${error.code}). Please try refreshing the page.`;
                        fallbackAction = 'retry';
                }
            }

            this.log(`Video error: ${errorMessage}`, 'error');
            
            this.videoState.hasError = true;
            this.videoState.errorMessage = errorMessage;
            this.videoState.isMetadataLoaded = false;
            this.videoState.fallbackAction = fallbackAction;

            // Disable scroll control on error
            this.disableScrollControl();

            // Display error message to user
            this.displayErrorMessage(errorMessage, fallbackAction);

            // Implement fallback behavior based on error type
            this.handleErrorFallback(error, fallbackAction);

            // Trigger custom event for external error handling
            this.dispatchCustomEvent('videoError', {
                error: errorMessage,
                code: error ? error.code : null,
                fallbackAction: fallbackAction,
                timestamp: Date.now()
            });
        };

        // Handle video loading progress
        const onLoadStart = () => {
            this.log('Video loading started');
            this.dispatchCustomEvent('loadStart');
        };

        const onCanPlay = () => {
            this.log('Video can start playing');
            this.videoState.isLoaded = true;
            this.dispatchCustomEvent('canPlay');
        };

        // Add event listeners and store references for cleanup
        this.addEventListener(this.videoElement, 'loadedmetadata', onLoadedMetadata);
        this.addEventListener(this.videoElement, 'error', onError);
        this.addEventListener(this.videoElement, 'loadstart', onLoadStart);
        this.addEventListener(this.videoElement, 'canplay', onCanPlay);
    }

    /**
     * Set up scroll event listeners for video control
     * Initially disabled until video metadata is loaded
     * 
     * Requirements: 2.1, 2.2, 3.1, 4.1, 4.2
     */
    setupScrollEventListeners() {
        this.handleScrollBound = this.handleScroll.bind(this);
        // Note: Event listener will be added when enableScrollControl() is called
    }

    /**
     * Set up resize event listeners for responsive behavior
     * 
     * Requirements: 5.4, 1.3
     */
    setupResizeEventListeners() {
        const onResize = () => {
            // Use ResponsiveManager if available, otherwise fallback to basic resize handling
            if (this.responsiveManager) {
                this.responsiveManager.handleResize();
            } else {
                // Fallback resize handling
                this.handleResize();
            }
        };

        this.addEventListener(window, 'resize', onResize);
    }

    /**
     * Enable scroll control after video metadata is loaded
     * 
     * Requirements: 7.1, 7.2
     */
    enableScrollControl() {
        if (!this.videoState.isMetadataLoaded) {
            this.log('Cannot enable scroll control - video metadata not loaded', 'warn');
            return;
        }

        // Add scroll event listener
        this.addEventListener(window, 'scroll', this.handleScrollBound, { passive: true });
        
        this.log('Scroll control enabled');
        this.dispatchCustomEvent('scrollControlEnabled');
    }

    /**
     * Disable scroll control (used during errors or cleanup)
     * 
     * Requirements: 7.3, 9.3
     */
    disableScrollControl() {
        // Remove scroll event listener
        this.removeEventListener(window, 'scroll', this.handleScrollBound);
        
        // Cancel any pending frame updates
        if (this.scrollState.frameRequestId) {
            cancelAnimationFrame(this.scrollState.frameRequestId);
            this.scrollState.frameRequestId = null;
        }

        // Clear any pending throttle timeout
        if (this.scrollState.throttleTimeout) {
            clearTimeout(this.scrollState.throttleTimeout);
            this.scrollState.throttleTimeout = null;
        }

        // Reset scroll state
        this.scrollState.isScrolling = false;
        this.scrollState.lastThrottleTime = 0;

        this.log('Scroll control disabled');
        this.dispatchCustomEvent('scrollControlDisabled');
    }

    /**
     * Handle scroll events and update video position with 60fps throttling
     * Processes scroll events, calculates progress, and updates video currentTime
     * Implements performance optimizations to maintain smooth 60fps operation
     * 
     * Requirements: 2.1, 2.2, 3.1, 4.1, 4.2, 4.3, 4.4
     */
    handleScroll(event) {
        // Skip if video is not ready
        if (!this.isReady()) {
            return;
        }

        const currentTime = performance.now();
        
        // Throttle to 60fps maximum - Requirements 4.3, 4.4
        const timeSinceLastThrottle = currentTime - this.scrollState.lastThrottleTime;
        if (timeSinceLastThrottle < this.scrollState.frameInterval) {
            // Clear any existing throttle timeout
            if (this.scrollState.throttleTimeout) {
                clearTimeout(this.scrollState.throttleTimeout);
            }
            
            // Schedule update for the next frame interval
            const remainingTime = this.scrollState.frameInterval - timeSinceLastThrottle;
            this.scrollState.throttleTimeout = setTimeout(() => {
                this.processScrollUpdate(currentTime);
            }, remainingTime);
            return;
        }

        // Process scroll update immediately
        this.processScrollUpdate(currentTime);
    }

    /**
     * Process scroll update with requestAnimationFrame for smooth performance
     * 
     * Requirements: 4.1, 4.2, 4.3, 4.4
     */
    processScrollUpdate(currentTime) {
        // Skip if already processing a scroll event (debouncing)
        if (this.scrollState.isScrolling) {
            return;
        }

        // Mark as scrolling to prevent concurrent processing
        this.scrollState.isScrolling = true;
        this.scrollState.lastScrollTime = currentTime;
        this.scrollState.lastThrottleTime = currentTime;

        // Clear any pending throttle timeout
        if (this.scrollState.throttleTimeout) {
            clearTimeout(this.scrollState.throttleTimeout);
            this.scrollState.throttleTimeout = null;
        }

        // Use requestAnimationFrame for smooth updates - Requirements 4.1, 4.2, 4.3
        this.scrollState.frameRequestId = requestAnimationFrame(() => {
            this.updateVideoFromScroll();
            this.scrollState.isScrolling = false;
        });
    }

    /**
     * Update video position based on current scroll position
     * Called within requestAnimationFrame for smooth performance
     * Enhanced with comprehensive edge case handling
     * 
     * Requirements: 2.1, 2.2, 3.1, 4.1, 4.2, 8.3, 8.4
     */
    updateVideoFromScroll() {
        try {
            // Use enhanced position calculator methods for robust dimension detection
            let scrollY, documentHeight, viewportHeight;

            try {
                // Try to use PositionCalculator's enhanced methods if available
                if (typeof this.positionCalculator.getCurrentScrollPosition === 'function') {
                    scrollY = this.positionCalculator.getCurrentScrollPosition();
                    documentHeight = this.positionCalculator.getDocumentHeight();
                    viewportHeight = this.positionCalculator.getViewportHeight();
                } else {
                    // Fallback to manual calculation with edge case handling
                    scrollY = this.getScrollPositionSafe();
                    documentHeight = this.getDocumentHeightSafe();
                    viewportHeight = this.getViewportHeightSafe();
                }
            } catch (error) {
                this.log(`Error getting scroll dimensions: ${error.message}`, 'warn');
                // Use safe fallback methods
                scrollY = this.getScrollPositionSafe();
                documentHeight = this.getDocumentHeightSafe();
                viewportHeight = this.getViewportHeightSafe();
            }

            // Validate dimensions before proceeding
            if (!this.validateScrollDimensions(scrollY, documentHeight, viewportHeight)) {
                this.log('Invalid scroll dimensions detected, skipping update', 'warn');
                return;
            }

            // Use PositionCalculator for precise mapping - Requirements 6.3, 6.4, 6.5
            const progress = this.positionCalculator.getScrollProgress(
                scrollY,
                documentHeight,
                viewportHeight
            );

            const videoTime = this.positionCalculator.getVideoTime(
                progress,
                this.videoState.duration
            );

            // Additional validation for calculated values
            if (!this.validateCalculatedValues(progress, videoTime)) {
                this.log('Invalid calculated values, skipping update', 'warn');
                return;
            }

            // Update video position - Requirements 2.1, 2.2, 3.1
            this.updateVideoPosition(progress, videoTime);

            // Update scroll state
            this.scrollState.lastProgress = progress;

            // Log debug information if enabled
            if (this.options.enableLogging) {
                this.log(`Scroll update - Progress: ${progress.toFixed(3)}, Video time: ${videoTime.toFixed(2)}s`);
            }

        } catch (error) {
            this.log(`Error updating video from scroll: ${error.message}`, 'error');
            
            // Attempt recovery by disabling and re-enabling scroll control
            if (!this.scrollErrorRecoveryAttempted) {
                this.scrollErrorRecoveryAttempted = true;
                this.log('Attempting scroll error recovery', 'warn');
                
                setTimeout(() => {
                    this.disableScrollControl();
                    setTimeout(() => {
                        if (this.isReady()) {
                            this.enableScrollControl();
                        }
                        this.scrollErrorRecoveryAttempted = false;
                    }, 100);
                }, 50);
            }
        }
    }

    /**
     * Update video position with the calculated progress and time
     * Ensures smooth frame updates without stuttering
     * Enhanced with boundary condition handling
     * 
     * @param {number} progress - Scroll progress (0-1)
     * @param {number} videoTime - Target video time in seconds
     * 
     * Requirements: 2.1, 2.2, 3.1, 4.1, 4.2, 8.3, 8.4
     */
    updateVideoPosition(progress, videoTime) {
        // Enhanced input validation with edge case handling
        if (typeof progress !== 'number' || !isFinite(progress)) {
            this.log(`Invalid progress value: ${progress}`, 'warn');
            return;
        }

        if (progress < 0 || progress > 1) {
            this.log(`Progress out of bounds: ${progress}, clamping`, 'warn');
            progress = Math.max(0, Math.min(1, progress));
        }

        if (typeof videoTime !== 'number' || !isFinite(videoTime)) {
            this.log(`Invalid video time: ${videoTime}`, 'warn');
            return;
        }

        if (videoTime < 0 || videoTime > this.videoState.duration) {
            this.log(`Video time out of bounds: ${videoTime}, clamping`, 'warn');
            videoTime = Math.max(0, Math.min(videoTime, this.videoState.duration));
        }

        // Handle edge cases at document boundaries
        try {
            // Check if we're at exact boundaries and handle precision issues
            const isAtStart = Math.abs(progress) < Number.EPSILON;
            const isAtEnd = Math.abs(progress - 1) < Number.EPSILON;

            if (isAtStart) {
                videoTime = 0;
                this.log('At document start, setting video to beginning', 'debug');
            } else if (isAtEnd) {
                videoTime = this.videoState.duration;
                this.log('At document end, setting video to end', 'debug');
            }

            // Prevent unnecessary updates if the time hasn't changed significantly
            const timeDifference = Math.abs(videoTime - this.videoState.currentTime);
            const minimumChange = 1 / 60; // ~16ms at 60fps, prevents micro-updates

            if (timeDifference < minimumChange && !isAtStart && !isAtEnd) {
                // Skip update for very small changes unless at boundaries
                return;
            }

            // Update video currentTime with error handling
            const previousTime = this.videoElement.currentTime;
            this.videoElement.currentTime = videoTime;
            
            // Verify the update was successful
            if (Math.abs(this.videoElement.currentTime - videoTime) > 0.1) {
                this.log(`Video time update may have failed: requested ${videoTime}, got ${this.videoElement.currentTime}`, 'warn');
            }

            // Update internal state
            this.videoState.currentTime = videoTime;

            // Dispatch custom event for external listeners
            this.dispatchCustomEvent('positionUpdate', {
                progress,
                videoTime,
                scrollY: this.getScrollPositionSafe(),
                previousTime,
                isAtBoundary: isAtStart || isAtEnd
            });

        } catch (error) {
            this.log(`Error updating video position: ${error.message}`, 'error');
            
            // Attempt recovery
            try {
                this.videoElement.currentTime = Math.max(0, Math.min(videoTime, this.videoState.duration));
                this.videoState.currentTime = this.videoElement.currentTime;
            } catch (recoveryError) {
                this.log(`Video position recovery failed: ${recoveryError.message}`, 'error');
            }
        }
    }

    /**
     * Handle window resize events
     * Fallback method when ResponsiveManager is not available
     * 
     * Requirements: 5.4, 1.3
     */
    handleResize() {
        if (this.responsiveManager) {
            // ResponsiveManager handles this
            return;
        }

        // Fallback resize handling
        this.log('Window resized - basic resize handling');
        this.dispatchCustomEvent('resize');
    }
    /**
     * Display error message to user with appropriate styling and actions
     *
     * @param {string} errorMessage - Error message to display
     * @param {string} fallbackAction - Type of fallback action (retry/fallback)
     *
     * Requirements: 7.3, 10.2
     */
    displayErrorMessage(errorMessage, fallbackAction) {
        // Remove any existing error display
        this.removeErrorDisplay();

        // Create error overlay
        const errorOverlay = document.createElement('div');
        errorOverlay.id = 'scroll-video-error-overlay';
        errorOverlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            z-index: 10000;
            max-width: 400px;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        // Create error content
        const errorTitle = document.createElement('h3');
        errorTitle.textContent = 'Video Loading Error';
        errorTitle.style.cssText = 'margin: 0 0 10px 0; color: #ff6b6b;';

        const errorText = document.createElement('p');
        errorText.textContent = errorMessage;
        errorText.style.cssText = 'margin: 0 0 15px 0; line-height: 1.4;';

        // Create action buttons based on fallback type
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center;';

        if (fallbackAction === 'retry') {
            const retryButton = document.createElement('button');
            retryButton.textContent = 'Retry';
            retryButton.style.cssText = `
                background: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            `;
            retryButton.onclick = () => this.retryVideoLoad();
            buttonContainer.appendChild(retryButton);
        }

        const dismissButton = document.createElement('button');
        dismissButton.textContent = 'Dismiss';
        dismissButton.style.cssText = `
            background: #666;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        dismissButton.onclick = () => this.removeErrorDisplay();
        buttonContainer.appendChild(dismissButton);

        // Assemble error overlay
        errorOverlay.appendChild(errorTitle);
        errorOverlay.appendChild(errorText);
        errorOverlay.appendChild(buttonContainer);

        // Add to document
        document.body.appendChild(errorOverlay);

        // Store reference for cleanup
        this.errorOverlay = errorOverlay;

        this.log('Error message displayed to user');
    }

    /**
     * Remove error display overlay
     *
     * Requirements: 7.3
     */
    removeErrorDisplay() {
        if (this.errorOverlay && this.errorOverlay.parentNode) {
            this.errorOverlay.parentNode.removeChild(this.errorOverlay);
            this.errorOverlay = null;
            this.log('Error display removed');
        }
    }

    /**
     * Handle error fallback behavior based on error type
     *
     * @param {MediaError} error - Video error object
     * @param {string} fallbackAction - Type of fallback action
     *
     * Requirements: 7.3, 10.4
     */
    handleErrorFallback(error, fallbackAction) {
        if (fallbackAction === 'fallback') {
            // For corrupted files or unsupported formats, try alternative approaches
            this.attemptVideoFallback();
        } else if (fallbackAction === 'retry') {
            // For network errors, set up automatic retry with backoff
            this.scheduleRetry();
        }
    }

    /**
     * Attempt video fallback for corrupted or unsupported files
     *
     * Requirements: 7.3, 10.4
     */
    attemptVideoFallback() {
        this.log('Attempting video fallback for corrupted/unsupported file');

        // Try to reload with different parameters
        const currentSrc = this.videoElement.src;
        if (currentSrc) {
            // Add cache-busting parameter to force reload
            const separator = currentSrc.includes('?') ? '&' : '?';
            const fallbackSrc = `${currentSrc}${separator}fallback=${Date.now()}`;

            this.log(`Trying fallback source: ${fallbackSrc}`);

            // Set up one-time listeners for fallback attempt
            const onFallbackSuccess = () => {
                this.log('Fallback video load successful');
                this.removeErrorDisplay();
                this.videoElement.removeEventListener('loadedmetadata', onFallbackSuccess);
                this.videoElement.removeEventListener('error', onFallbackFailed);
            };

            const onFallbackFailed = () => {
                this.log('Fallback video load failed - no more options available', 'error');
                this.videoElement.removeEventListener('loadedmetadata', onFallbackSuccess);
                this.videoElement.removeEventListener('error', onFallbackFailed);

                // Update error message to indicate final failure
                this.videoState.errorMessage = 'Video file cannot be loaded. Please check the file format and try again.';
                this.displayErrorMessage(this.videoState.errorMessage, 'none');
            };

            this.videoElement.addEventListener('loadedmetadata', onFallbackSuccess, { once: true });
            this.videoElement.addEventListener('error', onFallbackFailed, { once: true });

            // Attempt to load fallback source
            this.videoElement.src = fallbackSrc;
            this.videoElement.load();
        }
    }

    /**
     * Schedule automatic retry for network-related errors
     *
     * Requirements: 7.3
     */
    scheduleRetry() {
        // Implement exponential backoff for retries
        if (!this.retryCount) {
            this.retryCount = 0;
        }

        if (this.retryCount >= 3) {
            this.log('Maximum retry attempts reached', 'warn');
            this.videoState.errorMessage = 'Unable to load video after multiple attempts. Please check your connection and try again.';
            this.displayErrorMessage(this.videoState.errorMessage, 'retry');
            return;
        }

        const retryDelay = Math.pow(2, this.retryCount) * 1000; // 1s, 2s, 4s
        this.retryCount++;

        this.log(`Scheduling retry ${this.retryCount}/3 in ${retryDelay}ms`);

        this.retryTimeout = setTimeout(() => {
            this.retryVideoLoad();
        }, retryDelay);
    }

    /**
     * Retry video loading
     *
     * Requirements: 7.3
     */
    retryVideoLoad() {
        this.log('Retrying video load');

        // Clear any existing retry timeout
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }

        // Reset error state
        this.videoState.hasError = false;
        this.videoState.errorMessage = null;
        this.removeErrorDisplay();

        // Reload the video
        this.videoElement.load();

        // Dispatch retry event
        this.dispatchCustomEvent('videoRetry', {
            attempt: this.retryCount || 1,
            timestamp: Date.now()
        });
    }

    /**
     * Validate video file accessibility before loading
     *
     * @param {string} videoSrc - Video source URL
     * @returns {Promise<boolean>} Promise resolving to accessibility status
     *
     * Requirements: 10.4
     */
    async validateVideoAccessibility(videoSrc) {
        try {
            this.log(`Validating video accessibility: ${videoSrc}`);

            // Use fetch to check if the video file is accessible
            const response = await fetch(videoSrc, {
                method: 'HEAD',
                cache: 'no-cache'
            });

            if (!response.ok) {
                this.log(`Video file not accessible: ${response.status} ${response.statusText}`, 'error');
                return false;
            }

            // Check content type if available
            const contentType = response.headers.get('content-type');
            if (contentType && !contentType.startsWith('video/')) {
                this.log(`Invalid content type: ${contentType}`, 'warn');
                return false;
            }

            // Check content length if available
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) === 0) {
                this.log('Video file appears to be empty', 'warn');
                return false;
            }

            this.log('Video file accessibility validated successfully');
            return true;

        } catch (error) {
            this.log(`Video accessibility validation failed: ${error.message}`, 'error');
            return false;
        }
    }
    /**
     * Get scroll position with safe fallback handling
     *
     * @returns {number} Current scroll position
     *
     * Requirements: 8.3, 8.4
     */
    getScrollPositionSafe() {
        try {
            const methods = [
                () => window.scrollY,
                () => window.pageYOffset,
                () => document.documentElement.scrollTop,
                () => document.body.scrollTop
            ];

            for (const method of methods) {
                try {
                    const scrollY = method();
                    if (typeof scrollY === 'number' && scrollY >= 0 && isFinite(scrollY)) {
                        return scrollY;
                    }
                } catch (error) {
                    // Continue to next method
                }
            }

            return 0; // Safe fallback
        } catch (error) {
            this.log(`Error getting scroll position: ${error.message}`, 'warn');
            return 0;
        }
    }

    /**
     * Get document height with safe fallback handling
     *
     * @returns {number} Document height
     *
     * Requirements: 8.3, 8.4
     */
    getDocumentHeightSafe() {
        try {
            const methods = [
                () => document.documentElement.scrollHeight,
                () => document.body.scrollHeight,
                () => Math.max(
                    document.documentElement.scrollHeight || 0,
                    document.documentElement.offsetHeight || 0,
                    document.documentElement.clientHeight || 0,
                    document.body.scrollHeight || 0,
                    document.body.offsetHeight || 0,
                    document.body.clientHeight || 0
                )
            ];

            for (const method of methods) {
                try {
                    const height = method();
                    if (typeof height === 'number' && height > 0 && isFinite(height)) {
                        return height;
                    }
                } catch (error) {
                    // Continue to next method
                }
            }

            // Final fallback based on viewport
            const viewportHeight = this.getViewportHeightSafe();
            return Math.max(viewportHeight * 2, 1000);
        } catch (error) {
            this.log(`Error getting document height: ${error.message}`, 'warn');
            return 1000;
        }
    }

    /**
     * Get viewport height with safe fallback handling
     *
     * @returns {number} Viewport height
     *
     * Requirements: 8.3, 8.4
     */
    getViewportHeightSafe() {
        try {
            const methods = [
                () => window.innerHeight,
                () => document.documentElement.clientHeight,
                () => document.body.clientHeight
            ];

            for (const method of methods) {
                try {
                    const height = method();
                    if (typeof height === 'number' && height > 0 && isFinite(height)) {
                        return height;
                    }
                } catch (error) {
                    // Continue to next method
                }
            }

            return 600; // Common default viewport height
        } catch (error) {
            this.log(`Error getting viewport height: ${error.message}`, 'warn');
            return 600;
        }
    }

    /**
     * Validate scroll dimensions for consistency and safety
     *
     * @param {number} scrollY - Scroll position
     * @param {number} documentHeight - Document height
     * @param {number} viewportHeight - Viewport height
     * @returns {boolean} True if dimensions are valid
     *
     * Requirements: 8.3, 8.4
     */
    validateScrollDimensions(scrollY, documentHeight, viewportHeight) {
        // Check for valid numeric values
        if (typeof scrollY !== 'number' || !isFinite(scrollY) || scrollY < 0) {
            this.log(`Invalid scrollY: ${scrollY}`, 'warn');
            return false;
        }

        if (typeof documentHeight !== 'number' || !isFinite(documentHeight) || documentHeight <= 0) {
            this.log(`Invalid documentHeight: ${documentHeight}`, 'warn');
            return false;
        }

        if (typeof viewportHeight !== 'number' || !isFinite(viewportHeight) || viewportHeight <= 0) {
            this.log(`Invalid viewportHeight: ${viewportHeight}`, 'warn');
            return false;
        }

        // Check for reasonable relationships
        if (documentHeight < viewportHeight / 2) {
            this.log(`Suspicious document height (${documentHeight}) vs viewport (${viewportHeight})`, 'warn');
            // Allow but warn - might be a very short document
        }

        if (scrollY > documentHeight) {
            this.log(`ScrollY (${scrollY}) exceeds document height (${documentHeight})`, 'warn');
            // This might be valid in some edge cases, so don't fail
        }

        return true;
    }

    /**
     * Validate calculated progress and video time values
     *
     * @param {number} progress - Calculated progress
     * @param {number} videoTime - Calculated video time
     * @returns {boolean} True if values are valid
     *
     * Requirements: 8.3, 8.4
     */
    validateCalculatedValues(progress, videoTime) {
        // Validate progress
        if (typeof progress !== 'number' || !isFinite(progress)) {
            this.log(`Invalid progress value: ${progress}`, 'warn');
            return false;
        }

        if (progress < 0 || progress > 1) {
            this.log(`Progress out of bounds: ${progress}`, 'warn');
            return false;
        }

        // Validate video time
        if (typeof videoTime !== 'number' || !isFinite(videoTime)) {
            this.log(`Invalid video time: ${videoTime}`, 'warn');
            return false;
        }

        if (videoTime < 0 || videoTime > this.videoState.duration) {
            this.log(`Video time out of bounds: ${videoTime} (duration: ${this.videoState.duration})`, 'warn');
            return false;
        }

        return true;
    }

    /**
     * Add event listener and store reference for cleanup
     * Enhanced with lifecycle management and memory leak prevention
     * 
     * @param {EventTarget} target - Event target
     * @param {string} type - Event type
     * @param {Function} listener - Event listener function
     * @param {Object} options - Event listener options
     * 
     * Requirements: 9.1, 9.2, 9.3, 9.4
     */
    addEventListener(target, type, listener, options = {}) {
        // Prevent adding listeners after component is destroyed
        if (this.isDestroyed) {
            this.log(`Attempted to add event listener after component destruction: ${type}`, 'warn');
            return;
        }

        // Validate inputs
        if (!target || typeof target.addEventListener !== 'function') {
            this.log(`Invalid event target for ${type} listener`, 'error');
            return;
        }

        if (typeof listener !== 'function') {
            this.log(`Invalid listener function for ${type} event`, 'error');
            return;
        }

        try {
            // Add the event listener
            target.addEventListener(type, listener, options);
            
            // Create unique key for this listener
            const targetKey = this.getTargetKey(target);
            const key = `${targetKey}_${type}_${listener.name || 'anonymous'}`;
            
            // Store for cleanup with enhanced metadata
            const listenerData = {
                target,
                type,
                listener,
                options: { ...options },
                addedAt: Date.now(),
                targetKey
            };
            
            this.eventListeners.set(key, listenerData);
            
            if (this.options.enableLogging) {
                this.log(`Added event listener: ${type} on ${targetKey}`);
            }
            
        } catch (error) {
            this.log(`Failed to add event listener ${type}: ${error.message}`, 'error');
        }
    }

    /**
     * Remove event listener with enhanced cleanup
     * 
     * @param {EventTarget} target - Event target
     * @param {string} type - Event type
     * @param {Function} listener - Event listener function
     * 
     * Requirements: 9.3, 9.4
     */
    removeEventListener(target, type, listener) {
        if (!target || typeof target.removeEventListener !== 'function') {
            this.log(`Invalid event target for ${type} listener removal`, 'error');
            return;
        }

        try {
            // Remove the event listener
            target.removeEventListener(type, listener);
            
            // Find and remove from storage
            const targetKey = this.getTargetKey(target);
            const key = `${targetKey}_${type}_${listener.name || 'anonymous'}`;
            
            if (this.eventListeners.has(key)) {
                this.eventListeners.delete(key);
                
                if (this.options.enableLogging) {
                    this.log(`Removed event listener: ${type} from ${targetKey}`);
                }
            }
            
        } catch (error) {
            this.log(`Failed to remove event listener ${type}: ${error.message}`, 'error');
        }
    }

    /**
     * Get a unique key for an event target
     * 
     * @param {EventTarget} target - Event target
     * @returns {string} Unique key for the target
     */
    getTargetKey(target) {
        if (target === window) {
            return 'window';
        } else if (target === document) {
            return 'document';
        } else if (target === this.videoElement) {
            return 'video';
        } else if (target.id) {
            return `element_${target.id}`;
        } else if (target.tagName) {
            return `${target.tagName.toLowerCase()}_${Date.now()}`;
        } else {
            return `target_${Date.now()}`;
        }
    }

    /**
     * Remove all event listeners of a specific type
     * 
     * @param {string} type - Event type to remove
     * 
     * Requirements: 9.3, 9.4
     */
    removeAllListenersOfType(type) {
        const listenersToRemove = [];
        
        for (const [key, listenerData] of this.eventListeners) {
            if (listenerData.type === type) {
                listenersToRemove.push({ key, ...listenerData });
            }
        }
        
        for (const { key, target, type: eventType, listener } of listenersToRemove) {
            this.removeEventListener(target, eventType, listener);
        }
        
        if (this.options.enableLogging && listenersToRemove.length > 0) {
            this.log(`Removed ${listenersToRemove.length} listeners of type: ${type}`);
        }
    }

    /**
     * Get count of active event listeners for monitoring
     * 
     * @returns {Object} Listener counts by type and target
     */
    getEventListenerStats() {
        const stats = {
            total: this.eventListeners.size,
            byType: {},
            byTarget: {}
        };
        
        for (const [key, { type, targetKey }] of this.eventListeners) {
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            stats.byTarget[targetKey] = (stats.byTarget[targetKey] || 0) + 1;
        }
        
        return stats;
    }

    /**
     * Dispatch custom events for external listeners
     * 
     * @param {string} eventType - Event type
     * @param {Object} detail - Event detail data
     */
    dispatchCustomEvent(eventType, detail = {}) {
        try {
            const event = new CustomEvent(`scrollvideo:${eventType}`, {
                detail: {
                    player: this,
                    videoState: { ...this.videoState },
                    ...detail
                }
            });
            
            this.videoElement.dispatchEvent(event);
        } catch (error) {
            // Fallback for test environments or older browsers
            if (this.options.enableLogging) {
                this.log(`Custom event dispatched: scrollvideo:${eventType}`, 'log');
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
            console[level](`[ScrollVideoPlayer] ${message}`);
        }
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
     * Get current scroll state
     * 
     * @returns {Object} Current scroll state
     */
    getScrollState() {
        return { ...this.scrollState };
    }

    /**
     * Check if the player is ready for scroll control
     * 
     * @returns {boolean} True if ready
     */
    isReady() {
        return this.videoState.isMetadataLoaded && !this.videoState.hasError && !this.isDestroyed;
    }

    /**
     * Check for potential memory leaks and provide debugging information
     * 
     * @returns {Object} Memory leak analysis
     * 
     * Requirements: 9.3, 9.4
     */
    checkMemoryLeaks() {
        const analysis = {
            isDestroyed: this.isDestroyed,
            activeListeners: this.eventListeners.size,
            listenerStats: this.getEventListenerStats(),
            pendingTimeouts: {
                resizeTimeout: !!this.resizeTimeout,
                scrollThrottleTimeout: !!this.scrollState.throttleTimeout,
                frameRequestId: !!this.scrollState.frameRequestId
            },
            potentialLeaks: []
        };

        // Check for potential leaks
        if (this.isDestroyed && this.eventListeners.size > 0) {
            analysis.potentialLeaks.push(`${this.eventListeners.size} event listeners still active after destroy`);
        }

        if (this.scrollState.frameRequestId && this.isDestroyed) {
            analysis.potentialLeaks.push('RequestAnimationFrame still pending after destroy');
        }

        if ((this.resizeTimeout || this.scrollState.throttleTimeout) && this.isDestroyed) {
            analysis.potentialLeaks.push('Timeouts still active after destroy');
        }

        // Check for excessive listeners
        if (this.eventListeners.size > 10) {
            analysis.potentialLeaks.push(`High number of active listeners: ${this.eventListeners.size}`);
        }

        return analysis;
    }

    /**
     * Clean up event listeners and resources
     * Enhanced with comprehensive memory leak prevention
     * Should be called when the component is no longer needed
     * 
     * Requirements: 9.1, 9.2, 9.3, 9.4
     */
    destroy() {
        // Prevent multiple destroy calls
        if (this.isDestroyed) {
            this.log('Component already destroyed', 'warn');
            return;
        }

        this.log('Destroying ScrollVideoPlayer');

        // Mark as destroyed to prevent new listeners
        this.isDestroyed = true;

        // Disable scroll control (includes cleanup of RAF and timeouts)
        this.disableScrollControl();

        // Remove all event listeners with detailed logging
        const listenerCount = this.eventListeners.size;
        for (const [key, { target, type, listener }] of this.eventListeners) {
            try {
                target.removeEventListener(type, listener);
                if (this.options.enableLogging) {
                    this.log(`Cleaned up listener: ${type} from ${key}`);
                }
            } catch (error) {
                this.log(`Error removing listener ${key}: ${error.message}`, 'error');
            }
        }
        this.eventListeners.clear();

        if (this.options.enableLogging && listenerCount > 0) {
            this.log(`Cleaned up ${listenerCount} event listeners`);
        }

        // Clear timeouts and performance-related resources
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        
        // Clear any remaining scroll throttle timeout
        if (this.scrollState.throttleTimeout) {
            clearTimeout(this.scrollState.throttleTimeout);
            this.scrollState.throttleTimeout = null;
        }

        // Clear retry timeout
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }

        // Remove error display
        this.removeErrorDisplay();

        // Destroy ResponsiveManager if it exists
        if (this.responsiveManager && typeof this.responsiveManager.destroy === 'function') {
            try {
                this.responsiveManager.destroy();
            } catch (error) {
                this.log(`Error destroying ResponsiveManager: ${error.message}`, 'error');
            }
        }

        // Reset all state to prevent memory leaks
        this.videoState = {
            duration: 0,
            currentTime: 0,
            isLoaded: false,
            isMetadataLoaded: false,
            aspectRatio: 16 / 9,
            hasError: false,
            errorMessage: null
        };

        this.scrollState = {
            isScrolling: false,
            lastScrollTime: 0,
            lastProgress: 0,
            frameRequestId: null,
            throttleTimeout: null,
            lastThrottleTime: 0,
            targetFPS: 60,
            frameInterval: 1000 / 60
        };

        // Clear references to prevent memory leaks
        this.videoElement = null;
        this.positionCalculator = null;
        this.responsiveManager = null;
        this.handleScrollBound = null;

        this.log('ScrollVideoPlayer destroyed successfully');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollVideoPlayer;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.ScrollVideoPlayer = ScrollVideoPlayer;
}