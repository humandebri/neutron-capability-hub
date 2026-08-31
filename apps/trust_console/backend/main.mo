import Principal "mo:core/Principal";
import NeutronCapabilities "mo:neutron-capabilities";
import GitHub "./modules/GitHub";
import Tasks "./modules/Tasks";
import Cycles "./modules/Cycles";
import GitHubMemory "./memory/github_driver/v2";
import TasksMemory "./memory/tasks/v1";
import CyclesMemory "./memory/cycles_checkout/v2";

module {
  public type ConnectionStatus = { connected : Bool; credential_label : Text; token_suffix : Text; connected_at : Int; revision : Nat };
  public type SecretResult = { ok : Bool; error : Text; token : Text };
  public type JobView = { id : Nat; job_uid : Text; consumer_app_id : Text; operation : Text; owner : Text; repo : Text; issue_number : Nat; title : Text; body : Text; client_request_id : Text; status : Text; lease_id : Text; leased_at : Int; attempt_count : Nat; external_send_started : Bool; result_summary : Text; external_url : Text; external_number : Nat; error_code : Text; created_at : Int; updated_at : Int };
  public type JobResult = { ok : Bool; error : Text; job : ?JobView; revision : Nat }; public type JobPage = { jobs : [JobView]; revision : Nat };
  public type PolicyView = { id : Nat; consumer_app_id : Text; owner : Text; repo : Text; allow_issue_read : Bool; allow_issue_create : Bool; enabled : Bool; revision : Nat; created_at : Int; updated_at : Int };
  public type PolicyResult = { ok : Bool; error : Text; policy : ?PolicyView; revision : Nat }; public type PolicyPage = { policies : [PolicyView]; revision : Nat }; public type GitHubDeleteResult = { ok : Bool; error : Text; deleted : Nat; revision : Nat };
  public type TaskView = { id : Nat; revision : Nat; title : Text; status : Text; source_kind : Text; source_owner : Text; source_repo : Text; source_issue_number : Nat; source_url : Text; client_request_id : Text; created_at : Int; updated_at : Int };
  public type TaskResult = { ok : Bool; error : Text; task : ?TaskView; book_revision : Nat }; public type TaskPage = { tasks : [TaskView]; book_revision : Nat }; public type DeleteItem = { id : Nat; expected_revision : Nat }; public type TaskDeleteResult = { ok : Bool; error : Text; deleted : Nat; book_revision : Nat };
  public type Config = { configured : Bool; service_canister : Text; hosted_checkout_url : Text; neutron_canister : Text; last_order_id : Text; last_order_status : Text; last_cycles_amount : Text; last_gross_usd_cents : Nat64; last_error : Text; backend_reserved : Bool; revision : Nat };
  public type PriceMenu = { id : Text; menu_label : Text; gross_usd_cents : Nat64; net_usd_cents : Nat64; price_version : Nat64; enabled : Bool }; public type MenuPage = { ok : Bool; error : Text; menus : [PriceMenu] }; public type OrderView = { ok : Bool; error : Text; order_id : Text; client_secret : Text; status : Text; target_canister : Text; cycles_amount : Text; gross_usd_cents : Nat64; last_error : Text };
  public type AppBackendEnvironment = { stable_memory : { github_driver : GitHubMemory.Mem; tasks : TasksMemory.Mem; cycles_checkout : CyclesMemory.Mem }; capabilities : { backend_calls : NeutronCapabilities.BackendCallsV1 } };
  public class Init(env : AppBackendEnvironment) {
    let github = GitHub.Init(env); let tasks = Tasks.Init(env); let cycles = Cycles.Init(env);
    public func /*update*/github_connection_save(input : (Text, Text), /*caller*/ caller : Principal) : ConnectionStatus { github.github_connection_save(input.0, input.1, caller) };
    public func /*query*/github_connection_status(_input : (), /*caller*/ caller : Principal) : ConnectionStatus { github.github_connection_status(caller) };
    public func /*query*/github_connection_secret(_input : (), /*caller*/ caller : Principal) : SecretResult { github.github_connection_secret(caller) };
    public func /*update*/github_connection_disconnect(_input : (), /*caller*/ caller : Principal) : ConnectionStatus { github.github_connection_disconnect(caller) };
    public func /*query*/github_policies_list(_input : (), /*caller*/ caller : Principal) : PolicyPage { github.github_policies_list(caller) };
    public func /*query*/github_policy_authorize(input : (Text, Text, Text, Text), /*caller*/ caller : Principal) : Bool { github.github_policy_authorize(input.0, input.1, input.2, input.3, caller) };
    public func /*update*/github_policy_save(input : (Text, Text, Text, Bool, Bool, Bool, Nat), /*caller*/ caller : Principal) : PolicyResult { github.github_policy_save(input.0, input.1, input.2, input.3, input.4, input.5, input.6, caller) };
    public func /*update*/github_policy_remove(input : (Nat, Nat), /*caller*/ caller : Principal) : PolicyResult { github.github_policy_remove(input.0, input.1, caller) };
    public func /*update*/github_job_enqueue(input : (Text, Text, Text, Text, Text, Text, Text), /*caller*/ caller : Principal) : JobResult { github.github_job_enqueue(input.0, input.1, input.2, input.3, input.4, input.5, input.6, caller) };
    public func /*query*/github_jobs_list(_input : (), /*caller*/ caller : Principal) : JobPage { github.github_jobs_list(caller) };
    public func /*query*/github_job_load(id : Nat, /*caller*/ caller : Principal) : JobResult { github.github_job_load(id, caller) };
    public func /*update*/github_job_claim(input : (Nat, Text), /*caller*/ caller : Principal) : JobResult { github.github_job_claim(input.0, input.1, caller) };
    public func /*update*/github_job_mark_send_started(input : (Nat, Text), /*caller*/ caller : Principal) : JobResult { github.github_job_mark_send_started(input.0, input.1, caller) };
    public func /*update*/github_job_complete(input : (Nat, Text, Text, Text, Text, Nat, Text), /*caller*/ caller : Principal) : JobResult { github.github_job_complete(input.0, input.1, input.2, input.3, input.4, input.5, input.6, caller) };
    public func /*update*/github_jobs_delete_terminal(ids : [Nat], /*caller*/ caller : Principal) : GitHubDeleteResult { github.github_jobs_delete_terminal(ids, caller) };
    public func /*update*/github_demo_run(run_id : Text, /*caller*/ caller : Principal) : JobResult {
      github.github_demo_claim_owner(caller);
      let consumer = "judge_demo";
      let owner = "neutron-demo";
      let repo = "capability-sandbox";
      var expectedRevision = 0;
      for (policy in github.github_policies_list(caller).policies.vals()) {
        if (policy.consumer_app_id == consumer and policy.owner == owner and policy.repo == repo) expectedRevision := policy.revision;
      };
      let policy = github.github_policy_save(consumer, owner, repo, true, true, true, expectedRevision, caller);
      if (not policy.ok) return { ok = false; error = "demo_policy_failed:" # policy.error; job = null; revision = policy.revision };
      let queued = github.github_job_enqueue(run_id, consumer, owner, repo, "Review a scoped capability request", "Simulation only. No GitHub API request is sent.", "demo-" # run_id, caller);
      switch (queued.job) {
        case null queued;
        case (?job) {
          let lease = "demo-" # run_id;
          let claimed = github.github_job_claim(job.id, lease, caller);
          if (not claimed.ok) return claimed;
          let sending = github.github_job_mark_send_started(job.id, lease, caller);
          if (not sending.ok) return sending;
          github.github_job_complete(job.id, lease, "succeeded", "Simulation reconciled; no GitHub write was sent.", "", 0, "", caller)
        };
      }
    };
    public func /*query*/tasks_list() : TaskPage { tasks.tasks_list() };
    public func /*update*/tasks_create(title : Text, request_id : Text, source_kind : Text, source_owner : Text, source_repo : Text, issue_number : Nat, source_url : Text) : TaskResult { tasks.tasks_create(title, request_id, source_kind, source_owner, source_repo, issue_number, source_url) };
    public func /*update*/tasks_complete(id : Nat, revision : Nat) : TaskResult { tasks.tasks_complete(id, revision) };
    public func /*update*/tasks_delete_completed(items : [DeleteItem]) : TaskDeleteResult { tasks.tasks_delete_completed(items) };
    public func /*query*/cycles_checkout_config(_input : (), /*caller*/ caller : Principal) : Config { cycles.cycles_checkout_config(caller) };
    public func /*update*/cycles_checkout_config_save(input : (Text, Text), /*caller*/ caller : Principal) : Config { cycles.cycles_checkout_config_save(input.0, input.1, caller) };
    public func /*update*/cycles_price_menus(_input : (), /*caller*/ caller : Principal) : async* MenuPage { await* cycles.cycles_price_menus(caller) };
    public func /*update*/cycles_create_order(input : (Text, Text), /*caller*/ caller : Principal) : async* OrderView { await* cycles.cycles_create_order(input.0, input.1, caller) };
    public func /*update*/cycles_order_status(order_id : Text, /*caller*/ caller : Principal) : async* OrderView { await* cycles.cycles_order_status(order_id, caller) };
    public func /*update*/cycles_finalize_order(order_id : Text, /*caller*/ caller : Principal) : async* OrderView { await* cycles.cycles_finalize_order(order_id, caller) };
  };
/*---NEUTRON GENERATED BEGIN---*/

public type github_connection_save_Input = (input : (Text, Text));
public type github_connection_save_Output = ConnectionStatus;

public type github_connection_status_Input = (_input : ());
public type github_connection_status_Output = ConnectionStatus;

public type github_connection_secret_Input = (_input : ());
public type github_connection_secret_Output = SecretResult;

public type github_connection_disconnect_Input = (_input : ());
public type github_connection_disconnect_Output = ConnectionStatus;

public type github_policies_list_Input = (_input : ());
public type github_policies_list_Output = PolicyPage;

public type github_policy_authorize_Input = (input : (Text, Text, Text, Text));
public type github_policy_authorize_Output = Bool;

public type github_policy_save_Input = (input : (Text, Text, Text, Bool, Bool, Bool, Nat));
public type github_policy_save_Output = PolicyResult;

public type github_policy_remove_Input = (input : (Nat, Nat));
public type github_policy_remove_Output = PolicyResult;

public type github_job_enqueue_Input = (input : (Text, Text, Text, Text, Text, Text, Text));
public type github_job_enqueue_Output = JobResult;

public type github_jobs_list_Input = (_input : ());
public type github_jobs_list_Output = JobPage;

public type github_job_load_Input = (id : Nat);
public type github_job_load_Output = JobResult;

public type github_job_claim_Input = (input : (Nat, Text));
public type github_job_claim_Output = JobResult;

public type github_job_mark_send_started_Input = (input : (Nat, Text));
public type github_job_mark_send_started_Output = JobResult;

public type github_job_complete_Input = (input : (Nat, Text, Text, Text, Text, Nat, Text));
public type github_job_complete_Output = JobResult;

public type github_jobs_delete_terminal_Input = (ids : [Nat]);
public type github_jobs_delete_terminal_Output = GitHubDeleteResult;

public type github_demo_run_Input = (run_id : Text);
public type github_demo_run_Output = JobResult;

public type tasks_list_Input = ();
public type tasks_list_Output = TaskPage;

public type tasks_create_Input = (title : Text, request_id : Text, source_kind : Text, source_owner : Text, source_repo : Text, issue_number : Nat, source_url : Text);
public type tasks_create_Output = TaskResult;

public type tasks_complete_Input = (id : Nat, revision : Nat);
public type tasks_complete_Output = TaskResult;

public type tasks_delete_completed_Input = (items : [DeleteItem]);
public type tasks_delete_completed_Output = TaskDeleteResult;

public type cycles_checkout_config_Input = (_input : ());
public type cycles_checkout_config_Output = Config;

public type cycles_checkout_config_save_Input = (input : (Text, Text));
public type cycles_checkout_config_save_Output = Config;

public type cycles_price_menus_Input = (_input : ());
public type cycles_price_menus_Output = MenuPage;

public type cycles_create_order_Input = (input : (Text, Text));
public type cycles_create_order_Output = OrderView;

public type cycles_order_status_Input = (order_id : Text);
public type cycles_order_status_Output = OrderView;

public type cycles_finalize_order_Input = (order_id : Text);
public type cycles_finalize_order_Output = OrderView;

/*---NEUTRON GENERATED END---*/
}
