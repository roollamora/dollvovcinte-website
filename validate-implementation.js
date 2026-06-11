/**
 * Validation script for PositionCalculator implementation
 * Tests the component in isolation and validates requirements
 */

const PositionCalculator = require('./position-calculator.js');

function validateImplementation() {
    console.log('🔍 Validating PositionCalculator Implementation\n');
    
    const calculator = new PositionCalculator();
    let validationsPassed = 0;
    let validationsTotal = 0;
    
    function validate(name, testFn) {
        validationsTotal++;
        try {
            const result = testFn();
            if (result) {
                console.log(`✓ ${name}`);
                validationsPassed++;
            } else {
                console.log(`✗ ${name}: Test returned false`);
            }
        } catch (error) {
            console.log(`✗ ${name}: ${error.message}`);
        }
    }
    
    // Requirement 6.3: Linear progress mapping
    validate('Requirement 6.3: Linear progress mapping', () => {
        const documentHeight = 2000;
        const viewportHeight = 1000;
        const maxScroll = documentHeight - viewportHeight;
        
        // Test linearity at multiple points
        for (let i = 0; i <= 10; i++) {
            const scrollY = (i / 10) * maxScroll;
            const expectedProgress = i / 10;
            const actualProgress = calculator.getScrollProgress(scrollY, documentHeight, viewportHeight);
            
            if (Math.abs(actualProgress - expectedProgress) > 0.0001) {
                throw new Error(`Non-linear mapping at ${i * 10}%: expected ${expectedProgress}, got ${actualProgress}`);
            }
        }
        return true;
    });
    
    // Requirement 6.4: Progress bounds [0, 1]
    validate('Requirement 6.4: Progress value bounds [0, 1]', () => {
        const testCases = [
            { scrollY: -1000, expected: 0 },  // Below minimum
            { scrollY: 0, expected: 0 },      // At minimum
            { scrollY: 500, expected: 0.5 },  // Middle
            { scrollY: 1000, expected: 1 },   // At maximum
            { scrollY: 2000, expected: 1 }    // Above maximum
        ];
        
        for (const testCase of testCases) {
            const progress = calculator.getScrollProgress(testCase.scrollY, 2000, 1000);
            if (progress < 0 || progress > 1) {
                throw new Error(`Progress ${progress} is outside bounds [0, 1] for scrollY ${testCase.scrollY}`);
            }
            if (Math.abs(progress - testCase.expected) > 0.0001) {
                throw new Error(`Expected ${testCase.expected}, got ${progress} for scrollY ${testCase.scrollY}`);
            }
        }
        return true;
    });
    
    // Requirement 6.5: Video time mapping (currentTime = progress * duration)
    validate('Requirement 6.5: Video time mapping', () => {
        const videoDuration = 120; // 2 minutes
        const testCases = [
            { progress: 0, expected: 0 },
            { progress: 0.25, expected: 30 },
            { progress: 0.5, expected: 60 },
            { progress: 0.75, expected: 90 },
            { progress: 1, expected: 120 }
        ];
        
        for (const testCase of testCases) {
            const videoTime = calculator.getVideoTime(testCase.progress, videoDuration);
            if (Math.abs(videoTime - testCase.expected) > 0.0001) {
                throw new Error(`Expected ${testCase.expected}, got ${videoTime} for progress ${testCase.progress}`);
            }
            
            // Verify the formula: videoTime = progress * duration
            const expectedByFormula = testCase.progress * videoDuration;
            if (Math.abs(videoTime - expectedByFormula) > 0.0001) {
                throw new Error(`Formula validation failed: ${videoTime} ≠ ${testCase.progress} * ${videoDuration}`);
            }
        }
        return true;
    });
    
    // Test bounds checking and validation
    validate('Bounds checking and validation', () => {
        // Test progress clamping
        if (calculator.clampProgress(-0.5) !== 0) return false;
        if (calculator.clampProgress(1.5) !== 1) return false;
        if (calculator.clampProgress(0.5) !== 0.5) return false;
        
        // Test invalid input handling
        const progress1 = calculator.getScrollProgress('invalid', 2000, 1000);
        if (progress1 < 0 || progress1 > 1) return false;
        
        const videoTime1 = calculator.getVideoTime('invalid', 60);
        if (videoTime1 < 0 || videoTime1 > 60) return false;
        
        return true;
    });
    
    // Test edge cases
    validate('Edge case handling', () => {
        // Document shorter than viewport
        const progress1 = calculator.getScrollProgress(0, 500, 1000);
        if (progress1 !== 0) return false;
        
        // Zero duration video
        const videoTime1 = calculator.getVideoTime(0.5, 0);
        if (videoTime1 !== 0) return false;
        
        // Negative duration (should be handled gracefully)
        const videoTime2 = calculator.getVideoTime(0.5, -10);
        if (videoTime2 < 0) return false;
        
        return true;
    });
    
    // Test validation function
    validate('Validation function completeness', () => {
        const validation = calculator.validateCalculations(500, 2000, 1000, 60);
        
        // Check structure
        if (!validation.inputs || !validation.outputs) return false;
        if (typeof validation.isValid !== 'boolean') return false;
        if (!Array.isArray(validation.errors)) return false;
        
        // Check values
        if (validation.outputs.progress !== 0.5) return false;
        if (validation.outputs.videoTime !== 30) return false;
        if (!validation.isValid) return false;
        if (validation.errors.length !== 0) return false;
        
        return true;
    });
    
    console.log(`\n📊 Validation Results: ${validationsPassed}/${validationsTotal} validations passed`);
    
    if (validationsPassed === validationsTotal) {
        console.log('🎉 All requirements validated successfully!');
        console.log('\n✅ PositionCalculator component is ready for integration');
        return true;
    } else {
        console.log('❌ Some validations failed');
        return false;
    }
}

// Run validation
if (require.main === module) {
    validateImplementation();
}

module.exports = { validateImplementation };