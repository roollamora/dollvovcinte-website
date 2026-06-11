/**
 * Basic tests for PositionCalculator component
 * Tests the core functionality and edge cases
 */

// Import PositionCalculator (for Node.js environment)
let PositionCalculator;
if (typeof require !== 'undefined') {
    PositionCalculator = require('./position-calculator.js');
} else if (typeof window !== 'undefined' && window.PositionCalculator) {
    PositionCalculator = window.PositionCalculator;
}

function runTests() {
    const calculator = new PositionCalculator();
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
    
    function assertEqual(actual, expected, message = '') {
        if (Math.abs(actual - expected) > 0.0001) {
            throw new Error(`Expected ${expected}, got ${actual}. ${message}`);
        }
    }
    
    function assertBetween(value, min, max, message = '') {
        if (value < min || value > max) {
            throw new Error(`Expected value between ${min} and ${max}, got ${value}. ${message}`);
        }
    }
    
    console.log('Running PositionCalculator Tests...\n');
    
    // Test getScrollProgress bounds checking - Requirement 6.4
    test('getScrollProgress returns 0 at document top', () => {
        const progress = calculator.getScrollProgress(0, 2000, 1000);
        assertEqual(progress, 0, 'Should be 0 at top');
    });
    
    test('getScrollProgress returns 1 at document bottom', () => {
        const progress = calculator.getScrollProgress(1000, 2000, 1000);
        assertEqual(progress, 1, 'Should be 1 at bottom');
    });
    
    test('getScrollProgress returns 0.5 at middle', () => {
        const progress = calculator.getScrollProgress(500, 2000, 1000);
        assertEqual(progress, 0.5, 'Should be 0.5 at middle');
    });
    
    test('getScrollProgress clamps negative values', () => {
        const progress = calculator.getScrollProgress(-100, 2000, 1000);
        assertEqual(progress, 0, 'Should clamp negative to 0');
    });
    
    test('getScrollProgress clamps values above maximum', () => {
        const progress = calculator.getScrollProgress(1500, 2000, 1000);
        assertEqual(progress, 1, 'Should clamp over-scroll to 1');
    });
    
    test('getScrollProgress handles document shorter than viewport', () => {
        const progress = calculator.getScrollProgress(0, 500, 1000);
        assertEqual(progress, 0, 'Should return 0 when document is shorter');
    });
    
    // Test getVideoTime mapping - Requirement 6.5
    test('getVideoTime maps progress 0 to time 0', () => {
        const videoTime = calculator.getVideoTime(0, 60);
        assertEqual(videoTime, 0, 'Progress 0 should map to time 0');
    });
    
    test('getVideoTime maps progress 1 to full duration', () => {
        const videoTime = calculator.getVideoTime(1, 60);
        assertEqual(videoTime, 60, 'Progress 1 should map to full duration');
    });
    
    test('getVideoTime maps progress 0.5 to half duration', () => {
        const videoTime = calculator.getVideoTime(0.5, 60);
        assertEqual(videoTime, 30, 'Progress 0.5 should map to half duration');
    });
    
    test('getVideoTime clamps negative progress', () => {
        const videoTime = calculator.getVideoTime(-0.5, 60);
        assertEqual(videoTime, 0, 'Negative progress should map to 0');
    });
    
    test('getVideoTime clamps progress above 1', () => {
        const videoTime = calculator.getVideoTime(1.5, 60);
        assertEqual(videoTime, 60, 'Progress > 1 should map to full duration');
    });
    
    // Test clampProgress function
    test('clampProgress keeps valid values unchanged', () => {
        assertEqual(calculator.clampProgress(0.5), 0.5, 'Valid progress unchanged');
        assertEqual(calculator.clampProgress(0), 0, 'Zero unchanged');
        assertEqual(calculator.clampProgress(1), 1, 'One unchanged');
    });
    
    test('clampProgress clamps out-of-bounds values', () => {
        assertEqual(calculator.clampProgress(-0.5), 0, 'Negative clamped to 0');
        assertEqual(calculator.clampProgress(1.5), 1, 'Over 1 clamped to 1');
    });
    
    test('clampProgress handles invalid inputs', () => {
        assertEqual(calculator.clampProgress(NaN), 0, 'NaN becomes 0');
        assertEqual(calculator.clampProgress('invalid'), 0, 'String becomes 0');
    });
    
    // Test validation function
    test('validateCalculations returns valid results for normal inputs', () => {
        const validation = calculator.validateCalculations(500, 2000, 1000, 60);
        assertEqual(validation.outputs.progress, 0.5, 'Progress should be 0.5');
        assertEqual(validation.outputs.videoTime, 30, 'Video time should be 30');
        assertEqual(validation.isValid, true, 'Should be valid');
        assertEqual(validation.errors.length, 0, 'Should have no errors');
    });
    
    // Test edge cases and error handling
    test('getScrollProgress handles invalid inputs gracefully', () => {
        const progress1 = calculator.getScrollProgress('invalid', 2000, 1000);
        assertBetween(progress1, 0, 1, 'Should return valid progress despite invalid scrollY');
        
        const progress2 = calculator.getScrollProgress(500, 'invalid', 1000);
        assertBetween(progress2, 0, 1, 'Should return valid progress despite invalid documentHeight');
    });
    
    test('getVideoTime handles invalid inputs gracefully', () => {
        const videoTime1 = calculator.getVideoTime('invalid', 60);
        assertBetween(videoTime1, 0, 60, 'Should return valid time despite invalid progress');
        
        const videoTime2 = calculator.getVideoTime(0.5, 'invalid');
        assertBetween(videoTime2, 0, 1, 'Should return valid time despite invalid duration');
    });
    
    // Test linear mapping property - Requirement 6.3
    test('getScrollProgress maintains linear relationship', () => {
        const documentHeight = 3000;
        const viewportHeight = 1000;
        const maxScroll = documentHeight - viewportHeight;
        
        // Test multiple points along the scroll range
        for (let i = 0; i <= 10; i++) {
            const scrollY = (i / 10) * maxScroll;
            const expectedProgress = i / 10;
            const actualProgress = calculator.getScrollProgress(scrollY, documentHeight, viewportHeight);
            assertEqual(actualProgress, expectedProgress, `Linear mapping at ${i * 10}%`);
        }
    });
    
    console.log(`\nTest Results: ${testsPassed}/${testsTotal} tests passed`);
    
    if (testsPassed === testsTotal) {
        console.log('🎉 All tests passed!');
        return true;
    } else {
        console.log('❌ Some tests failed');
        return false;
    }
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runTests();
}

// Export for browser usage
if (typeof window !== 'undefined') {
    window.runPositionCalculatorTests = runTests;
}