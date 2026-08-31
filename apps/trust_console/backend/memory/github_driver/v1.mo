// Persistent schema: keep this file immutable after release.
import Map "mo:core/Map";

module {
    public type Job = {
        id : Nat;
        operation : Text;
        owner : Text;
        repo : Text;
        issue_number : Nat;
        title : Text;
        body : Text;
        client_request_id : Text;
        status : Text;
        lease_id : Text;
        leased_at : Int;
        result_summary : Text;
        external_url : Text;
        external_number : Nat;
        error_code : Text;
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
        var revision : Nat;
        jobs : Map.Map<Nat, Job>;
        request_ids : Map.Map<Text, Nat>;
    };
    public func init() : Mem {
        {
            var credential_owner = null;
            var token = "";
            var token_suffix = "";
            var credential_label = "";
            var connected_at = 0;
            var next_job_id = 1;
            var revision = 0;
            jobs = Map.empty<Nat, Job>();
            request_ids = Map.empty<Text, Nat>();
        };
    };
};
