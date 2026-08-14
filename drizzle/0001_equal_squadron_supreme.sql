CREATE TABLE `member_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`type` text NOT NULL,
	`reason` text NOT NULL,
	`consultation_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consultation_id`) REFERENCES `consultations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_member_ledger_member_created` ON `member_ledger` (`member_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_member_ledger_consultation` ON `member_ledger` (`consultation_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_code` ON `members` (`code`);--> statement-breakpoint
CREATE INDEX `idx_members_name` ON `members` (`name`);--> statement-breakpoint
ALTER TABLE `consultations` ADD `referral_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `consultations` ADD `purchase_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `consultations` ADD `reward_granted` integer DEFAULT false NOT NULL;