#!/bin/bash

# AgentOS MCP Server Publishing Script
# This script prepares and publishes the package to npm registry

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PACKAGE_NAME="agentos-mcp"
DRY_RUN=false
SKIP_TESTS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--dry-run] [--skip-tests]"
            echo "  --dry-run    : Prepare package without publishing"
            echo "  --skip-tests : Skip running tests before publishing"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Helper functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check if npm is logged in
    if ! npm whoami &> /dev/null; then
        print_error "Not logged in to npm. Run 'npm login' first."
        exit 1
    fi
    
    print_success "Logged in to npm as $(npm whoami)"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found"
        exit 1
    fi
    
    # Check if we're in the right directory
    PACKAGE_NAME_FROM_JSON=$(node -e "console.log(require('./package.json').name)")
    if [ "$PACKAGE_NAME_FROM_JSON" != "$PACKAGE_NAME" ]; then
        print_error "Wrong package. Expected $PACKAGE_NAME, found $PACKAGE_NAME_FROM_JSON"
        exit 1
    fi
    
    print_success "Package: $PACKAGE_NAME"
    
    # Get current version
    CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")
    print_info "Current version: $CURRENT_VERSION"
}

# Run tests
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        print_warning "Skipping tests as requested"
        return
    fi
    
    print_header "Running Tests"
    
    # Lint
    print_info "Running linter..."
    npm run lint
    print_success "Linting passed"
    
    # Unit tests
    print_info "Running unit tests..."
    npm run test
    print_success "Unit tests passed"
    
    # Build test
    print_info "Testing build..."
    npm run build
    print_success "Build test passed"
}

# Clean and build
clean_and_build() {
    print_header "Cleaning and Building"
    
    # Clean previous build
    print_info "Cleaning previous build..."
    npm run clean
    
    # Build
    print_info "Building package..."
    npm run build
    print_success "Build completed"
    
    # Verify build output
    if [ ! -f "build/index.js" ]; then
        print_error "Build output not found"
        exit 1
    fi
    
    print_success "Build output verified"
}

# Check package contents
check_package() {
    print_header "Checking Package Contents"
    
    # Check required files
    REQUIRED_FILES=(
        "package.json"
        "README.md"
        "LICENSE"
        "build/index.js"
    )
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            print_error "Required file missing: $file"
            exit 1
        fi
    done
    
    print_success "All required files present"
    
    # Check package.json fields
    print_info "Validating package.json fields..."
    
    # Check if main field points to correct file
    MAIN_FIELD=$(node -e "console.log(require('./package.json').main)")
    if [ "$MAIN_FIELD" != "build/index.js" ]; then
        print_error "Main field should be 'build/index.js', found '$MAIN_FIELD'"
        exit 1
    fi
    
    # Check bin field
    BIN_FIELD=$(node -e "console.log(require('./package.json').bin && require('./package.json').bin['agentos-mcp'])")
    if [ "$BIN_FIELD" != "./build/index.js" ]; then
        print_error "Bin field should be './build/index.js', found '$BIN_FIELD'"
        exit 1
    fi
    
    print_success "Package.json validation passed"
}

# Check version conflicts
check_version_conflicts() {
    print_header "Checking Version Conflicts"
    
    # Check if version already exists on npm
    VERSION_EXISTS=$(npm view $PACKAGE_NAME@$CURRENT_VERSION version 2>/dev/null || echo "")
    
    if [ "$VERSION_EXISTS" = "$CURRENT_VERSION" ]; then
        print_warning "Version $CURRENT_VERSION already exists on npm"
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Publishing cancelled"
            exit 0
        fi
    else
        print_success "Version $CURRENT_VERSION is available"
    fi
}

# Create npmrc for publishing
create_npmrc() {
    print_header "Preparing npm Configuration"
    
    # Backup existing npmrc
    if [ -f ".npmrc" ]; then
        cp .npmrc .npmrc.backup
        print_info "Backed up existing .npmrc"
    fi
    
    # Create publishing npmrc
    cat > .npmrc << EOF
# AgentOS MCP Server Publishing Configuration
registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=\${NPM_TOKEN}
EOF
    
    print_success "Created .npmrc for publishing"
}

# Dry run publish
dry_run_publish() {
    print_header "Dry Run Publish"
    
    print_info "Running npm publish --dry-run..."
    npm publish --dry-run
    
    if [ $? -eq 0 ]; then
        print_success "Dry run successful"
    else
        print_error "Dry run failed"
        exit 1
    fi
}

# Publish package
publish_package() {
    print_header "Publishing Package"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "Dry run mode - not actually publishing"
        return
    fi
    
    print_info "Publishing $PACKAGE_NAME@$CURRENT_VERSION..."
    
    # Publish
    npm publish --access public
    
    if [ $? -eq 0 ]; then
        print_success "Package published successfully!"
    else
        print_error "Publishing failed"
        exit 1
    fi
}

# Create GitHub release
create_github_release() {
    if [ "$DRY_RUN" = true ]; then
        print_info "Dry run mode - skipping GitHub release"
        return
    fi
    
    print_header "Creating GitHub Release"
    
    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
        print_warning "gh CLI not found, skipping GitHub release"
        return
    fi
    
    # Get release notes from git log
    RELEASE_NOTES=$(git log --oneline --pretty=format:"- %s" $(git describe --tags --abbrev=0)..HEAD || echo "Release version $CURRENT_VERSION")
    
    # Create release
    echo "$RELEASE_NOTES" | gh release create "v$CURRENT_VERSION" --title "Release v$CURRENT_VERSION" --notes-file -
    
    if [ $? -eq 0 ]; then
        print_success "GitHub release created"
    else
        print_warning "GitHub release failed (may need manual creation)"
    fi
}

# Cleanup
cleanup() {
    print_header "Cleanup"
    
    # Restore npmrc
    if [ -f ".npmrc.backup" ]; then
        mv .npmrc.backup .npmrc
        print_info "Restored original .npmrc"
    fi
    
    # Clean build
    print_info "Cleaning build files..."
    npm run clean
    
    print_success "Cleanup completed"
}

# Main publishing flow
main() {
    print_header "AgentOS MCP Server Publishing"
    
    # Store current directory
    ORIGINAL_DIR=$(pwd)
    
    # Trap for cleanup
    trap cleanup EXIT
    
    check_prerequisites
    run_tests
    clean_and_build
    check_package
    check_version_conflicts
    create_npmrc
    dry_run_publish
    publish_package
    create_github_release
    
    print_success "Publishing completed successfully! 🚀"
    
    if [ "$DRY_RUN" = false ]; then
        print_info "Package available at: https://www.npmjs.com/package/$PACKAGE_NAME"
        print_info "Install with: npm install -g $PACKAGE_NAME"
    fi
}

# Run main function
main "$@"
