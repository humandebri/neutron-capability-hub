import Array "mo:core/Array";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import V1 "./v1";
import V2 "./v2";

module {
    public func migrate(old : V1.Mem) : V2.Mem {
        let jobs = Map.empty<Nat, V2.Job>();
        let requestIds = Map.empty<Text, Nat>();
        for ((id, job) in Map.entries(old.jobs)) {
            let closeWasPending = job.operation == "issue_close" and not terminal(job.status);
            Map.add(jobs, Nat.compare, id, {
                id = job.id;
                job_uid = legacyUuid(job.id);
                consumer_app_id = "github_driver";
                owner = job.owner;
                repo = job.repo;
                issue_number = job.issue_number;
                title = job.title;
                body = job.body;
                client_request_id = job.client_request_id;
                status = if (closeWasPending) "failed_terminal" else job.status;
                lease_id = if (closeWasPending) "" else job.lease_id;
                leased_at = if (closeWasPending) 0 else job.leased_at;
                attempt_count = if (job.status == "pending") 0 else 1;
                external_send_started = job.status == "leased";
                result_summary = if (closeWasPending) "Legacy issue close was retired without execution." else job.result_summary;
                external_url = job.external_url;
                external_number = job.external_number;
                error_code = if (closeWasPending) "legacy_issue_close_retired" else job.error_code;
                created_at = job.created_at;
                updated_at = job.updated_at;
            });
            Map.add(requestIds, Text.compare, job.client_request_id, id);
        };
        {
            var credential_owner = old.credential_owner;
            var token = old.token;
            var token_suffix = old.token_suffix;
            var credential_label = old.credential_label;
            var connected_at = old.connected_at;
            var next_job_id = old.next_job_id;
            var next_policy_id = 1;
            var revision = old.revision;
            jobs;
            request_ids = requestIds;
            policies = Map.empty<Nat, V2.Policy>();
            policy_keys = Map.empty<Text, Nat>();
        };
    };

    func terminal(status : Text) : Bool { status == "succeeded" or status == "failed_terminal" or status == "outcome_unknown" };
    func legacyUuid(id : Nat) : Text {
        let digits = Nat.toText(id);
        let padding = if (digits.size() >= 12) "" else Text.fromArray(Array.tabulate<Char>(12 - digits.size(), func _ { '0' }));
        "00000000-0000-4000-8000-" # padding # digits;
    };
};
