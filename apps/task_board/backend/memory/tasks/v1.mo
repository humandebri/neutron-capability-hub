// Persistent schema: keep this file immutable after release.
import Map "mo:core/Map";

module {
    public type Status = { #open; #completed };
    public type Source = {
        #manual;
        #github_issue : { owner : Text; repo : Text; issue_number : Nat; url : Text };
    };
    public type Task = {
        id : Nat;
        revision : Nat;
        title : Text;
        status : Status;
        source : Source;
        client_request_id : Text;
        created_at : Int;
        updated_at : Int;
    };
    public type Mem = {
        var next_id : Nat;
        var book_revision : Nat;
        tasks : Map.Map<Nat, Task>;
        request_ids : Map.Map<Text, Nat>;
    };
    public func init() : Mem {
        {
            var next_id = 1;
            var book_revision = 0;
            tasks = Map.empty<Nat, Task>();
            request_ids = Map.empty<Text, Nat>();
        };
    };
};
