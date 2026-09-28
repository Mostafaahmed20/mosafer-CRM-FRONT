# Daily Operations Task System Architecture

## Goal

Add a daily internal operations task tool without duplicating the current ticketing system.

The right approach is:

- Keep `tickets` for external/customer/problem-driven work.
- Add `daily ops tasks` for planned recurring internal work.
- Reuse the same collaboration engine for comments, attachments, assignees, permissions, notifications, and shift handover.

Do not build a completely separate app inside the CRM. Build a new module on top of the same work-item foundation.

## Best Architectural Direction

Use a shared `WorkItem` domain with two main business types:

- `ticket`
- `daily_task`

Then add recurring task support with:

- `DailyTaskTemplate`
- `DailyTaskInstance`
- `TaskHandover`
- `TaskActivity`

This avoids duplicated logic for:

- comments
- replies
- attachments
- assignees
- permissions
- realtime notifications
- audit history

## Why This Is Better Than A Separate Tool

Your current frontend already shows the correct primitives:

- card comments and editing
- card attachments
- member assignment
- realtime notifications
- shift handover fields

So the new module should share those behaviors instead of rebuilding them with different APIs and different data models.

If you create a fully separate daily-task tool, you will duplicate:

- task assignment
- comment threads
- file uploads
- notification logic
- status flow
- member permissions
- reporting

That will fight your ticketing system and become harder to maintain.

## Business Separation

### Tickets

Use tickets for:

- customer issues
- travel booking problems
- incidents
- requests requiring investigation or SLA tracking

### Daily Ops Tasks

Use daily tasks for:

- recurring work every day
- opening/closing shift routines
- quality checks
- admin follow-ups
- internal team duties
- planned operational checklists

### Bridge Between Them

If a daily task reveals a real issue, allow:

- `Create linked ticket from task`
- `Link existing ticket`

This is better than turning every internal task into a ticket.

## Recommended Domain Model

### 1. WorkItem

Shared base model for all operational items.

Core fields:

- `id`
- `type`: `ticket | daily_task`
- `title`
- `description`
- `status`
- `priority`
- `boardId`
- `listId`
- `createdBy`
- `assignedTo[]`
- `watchers[]`
- `attachments[]`
- `comments[]`
- `activity[]`
- `createdAt`
- `updatedAt`

### 2. DailyTaskTemplate

Defines what should be generated every day.

Fields:

- `id`
- `title`
- `description`
- `teamId`
- `boardId`
- `defaultListId`
- `defaultAssigneeMode`: `fixed_users | role_based | round_robin | shift_based`
- `defaultAssigneeIds[]`
- `createdBy`
- `active`
- `recurrenceRule`
- `shiftType`: `morning | evening | night | custom`
- `checklistTemplate[]`
- `requiresAttachment`
- `requiresPendingReason`
- `allowCarryForward`
- `slaMinutes` or `dueTime`
- `tags[]`

### 3. DailyTaskInstance

One generated task for one day and one shift.

Fields:

- `id`
- `templateId`
- `workItemId`
- `businessDate`
- `shiftId`
- `teamId`
- `assigneeIds[]`
- `status`: `todo | in_progress | pending | done | carried_forward | cancelled`
- `progressPercent`
- `pendingReason`
- `completionNote`
- `completedAt`
- `completedBy`
- `carriedForwardToShiftId`
- `carriedForwardReason`
- `source`: `auto_generated | manual`

### 3a. Team Coverage Assignment

Your screenshot shows a daily coverage matrix, not just simple task assignment.

Example from the image:

- `Hadeer` handles `Mail` from `2:00 AM - 1:00 PM`, plus `Creation`
- `Eman` handles `WhatsApp` from `8:00 AM - 3:00 PM`, plus `Arrivals`
- `Yasmin` handles `WhatsApp` from `9:00 AM - 4:00 PM`
- `Fadwa` handles `WhatsApp` from `9:00 AM - 4:00 PM`, plus `3 days ahead`
- `Mariam` handles `Mail` from `1:00 PM - 4:00 PM`
- `Trainees` handle `WhatsApp` from `9:00 AM - 4:00 PM`, plus `Failures - AR-CR`

This means you need one more business object:

- `CoverageSlot`

Fields:

- `id`
- `teamId`
- `businessDate`
- `channel`: `mail | whatsapp | custom`
- `memberId`
- `startsAt`
- `endsAt`
- `secondaryDuty` nullable
- `shiftId`
- `capacityWeight`
- `notes`

This is important because not every task should be manually assigned one by one. Some tasks should be generated from the daily coverage plan.

### 4. TaskComment

Reuse your existing card comment idea, but support replies.

