import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const consultations = sqliteTable("consultations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reference: text("reference").notNull(),
  bouquetId: text("bouquet_id").notNull(),
  bouquetName: text("bouquet_name").notNull(),
  size: text("size").notNull(),
  materialPlan: text("material_plan").notNull(),
  priceRange: text("price_range").notNull(),
  scene: text("scene").notNull().default(""),
  deliveryDate: text("delivery_date").notNull().default(""),
  budget: text("budget").notNull().default(""),
  customerName: text("customer_name").notNull().default(""),
  contact: text("contact").notNull().default(""),
  note: text("note").notNull().default(""),
  referralCode: text("referral_code").notNull().default(""),
  referrerMemberId: integer("referrer_member_id"),
  purchaseAmount: integer("purchase_amount").notNull().default(0),
  rewardGranted: integer("reward_granted", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_consultations_reference").on(table.reference),
  index("idx_consultations_status_created").on(table.status, table.createdAt),
  index("idx_consultations_referrer_member").on(table.referrerMemberId),
]);

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  contact: text("contact").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_members_name").on(table.name),
]);

export const memberLedger = sqliteTable("member_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: integer("member_id").notNull().references(() => members.id),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  reason: text("reason").notNull(),
  consultationId: integer("consultation_id").references(() => consultations.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_member_ledger_member_created").on(table.memberId, table.createdAt),
  index("idx_member_ledger_consultation").on(table.consultationId),
]);

export const catalogState = sqliteTable("catalog_state", {
  id: integer("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
