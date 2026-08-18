export const DEFAULT_WORKFLOW_STATE_PATH =
  '/home/sam/.openclaw/workspace/state/youtube_linkedin_workflow.json';

export const ACTIVE_WORKFLOW_NAME = 'youtube-linkedin-daily-digest';
export const LEGACY_OPENCLAW_CRON_ID = 'fe974333-bc3a-484a-aba3-679aa3102702';

export function syncWorkflowMetadata(state, { statePath = DEFAULT_WORKFLOW_STATE_PATH } = {}) {
  state.workflow ??= {};
  Object.assign(state.workflow, {
    name: ACTIVE_WORKFLOW_NAME,
    legacy_names: ['youtube-linkedin-review-publish', 'youtube-linkedin-preview-publish'],
    display_name: 'YouTube to LinkedIn daily digest',
    status: 'production',
    mode: 'daily_digest_only',
    canonical_state_path: statePath,
    source_channels_path: 'youtube_video_watchlist.channels',
    delivery: {
      channel: 'telegram',
      to: '8692887396',
    },
    active_scheduler: {
      kind: 'systemd_user_timer',
      timer_name: 'openclaw-youtube-linkedin-digest.timer',
      service_name: 'openclaw-youtube-linkedin-digest.service',
      schedule: '*-*-* 06:00:00 UTC',
      randomized_delay: 'none',
      persistent: false,
      command: 'npm --silent run youtube:digest:send',
    },
    daily_digest: {
      mode: 'digest_only',
      generator_command: 'npm --silent run youtube:digest',
      sender_command: 'npm --silent run youtube:digest:send',
      packet_generation: 'manual_only',
      thumbnail_storage: 'none',
    },
    manual_commands: {
      save_video: 'npm --silent run youtube:digest -- --save-video <video-id-or-url>',
      unsave_video: 'npm --silent run youtube:digest -- --unsave-video <video-id-or-url>',
      status_video: 'npm --silent run youtube:digest -- --status-video <video-id-or-url>',
    },
    legacy_openclaw_cron: {
      name: 'youtube-linkedin-review-publish',
      aliases: ['youtube-linkedin-preview-publish'],
      cron_job_id: LEGACY_OPENCLAW_CRON_ID,
      status: 'removed',
      removed_at: '2026-08-10',
      acceptable_states: ['removed', 'disabled'],
      former_execution_agent_id: 'linkedinengine',
    },
  });

  for (const key of [
    'aliases',
    'cron_job_id',
    'schedule',
    'cron_behavior',
    'daily_packet_cap',
    'sources',
    'youtube_source_channels',
    'stability_mode',
  ]) {
    delete state.workflow[key];
  }
}