Fields:

- `id`
- `workItemId`
- `authorId`
- `body`
- `parentCommentId` nullable
- `mentions[]`
- `editedAt`
- `deletedAt`
- `createdAt`

If nested replies are too heavy for phase 1, keep flat comments plus `@mentions`.

### 5. TaskAttachment

Reuse existing attachment model.

Fields:

- `id`
- `workItemId`
- `uploadedBy`
- `fileName`
- `mimeType`
- `size`
- `url`
- `createdAt`

### 6. TaskHandover

Use this instead of inventing another pending-transfer object.

Fields:

- `id`
- `dailyTaskInstanceId`
- `fromShiftId`
- `toShiftId`
- `reason`
- `summary`
- `nextAction`
- `nextOwnerId`
- `createdBy`
- `createdAt`
- `acceptedAt`

## Status Model

Keep the status model simple and operational:

- `todo`
- `in_progress`
- `pending`
- `done`
- `carried_forward`

Rules:

- when task is completed, set `progressPercent = 100`
- when task is `todo`, progress is `0`
- when task is checklist-based, progress can be derived from checklist completion
- when task is `pending`, `pendingReason` is required
- when task is moved to another shift, create a handover record and notify the next owner

Do not allow arbitrary progress editing if you can derive it from status/checklist. Derived progress is cleaner.

## Schedule Model From Your Screenshot

The screenshot should not be stored as one flat Excel-like table in the app. It should be normalized into three layers:

### 1. Team Members

- person identity
- role
- team membership

### 2. Daily Coverage Slots

- who owns `Mail`
- who owns `WhatsApp`
- what time window they cover
- what extra duty they own that day

### 3. Generated Daily Tasks

From each coverage slot, generate tasks such as:

- `Monitor WhatsApp queue`
- `Handle Mail queue`
- `Process Arrivals`
- `Process Creation`
- `Review 3 days ahead`
- `Handle Failures AR-CR`

That gives you both:

- a staffing schedule
- actionable tasks with comments, attachments, replies, pending reasons, and completion state

This is better than making the schedule itself the task.

## Permissions

Recommended permission layers:

### Global Admin

- manage all users
- configure teams and shifts
- view all daily tasks

### Board or Team Admin

- create templates
- assign members
- edit all daily tasks in their team
- carry tasks to another shift
- reopen completed tasks

### Member

- view assigned tasks
- update own task status
- add comments
- upload/delete own attachments
- edit/delete own comments
- mark task done
- add pending reason

### Observer

- read-only

## Notification Architecture

Extend the existing notification system. Add event types such as:

- `daily_task.generated`
- `daily_task.assigned`
- `daily_task.updated`
- `daily_task.commented`
- `daily_task.replied`
- `daily_task.completed`
- `daily_task.pending`
- `daily_task.carried_forward`

Delivery channels:

- in-app notification bell
- realtime socket event
- optional email digest for missed tasks

Notify these users:

- assignee
- task creator
- team admins
- mentioned users
- next-shift assignee on carry forward

## Scheduling / Automation

You need a background job that runs daily per team timezone.

Recommended services:

### Recurrence Generator Job

Runs every day and creates `DailyTaskInstance` from active templates.

Responsibilities:

- find active templates for the date
- resolve the shift
- resolve coverage slot owner
- resolve assignees
- create instances idempotently
- send notifications

### Coverage Planner Job

Runs before daily task generation.

Responsibilities:

- load the team coverage plan for the day
- assign channel owners by time range
- apply extra duties
- support backup members or trainees
- expose gaps where no owner exists for a channel/time window

This matters because your screenshot is primarily a coverage plan.

### Escalation / Reminder Job

Runs every few minutes.

Responsibilities:

- remind users about overdue daily tasks
- notify admins about pending or untouched tasks
- notify next shift when handover exists

### Completion Metrics Job

Optional if analytics become heavy.

Responsibilities:

- aggregate completion rate
- average completion time
- pending reasons distribution
- carry-forward rate

## API Design

Recommended API surface:

### Templates

- `GET /api/daily-task-templates`
- `POST /api/daily-task-templates`
- `PATCH /api/daily-task-templates/:id`
- `DELETE /api/daily-task-templates/:id`

### Daily Task Instances

- `GET /api/daily-tasks?date=2026-03-11&teamId=&shiftId=&status=&assigneeId=`
- `POST /api/daily-tasks/manual`
- `PATCH /api/daily-tasks/:id`
- `POST /api/daily-tasks/:id/complete`
- `POST /api/daily-tasks/:id/pending`
- `POST /api/daily-tasks/:id/carry-forward`

### Comments / Replies

