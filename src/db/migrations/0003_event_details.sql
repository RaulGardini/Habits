ALTER TABLE `events` ADD `all_day` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `location` text;--> statement-breakpoint
ALTER TABLE `events` ADD `repeat` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `repeat_until` text;--> statement-breakpoint
ALTER TABLE `events` ADD `excluded_dates` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `reminder_minutes` integer;