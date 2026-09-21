CREATE TABLE `habit_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`value` real,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_entries_habit_date_uq` ON `habit_entries` (`habit_id`,`date`);--> statement-breakpoint
CREATE INDEX `habit_entries_date_idx` ON `habit_entries` (`date`);--> statement-breakpoint
CREATE TABLE `habit_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`time` text NOT NULL,
	`weekdays` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `habit_reminders_habit_idx` ON `habit_reminders` (`habit_id`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`time_of_day` text DEFAULT 'anytime' NOT NULL,
	`frequency_type` text DEFAULT 'daily' NOT NULL,
	`frequency_weekdays` integer,
	`frequency_count` integer,
	`frequency_period` text,
	`frequency_interval` integer,
	`tracking_type` text DEFAULT 'boolean' NOT NULL,
	`target_value` real,
	`unit` text,
	`start_date` text NOT NULL,
	`archived_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`goal_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `habits_sort_order_idx` ON `habits` (`sort_order`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
