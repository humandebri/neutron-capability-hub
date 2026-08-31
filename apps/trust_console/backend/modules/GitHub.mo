import Array "mo:core/Array";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Memory "../memory/github_driver/v2";

module {
    public type ConnectionStatus = { connected : Bool; credential_label : Text; token_suffix : Text; connected_at : Int; revision : Nat };
    public type SecretResult = { ok : Bool; error : Text; token : Text };
    public type JobView = {
        id : Nat; job_uid : Text; consumer_app_id : Text; operation : Text; owner : Text; repo : Text; issue_number : Nat;
        title : Text; body : Text; client_request_id : Text; status : Text;
        lease_id : Text; leased_at : Int; attempt_count : Nat; external_send_started : Bool;
        result_summary : Text; external_url : Text; external_number : Nat; error_code : Text;
        created_at : Int; updated_at : Int;
    };
    public type JobResult = { ok : Bool; error : Text; job : ?JobView; revision : Nat };
    public type JobPage = { jobs : [JobView]; revision : Nat };
    public type PolicyView = {
        id : Nat; consumer_app_id : Text; owner : Text; repo : Text;
        allow_issue_read : Bool; allow_issue_create : Bool; enabled : Bool;
        revision : Nat; created_at : Int; updated_at : Int;
    };
    public type PolicyResult = { ok : Bool; error : Text; policy : ?PolicyView; revision : Nat };
    public type PolicyPage = { policies : [PolicyView]; revision : Nat };
    public type DeleteResult = { ok : Bool; error : Text; deleted : Nat; revision : Nat };
    public type AppBackendEnvironment = { stable_memory : { github_driver : Memory.Mem } };

    public class Init(env : AppBackendEnvironment) {
        let mem = env.stable_memory.github_driver;
        let MAX_JOBS : Nat = 500;
        let MAX_POLICIES : Nat = 500;
        let MAX_DELETE : Nat = 100;
        let LEASE_NANOS : Int = 120_000_000_000;

        public func github_demo_claim_owner(/*caller*/ caller : Principal) {
            assertAuthenticated(caller); assertOwnerOrUnclaimed(caller);
            if (mem.credential_owner == null) mem.credential_owner := ?caller;
        };

        public func /*update*/github_connection_save(token : Text, credential_label : Text, /*caller*/ caller : Principal) : ConnectionStatus {
            assertAuthenticated(caller); assertOwnerOrUnclaimed(caller);
            if (token.size() < 20 or token.size() > 512 or containsWhitespace(token)) return status();
            mem.credential_owner := ?caller; mem.token := token; mem.token_suffix := suffix(token, 4);
            mem.credential_label := if (credential_label.size() <= 80) credential_label else "GitHub";
            mem.connected_at := Time.now(); mem.revision += 1; status();
        };
        public func /*query*/github_connection_status(/*caller*/ caller : Principal) : ConnectionStatus { assertAuthenticated(caller); assertOwnerOrUnclaimed(caller); status() };
        public func /*query*/github_connection_secret(/*caller*/ caller : Principal) : SecretResult {
            assertAuthenticated(caller); assertOwner(caller);
            if (mem.token == "") { { ok = false; error = "GitHub is not connected"; token = "" } } else { { ok = true; error = ""; token = mem.token } };
        };
        public func /*update*/github_connection_disconnect(/*caller*/ caller : Principal) : ConnectionStatus {
            assertAuthenticated(caller); assertOwner(caller);
            mem.token := ""; mem.token_suffix := ""; mem.credential_label := ""; mem.connected_at := 0; mem.revision += 1; status();
        };

        public func /*query*/github_policies_list(/*caller*/ caller : Principal) : PolicyPage {
            assertAuthenticated(caller); assertOwner(caller);
            let rows = List.empty<PolicyView>(); for (policy in Map.values(mem.policies)) List.add(rows, policyView(policy));
            { policies = List.toArray(rows); revision = mem.revision };
        };
        public func /*query*/github_policy_authorize(consumer_app_id : Text, owner : Text, repo : Text, operation : Text, /*caller*/ caller : Principal) : Bool {
            assertAuthenticated(caller); assertOwner(caller); isAuthorized(consumer_app_id, owner, repo, operation);
        };
        public func /*update*/github_policy_save(
            consumer_app_id : Text, owner : Text, repo : Text, allow_issue_read : Bool, allow_issue_create : Bool,
            enabled : Bool, expected_revision : Nat, /*caller*/ caller : Principal,
        ) : PolicyResult {
            assertAuthenticated(caller); assertOwner(caller);
            if (not validAppId(consumer_app_id) or not validSegment(owner) or not validSegment(repo)) return policyFailure("Invalid policy scope");
            let key = policyKey(consumer_app_id, owner, repo); let now = Time.now();
            switch (Map.get(mem.policy_keys, Text.compare, key)) {
                case (?id) {
                    let ?current = Map.get(mem.policies, Nat.compare, id) else return policyFailure("Policy index is inconsistent");
                    if (current.revision != expected_revision) return policyFailure("Policy revision conflict");
                    let next : Memory.Policy = { id = current.id; consumer_app_id; owner; repo; allow_issue_read; allow_issue_create; enabled; revision = current.revision + 1; created_at = current.created_at; updated_at = now };
                    Map.add(mem.policies, Nat.compare, id, next); mem.revision += 1; policySuccess(?next);
                };
                case (null) {
                    if (expected_revision != 0) return policyFailure("Policy revision conflict");
                    if (Map.size(mem.policies) >= MAX_POLICIES) return policyFailure("Policy limit reached");
                    let policy : Memory.Policy = { id = mem.next_policy_id; consumer_app_id; owner; repo; allow_issue_read; allow_issue_create; enabled; revision = 1; created_at = now; updated_at = now };
                    Map.add(mem.policies, Nat.compare, policy.id, policy); Map.add(mem.policy_keys, Text.compare, key, policy.id);
                    mem.next_policy_id += 1; mem.revision += 1; policySuccess(?policy);
                };
            };
        };
        public func /*update*/github_policy_remove(id : Nat, expected_revision : Nat, /*caller*/ caller : Principal) : PolicyResult {
            assertAuthenticated(caller); assertOwner(caller);
            let ?current = Map.get(mem.policies, Nat.compare, id) else return policyFailure("Policy not found");
            if (current.revision != expected_revision) return policyFailure("Policy revision conflict");
            Map.remove(mem.policies, Nat.compare, id); Map.remove(mem.policy_keys, Text.compare, policyKey(current.consumer_app_id, current.owner, current.repo));
            mem.revision += 1; policySuccess(?current);
        };

        public func /*update*/github_job_enqueue(
            job_uid : Text, consumer_app_id : Text, owner : Text, repo : Text, title : Text, body : Text,
            client_request_id : Text, /*caller*/ caller : Principal,
        ) : JobResult {
            assertAuthenticated(caller); assertOwner(caller);
            if (not validUuid(job_uid)) return failure("Invalid GitHub Job uid");
            if (not validAppId(consumer_app_id)) return failure("Invalid consumer app id");
            if (not validSegment(owner) or not validSegment(repo)) return failure("Invalid repository");
            if (title.size() == 0 or title.size() > 256 or body.size() > 60_000) return failure("GitHub issue content is too large");
            if (client_request_id.size() == 0 or client_request_id.size() > 128) return failure("Invalid client_request_id");
            if (not isAuthorized(consumer_app_id, owner, repo, "issue_create")) return failure("GitHub Driver Policy denied issue_create for this consumer and repository");
            switch (Map.get(mem.request_ids, Text.compare, client_request_id)) { case (?id) return success(Map.get(mem.jobs, Nat.compare, id)); case (null) {} };
            if (Map.size(mem.jobs) >= MAX_JOBS) return failure("GitHub Job limit reached; delete terminal Jobs in the Driver");
            let now = Time.now();
            let job : Memory.Job = {
                id = mem.next_job_id; job_uid; consumer_app_id; owner; repo; issue_number = 0; title; body; client_request_id;
                status = "pending"; lease_id = ""; leased_at = 0; attempt_count = 0; external_send_started = false;
                result_summary = ""; external_url = ""; external_number = 0; error_code = ""; created_at = now; updated_at = now;
            };
            Map.add(mem.jobs, Nat.compare, job.id, job); Map.add(mem.request_ids, Text.compare, client_request_id, job.id);
            mem.next_job_id += 1; mem.revision += 1; success(?job);
        };
        public func /*query*/github_jobs_list(/*caller*/ caller : Principal) : JobPage {
            assertAuthenticated(caller); assertOwner(caller);
            let rows = List.empty<JobView>(); for (job in Map.values(mem.jobs)) List.add(rows, jobView(job));
            { jobs = List.toArray(rows); revision = mem.revision };
        };
        public func /*query*/github_job_load(id : Nat, /*caller*/ caller : Principal) : JobResult {
            assertAuthenticated(caller); assertOwner(caller); switch (Map.get(mem.jobs, Nat.compare, id)) { case (?job) success(?job); case (null) failure("GitHub Job not found") };
        };
        public func /*update*/github_job_claim(id : Nat, lease_id : Text, /*caller*/ caller : Principal) : JobResult {
            assertAuthenticated(caller); assertOwner(caller);
            if (lease_id.size() < 8 or lease_id.size() > 128) return failure("Invalid lease id");
            let ?current = Map.get(mem.jobs, Nat.compare, id) else return failure("GitHub Job not found"); let now = Time.now();
            let claimable = current.status == "pending" or current.status == "failed_retryable" or (current.status == "leased" and now - current.leased_at > LEASE_NANOS);
            if (not claimable) return failure("GitHub Job is not claimable");
            let next = replace(current, "leased", lease_id, now, current.attempt_count + 1, current.external_send_started, current.result_summary, current.external_url, current.external_number, "");
            Map.add(mem.jobs, Nat.compare, id, next); mem.revision += 1; success(?next);
        };
        public func /*update*/github_job_mark_send_started(id : Nat, lease_id : Text, /*caller*/ caller : Principal) : JobResult {
            assertAuthenticated(caller); assertOwner(caller);
            let ?current = Map.get(mem.jobs, Nat.compare, id) else return failure("GitHub Job not found");
            if (current.status != "leased" or current.lease_id != lease_id) return failure("GitHub Job lease mismatch");
            let next = replace(current, current.status, current.lease_id, current.leased_at, current.attempt_count, true, current.result_summary, current.external_url, current.external_number, current.error_code);
            Map.add(mem.jobs, Nat.compare, id, next); mem.revision += 1; success(?next);
        };
        public func /*update*/github_job_complete(
            id : Nat, lease_id : Text, status_ : Text, result_summary : Text, external_url : Text,
            external_number : Nat, error_code : Text, /*caller*/ caller : Principal,
        ) : JobResult {
            assertAuthenticated(caller); assertOwner(caller);
            let ?current = Map.get(mem.jobs, Nat.compare, id) else return failure("GitHub Job not found");
            if (current.status != "leased" or current.lease_id != lease_id) return failure("GitHub Job lease mismatch");
            if (not terminalStatus(status_) and status_ != "failed_retryable") return failure("Invalid GitHub Job completion state");
            let next = replace(current, status_, "", 0, current.attempt_count, current.external_send_started, bounded(result_summary, 500), bounded(external_url, 500), external_number, bounded(error_code, 120));
            Map.add(mem.jobs, Nat.compare, id, next); mem.revision += 1; success(?next);
        };
        public func /*update*/github_jobs_delete_terminal(ids : [Nat], /*caller*/ caller : Principal) : DeleteResult {
            assertAuthenticated(caller); assertOwner(caller);
            if (ids.size() == 0 or ids.size() > MAX_DELETE) return deleteFailure("Select 1 to 100 terminal Jobs");
            for (id in ids.vals()) { let ?job = Map.get(mem.jobs, Nat.compare, id) else return deleteFailure("GitHub Job not found"); if (not terminalStatus(job.status)) return deleteFailure("Only terminal GitHub Jobs can be deleted") };
            var deleted = 0;
            for (id in ids.vals()) switch (Map.get(mem.jobs, Nat.compare, id)) { case (?job) { Map.remove(mem.jobs, Nat.compare, id); Map.remove(mem.request_ids, Text.compare, job.client_request_id); deleted += 1 }; case (null) {} };
            mem.revision += 1; { ok = true; error = ""; deleted; revision = mem.revision };
        };

        func isAuthorized(consumer : Text, owner_ : Text, repo_ : Text, operation : Text) : Bool {
            let ?id = Map.get(mem.policy_keys, Text.compare, policyKey(consumer, owner_, repo_)) else return false;
            let ?policy = Map.get(mem.policies, Nat.compare, id) else return false;
            policy.enabled and (if (operation == "issue_read") policy.allow_issue_read else if (operation == "issue_create") policy.allow_issue_create else false);
        };
        func status() : ConnectionStatus { { connected = mem.token != ""; credential_label = mem.credential_label; token_suffix = mem.token_suffix; connected_at = mem.connected_at; revision = mem.revision } };
        func success(job : ?Memory.Job) : JobResult { { ok = true; error = ""; job = switch job { case (?value) ?jobView(value); case (null) null }; revision = mem.revision } };
        func failure(error : Text) : JobResult { { ok = false; error; job = null; revision = mem.revision } };
        func policySuccess(policy : ?Memory.Policy) : PolicyResult { { ok = true; error = ""; policy = switch policy { case (?value) ?policyView(value); case (null) null }; revision = mem.revision } };
        func policyFailure(error : Text) : PolicyResult { { ok = false; error; policy = null; revision = mem.revision } };
        func deleteFailure(error : Text) : DeleteResult { { ok = false; error; deleted = 0; revision = mem.revision } };
        func assertAuthenticated(caller : Principal) { assert(not Principal.isAnonymous(caller)) };
        func assertOwner(caller : Principal) { assert(mem.credential_owner == ?caller) };
        func assertOwnerOrUnclaimed(caller : Principal) { switch (mem.credential_owner) { case (?owner_) assert(owner_ == caller); case (null) {} } };
        func terminalStatus(value : Text) : Bool { value == "succeeded" or value == "failed_terminal" or value == "outcome_unknown" };
        func validSegment(value : Text) : Bool { value.size() >= 1 and value.size() <= 100 and value != "." and value != ".." };
        func validAppId(value : Text) : Bool { value.size() >= 1 and value.size() <= 128 and not containsWhitespace(value) };
        func validUuid(value : Text) : Bool { if (value.size() != 36) return false; let chars = Text.toArray(value); chars[8] == '-' and chars[13] == '-' and chars[18] == '-' and chars[23] == '-' };
        func policyKey(consumer : Text, owner_ : Text, repo_ : Text) : Text { Text.toLower(consumer) # "\00" # Text.toLower(owner_) # "\00" # Text.toLower(repo_) };
        func containsWhitespace(value : Text) : Bool { for (char in value.chars()) if (char == ' ' or char == '\n' or char == '\r' or char == '\t') return true; false };
        func suffix(value : Text, count : Nat) : Text { let chars = Text.toArray(value); let size = chars.size(); if (size <= count) value else Text.fromArray(Array.sliceToArray(chars, size - count, size)) };
        func bounded(value : Text, max : Nat) : Text { if (value.size() <= max) value else "Result exceeded display limit" };
        func replace(job : Memory.Job, status_ : Text, lease_id : Text, leased_at : Int, attempt_count : Nat, external_send_started : Bool, result_summary : Text, external_url : Text, external_number : Nat, error_code : Text) : Memory.Job {
            { id = job.id; job_uid = job.job_uid; consumer_app_id = job.consumer_app_id; owner = job.owner; repo = job.repo; issue_number = job.issue_number; title = job.title; body = job.body; client_request_id = job.client_request_id;
              status = status_; lease_id; leased_at; attempt_count; external_send_started; result_summary; external_url; external_number; error_code; created_at = job.created_at; updated_at = Time.now() };
        };
        func jobView(job : Memory.Job) : JobView {
            { id = job.id; job_uid = job.job_uid; consumer_app_id = job.consumer_app_id; operation = "issue_create"; owner = job.owner; repo = job.repo; issue_number = job.issue_number;
              title = job.title; body = job.body; client_request_id = job.client_request_id; status = job.status; lease_id = job.lease_id; leased_at = job.leased_at;
              attempt_count = job.attempt_count; external_send_started = job.external_send_started; result_summary = job.result_summary; external_url = job.external_url;
              external_number = job.external_number; error_code = job.error_code; created_at = job.created_at; updated_at = job.updated_at };
        };
        func policyView(policy : Memory.Policy) : PolicyView {
            { id = policy.id; consumer_app_id = policy.consumer_app_id; owner = policy.owner; repo = policy.repo; allow_issue_read = policy.allow_issue_read;
              allow_issue_create = policy.allow_issue_create; enabled = policy.enabled; revision = policy.revision; created_at = policy.created_at; updated_at = policy.updated_at };
        };
    };

/*---NEUTRON GENERATED BEGIN---*/

public type github_connection_save_Input = (token : Text, credential_label : Text);
public type github_connection_save_Output = ConnectionStatus;

public type github_connection_status_Input = ();
public type github_connection_status_Output = ConnectionStatus;

public type github_connection_secret_Input = ();
public type github_connection_secret_Output = SecretResult;

public type github_connection_disconnect_Input = ();
public type github_connection_disconnect_Output = ConnectionStatus;

public type github_policies_list_Input = ();
public type github_policies_list_Output = PolicyPage;

public type github_policy_authorize_Input = (consumer_app_id : Text, owner : Text, repo : Text, operation : Text);
public type github_policy_authorize_Output = Bool;

public type github_policy_save_Input = (consumer_app_id : Text, owner : Text, repo : Text, allow_issue_read : Bool, allow_issue_create : Bool,
            enabled : Bool, expected_revision : Nat);
public type github_policy_save_Output = PolicyResult;

public type github_policy_remove_Input = (id : Nat, expected_revision : Nat);
public type github_policy_remove_Output = PolicyResult;

public type github_job_enqueue_Input = (job_uid : Text, consumer_app_id : Text, owner : Text, repo : Text, title : Text, body : Text,
            client_request_id : Text);
public type github_job_enqueue_Output = JobResult;

public type github_jobs_list_Input = ();
public type github_jobs_list_Output = JobPage;

public type github_job_load_Input = (id : Nat);
public type github_job_load_Output = JobResult;

public type github_job_claim_Input = (id : Nat, lease_id : Text);
public type github_job_claim_Output = JobResult;

public type github_job_mark_send_started_Input = (id : Nat, lease_id : Text);
public type github_job_mark_send_started_Output = JobResult;

public type github_job_complete_Input = (id : Nat, lease_id : Text, status_ : Text, result_summary : Text, external_url : Text,
            external_number : Nat, error_code : Text);
public type github_job_complete_Output = JobResult;

public type github_jobs_delete_terminal_Input = (ids : [Nat]);
public type github_jobs_delete_terminal_Output = DeleteResult;

/*---NEUTRON GENERATED END---*/
}
