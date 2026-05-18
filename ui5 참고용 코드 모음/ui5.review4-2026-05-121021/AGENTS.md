# AGENTS.md

## Project context

This is a SAPUI5 project.

Main source directory:
- webapp/

Important files:
- webapp/manifest.json
- webapp/Component.js
- webapp/controller/*
- webapp/view/*
- webapp/fragment/*
- webapp/i18n/i18n.properties

## Commenting rules

When adding comments:
- Do not change runtime behavior.
- Do not rename IDs, binding paths, routes, targets, model names, or i18n keys.
- Do not add new dependencies.
- Avoid commenting every line.
- Add comments only where they explain intent, lifecycle, routing, binding, model usage, event flow, or SAPUI5 framework behavior.
- Use Korean comments for educational clarity.
- Keep comments professional and suitable for beginner SAPUI5 students.

## SAPUI5-specific rules

For JavaScript controllers:
- Preserve sap.ui.define dependency order.
- Do not convert controller syntax unless explicitly requested.
- Explain lifecycle hooks such as onInit, onBeforeRendering, onAfterRendering only when relevant.
- Explain router, model, binding context, event object, and formatter usage.

For XML Views:
- Use XML comments only when they help explain layout, aggregation, binding, or control intent.
- Do not change control hierarchy unless explicitly requested.
- Do not modify namespaces unless necessary.

For manifest.json:
- Do not modify routes, targets, models, or dataSources unless explicitly requested.
- Explain routing and model configuration in comments only if JSON comments are not required. Since JSON does not support comments, provide explanation separately instead of editing manifest.json directly.

## Verification

After changes:
- Show a concise summary of changed files.
- Show key risks.
- Ask me to review the diff before considering the task complete.
- If npm scripts exist, suggest the relevant command, but do not install new packages without approval.