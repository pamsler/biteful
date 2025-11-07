# Pull Request

## Description
<!-- Provide a clear and concise description of what this PR does -->

## Type of Change
<!-- Mark the relevant option with an "x" -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Code style/formatting (no functional changes)
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix

## Related Issue
<!-- Link to the issue this PR addresses -->

Fixes #(issue number)

## Changes Made
<!-- List the specific changes made in this PR -->

- Change 1
- Change 2
- Change 3

## Screenshots (if applicable)
<!-- Add screenshots to show visual changes -->

## Testing
<!-- Describe the tests you ran and how to reproduce them -->

### Test Environment
- Docker Version:
- Docker Compose Version:
- Platform: [e.g. linux/amd64]
- Browser (if frontend changes): [e.g. Chrome 120]

### Test Steps
1. Step 1
2. Step 2
3. Step 3

### Test Results
- [ ] All existing tests pass
- [ ] New tests added and passing
- [ ] Manual testing completed
- [ ] No console errors
- [ ] Tested in both light and dark mode (if UI changes)
- [ ] Tested in both German and English (if applicable)

## Docker Build
<!-- Verify the Docker image builds successfully -->

- [ ] Docker image builds without errors: `docker build -t biteful:test .`
- [ ] Container starts successfully: `docker-compose up`
- [ ] Health check passes: `curl http://localhost:8570/api/health`

## Security Considerations
<!-- Address any security implications -->

- [ ] No sensitive data exposed in logs
- [ ] No new security vulnerabilities introduced
- [ ] Input validation added where needed
- [ ] Authentication/authorization checked (if applicable)

## Documentation
<!-- Check all that apply -->

- [ ] README updated (if needed)
- [ ] CHANGELOG.md updated
- [ ] Code comments added for complex logic
- [ ] Environment variables documented (if new ones added)

## Breaking Changes
<!-- If this is a breaking change, describe the impact and migration path -->

**Impact:**
<!-- Describe what breaks and why -->

**Migration Guide:**
<!-- Provide steps to migrate from the old behavior to the new one -->

## Checklist
<!-- Mark completed items with an "x" -->

- [ ] My code follows the project's code style
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My changes generate no new warnings
- [ ] I have tested my changes locally
- [ ] I have checked that Docker build works
- [ ] I have updated the documentation accordingly
- [ ] I have added this change to CHANGELOG.md

## Additional Notes
<!-- Add any additional notes or context for reviewers -->

---

**Thank you for contributing to Biteful!** 🍽️
