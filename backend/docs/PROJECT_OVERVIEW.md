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

## Planned Expansion After MVP

These modules are intentionally planned now so the architecture stays clean, but they are implemented after the MVP is stable:

- measurable goals and quotas, with sales quota support first
- deployment hardening and demo polish

## Backend Goals

- expose a REST API that a plain HTML, CSS, and JavaScript frontend can call directly
- keep the project student-friendly while still looking production-inspired
- separate routing, business logic, and data access
- keep naming, response structures, and validation rules consistent
- make every phase testable before moving forward
- produce practical markdown documentation for both backend and frontend teammates

## Current Delivery Status

As of March 26, 2026, the backend has completed Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, and Phase 7:

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
- roadmap, architecture, schema, and environment docs published

## Success Criteria

This backend is successful if it is:

- easy for the frontend team to integrate with
- clean enough to explain during a cloud computing presentation
- incremental enough for a student team to build confidently
- documented well enough that new teammates can onboard quickly
