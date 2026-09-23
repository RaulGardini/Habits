CREATE TABLE `sync_outbox` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`table_name` text NOT NULL,
	`row_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_outbox_row_uq` ON `sync_outbox` (`table_name`,`row_key`);--> statement-breakpoint
CREATE TABLE `sync_pause` (
	`id` integer PRIMARY KEY NOT NULL
);--> statement-breakpoint
-- Outbox triggers: every insert/update of a synced row queues it for the next push, in the
-- same transaction as the change (hand-written; drizzle-kit does not generate triggers).
-- A row changed again moves to the end (new `seq`). No `INSERT OR REPLACE`: inside a trigger
-- the outer UPSERT's conflict policy would override it. Device-only settings never sync.
-- Off while `sync_pause` has a row (applying rows pulled from the cloud).
--> statement-breakpoint
CREATE TRIGGER `habits_outbox_insert` AFTER INSERT ON `habits`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'habits' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('habits', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `habits_outbox_update` AFTER UPDATE ON `habits`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'habits' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('habits', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `habit_reminders_outbox_insert` AFTER INSERT ON `habit_reminders`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'habitReminders' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('habitReminders', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `habit_reminders_outbox_update` AFTER UPDATE ON `habit_reminders`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'habitReminders' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('habitReminders', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `habit_entries_outbox_insert` AFTER INSERT ON `habit_entries`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'habitEntries' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('habitEntries', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `habit_entries_outbox_update` AFTER UPDATE ON `habit_entries`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'habitEntries' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('habitEntries', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `tasks_outbox_insert` AFTER INSERT ON `tasks`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'tasks' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('tasks', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `tasks_outbox_update` AFTER UPDATE ON `tasks`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'tasks' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('tasks', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `events_outbox_insert` AFTER INSERT ON `events`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'events' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('events', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `events_outbox_update` AFTER UPDATE ON `events`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'events' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('events', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `day_notes_outbox_insert` AFTER INSERT ON `day_notes`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'dayNotes' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('dayNotes', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `day_notes_outbox_update` AFTER UPDATE ON `day_notes`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'dayNotes' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('dayNotes', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `goals_outbox_insert` AFTER INSERT ON `goals`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'goals' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('goals', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `goals_outbox_update` AFTER UPDATE ON `goals`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`)
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'goals' AND `row_key` = NEW.`id`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('goals', NEW.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `settings_outbox_insert` AFTER INSERT ON `settings`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`) AND NEW.`key` NOT IN ('activeTimer', 'syncState')
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'settings' AND `row_key` = NEW.`key`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('settings', NEW.`key`);
END;
--> statement-breakpoint
CREATE TRIGGER `settings_outbox_update` AFTER UPDATE ON `settings`
WHEN NOT EXISTS (SELECT 1 FROM `sync_pause`) AND NEW.`key` NOT IN ('activeTimer', 'syncState')
BEGIN
  DELETE FROM `sync_outbox` WHERE `table_name` = 'settings' AND `row_key` = NEW.`key`;
  INSERT INTO `sync_outbox` (`table_name`, `row_key`) VALUES ('settings', NEW.`key`);
END;
--> statement-breakpoint
-- Rows changed since the last push of the previous sync engine (all rows if never synced).
--> statement-breakpoint
INSERT OR IGNORE INTO `sync_outbox` (`table_name`, `row_key`)
SELECT 'habits', `id` FROM `habits`
WHERE `updated_at` > COALESCE((SELECT json_extract(`value`, '$.lastPushedAt') FROM `settings` WHERE `key` = 'syncState'), '');
--> statement-breakpoint
INSERT OR IGNORE INTO `sync_outbox` (`table_name`, `row_key`)
SELECT 'habitReminders', `id` FROM `habit_reminders`
WHERE `updated_at` > COALESCE((SELECT json_extract(`value`, '$.lastPushedAt') FROM `settings` WHERE `key` = 'syncState'), '');
--> statement-breakpoint
INSERT OR IGNORE INTO `sync_outbox` (`table_name`, `row_key`)
SELECT 'habitEntries', `id` FROM `habit_entries`
WHERE `updated_at` > COALESCE((SELECT json_extract(`value`, '$.lastPushedAt') FROM `settings` WHERE `key` = 'syncState'), '');
--> statement-breakpoint
INSERT OR IGNORE INTO `sync_outbox` (`table_name`, `row_key`)
SELECT 'tasks', `id` FROM `tasks`
WHERE `updated_at` > COALESCE((SELECT json_extract(`value`, '$.lastPushedAt') FROM `settings` WHERE `key` = 'syncState'), '');
--> statement-breakpoint
INSERT OR IGNORE INTO `sync_outbox` (`table_name`, `row_key`)
SELECT 'events', `id` FROM `events`
WHERE `updated_at` > COALESCE((SELECT json_extract(`value`, '$.lastPushedAt') FROM `settings` WHERE `key` = 'syncState'), '');
--> statement-breakpoint
INSERT OR IGNORE INTO `sync_outbox` (`table_name`, `row_key`)
SELECT 'dayNotes', `id` FROM `day_notes`
WHERE `updated_at` > COALESCE((SELECT json_extract(`value`, '$.lastPushedAt') FROM `settings` WHERE `key` = 'syncState'), '');
--> statement-breakpoint
INSERT OR IGNORE INTO `sync_outbox` (`table_name`, `row_key`)
SELECT 'goals', `id` FROM `goals`
WHERE `updated_at` > COALESCE((SELECT json_extract(`value`, '$.lastPushedAt') FROM `settings` WHERE `key` = 'syncState'), '');
--> statement-breakpoint
INSERT OR IGNORE INTO `sync_outbox` (`table_name`, `row_key`)
SELECT 'settings', `key` FROM `settings`
WHERE `updated_at` > COALESCE((SELECT json_extract(`value`, '$.lastPushedAt') FROM `settings` WHERE `key` = 'syncState'), '') AND `key` NOT IN ('activeTimer', 'syncState');
