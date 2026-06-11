/**
 * PositionCalculator Component
 * 
 * Handles the core scroll-to-video mapping functionality with bounds checking
 * and validation. Maps scroll position to normalized progress (0-1) and 
 * converts progress to video timeline position.
 * 
 * Requirements: 6.3, 6.4, 6.5
 */
class PositionCalculator {
    /**
     * Calculate scroll progress as a normalized value between 0 and 1
     * Enhanced with comprehensive edge case handling
     * 
     * @param {number} scrollY - Current vertical scroll position
     * @param {number} documentHeight - Total document height
     * @param {number} viewportHeight - Viewport height
     * @returns {number} Progress value between 0 and 1 inclusive
     * 
     * Preconditions:
     * - scrollY must be non-negative
     * - documentHeight must be positive
     * - viewportHeight must be positive
     * 
     * Postconditions:
     * - Returns value between 0 and 1 inclusive
     * - 0 represents top of document, 1 represents bottom
     * - Function is pure (no side effects)
     * 
     * Requirements: 8.3, 8.4
     */
    getScrollProgress(scrollY, documentHeight, viewportHeight) {
        // Enhanced input validation with edge case handling
        if (typeof scrollY !== 'number' || isNaN(scrollY)) {
            console.warn('Invalid scrollY value (not a number):', scrollY, 'Using 0');
            scrollY = 0;
        }
        
        if (!isFinite(scrollY) || scrollY < 0) {
            console.warn('Invalid scrollY value (infinite or negative):', scrollY, 'Using 0');
            scrollY = 0;
        }
        
        if (typeof documentHeight !== 'number' || isNaN(documentHeight) || !isFinite(documentHeight) || documentHeight <= 0) {
            console.warn('Invalid documentHeight value:', documentHeight, 'Using fallback calculation');
            // Fallback: use viewport height + some content
            documentHeight = Math.max(viewportHeight * 2, 1000);
        }
        
        if (typeof viewportHeight !== 'number' || isNaN(viewportHeight) || viewportHeight <= 0) {
            console.warn('Invalid viewportHeight value:', viewportHeight, 'Using fallback');
            // Fallback: use common viewport height
            viewportHeight = Math.max(window.innerHeight || 600, 400);
        }

        // Handle edge case where document height is extremely large (potential overflow)
        if (documentHeight > Number.MAX_SAFE_INTEGER / 2) {
            console.warn('Document height exceeds safe limits:', documentHeight, 'Using capped value');
            documentHeight = Number.MAX_SAFE_INTEGER / 2;
        }

        // Calculate maximum scrollable distance with boundary validation
        const maxScroll = documentHeight - viewportHeight;
        
        // Handle edge cases for document-viewport relationship
        if (maxScroll <= 0) {
            // Document is shorter than or equal to viewport
            console.log('Document height <= viewport height, returning progress 0');
            return 0;
        }

        // Handle edge case where scrollY exceeds maximum possible scroll
        if (scrollY > maxScroll) {
            console.warn('ScrollY exceeds maximum scroll:', scrollY, 'vs', maxScroll, 'Clamping to max');
            scrollY = maxScroll;
        }
        
        // Calculate raw progress with precision handling
        const rawProgress = maxScroll > 0 ? scrollY / maxScroll : 0;
        
        // Handle floating point precision issues
        if (Math.abs(rawProgress - 1) < Number.EPSILON) {
            return 1;
        }
        if (Math.abs(rawProgress) < Number.EPSILON) {
            return 0;
        }
        
        // Clamp progress to bounds [0, 1] with enhanced validation
        return this.clampProgress(rawProgress);
    }

