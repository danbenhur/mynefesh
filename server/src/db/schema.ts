import { pgTable, pgEnum, uuid, text, integer, boolean, timestamp, date } from 'drizzle-orm/pg-core'
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

// No FK — chat is a global log, not per-umbrella (for now)
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: chatRoleEnum('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
