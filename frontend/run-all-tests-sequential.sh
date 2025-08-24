#!/bin/bash

echo "========================================"
echo "Running All Cypress Tests Sequentially"
echo "We need to run this sequentially to ensure the backend is healthy before running the next test since we are using the same data"
echo "========================================"
echo

# Function to wait for specified seconds
wait_for_recovery() {
    local seconds=$1
    echo "Waiting $seconds seconds for backend to recover..."
    sleep $seconds
    echo "Recovery wait completed"
    echo
}

# Function to run test and check result
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo "Step: Running $test_name..."
    echo "Command: $test_command"
    echo
    
    if eval "$test_command"; then
        echo "$test_name completed successfully"
        echo
        return 0
    else
        echo "ERROR: $test_name failed"
        echo "Please check the error above and fix the issue"
        echo
        return 1
    fi
}

echo "Detected Git Bash environment"
echo "Starting sequential test execution..."
echo

# Step 1: Run flash-sale.cy.ts
if ! run_test "flash-sale.cy.ts" "npm run test:e2e:simple"; then
    echo "Exiting due to test failure"
    exit 1
fi

wait_for_recovery 15

# Step 2: Run stress-test-5stock.cy.ts
if ! run_test "stress-test-5stock.cy.ts" "npm run test:e2e:stress:5stock"; then
    echo "Exiting due to test failure"
    exit 1
fi

wait_for_recovery 15

# Step 3: Run stress-test.cy.ts
if ! run_test "stress-test.cy.ts" "npm run test:e2e:stress"; then
    echo "Exiting due to test failure"
    exit 1
fi

wait_for_recovery 20

# Step 4: Run stock-preset-stress-test.cy.ts (using stress test command)
if ! run_test "stock-preset-stress-test.cy.ts" "npm run test:e2e:stress"; then
    echo "Exiting due to test failure"
    exit 1
fi

echo "========================================"
echo "ALL TESTS COMPLETED SUCCESSFULLY!"
echo "========================================"
echo
echo "Summary:"
echo "- flash-sale.cy.ts: PASSED"
echo "- stress-test-5stock.cy.ts: PASSED"
echo "- stress-test.cy.ts: PASSED"
echo "- stock-preset-stress-test.cy.ts: PASSED"
echo
echo "Total execution time: ~3-5 minutes"
echo "Backend recovery: Automatic delays between tests"
echo
echo "Press Enter to continue..."
read
