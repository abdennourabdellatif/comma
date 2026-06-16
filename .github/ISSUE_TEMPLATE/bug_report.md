name: Bug Report
description: Report a bug to help us improve
title: "[BUG] "
labels: ["bug"]
assignees: []

body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to fill out this bug report! 🐛

  - type: checkboxes
    attributes:
      label: Is there an existing issue for this?
      description: Please search to see if an issue already exists for the bug you encountered.
      options:
      - label: I have searched the existing issues
        required: true

  - type: textarea
    attributes:
      label: Current Behavior
      description: A concise description of what you're experiencing.
      placeholder: |
        When I do X, Y happens unexpectedly.
    validations:
      required: true

  - type: textarea
    attributes:
      label: Expected Behavior
      description: A concise description of what you expected to happen.
      placeholder: |
        When I do X, Y should happen.
    validations:
      required: true

  - type: textarea
    attributes:
      label: Steps To Reproduce
      description: Steps to reproduce the behavior.
      placeholder: |
        1. Navigate to '...'
        2. Click on '...'
        3. Scroll down to '...'
        4. See error
      validations:
        required: true

  - type: textarea
    attributes:
      label: Environment
      description: |
        Examples:
        - **OS**: Windows 11
        - **Browser**: Chrome 120.0
        - **Node**: 18.17.1
        - **npm**: 9.8.1
      value: |
        - **OS**: 
        - **Browser**: 
        - **Node**: 
        - **npm**: 
      render: markdown
      validations:
        required: true

  - type: textarea
    attributes:
      label: Screenshots/Video
      description: If applicable, add screenshots or videos showing the bug.

  - type: textarea
    attributes:
      label: Additional Context
      description: Add any other context about the problem here.

  - type: checkboxes
    attributes:
      label: Would you like to submit a PR to fix this issue?
      options:
      - label: "Yes, I would like to submit a PR!"
