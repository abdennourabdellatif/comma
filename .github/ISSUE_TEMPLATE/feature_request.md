name: Feature Request
description: Suggest an idea for this project
title: "[FEATURE] "
labels: ["enhancement"]
assignees: []

body:
  - type: markdown
    attributes:
      value: |
        Thanks for suggesting a feature! ✨

  - type: checkboxes
    attributes:
      label: Is there an existing issue for this?
      description: Please search to see if a feature request already exists.
      options:
      - label: I have searched the existing issues
        required: true

  - type: textarea
    attributes:
      label: Description
      description: A concise description of the feature you'd like to see.
      placeholder: |
        I want to be able to...
    validations:
      required: true

  - type: textarea
    attributes:
      label: Motivation
      description: Why should this feature be added? What problem does it solve?
      placeholder: |
        This would be useful because...
    validations:
      required: true

  - type: textarea
    attributes:
      label: Proposed Solution
      description: Describe how you envision this feature working.
      placeholder: |
        One possible approach would be to...

  - type: textarea
    attributes:
      label: Alternatives Considered
      description: Have you considered any alternative solutions or features?

  - type: textarea
    attributes:
      label: Additional Context
      description: Add any other context or screenshots about the feature request here.

  - type: checkboxes
    attributes:
      label: Would you like to implement this feature?
      options:
      - label: "Yes, I would like to submit a PR!"