    /**
     * Convert progress value to video timeline position
     * Enhanced with comprehensive boundary condition handling
     * 
     * @param {number} progress - Normalized progress value (0-1)
     * @param {number} videoDuration - Total video duration in seconds
     * @returns {number} Video time in seconds
     * 
     * Preconditions:
     * - progress must be between 0 and 1 inclusive
     * - videoDuration must be positive
     * 
     * Postconditions:
     * - Returns value between 0 and videoDuration inclusive
     * - Video time equals progress * videoDuration
     * - No mutations to input parameters
     * 
     * Requirements: 8.3, 8.4
     */
    getVideoTime(progress, videoDuration) {
        // Enhanced input validation with edge case handling
        if (typeof progress !== 'number' || isNaN(progress)) {
            console.warn('Invalid progress value (not a number):', progress, 'Using 0');
            progress = 0;
        }
        
        if (typeof videoDuration !== 'number' || isNaN(videoDuration)) {
            console.warn('Invalid videoDuration value (not a number):', videoDuration, 'Using 0');
            return 0;
        }

        if (videoDuration <= 0) {
            console.warn('Invalid videoDuration value (non-positive):', videoDuration, 'Using 0');
            return 0;
        }

        // Handle edge case where video duration is extremely large
        if (videoDuration > Number.MAX_SAFE_INTEGER / 1000) {
            console.warn('Video duration exceeds safe limits:', videoDuration, 'Using capped value');
            videoDuration = Number.MAX_SAFE_INTEGER / 1000;
        }
        
        // Clamp progress to ensure it's within bounds with enhanced precision
        const clampedProgress = this.clampProgress(progress);
        
        // Handle boundary conditions with precision
        if (clampedProgress === 0) {
            return 0;
        }
        if (clampedProgress === 1) {
            return videoDuration;
        }
        
        // Calculate video time with precision handling
        const videoTime = clampedProgress * videoDuration;
        
        // Handle floating point precision issues near boundaries
        if (Math.abs(videoTime - videoDuration) < Number.EPSILON) {
            return videoDuration;
        }
        if (Math.abs(videoTime) < Number.EPSILON) {
            return 0;
        }
        
        // Ensure video time doesn't exceed duration due to floating point precision
        const clampedVideoTime = Math.min(Math.max(videoTime, 0), videoDuration);
        
        // Additional validation for edge cases
        if (clampedVideoTime < 0 || clampedVideoTime > videoDuration) {
            console.warn('Video time calculation resulted in out-of-bounds value:', clampedVideoTime, 'Clamping to bounds');
            return Math.min(Math.max(clampedVideoTime, 0), videoDuration);
        }
        
        return clampedVideoTime;
    }

    /**
     * Clamp progress value to bounds [0, 1] with enhanced edge case handling
     * 
     * @param {number} progress - Raw progress value
     * @returns {number} Clamped progress value between 0 and 1 inclusive
     * 
     * Preconditions:
     * - progress can be any number
     * 
     * Postconditions:
     * - Returns value between 0 and 1 inclusive
     * - Values < 0 become 0
     * - Values > 1 become 1
     * - Values between 0 and 1 remain unchanged
     * - Handles floating point precision issues
     * 
     * Requirements: 8.3, 8.4
     */
    clampProgress(progress) {
        // Handle non-numeric values
        if (typeof progress !== 'number') {
            console.warn('Invalid progress value for clamping (not a number):', progress, 'Using 0');
            return 0;
        }

        // Handle NaN and infinite values
        if (isNaN(progress)) {
            console.warn('Invalid progress value for clamping (NaN):', progress, 'Using 0');
            return 0;
        }

        if (!isFinite(progress)) {
            console.warn('Invalid progress value for clamping (not finite):', progress, 'Using', progress > 0 ? '1' : '0');
            return progress > 0 ? 1 : 0;
        }

        // Handle floating point precision issues near boundaries
        if (Math.abs(progress) < Number.EPSILON) {
            return 0;
        }
        if (Math.abs(progress - 1) < Number.EPSILON) {
            return 1;
        }

        // Standard clamping with enhanced precision
        const clamped = Math.max(0, Math.min(1, progress));

        // Final validation to ensure result is within bounds
        if (clamped < 0 || clamped > 1) {
            console.warn('Clamping resulted in out-of-bounds value:', clamped, 'Force clamping');
            return clamped < 0 ? 0 : 1;
        }

        return clamped;
    }

