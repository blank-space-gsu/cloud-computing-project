# Project Overview

## Purpose

TaskTrail is a web application for organizing employee work in one place. It replaces fragmented tracking across spreadsheets, email threads, chat messages, and ad hoc manual processes.

## Problem Statement

Managers need a simple way to assign work, monitor deadlines, and understand whether team members are overloaded or falling behind. Employees need a single source of truth for their assigned work, due dates, priorities, and completion status.

## Primary Users

- `employee`: views assigned work, due dates, and task status
- `manager`: assigns tasks, monitors team workload, and reviews completion progress
- `admin`: optional support role for future operational controls

## Current Product Scope

The live product now focuses on the strongest version of the app:

- managers use a lightweight Dashboard to find work that needs attention
- managers use Worker Tracker to drill from team -> employee -> task
- managers create and manage teams, join access, and task assignment
- employees join teams, work from My Tasks, and mark progress or completion
- employees use Calendar to see due-dated assigned work across active teams
- team-based access boundaries remain the source of truth

## Optional Next Enhancements

The planned roadmap is now complete. If the team wants to extend the project after the current delivery baseline, these are sensible next additions:

- task comments and update history
- file attachments
- scheduled/email reminder delivery
- export-ready reporting

## Backend Goals

- expose a REST API that a plain HTML, CSS, and JavaScript frontend can call directly
- keep the project student-friendly while still looking production-inspired
- separate routing, business logic, and data access
- keep naming, response structures, and validation rules consistent
- make every phase testable before moving forward
- produce practical markdown documentation for both backend and frontend teammates

## Current Delivery Status

As of April 17, 2026, the backend supports the focused product spine:

- backend-managed Supabase auth signup/login and RBAC
- durable team memberships with leave/rejoin history
- employee and manager join access through role-aware team access tokens
- employee self-join and self-leave flows
- scoped team list, team detail, and active roster endpoints
- task CRUD, assignment, and reassignment
- employee progress, notes, and completion updates
- task update history in `task_updates`
- manager dashboard attention summary
- Worker Tracker manager drilldown
- employee calendar support through due-dated assigned tasks
- recurring task rules that generate real task instances
- reusable smoke/audit tooling plus deployment docs

Legacy backend surfaces for hours logging, productivity metrics, and goals still exist for compatibility, but they are no longer part of the promoted live product experience.

## Success Criteria

This backend is successful if it is:

- easy for the frontend team to integrate with
- clean enough to explain during a cloud computing presentation
- incremental enough for a student team to build confidently
- documented well enough that new teammates can onboard quickly
- deployable and smoke-checkable with a student-friendly workflow
- focused enough that task assignment, membership, completion, and due-date visibility stay at the center of the product