- `POST /api/daily-tasks/:id/comments`
- `PATCH /api/daily-tasks/:id/comments/:commentId`
- `DELETE /api/daily-tasks/:id/comments/:commentId`
- `POST /api/daily-tasks/:id/comments/:commentId/replies`

### Attachments

- `POST /api/daily-tasks/:id/attachments`
- `DELETE /api/daily-tasks/:id/attachments/:attachmentId`

### Linking With Tickets

- `POST /api/daily-tasks/:id/link-ticket`
- `POST /api/daily-tasks/:id/create-ticket`

## UI Architecture

Do not hide this inside the ticket inbox. Make it its own workspace.

Recommended screens:

### 1. Daily Ops Workspace

Main operational screen for today.

Sections:

- `Coverage Board`
- `My Tasks Today`
- `Team Tasks`
- `Pending / Handover Queue`
- `Completed Today`

Views:

- board view by status
- list view by assignee
- shift view
- coverage timeline by channel

### 2. Task Detail Drawer / Modal

Reuse the current card detail interaction pattern.

Include:

- title and description
- assignees
- checklist
- comments and replies
- attachments
- pending reason
- handover to next shift
- linked tickets
- audit timeline

### 3. Template Library

For admins only.

Include:

- create recurring task templates
- assign default team members
- define recurrence and shift
- mark required evidence
- define carry-forward policy

### 3a. Coverage Planner

For admins/team leads.

Include:

- assign team member to channel
- define working window
- assign additional duty
- assign backup or trainee support
- detect overlapping or uncovered schedule windows

The picture you sent maps directly to this screen.

### 4. Shift Handover Queue

Operational safety screen.

Shows:

- tasks not completed in current shift
- pending reason
- next action
- next owner
- handover acceptance state

## How To Avoid Conflict With Existing Ticketing

### Reuse

Reuse these capabilities from the current system:

- comments
- attachments
- members
- notification service
- board permissions
- handover concept

### Do Not Reuse Blindly

Do not force daily tasks into ticket status names like:

- `Requested`
- `Booked`
- `Cancelled`

That status language belongs to ticketing, not daily operations.

### Keep Shared Infrastructure, Separate Business Rules

Share:

- data access layer
- work-item engine
- activity log
- notification bus
- attachment storage

Separate:

- task generation rules
- ticket SLA rules
- ticket-specific fields
- daily-shift logic
- channel coverage planning

## Reporting

Useful KPIs:

- completion rate by day
- completion rate by member
- average completion time
- pending count
- carry-forward count
- completion by shift
- attachment compliance rate
- task load by admin/team/member

This should live in analytics, not inside the ticket inbox.

## Recommended Storage Strategy

If your backend is MongoDB, a clean approach is:

- `workitems`
- `daily_task_templates`
- `daily_task_instances`
- `comments`
- `attachments`
- `notifications`
- `handover_records`
- `coverage_slots`

If your current card structure is already tightly bound to boards/lists, you have two options:

### Option A: Best Long-Term

Refactor cards into a generic `work item` model and let boards render filtered work items.

### Option B: Best Short-Term

Keep board cards as the main storage object and add:

- `card.kind = ticket | daily_task`
- `recurrenceTemplateId`
- `businessDate`
- `shiftId`
- `pendingReason`
- `carriedForwardToShiftId`

Then build templates and automation around cards.

For your current codebase, `Option B` is the fastest and safest first step.

## Recommended Rollout Plan

### Phase 1

- add `daily_task` card kind
- add `coverage_slot` model
- add daily task workspace
- add coverage planner UI from the schedule matrix
- add template model
- add auto-generation job
- reuse comments, attachments, members, notifications
- add pending reason and carry-forward actions

### Phase 2

- add threaded replies
- add richer shift dashboard
- add analytics widgets
- add linked ticket creation

### Phase 3

- add round-robin auto assignment
- add SLA reminders
- add email or push reminders
- add team capacity balancing

## Final Recommendation

The best architecture for your CRM is not a second tasking system beside tickets.

The best architecture is:

- one shared operational work-item engine
- tickets as one item type
- daily recurring tasks as another item type
- one notification and collaboration system
- one shift handover model
- one analytics/reporting pipeline

That gives you:

- less duplicate code
- cleaner permissions
- less confusion for users
- easier reporting
- safer future expansion

## Immediate Build Decision

If you want the fastest implementation with the least risk to the current project, build this as:

- a new `Daily Ops Workspace`
- backed by the existing board/card architecture
- with `card.kind = daily_task`
- with a separate `coverage_slots` table/model for daily ownership like the screenshot
- plus recurring templates and scheduled generation

That is the strongest short-term architecture for this codebase.
