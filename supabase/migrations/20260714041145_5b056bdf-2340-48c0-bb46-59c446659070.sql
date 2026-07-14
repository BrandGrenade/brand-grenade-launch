CREATE INDEX IF NOT EXISTS sessions_status_idx ON public.sessions USING btree (status);
CREATE INDEX IF NOT EXISTS sessions_stage_status_idx ON public.sessions USING btree (stage_status);
CREATE INDEX IF NOT EXISTS sessions_brand_name_idx ON public.sessions USING btree (lower(brand_name));
CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON public.sessions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_user_id_updated_at_idx ON public.sessions USING btree (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_sessions_created_at_idx ON public.intelligence_sessions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_sessions_user_id_updated_at_idx ON public.intelligence_sessions USING btree (user_id, updated_at DESC);