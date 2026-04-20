export const DEMO_TEAM = {
  name: "Northstar Operations",
  description:
    "Regional operations team coordinating outbound shipments, inventory checks, and dock readiness."
};

export const DEMO_USERS = [
  {
    key: "managerPrimary",
    email: "olivia.hart@tasktrail.local",
    firstName: "Olivia",
    lastName: "Hart",
    jobTitle: "Operations Manager",
    appRole: "manager",
    membershipRole: "manager",
    dateOfBirth: "1989-04-16",
    address: "1120 Riverside Avenue, Jacksonville, FL 32204"
  },
  {
    key: "employeeOne",
    email: "ethan.reyes@tasktrail.local",
    firstName: "Ethan",
    lastName: "Reyes",
    jobTitle: "Inventory Coordinator",
    appRole: "employee",
    membershipRole: "member",
    dateOfBirth: "1993-09-02",
    address: "77 Parkline Drive, Jacksonville, FL 32218"
  },
  {
    key: "employeeTwo",
    email: "priya.shah@tasktrail.local",
    firstName: "Priya",
    lastName: "Shah",
    jobTitle: "Logistics Specialist",
    appRole: "employee",
    membershipRole: "member",
    dateOfBirth: "1995-01-28",
    address: "502 Willow Creek Road, Jacksonville, FL 32224"
  },
  {
    key: "employeeJoin",
    email: "nina.patel@tasktrail.local",
    firstName: "Nina",
    lastName: "Patel",
    jobTitle: "Returns Specialist",
    appRole: "employee",
    dateOfBirth: "1997-06-19",
    address: "918 Harbor Point Lane, Jacksonville, FL 32225"
  },
  {
    key: "managerJoin",
    email: "marcus.lee@tasktrail.local",
    firstName: "Marcus",
    lastName: "Lee",
    jobTitle: "Area Manager",
    appRole: "manager",
    dateOfBirth: "1986-11-07",
    address: "411 Red Maple Court, Jacksonville, FL 32256"
  }
];

export const DEMO_PRIMARY_TEAM_MEMBER_KEYS = [
  "managerPrimary",
  "employeeOne",
  "employeeTwo"
];

export const DEMO_LOGIN_ACCOUNTS = {
  manager: DEMO_USERS.find((user) => user.key === "managerPrimary"),
  employee: DEMO_USERS.find((user) => user.key === "employeeOne"),
  employeeJoin: DEMO_USERS.find((user) => user.key === "employeeJoin"),
  managerJoin: DEMO_USERS.find((user) => user.key === "managerJoin")
};

export const DEMO_TASK_BLUEPRINTS = [
  {
    key: "manifestApproval",
    title: "Finalize outbound shipment manifest",
    description:
      "Review outbound pallet counts and clear the final manifest before the carrier pickup window.",
    notes: "Cross-check lane 3 totals before final approval.",
    status: "in_progress",
    priority: "high",
    dueDaysFromToday: 1,
    dueHourUtc: 17,
    estimatedHours: 2.5,
    progressPercent: 40,
    assigneeKey: "employeeOne",
    assignmentNote: "Please finish this before the 5 PM dispatch cutoff."
  },
  {
    key: "inventoryReconciliation",
    title: "Reconcile aisle C inventory counts",
    description:
      "Compare the physical count against the system and flag any variance greater than five units.",
    notes: "Focus on the fast-moving SKUs first.",
    status: "in_progress",
    priority: "high",
    dueDaysFromToday: 0,
    dueHourUtc: 19,
    estimatedHours: 4,
    progressPercent: 65,
    assigneeKey: "employeeTwo",
    assignmentNote: "This is the top priority before closeout."
  },
  {
    key: "carrierException",
    title: "Resolve carrier exception follow-up",
    description:
      "Work through the missing-scan exceptions from the overnight carrier report and confirm final delivery status.",
    notes: "Waiting on supporting paperwork for two exceptions.",
    status: "blocked",
    priority: "high",
    dueDaysFromToday: -1,
    dueHourUtc: 15,
    estimatedHours: 3,
    progressPercent: 55,
    assigneeKey: "employeeOne",
    assignmentNote: "Document blockers clearly for the manager review."
  },
  {
    key: "receivingChecklist",
    title: "Prepare receiving checklist for lane 4",
    description:
      "Stage the receiving checklist and confirm the lane is ready for the afternoon inbound trailer.",
    notes: "Keep this unassigned until dock staffing is confirmed.",
    status: "todo",
    priority: "medium",
    dueDaysFromToday: 0,
    dueHourUtc: 20,
    estimatedHours: 1.5,
    progressPercent: 0,
    assignmentNote: null
  },
  {
    key: "dispatchSummary",
    title: "Submit end-of-day dispatch summary",
    description:
      "Send the dispatch summary to leadership with completed lane totals and next-day risks.",
    notes: "Completed ahead of the evening handoff.",
    status: "completed",
    priority: "medium",
    dueDaysFromToday: -1,
    dueHourUtc: 16,
    estimatedHours: 1.25,
    progressPercent: 100,
    completedDaysFromToday: -1,
    completedHourUtc: 14,
    assigneeKey: "employeeTwo",
    assignmentNote: "Include the final route adjustments in the notes."
  },
  {
    key: "returnsTriage",
    title: "Triage overnight returns exceptions",
    description:
      "Review the overnight returns queue, clear duplicates, and route damaged items for follow-up.",
    notes: "Completed during the morning huddle.",
    status: "completed",
    priority: "low",
    dueDaysFromToday: 0,
    dueHourUtc: 13,
    estimatedHours: 1,
    progressPercent: 100,
    completedDaysFromToday: 0,
    completedHourUtc: 10,
    assigneeKey: "employeeOne",
    assignmentNote: "Only keep supplier-claim cases open."
  }
];

export const DEMO_RECURRING_RULE_BLUEPRINTS = [
  {
    key: "dockWalkthrough",
    title: "Morning dock readiness walkthrough",
    description:
      "Verify dock lanes, labels, and handhelds before the morning outbound window opens.",
    priority: "medium",
    frequency: "daily",
    dueTime: "08:30",
    startsOnOffsetDays: 1,
    endsOnOffsetDays: 2,
    defaultAssigneeKey: "employeeOne",
    generatedTaskStatus: "in_progress",
    generatedTaskProgressPercent: 20,
    generatedTaskNotes:
      "Handheld inventory has been checked; lane labels still need a final pass."
  },
  {
    key: "cycleCount",
    title: "Thursday cycle count review",
    description:
      "Run the weekly cycle count review for fast-moving inventory and note any variance follow-up.",
    priority: "high",
    frequency: "weekly",
    weekdays: [4],
    dueTime: "13:00",
    startsOnOffsetDays: 1,
    endsOnOffsetDays: 7,
    defaultAssigneeKey: "employeeTwo",
    generatedTaskStatus: "in_progress",
    generatedTaskProgressPercent: 35,
    generatedTaskNotes:
      "Fast-moving SKUs are counted; variance follow-up is still in progress."
  },
  {
    key: "safetyCabinetAudit",
    title: "Month-end safety cabinet audit",
    description:
      "Inspect the floor safety cabinets, replace missing items, and record any follow-up actions.",
    priority: "medium",
    frequency: "monthly",
    dayOfMonth: 28,
    dueTime: "15:30",
    startsOnOffsetDays: 1,
    endsOnOffsetDays: 8,
    defaultAssigneeKey: "employeeTwo"
  }
];
