#!/bin/bash

# =============================================================================
# Biteful - GitHub Push Script
# =============================================================================
# This script safely pushes your project to GitHub
#
# Usage:
#   ./push-to-github.sh
#
# Before running:
#   1. Create a repository on GitHub
#   2. Make executable: chmod +x push-to-github.sh
#   3. Run the script - it will ask for your GitHub repository URL
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Functions
# -----------------------------------------------------------------------------

print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}→ $1${NC}"
}

# Check if we're in the right directory
check_directory() {
    if [ ! -f "package.json" ] || [ ! -f "Dockerfile" ]; then
        print_error "This doesn't look like the meal-planner directory!"
        echo "Please run this script from the project root directory."
        exit 1
    fi
}

# Security check: Make sure no sensitive files will be committed
security_check() {
    print_header "Security Check"

    local found_issues=0

    # Check for .env files (excluding examples)
    if git ls-files --others --exclude-standard | grep -E '^\.env$|^\.env\..*' | grep -v '.env.example' | grep -v '.env.production.example' > /dev/null 2>&1; then
        print_warning "Found .env files that might be staged!"
        git ls-files --others --exclude-standard | grep -E '^\.env$|^\.env\..*' | grep -v '.env.example'
        found_issues=1
    fi

    # Check for common credential files
    local sensitive_patterns=("*.pem" "*.key" "credentials.json" "config.json" "*password*" "*secret*")
    for pattern in "${sensitive_patterns[@]}"; do
        if git ls-files --others --exclude-standard | grep -i "$pattern" > /dev/null 2>&1; then
            print_warning "Found potential credential files: $pattern"
            found_issues=1
        fi
    done

    # Check if push-to-dockerhub.sh still contains real credentials
    if [ -f "push-to-dockerhub.sh" ]; then
        if grep -q "dckr_pat_" push-to-dockerhub.sh || grep -E 'DOCKER_PASSWORD="[^Y][^O][^U]' push-to-dockerhub.sh > /dev/null 2>&1; then
            print_error "push-to-dockerhub.sh contains real Docker Hub credentials!"
            print_info "Please replace them with placeholder values before pushing."
            found_issues=1
        fi
    fi

    if [ $found_issues -eq 0 ]; then
        print_success "No sensitive files detected"
    else
        print_error "Security issues found! Please fix them before pushing."
        echo ""
        echo "Run: git status --ignored"
        echo "To see what would be committed."
        exit 1
    fi

    echo ""
}

# Initialize git repository
init_git() {
    print_header "Git Repository Setup"

    if [ ! -d ".git" ]; then
        print_info "Initializing Git repository..."
        git init
        print_success "Git repository initialized"
    else
        print_info "Git repository already exists"
    fi

    # Set default branch to main
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    if [ "$current_branch" != "main" ]; then
        print_info "Setting default branch to 'main'..."
        git branch -M main
    fi

    echo ""
}

# Get GitHub repository URL from user
get_github_url() {
    print_header "GitHub Repository URL"

    # Check if remote already exists
    if git remote get-url origin > /dev/null 2>&1; then
        existing_url=$(git remote get-url origin)
        print_info "Existing remote found: $existing_url"
        echo ""
        read -p "Use this remote? (y/n): " use_existing

        if [[ $use_existing =~ ^[Yy]$ ]]; then
            GITHUB_URL="$existing_url"
            return
        else
            print_info "Removing existing remote..."
            git remote remove origin
        fi
    fi

    echo ""
    echo "Enter your GitHub repository URL:"
    echo "Example: https://github.com/pamsler/biteful.git"
    echo "      or git@github.com:pamsler/biteful.git"
    echo ""
    read -p "GitHub URL: " GITHUB_URL

    if [ -z "$GITHUB_URL" ]; then
        print_error "No URL provided!"
        exit 1
    fi

    print_success "GitHub URL: $GITHUB_URL"
    echo ""
}

# Show what will be committed
show_status() {
    print_header "Files to be Committed"

    # Add all files (respects .gitignore)
    git add .

    echo ""
    print_info "The following files will be committed:"
    echo ""
    git status --short
    echo ""

    # Count files
    file_count=$(git status --short | wc -l)
    print_info "Total files: $file_count"
    echo ""

    read -p "Continue with commit? (y/n): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        print_warning "Aborted by user"
        exit 0
    fi
    echo ""
}

# Create commit
create_commit() {
    print_header "Creating Commit"

    # Get commit message
    echo "Enter commit message (or press Enter for default):"
    read -p "Message: " commit_message

    if [ -z "$commit_message" ]; then
        commit_message="Initial commit - Biteful v0.1.0

- Complete meal planning application
- Docker containerized (linux/amd64)
- PostgreSQL database
- React frontend with TypeScript
- Node.js backend
- Production-ready deployment files
- Security: SHA256 pinned base images, SBOM + Provenance"
    fi

    git commit -m "$commit_message"

    print_success "Commit created"
    echo ""
}

# Add remote and push
push_to_github() {
    print_header "Pushing to GitHub"

    # Add remote if not exists
    if ! git remote get-url origin > /dev/null 2>&1; then
        print_info "Adding GitHub remote..."
        git remote add origin "$GITHUB_URL"
        print_success "Remote added"
    fi

    echo ""
    print_info "Pushing to GitHub..."
    echo ""

    # Push to main branch
    git push -u origin main

    if [ $? -eq 0 ]; then
        print_success "Successfully pushed to GitHub!"
    else
        print_error "Push failed!"
        echo ""
        echo "Common issues:"
        echo "  1. Repository doesn't exist on GitHub"
        echo "  2. Authentication failed (check your credentials)"
        echo "  3. No write permissions to the repository"
        exit 1
    fi

    echo ""
}

# Display summary
display_summary() {
    print_header "Push Complete! 🎉"
    echo ""
    echo "Your code is now on GitHub!"
    echo ""

    # Extract GitHub URL components
    if [[ $GITHUB_URL =~ github\.com[:/]([^/]+)/([^.]+) ]]; then
        username="${BASH_REMATCH[1]}"
        repo="${BASH_REMATCH[2]}"

        echo "View your repository:"
        echo -e "  ${BLUE}https://github.com/$username/$repo${NC}"
        echo ""

        print_info "Next steps:"
        echo "  1. Add repository description and topics on GitHub"
        echo "  2. Enable GitHub Actions (if needed)"
        echo "  3. Set up branch protection rules"
        echo "  4. Add collaborators (if working in a team)"
    fi

    echo ""
}

# -----------------------------------------------------------------------------
# Main Script
# -----------------------------------------------------------------------------

main() {
    echo ""
    print_header "Biteful - GitHub Push"
    echo ""

    # Pre-flight checks
    check_directory

    # Execution steps
    init_git
    security_check
    get_github_url
    show_status
    create_commit
    push_to_github
    display_summary

    print_success "All done!"
    echo ""
}

# Run main function
main "$@"
