#!/bin/bash

# AgentOS MCP Server Installation Script
# This script installs AgentOS MCP Server and sets up the necessary configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if Node.js is installed
check_nodejs() {
    print_header "Checking Node.js Installation"
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed or not in PATH"
        print_info "Please install Node.js 18 or higher from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_error "Node.js version $NODE_VERSION is too old. Version 18 or higher is required."
        exit 1
    fi
    
    print_success "Node.js $NODE_VERSION found"
}

# Check if npm is installed
check_npm() {
    print_header "Checking npm Installation"
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed or not in PATH"
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    print_success "npm $NPM_VERSION found"
}

# Install AgentOS MCP Server
install_agentos() {
    print_header "Installing AgentOS MCP Server"
    
    # Check if already installed
    if command -v agentos-mcp &> /dev/null; then
        print_warning "AgentOS MCP Server is already installed"
        read -p "Do you want to reinstall? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping installation"
            return
        fi
    fi
    
    # Install globally
    print_info "Installing agentos-mcp globally..."
    npm install -g agentos-mcp
    
    if [ $? -eq 0 ]; then
        print_success "AgentOS MCP Server installed successfully"
    else
        print_error "Failed to install AgentOS MCP Server"
        exit 1
    fi
}

# Create configuration directory
create_config_dir() {
    print_header "Setting up Configuration Directory"
    
    CONFIG_DIR="$HOME/.agentos"
    
    if [ ! -d "$CONFIG_DIR" ]; then
        mkdir -p "$CONFIG_DIR"
        print_success "Created configuration directory: $CONFIG_DIR"
    else
        print_info "Configuration directory already exists: $CONFIG_DIR"
    fi
    
    # Create subdirectories
    mkdir -p "$CONFIG_DIR/logs"
    mkdir -p "$CONFIGOS/data"
    print_success "Configuration directories ready"
}

# Set up environment variables
setup_environment() {
    print_header "Setting up Environment Variables"
    
    CONFIG_FILE="$HOME/.agentos/.env"
    
    if [ ! -f "$CONFIG_FILE" ]; then
        cat > "$CONFIG_FILE" << EOF
# AgentOS MCP Server Configuration
AGENTOS_DATA_DIR="$HOME/.agentos/data"
AGENTOS_LOG_LEVEL="info"

# License key (optional - for Pro features)
# AGENTOS_LICENSE_KEY="your-license-key-here"

# Debug mode (optional)
# AGENTOS_DEBUG="true"
EOF
        print_success "Created environment file: $CONFIG_FILE"
    else
        print_info "Environment file already exists: $CONFIG_FILE"
    fi
    
    # Add to shell profile if not already there
    SHELL_PROFILE=""
    case "$SHELL" in
        */bash)
            SHELL_PROFILE="$HOME/.bashrc"
            ;;
        */zsh)
            SHELL_PROFILE="$HOME/.zshrc"
            ;;
        */fish)
            SHELL_PROFILE="$HOME/.config/fish/config.fish"
            ;;
        *)
            print_warning "Unknown shell: $SHELL"
            print_info "Please manually add the following to your shell profile:"
            print_info "source $HOME/.agentos/.env"
            return
            ;;
    esac
    
    if [ -f "$SHELL_PROFILE" ]; then
        if ! grep -q "source.*agentos.*\.env" "$SHELL_PROFILE"; then
            echo "" >> "$SHELL_PROFILE"
            echo "# AgentOS MCP Server" >> "$SHELL_PROFILE"
            echo "source $HOME/.agentos/.env" >> "$SHELL_PROFILE"
            print_success "Added environment variables to $SHELL_PROFILE"
        else
            print_info "Environment variables already configured in $SHELL_PROFILE"
        fi
    fi
}

# Test installation
test_installation() {
    print_header "Testing Installation"
    
    # Test CLI
    if agentos-mcp --help > /dev/null 2>&1; then
        print_success "CLI command works"
    else
        print_error "CLI command failed"
        return 1
    fi
    
    # Test database initialization
    TEST_DATA_DIR=$(mktemp -d)
    AGENTOS_DATA_DIR="$TEST_DATA_DIR" agentos-mcp --test-db > /dev/null 2>&1 || true
    
    if [ -f "$TEST_DATA_DIR/agentos.db" ]; then
        print_success "Database initialization works"
        rm -rf "$TEST_DATA_DIR"
    else
        print_warning "Database test skipped (feature not available)"
    fi
}

# Show next steps
show_next_steps() {
    print_header "Installation Complete!"
    
    echo ""
    print_success "AgentOS MCP Server has been installed successfully!"
    echo ""
    print_info "Next steps:"
    echo "1. Restart your terminal or run: source $HOME/.agentos/.env"
    echo "2. Test the installation: agentos-mcp --help"
    echo "3. Configure your MCP client (Claude Desktop, Cursor, etc.)"
    echo ""
    print_info "MCP Client Configuration:"
    echo 'Add this to your MCP settings:'
    echo '{'
    echo '  "mcpServers": {'
    echo '    "agentos": {'
    echo '      "command": "agentos-mcp"'
    echo '    }'
    echo '  }'
    echo '}'
    echo ""
    print_info "For Pro features:"
    echo "1. Get your license key from https://mcp-marketplace.io/agentos-mcp"
    echo "2. Set AGENTOS_LICENSE_KEY in $HOME/.agentos/.env"
    echo ""
    print_info "Documentation: https://docs.agentos-mcp.com"
    print_info "Support: https://github.com/agentos-mcp/server/issues"
}

# Main installation flow
main() {
    print_header "AgentOS MCP Server Installation"
    
    check_nodejs
    check_npm
    install_agentos
    create_config_dir
    setup_environment
    test_installation
    show_next_steps
    
    print_success "Installation completed successfully! 🚀"
}

# Run main function
main "$@"
