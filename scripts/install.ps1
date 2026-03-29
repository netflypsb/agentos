# AgentOS MCP Server Installation Script for Windows
# This script installs AgentOS MCP Server and sets up the necessary configuration

#Requires -RunAsAdministrator

param(
    [switch]$Force,
    [switch]$SkipTests
)

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    White = "White"
}

# Helper functions
function Write-Header {
    param([string]$Title)
    Write-Host "========================================" -ForegroundColor $Colors.Blue
    Write-Host $Title -ForegroundColor $Colors.Blue
    Write-Host "========================================" -ForegroundColor $Colors.Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $Colors.Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $Colors.Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $Colors.Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor $Colors.Blue
}

# Check if Node.js is installed
function Test-NodeJS {
    Write-Header "Checking Node.js Installation"
    
    try {
        $nodeVersion = node --version
        $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        
        if ($majorVersion -lt 18) {
            Write-Error "Node.js version $nodeVersion is too old. Version 18 or higher is required."
            Write-Info "Please install Node.js 18 or higher from https://nodejs.org/"
            exit 1
        }
        
        Write-Success "Node.js $nodeVersion found"
    }
    catch {
        Write-Error "Node.js is not installed or not in PATH"
        Write-Info "Please install Node.js 18 or higher from https://nodejs.org/"
        exit 1
    }
}

# Check if npm is installed
function Test-NPM {
    Write-Header "Checking npm Installation"
    
    try {
        $npmVersion = npm --version
        Write-Success "npm $npmVersion found"
    }
    catch {
        Write-Error "npm is not installed or not in PATH"
        exit 1
    }
}

# Install AgentOS MCP Server
function Install-AgentOS {
    Write-Header "Installing AgentOS MCP Server"
    
    # Check if already installed
    try {
        $installedVersion = agentos-mcp --version 2>$null
        if ($installedVersion -and -not $Force) {
            Write-Warning "AgentOS MCP Server is already installed (version $installedVersion)"
            $response = Read-Host "Do you want to reinstall? (y/N)"
            if ($response -notmatch '^[Yy]') {
                Write-Info "Skipping installation"
                return
            }
        }
    }
    catch {
        # Not installed, continue
    }
    
    # Install globally
    Write-Info "Installing agentos-mcp globally..."
    try {
        npm install -g agentos-mcp
        if ($LASTEXITCODE -eq 0) {
            Write-Success "AgentOS MCP Server installed successfully"
        }
        else {
            Write-Error "Failed to install AgentOS MCP Server"
            exit 1
        }
    }
    catch {
        Write-Error "Installation failed: $($_.Exception.Message)"
        exit 1
    }
}

# Create configuration directory
function New-ConfigDirectory {
    Write-Header "Setting up Configuration Directory"
    
    $configDir = "$env:USERPROFILE\.agentos"
    
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
        Write-Success "Created configuration directory: $configDir"
    }
    else {
        Write-Info "Configuration directory already exists: $configDir"
    }
    
    # Create subdirectories
    New-Item -ItemType Directory -Path "$configDir\logs" -Force | Out-Null
    New-Item -ItemType Directory -Path "$configDir\data" -Force | Out-Null
    Write-Success "Configuration directories ready"
}

# Set up environment variables
function Set-EnvironmentVariables {
    Write-Header "Setting up Environment Variables"
    
    $configFile = "$env:USERPROFILE\.agentos\.env"
    
    if (-not (Test-Path $configFile)) {
        $envContent = @"
# AgentOS MCP Server Configuration
AGENTOS_DATA_DIR="$env:USERPROFILE\.agentos\data"
AGENTOS_LOG_LEVEL="info"

# License key (optional - for Pro features)
# AGENTOS_LICENSE_KEY="your-license-key-here"

# Debug mode (optional)
# AGENTOS_DEBUG="true"
"@
        $envContent | Out-File -FilePath $configFile -Encoding UTF8
        Write-Success "Created environment file: $configFile"
    }
    else {
        Write-Info "Environment file already exists: $configFile"
    }
    
    # Add to user environment variables
    try {
        $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
        $agentosPath = "$env:USERPROFILE\.agentos"
        
        if ($currentPath -notlike "*$agentosPath*") {
            $newPath = $currentPath + ";" + $agentosPath
            [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
            Write-Success "Added AgentOS directory to user PATH"
        }
        else {
            Write-Info "AgentOS directory already in PATH"
        }
    }
    catch {
        Write-Warning "Failed to update PATH environment variable: $($_.Exception.Message)"
        Write-Info "You may need to add $env:USERPROFILE\.agentos to your PATH manually"
    }
}

# Test installation
function Test-Installation {
    if ($SkipTests) {
        Write-Info "Skipping tests as requested"
        return
    }
    
    Write-Header "Testing Installation"
    
    # Test CLI
    try {
        $helpOutput = agentos-mcp --help 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "CLI command works"
        }
        else {
            Write-Error "CLI command failed"
            return $false
        }
    }
    catch {
        Write-Error "CLI command failed: $($_.Exception.Message)"
        return $false
    }
    
    # Test basic functionality
    try {
        $testOutput = agentos-mcp --test 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Basic functionality test passed"
        }
        else {
            Write-Warning "Basic functionality test failed (this may be normal)"
        }
    }
    catch {
        Write-Warning "Basic functionality test skipped (feature not available)"
    }
    
    return $true
}

# Show next steps
function Show-NextSteps {
    Write-Header "Installation Complete!"
    
    Write-Success "AgentOS MCP Server has been installed successfully!"
    Write-Host ""
    
    Write-Info "Next steps:"
    Write-Host "1. Restart your terminal or PowerShell session"
    Write-Host "2. Test the installation: agentos-mcp --help"
    Write-Host "3. Configure your MCP client (Claude Desktop, Cursor, etc.)"
    Write-Host ""
    
    Write-Info "MCP Client Configuration:"
    Write-Host "Add this to your MCP settings:"
    Write-Host "{"
    Write-Host '  "mcpServers": {'
    Write-Host '    "agentos": {'
    Write-Host '      "command": "agentos-mcp"'
    Write-Host "    }"
    Write-Host "  }"
    Write-Host "}"
    Write-Host ""
    
    Write-Info "For Pro features:"
    Write-Host "1. Get your license key from https://mcp-marketplace.io/agentos-mcp"
    Write-Host "2. Set AGENTOS_LICENSE_KEY in $env:USERPROFILE\.agentos\.env"
    Write-Host ""
    
    Write-Info "Documentation: https://docs.agentos-mcp.com"
    Write-Info "Support: https://github.com/agentos-mcp/server/issues"
}

# Main installation flow
function Main {
    Write-Header "AgentOS MCP Server Installation (Windows)"
    
    try {
        Test-NodeJS
        Test-NPM
        Install-AgentOS
        New-ConfigDirectory
        Set-EnvironmentVariables
        
        $testResult = Test-Installation
        if (-not $testResult) {
            Write-Warning "Some tests failed, but installation may still work"
        }
        
        Show-NextSteps
        Write-Success "Installation completed successfully! 🚀"
    }
    catch {
        Write-Error "Installation failed: $($_.Exception.Message)"
        exit 1
    }
}

# Run main function
Main