    /**
     * Validate that all calculations maintain expected invariants
     * Used for debugging and testing
     * 
     * @param {number} scrollY - Current scroll position
     * @param {number} documentHeight - Document height
     * @param {number} viewportHeight - Viewport height
     * @param {number} videoDuration - Video duration
     * @returns {Object} Validation results with calculated values
     */
    validateCalculations(scrollY, documentHeight, viewportHeight, videoDuration) {
        const progress = this.getScrollProgress(scrollY, documentHeight, viewportHeight);
        const videoTime = this.getVideoTime(progress, videoDuration);
        
        const validation = {
            inputs: { scrollY, documentHeight, viewportHeight, videoDuration },
            outputs: { progress, videoTime },
            isValid: true,
            errors: []
        };
        
        // Validate progress bounds
        if (progress < 0 || progress > 1) {
            validation.isValid = false;
            validation.errors.push(`Progress ${progress} is outside bounds [0, 1]`);
        }
        
        // Validate video time bounds
        if (videoTime < 0 || videoTime > videoDuration) {
            validation.isValid = false;
            validation.errors.push(`Video time ${videoTime} is outside bounds [0, ${videoDuration}]`);
        }
        
        // Validate monotonic relationship (for debugging)
        validation.maxScroll = documentHeight - viewportHeight;
        validation.progressRatio = validation.maxScroll > 0 ? scrollY / validation.maxScroll : 0;
        
        return validation;
    }
    /**
     * Get document height with fallback handling for edge cases
     *
     * @returns {number} Document height with fallback values
     *
     * Requirements: 8.3, 8.4
     */
    getDocumentHeight() {
        try {
            // Try multiple methods to get document height
            const methods = [
                () => document.documentElement.scrollHeight,
                () => document.body.scrollHeight,
                () => Math.max(
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight,
                    document.documentElement.clientHeight,
                    document.body.scrollHeight,
                    document.body.offsetHeight,
                    document.body.clientHeight
                )
            ];

            for (const method of methods) {
                try {
                    const height = method();
                    if (typeof height === 'number' && height > 0 && isFinite(height)) {
                        return height;
                    }
                } catch (error) {
                    console.warn('Document height calculation method failed:', error.message);
                }
            }

            // Final fallback
            console.warn('All document height methods failed, using viewport-based fallback');
            return Math.max(window.innerHeight * 2, 1000);

        } catch (error) {
            console.error('Critical error in document height calculation:', error.message);
            return 1000; // Emergency fallback
        }
    }

    /**
     * Get viewport height with fallback handling
     *
     * @returns {number} Viewport height with fallback values
     *
     * Requirements: 8.3, 8.4
     */
    getViewportHeight() {
        try {
            // Try multiple methods to get viewport height
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
                    console.warn('Viewport height calculation method failed:', error.message);
                }
            }

            // Final fallback
            console.warn('All viewport height methods failed, using default fallback');
            return 600; // Common default viewport height

        } catch (error) {
            console.error('Critical error in viewport height calculation:', error.message);
            return 600; // Emergency fallback
        }
    }

    /**
     * Get current scroll position with boundary validation
     *
     * @returns {number} Current scroll position with bounds checking
     *
     * Requirements: 8.3, 8.4
     */
    getCurrentScrollPosition() {
        try {
            // Try multiple methods to get scroll position
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
                    console.warn('Scroll position calculation method failed:', error.message);
                }
            }

            // Final fallback
            console.warn('All scroll position methods failed, using 0');
            return 0;

        } catch (error) {
            console.error('Critical error in scroll position calculation:', error.message);
            return 0; // Emergency fallback
        }
    }

    /**
     * Calculate scroll progress with automatic dimension detection and edge case handling
     *
     * @returns {number} Progress value between 0 and 1 inclusive
     *
     * Requirements: 8.3, 8.4
     */
    getScrollProgressAuto() {
        const scrollY = this.getCurrentScrollPosition();
        const documentHeight = this.getDocumentHeight();
        const viewportHeight = this.getViewportHeight();

        return this.getScrollProgress(scrollY, documentHeight, viewportHeight);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PositionCalculator;
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.PositionCalculator = PositionCalculator;
}