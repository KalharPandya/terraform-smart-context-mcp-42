# Changelog

<!-- AI should never edit this file manually. -->
<!-- This file is only updated when a feature ships, via /end-session. -->
<!-- Format follows Keep a Changelog: https://keepachangelog.com/en/1.0.0/ -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Dummy Terraform infrastructure: 75 null_resources across 6 modules (networking, security, compute, database, loadbalancer, monitoring) simulating a 3-tier AWS deployment. State produces 4041 pretty-printed JSON lines (~33K tokens). Zero cloud charges. Closes #12.
- 4 design decisions committed to DECISIONS.md: null_resource trigger refs, 75-resource module layout, 4000+ line state target, experiment comparison metrics.

### Changed

### Fixed

### Removed
