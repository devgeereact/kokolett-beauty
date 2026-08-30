-- =====================================================================
-- 0057_drop_ai_recommendations.sql
--
-- Created by 0002, never read or written by anything: the shipped
-- assistant is src/lib/insights.ts (deterministic, client-side) plus the
-- ai-assistant-chat Edge Function, neither of which uses this table.
-- Confirmed dead across every audit this session (docs/KOKO_GAP.md).
--
-- Owner-approved for removal 2026-08-30. Explicitly does NOT touch the
-- AI assistant's ability to draft messages, ads or newsletters — that
-- capability is the general chat in ai-assistant-chat/index.ts (a real
-- LLM conversation the owner can ask to draft anything), entirely
-- unrelated to this table. Nothing in the codebase reads or writes
-- ai_recommendations, so nothing about how the owner uses the assistant
-- changes.
-- =====================================================================

drop table public.ai_recommendations;
drop type public.recommendation_status;
