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
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_consultations_reference").on(table.reference),
  index("idx_consultations_status_created").on(table.status, table.createdAt),
]);
