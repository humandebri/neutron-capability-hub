// Persistent schema: keep this file immutable after release.
import Map "mo:core/Map";

module {
    public type Job = {
        id : Nat;
        job_uid : Text;
        consumer_app_id : Text;
        owner : Text;
        repo : Text;
        issue_number : Nat;
        title : Text;
        body : Text;
        client_request_id : Text;
        status : Text;
        lease_id : Text;
        leased_at : Int;
        attempt_count : Nat;
        external_send_started : Bool;
        result_summary : Text;
        external_url : Text;
        external_number : Nat;
        error_code : Text;
        created_at : Int;
        updated_at : Int;
    };
    public type Policy = {
        id : Nat;
        consumer_app_id : Text;
        owner : Text;
        repo : Text;
        allow_issue_read : Bool;
        allow_issue_create : Bool;
        enabled : Bool;
        revision : Nat;
        created_at : Int;
        updated_at : Int;
    };
    public type Mem = {
        var credential_owner : ?Principal;
        var token : Text;
        var token_suffix : Text;
        var credential_label : Text;
        var connected_at : Int;
        var next_job_id : Nat;
        var next_policy_id : Nat;
        var revision : Nat;
        jobs : Map.Map<Nat, Job>;
        request_ids : Map.Map<Text, Nat>;
        policies : Map.Map<Nat, Policy>;
        policy_keys : Map.Map<Text, Nat>;
    };
    public func init() : Mem {
        {
            var credential_owner = null;
            var token = "";
            var token_suffix = "";
            var credential_label = "";
            var connected_at = 0;
            var next_job_id = 1;
            var next_policy_id = 1;
            var revision = 0;
            jobs = Map.empty<Nat, Job>();
            request_ids = Map.empty<Text, Nat>();
            policies = Map.empty<Nat, Policy>();
            policy_keys = Map.empty<Text, Nat>();
        };
    };
};
