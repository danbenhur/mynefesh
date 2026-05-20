import { pgTable, pgEnum, uuid, text, integer, boolean, timestamp, date, doublePrecision, jsonb } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

export const taskStatusEnum = pgEnum('task_status', ['todo', 'in-progress', 'done'])
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high'])
export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant'])

// Self-referential: parentId is null for top-level umbrellas, UUID for children.
// This mirrors the client Umbrella type directly (parentId: string | null).
export const umbrellas = pgTable('umbrellas', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull().default(''),
  parentId: uuid('parent_id').references((): AnyPgColumn => umbrellas.id, { onDelete: 'cascade' }),
  healthScore: integer('health_score').notNull().default(50),
  notes: text('notes').array().notNull().default(sql`ARRAY[]::text[]`),
  position: integer('position').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  umbrellaId: uuid('umbrella_id').notNull().references(() => umbrellas.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: taskStatusEnum('status').notNull().default('todo'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const reminders = pgTable('reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  umbrellaId: uuid('umbrella_id').notNull().references(() => umbrellas.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  triggerAt: timestamp('trigger_at', { withTimezone: true }).notNull(),
  isRecurring: boolean('is_recurring').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const healthHistory = pgTable('health_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  umbrellaId: uuid('umbrella_id').notNull().references(() => umbrellas.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
})

export const whatsappStateEnum = pgEnum('whatsapp_state', ['pending', 'snoozed', 'completed', 'final_sent'])

export const userSettings = pgTable('user_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
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
  date: date('date').notNull().unique(),
  state: whatsappStateEnum('state').notNull().default('pending'),
  snoozeCount: integer('snooze_count').notNull().default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  nextSendAt: timestamp('next_send_at', { withTimezone: true }),
})

export const cadenceEnum = pgEnum('cadence', ['daily', 'weekly', 'monthly', 'annual'])
export const answerTypeEnum = pgEnum('answer_type', ['text', 'scale', 'boolean', 'boolean_partial', 'multi_select'])
export const answerBooleanValueEnum = pgEnum('answer_boolean_value', ['yes', 'no', 'partial'])

export const umbrellaQuestions = pgTable('umbrella_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
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
})

export const questionAnswers = pgTable('question_answers', {
  id: uuid('id').defaultRandom().primaryKey(),
  questionId: uuid('question_id').notNull().references(() => umbrellaQuestions.id, { onDelete: 'cascade' }),
  interviewDate: date('interview_date').notNull(),
  answerText: text('answer_text'),
  answerScale: integer('answer_scale'),
  answerBoolean: answerBooleanValueEnum('answer_boolean'),
  answerOptions: text('answer_options').array(),
  answerNormalized: doublePrecision('answer_normalized'),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const interviewSession = pgTable('interview_session', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: date('date').notNull().unique(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  currentIndex: integer('current_index').notNull().default(0),
})

export const resolutions = pgTable('resolutions', {
  id: uuid('id').defaultRandom().primaryKey(),
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
})

// No FK — chat is a global log, not per-umbrella (for now)
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: chatRoleEnum('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
