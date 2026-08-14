CREATE TABLE `consultations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`bouquet_id` text NOT NULL,
	`bouquet_name` text NOT NULL,
	`size` text NOT NULL,
	`material_plan` text NOT NULL,
	`price_range` text NOT NULL,
	`scene` text DEFAULT '' NOT NULL,
	`delivery_date` text DEFAULT '' NOT NULL,
	`budget` text DEFAULT '' NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_consultations_reference` ON `consultations` (`reference`);--> statement-breakpoint
CREATE INDEX `idx_consultations_status_created` ON `consultations` (`status`,`created_at`);