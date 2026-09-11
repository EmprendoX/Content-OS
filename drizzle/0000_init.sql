CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`piece_id` text,
	`variant_id` text,
	`agent` text NOT NULL,
	`provider` text DEFAULT 'mock' NOT NULL,
	`status` text NOT NULL,
	`input` text,
	`output` text,
	`error` text,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_piece_idx` ON `agent_runs` (`piece_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brand_networks` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`network` text NOT NULL,
	`handle` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `brand_networks_brand_idx` ON `brand_networks` (`brand_id`);--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#2563eb' NOT NULL,
	`products` text DEFAULT '[]' NOT NULL,
	`audiences` text DEFAULT '[]' NOT NULL,
	`voice_tone` text DEFAULT '' NOT NULL,
	`offers` text DEFAULT '[]' NOT NULL,
	`ctas` text DEFAULT '[]' NOT NULL,
	`proof_points` text DEFAULT '[]' NOT NULL,
	`preferred_words` text DEFAULT '[]' NOT NULL,
	`forbidden_words` text DEFAULT '[]' NOT NULL,
	`forbidden_promises` text DEFAULT '[]' NOT NULL,
	`approved_examples` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_slug_unique` ON `brands` (`slug`);--> statement-breakpoint
CREATE TABLE `content_pieces` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`idea_id` text,
	`campaign` text DEFAULT '' NOT NULL,
	`topic` text NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'IDEA' NOT NULL,
	`networks` text DEFAULT '[]' NOT NULL,
	`research` text,
	`strategy` text,
	`master` text,
	`editor_decision` text,
	`error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pieces_brand_idx` ON `content_pieces` (`brand_id`);--> statement-breakpoint
CREATE INDEX `pieces_status_idx` ON `content_pieces` (`status`);--> statement-breakpoint
CREATE TABLE `content_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`piece_id` text NOT NULL,
	`brand_id` text NOT NULL,
	`network` text NOT NULL,
	`format` text DEFAULT '' NOT NULL,
	`hook` text DEFAULT '' NOT NULL,
	`copy` text DEFAULT '' NOT NULL,
	`cta` text DEFAULT '' NOT NULL,
	`hashtags` text DEFAULT '[]' NOT NULL,
	`visual_brief` text,
	`visual_asset_id` text,
	`reviewer_comments` text DEFAULT '' NOT NULL,
	`review` text,
	`status` text DEFAULT 'ADAPTING' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`scheduled_at` text,
	`published_url` text,
	`published_at` text,
	`approved_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`piece_id`) REFERENCES `content_pieces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `variants_piece_idx` ON `content_variants` (`piece_id`);--> statement-breakpoint
CREATE INDEX `variants_status_idx` ON `content_variants` (`status`);--> statement-breakpoint
CREATE INDEX `variants_scheduled_idx` ON `content_variants` (`scheduled_at`);--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`campaign` text DEFAULT '' NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`priority` integer DEFAULT 2 NOT NULL,
	`status` text DEFAULT 'abierta' NOT NULL,
	`piece_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ideas_brand_idx` ON `ideas` (`brand_id`);--> statement-breakpoint
CREATE TABLE `knowledge_items` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text,
	`title` text NOT NULL,
	`type` text DEFAULT 'nota' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`source_url` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `knowledge_brand_idx` ON `knowledge_items` (`brand_id`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text,
	`filename` text NOT NULL,
	`stored_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`network` text NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`reach` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`shares` integer DEFAULT 0 NOT NULL,
	`saves` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`collected_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `content_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `metrics_variant_idx` ON `metrics` (`variant_id`);--> statement-breakpoint
CREATE TABLE `publish_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`connection_id` text,
	`network` text NOT NULL,
	`dry_run` integer DEFAULT true NOT NULL,
	`payload` text NOT NULL,
	`response` text,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`executed_at` text,
	FOREIGN KEY (`variant_id`) REFERENCES `content_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_variant_idx` ON `publish_jobs` (`variant_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `social_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`network` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`encrypted_token` text,
	`status` text DEFAULT 'simulada' NOT NULL,
	`dry_run` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `connections_brand_idx` ON `social_connections` (`brand_id`);--> statement-breakpoint
CREATE TABLE `variant_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`actor` text DEFAULT 'system' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `content_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `versions_variant_idx` ON `variant_versions` (`variant_id`);