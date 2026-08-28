import Blob "mo:core/Blob";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Driver "../backend/main";
import Memory "../backend/memory/github_driver/v2";
import V1 "../backend/memory/github_driver/v1";
import Migration "../backend/memory/github_driver/v1_to_v2";
let user = Principal.fromBlob(Blob.fromArray([1, 2, 3, 2]));
let app = Driver.Init({ stable_memory = { github_driver = Memory.init() } });
assert (not app.github_connection_status(user).connected);
ignore app.github_connection_save("github_pat_12345678901234567890", "octo", user);
let policy = app.github_policy_save("task_board", "octo", "repo", true, true, true, 0, user);
assert policy.ok;
assert app.github_policy_authorize("task_board", "octo", "repo", "issue_create", user);
assert (not app.github_policy_authorize("other_app", "octo", "repo", "issue_create", user));
let queued = app.github_job_enqueue("123e4567-e89b-42d3-a456-426614174000", "task_board", "octo", "repo", "Title", "Body", "request-1", user);
assert queued.ok;
let duplicate = app.github_job_enqueue("223e4567-e89b-42d3-a456-426614174000", "task_board", "octo", "repo", "Different", "Body", "request-1", user);
assert duplicate.ok;
assert (app.github_jobs_list(user).jobs.size() == 1);
let claimed = app.github_job_claim(1, "lease-123456", user);
assert claimed.ok;
assert (not app.github_jobs_delete_terminal([1], user).ok);
assert app.github_job_mark_send_started(1, "lease-123456", user).ok;
let wrongLease = app.github_job_complete(1, "lease-wrong", "succeeded", "Created", "https://github.test/1", 1, "", user);
assert (not wrongLease.ok);
let finished = app.github_job_complete(1, "lease-123456", "succeeded", "Created", "https://github.test/1", 1, "", user);
assert finished.ok;
assert (not app.github_job_claim(1, "lease-second", user).ok);
assert (app.github_jobs_delete_terminal([1], user).deleted == 1);
assert (app.github_jobs_list(user).jobs.size() == 0);

let legacy = V1.init();
Map.add(legacy.jobs, Nat.compare, 1, {
  id = 1; operation = "issue_close"; owner = "octo"; repo = "repo"; issue_number = 7;
  title = ""; body = ""; client_request_id = "legacy-1"; status = "leased";
  lease_id = "legacy-lease"; leased_at = 1; result_summary = ""; external_url = "";
  external_number = 0; error_code = ""; created_at = 1; updated_at = 1;
});
let migrated = Migration.migrate(legacy);
switch (Map.get(migrated.jobs, Nat.compare, 1)) {
  case (?legacyJob) {
    assert (legacyJob.status == "failed_terminal");
    assert legacyJob.external_send_started;
    assert (legacyJob.error_code == "legacy_issue_close_retired");
  };
  case (null) assert false;
};
