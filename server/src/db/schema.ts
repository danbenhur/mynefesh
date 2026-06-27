import { pgTable, pgEnum, uuid, text, integer, boolean, timestamp, date, doublePrecision, jsonb, index, numeric, unique } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  googleId: text('google_id').unique(),
  email: text('email').unique().notNull(),
  name: text('name').notNull().default(''),
  picture: text('picture'),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  isSandboxUser: boolean('is_sandbox_user').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  emailIdx: index('idx_users_email').on(t.email),
  googleIdIdx: index('idx_users_google_id').on(t.googleId),
}))

export const allowedEmails = pgTable('allowed_emails', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => ({
  emailIdx: index('idx_allowed_emails_email').on(t.email),
}))

export const taskStatusEnum = pgEnum('task_status', ['todo', 'in-progress', 'done'])
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high'])
export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant'])

// Self-referential: parentId is null for top-level umbrellas, UUID for children.
// This mirrors the client Umbrella type directly (parentId: string | null).
export const umbrellas = pgTable('umbrellas', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon').notNull().default(''),
  parentId: uuid('parent_id').references((): AnyPgColumn => umbrellas.id, { onDelete: 'cascade' }),
  healthScore: integer('health_score').notNull().default(50),
  notes: text('notes').array().notNull().default(sql`ARRAY[]::text[]`),
  position: integer('position').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('idx_umbrellas_user_id').on(t.userId),
  parentIdIdx: index('idx_umbrellas_parent_id').on(t.parentId),
  archivedAtIdx: index('idx_umbrellas_archived_at').on(t.archivedAt),
}))

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  umbrellaId: uuid('umbrella_id').notNull().references(() => umbrellas.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: taskStatusEnum('status').notNull().default('todo'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('idx_tasks_user_id').on(t.userId),
  umbrellaIdIdx: index('idx_tasks_umbrella_id').on(t.umbrellaId),
  statusIdx: index('idx_tasks_status').on(t.status),
}))

export const reminders = pgTable('reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  umbrellaId: uuid('umbrella_id').notNull().references(() => umbrellas.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  triggerAt: timestamp('trigger_at', { withTimezone: true }).notNull(),
  isRecurring: boolean('is_recurring').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('idx_reminders_user_id').on(t.userId),
  umbrellaIdIdx: index('idx_reminders_umbrella_id').on(t.umbrellaId),
}))

export const healthHistory = pgTable('health_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  umbrellaId: uuid('umbrella_id').notNull().references(() => umbrellas.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('idx_health_history_user_id').on(t.userId),
  umbrellaIdIdx: index('idx_health_history_umbrella_id').on(t.umbrellaId),
}))

export const whatsappStateEnum = pgEnum('whatsapp_state', ['pending', 'snoozed', 'completed', 'final_sent'])

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  checkinTime: text('checkin_time').notNull().default('21:00'),
  phoneNumber: text('phone_number'),
  timezone: text('timezone').notNull().default('Asia/Jerusalem'),
  shabbatMode: boolean('shabbat_mode').notNull().default(true),
  saturdayCheckinTime: text('saturday_checkin_time'),
  lastSandboxJoinAt: timestamp('last_sandbox_join_at', { withTimezone: true }),
  sandboxStatus: text('sandbox_status').notNull().default('unknown'),
  lastDeliveryFailureAt: timestamp('last_delivery_failure_at', { withTimezone: true }),
  last60hReminderAt: timestamp('last_60h_reminder_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const whatsappSession = pgTable('whatsapp_session', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  state: whatsappStateEnum('state').notNull().default('pending'),
  snoozeCount: integer('snooze_count').notNull().default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  nextSendAt: timestamp('next_send_at', { withTimezone: true }),
}, (t) => ({
  userIdIdx: index('idx_whatsapp_session_user_id').on(t.userId),
  userDateUnique: unique('uq_whatsapp_session_user_date').on(t.userId, t.date),
}))

export const cadenceEnum = pgEnum('cadence', ['daily', 'weekly', 'monthly', 'annual'])
export const answerTypeEnum = pgEnum('answer_type', ['text', 'scale', 'boolean', 'boolean_partial', 'multi_select'])
export const answerBooleanValueEnum = pgEnum('answer_boolean_value', ['yes', 'no', 'partial'])

export const umbrellaQuestions = pgTable('umbrella_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  umbrellaId: uuid('umbrella_id').notNull().references(() => umbrellas.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  cadence: cadenceEnum('cadence').notNull(),
  dayOfWeek: integer('day_of_week'),      // 0-6, weekly only
  dayOfMonth: integer('day_of_month'),    // 1-31, monthly + annual
  monthOfYear: integer('month_of_year'),  // 1-12, annual only
  answerType: answerTypeEnum('answer_type').notNull().default('text'),
  scaleMin: integer('scale_min'),
  scaleMax: integer('scale_max'),
  options: jsonb('options').$type<string[]>(),
  position: integer('position').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('idx_umbrella_questions_user_id').on(t.userId),
  umbrellaIdIdx: index('idx_umbrella_questions_umbrella_id').on(t.umbrellaId),
}))

export const questionAnswers = pgTable('question_answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => umbrellaQuestions.id, { onDelete: 'cascade' }),
  interviewDate: date('interview_date').notNull(),
  answerText: text('answer_text'),
  answerScale: integer('answer_scale'),
  answerBoolean: answerBooleanValueEnum('answer_boolean'),
  answerOptions: text('answer_options').array(),
  answerNormalized: doublePrecision('answer_normalized'),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('idx_question_answers_user_id').on(t.userId),
  questionIdIdx: index('idx_question_answers_question_id').on(t.questionId),
  interviewDateIdx: index('idx_question_answers_interview_date').on(t.interviewDate),
}))

export const interviewSession = pgTable('interview_session', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  currentIndex: integer('current_index').notNull().default(0),
}, (t) => ({
  userIdIdx: index('idx_interview_session_user_id').on(t.userId),
  userDateUnique: unique('uq_interview_session_user_date').on(t.userId, t.date),
}))

export const resolutions = pgTable('resolutions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  umbrellaId: uuid('umbrella_id').notNull().references(() => umbrellas.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => umbrellaQuestions.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  successThreshold: integer('success_threshold'),
  status: text('status').notNull().default('active'),
  finalScore: integer('final_score'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('idx_resolutions_user_id').on(t.userId),
  umbrellaIdIdx: index('idx_resolutions_umbrella_id').on(t.umbrellaId),
  questionIdIdx: index('idx_resolutions_question_id').on(t.questionId),
  activeDueIdx: index('idx_resolutions_active_due').on(t.status, t.endDate),
}))

// No FK — chat is a global log, not per-umbrella (for now)
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: chatRoleEnum('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('idx_chat_messages_user_id').on(t.userId),
}))

// Spend-tracking table shared by all billable surfaces.
// kind = 'anthropic' → token fields populated; kind = 'sms' → token fields null.
// user_id is nullable (FK to users; null for system-level calls).
export const apiUsage = pgTable('api_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  kind: text('kind').notNull(), // 'anthropic' | 'sms'
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  dayUtc: date('day_utc').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd: numeric('cost_usd', { precision: 10, scale: 4 }),
}, (t) => ({
  dayUtcIdx: index('idx_api_usage_day_utc').on(t.dayUtc),
  kindDayIdx: index('idx_api_usage_kind_day').on(t.kind, t.dayUtc),
  userIdIdx: index('idx_api_usage_user_id').on(t.userId),
}))
