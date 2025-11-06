#!/bin/bash

# =============================================================================
# Biteful - Docker Hub Push Script
# =============================================================================
# This script builds and pushes the Docker image to Docker Hub
#
# Usage:
#   ./push-to-dockerhub.sh [version]
#
# Example:
#   ./push-to-dockerhub.sh 1.0.0
#   ./push-to-dockerhub.sh          # Uses 'latest' tag
#
# Before running:
#   1. Fill in your Docker Hub credentials below
#   2. Make executable: chmod +x push-to-dockerhub.sh
# =============================================================================

set -e  # Exit on error

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

# Docker Hub credentials - FILL IN YOUR VALUES
DOCKER_USERNAME="pamsler"
DOCKER_PASSWORD="YOUR_DOCKERHUB_PASSWORD"  # Or use Docker access token (recommended)

# Image configuration
IMAGE_NAME="biteful"
REGISTRY="docker.io"  # Docker Hub registry

# Version (use argument or default to 'v0.1.0')
VERSION="${1:-v0.1.0}"

# Ensure version starts with 'v'
if [[ ! $VERSION =~ ^v ]]; then
    VERSION="v${VERSION}"
fi

# Full image names
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}"
IMAGE_TAG="${FULL_IMAGE_NAME}:${VERSION}"
IMAGE_LATEST="${FULL_IMAGE_NAME}:latest"

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

# Check if credentials are set
check_credentials() {
    if [ "$DOCKER_USERNAME" = "YOUR_DOCKERHUB_USERNAME" ] || [ "$DOCKER_PASSWORD" = "YOUR_DOCKERHUB_PASSWORD" ]; then
        print_error "Please set your Docker Hub credentials in this script first!"
        echo ""
        echo "Edit this file and replace:"
        echo "  DOCKER_USERNAME=\"YOUR_DOCKERHUB_USERNAME\""
        echo "  DOCKER_PASSWORD=\"YOUR_DOCKERHUB_PASSWORD\""
        echo ""
        exit 1
    fi
}

# Login to Docker Hub
docker_login() {
    print_header "Docker Hub Login"
    print_info "Logging in as: ${DOCKER_USERNAME}"

    echo "${DOCKER_PASSWORD}" | docker login ${REGISTRY} -u "${DOCKER_USERNAME}" --password-stdin

    if [ $? -eq 0 ]; then
        print_success "Successfully logged in to Docker Hub"
    else
        print_error "Failed to login to Docker Hub"
        exit 1
    fi
    echo ""
}

# Build Docker image with attestation
build_image() {
    print_header "Building Docker Image with Supply Chain Attestation"
    print_info "Image: ${IMAGE_TAG}"
    print_info "Platform: linux/amd64"
    print_info "Attestation: SBOM + Provenance"
    echo ""

    # Ensure buildx is available
    if ! docker buildx version &> /dev/null; then
        print_warning "Docker buildx not found. Installing..."
        docker buildx install
    fi

    # Create builder if not exists
    if ! docker buildx inspect biteful-builder &> /dev/null; then
        print_info "Creating buildx builder..."
        docker buildx create --name biteful-builder --use --bootstrap
    else
        docker buildx use biteful-builder
    fi

    # Build with buildx for single platform and attestation
    docker buildx build \
        --platform linux/amd64 \
        --tag "${IMAGE_TAG}" \
        --tag "${IMAGE_LATEST}" \
        --label "build.date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --label "build.version=${VERSION}" \
        --label "org.opencontainers.image.version=${VERSION}" \
        --sbom=true \
        --provenance=mode=max \
        --push \
        .

    if [ $? -eq 0 ]; then
        print_success "Image built and pushed successfully with attestation"
    else
        print_error "Failed to build image"
        exit 1
    fi
    echo ""
}

# Display image information
show_image_info() {
    print_header "Image Information"
    print_info "Images pushed to Docker Hub:"
    print_info "  - ${IMAGE_TAG}"
    print_info "  - ${IMAGE_LATEST}"
    print_info "Platform: linux/amd64"
    print_info "Attestation: SBOM + Provenance included"
    echo ""
}

# Optional: Scan image for vulnerabilities
scan_image() {
    print_header "Security Scan (Optional)"

    # Check if docker scan is available
    if command -v docker &> /dev/null && docker scan --version &> /dev/null; then
        print_info "Scanning image for vulnerabilities..."
        docker scan "${IMAGE_TAG}" || true
    else
        print_warning "Docker scan not available. Skipping security scan."
        print_info "Install Docker Scout for vulnerability scanning:"
        print_info "  https://docs.docker.com/scout/"
    fi
    echo ""
}

# Push image to Docker Hub (already done by buildx)
push_image() {
    print_header "Image Already Pushed"
    print_success "Images were pushed during build with buildx"
    print_info "No additional push needed"
    echo ""
}

# Cleanup
cleanup() {
    print_header "Cleanup"
    print_info "Logging out from Docker Hub..."
    docker logout ${REGISTRY}
    print_success "Logged out successfully"
    echo ""
}

# Display final information
display_summary() {
    print_header "Push Complete! 🎉"
    echo ""
    echo "Your image is now available on Docker Hub:"
    echo ""
    echo -e "  ${GREEN}docker pull ${IMAGE_TAG}${NC}"

    if [ "$VERSION" != "latest" ]; then
        echo -e "  ${GREEN}docker pull ${IMAGE_LATEST}${NC}"
    fi

    echo ""
    echo "View on Docker Hub:"
    echo -e "  ${BLUE}https://hub.docker.com/r/${DOCKER_USERNAME}/${IMAGE_NAME}${NC}"
    echo ""

    print_info "To use in docker-compose, update your image:"
    echo "  image: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
    echo ""
}

# -----------------------------------------------------------------------------
# Main Script
# -----------------------------------------------------------------------------

main() {
    echo ""
    print_header "Biteful - Docker Hub Push"
    echo ""

    # Pre-flight checks
    check_credentials

    # Execution steps
    docker_login
    build_image
    show_image_info
    push_image
    cleanup
    display_summary

    print_success "All done!"
    echo ""
}

# Run main function
main "$@"
