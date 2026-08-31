import Blob "mo:core/Blob";
import Principal "mo:core/Principal";
import NeutronCapabilities "mo:neutron-capabilities";
import Console "../backend/main";
import GitHubMemory "../backend/memory/github_driver/v2";
import TaskMemory "../backend/memory/tasks/v1";
import CyclesMemory "../backend/memory/cycles_checkout/v2";

let self = Principal.fromBlob(Blob.fromArray([0, 1, 1]));
let user = Principal.fromBlob(Blob.fromArray([7, 8, 9, 2]));
let app = Console.Init({
  stable_memory = { github_driver = GitHubMemory.init(); tasks = TaskMemory.init(); cycles_checkout = CyclesMemory.init() };
  capabilities = { backend_calls = {
    canister_principal = self;
    can_call = func(_canister : Principal, _method : Text) { false };
    call = func(_request : NeutronCapabilities.BackendCallRequestV1) : async* NeutronCapabilities.BackendCallResultV1 { #err({ code = "unreserved"; message = "No exact access" }) };
    call_batch = func(_requests : [NeutronCapabilities.BackendCallRequestV1]) : async* [NeutronCapabilities.BackendCallResultV1] { [] };
  } };
});
assert (not app.github_connection_status((), user).connected);
let demo = app.github_demo_run("323e4567-e89b-42d3-a456-426614174000", user);
assert demo.ok;
switch (demo.job) { case null assert false; case (?job) { assert (job.status == "succeeded"); assert job.external_send_started; assert (job.external_url == "") } };
assert (not app.github_connection_status((), user).connected);
ignore app.github_connection_save(("github_pat_12345678901234567890", "Owner GitHub"), user);
assert app.github_policy_save(("agent_runner", "acme", "launchpad", true, true, true, 0), user).ok;
assert app.github_policy_authorize(("agent_runner", "acme", "launchpad", "issue_create"), user);
assert (not app.github_policy_authorize(("other", "acme", "launchpad", "issue_create"), user));
let queued = app.github_job_enqueue(("123e4567-e89b-42d3-a456-426614174000", "agent_runner", "acme", "launchpad", "Ship release", "", "request-1"), user);
assert queued.ok;
assert app.github_job_enqueue(("223e4567-e89b-42d3-a456-426614174000", "agent_runner", "acme", "launchpad", "Duplicate", "", "request-1"), user).ok;
assert (app.github_jobs_list((), user).jobs.size() == 2);
let task = app.tasks_create("Review launch", "task-1", "github_issue", "acme", "launchpad", 42, "https://github.example/acme/launchpad/issues/42");
assert task.ok; assert app.tasks_complete(1, 1).ok; assert (not app.tasks_complete(1, 1).ok);
assert (app.cycles_checkout_config((), user).neutron_canister == Principal.toText(self));
assert (not app.cycles_checkout_config((), user).backend_reserved);
