# Project Overview

## Purpose

The Cloud-Based Workforce Task Management System is a web application for organizing employee work in one place. It replaces fragmented tracking across spreadsheets, email threads, chat messages, and ad hoc manual processes.

## Problem Statement

Managers need a simple way to assign work, monitor deadlines, and understand whether team members are overloaded or falling behind. Employees need a single source of truth for their assigned work, due dates, priorities, and completion status.

## Primary Users

- `employee`: views assigned work, due dates, and task status
- `manager`: assigns tasks, monitors team workload, and reviews completion progress
- `admin`: optional support role for future operational controls

## MVP Scope

The first implementation focuses on the smallest useful product:

- manager-to-employee task assignment
- employee task visibility
- task status updates
- due dates, priorities, and weekly organization
- manager dashboard summaries for workload and completion
- team-based access boundaries

## Optional Next Enhancements

The planned roadmap is now complete. If the team wants to extend the project after the current delivery baseline, these are sensible next additions:

- task comments and update history
- file attachments
- scheduled/email reminder delivery beyond the current in-app notification endpoints
- export-ready reporting

## Backend Goals

- expose a REST API that a plain HTML, CSS, and JavaScript frontend can call directly
- keep the project student-friendly while still looking production-inspired
- separate routing, business logic, and data access
- keep naming, response structures, and validation rules consistent
- make every phase testable before moving forward
- produce practical markdown documentation for both backend and frontend teammates

## Current Delivery Status

As of April 9, 2026, the backend has completed Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, Phase 9, and the frontend support extension pass:

- backend project structure created in `/backend`
- Express application bootstrapped
- health endpoint implemented with database readiness reporting
- standard API response helpers added
- centralized error handling added
- environment parsing and validation added
- database connection utilities added
- MVP schema documented and generated as SQL DDL
- Phase 1 migration pushed to the linked Supabase project `cloud_computing`
- backend-managed auth endpoints implemented
- RBAC middleware implemented for role checks
- auth profile sync migration pushed to Supabase
- demo manager and employee accounts seeded for manual verification
- authenticated user profile endpoint implemented
- team list, team detail, and team member roster endpoints implemented
- service-layer team scope rules implemented for employees, managers, and admins
- task list, task detail, task create, task update, and task delete endpoints implemented
- manager task assignment endpoint implemented with active-assignment history
- employee task status, progress, and notes updates restricted through service-layer RBAC
- employee dashboard summary endpoint implemented
- manager dashboard summary endpoint implemented with workload and deadline aggregation
- hours logging endpoints implemented with weekly and monthly totals
- productivity metrics endpoint implemented with weekly, monthly, and yearly rollups
- employee, manager-team, and manager-selected-user productivity views implemented
- goals and sales quota tracking endpoints implemented with computed progress percentages
- user-scoped and team-scoped goals are enforced through manager-controlled write flows
- reusable smoke-test script implemented for local and deployed verification
- Render Blueprint configuration added for monorepo deployment
- deployment and testing documentation published for final handoff
- self-profile editing implemented for safe profile-only fields
- people-directory and manager/admin employee creation APIs implemented
- persisted team creation, editing, and membership management implemented
- backend-backed in-app notifications implemented for list, read, and dismiss flows
- roadmap, architecture, schema, and environment docs published

## Success Criteria

This backend is successful if it is:

- easy for the frontend team to integrate with
- clean enough to explain during a cloud computing presentation
- incremental enough for a student team to build confidently
- documented well enough that new teammates can onboard quickly
- deployable and smoke-checkable with a student-friendly workflow
