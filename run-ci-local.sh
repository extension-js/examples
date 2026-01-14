#!/bin/bash
set -e  # Exit on error

echo "=========================================="
echo "Running Local CI Simulation"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print step header
print_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Step: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Function to check if command succeeded
check_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1 completed successfully${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        exit 1
    fi
}

# Step 1: Setup (shared setup job equivalent)
print_step "1. Setup (install dependencies, install Playwright)"
echo "Installing dependencies..."
pnpm install
check_result "Install dependencies"

echo "Installing Playwright browsers..."
pnpm test:install
check_result "Install Playwright browsers"

# Step 2: Run lint and validation (build-and-lint job equivalent)
print_step "2. Run lint and validation"
echo "Normalizing examples..."
node ci-scripts/normalize-examples.mjs
check_result "Normalize examples"

pnpm run test:ci
check_result "Lint and validation"

# Step 3: Run E2E tests in batches (simulating CI parallel jobs)
# Each batch builds only its own examples
print_step "3. Run E2E Test Batches"

echo -e "${YELLOW}Note: Running batches sequentially locally (CI runs them in parallel)${NC}"
echo -e "${YELLOW}Each batch builds only its own examples to split work${NC}"
echo ""

# Set CI environment variables like GitHub Actions does
export CI=true
export SKIP_BUILD=true
export HEADLESS=false  # Run in headed mode for better extension compatibility

# Run each batch - each builds its own examples then runs tests
BATCHES=(
    "content:test:content"
    "sidebar:test:sidebar"
    "action:test:action"
    "newtab:test:newtab"
    "special-folders:test:special"
    "mixed-context:test:mixed"
    "other:test:other"
)

batch_num=0
for batch_info in "${BATCHES[@]}"; do
    IFS=':' read -r batch_name batch_cmd <<< "$batch_info"
    batch_num=$((batch_num + 1))
    
    print_step "3.$batch_num. Building and testing $batch_name batch"
    
    # Normalize examples (needed before building)
    echo "Normalizing examples..."
    node ci-scripts/normalize-examples.mjs
    check_result "Normalize examples"
    
    # Get examples for this project
    echo "Getting examples for $batch_name project..."
    EXAMPLES=$(node ci-scripts/get-examples-for-project.mjs "$batch_name")
    echo "Building examples: $EXAMPLES"
    
    # Build only the examples for this batch
    echo "Building $batch_name examples..."
    node ci-scripts/build-all.mjs --filter="$EXAMPLES"
    check_result "Build $batch_name examples"
    
    # Run tests for this batch in headed mode (no xvfb needed)
    echo "Running $batch_name batch E2E tests..."
    pnpm run "$batch_cmd"
    check_result "$batch_name batch tests"
done

echo ""
echo -e "${GREEN}=========================================="
echo -e "✓ All CI steps completed successfully!"
echo -e "==========================================${NC}"
echo ""
echo "Summary:"
echo "  ✓ Dependencies installed"
echo "  ✓ Playwright browsers installed"
echo "  ✓ Lint passed"
echo "  ✓ Each batch normalized and built its own examples"
echo "  ✓ All E2E test batches passed"
echo ""

