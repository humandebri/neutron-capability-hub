import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Memory "../memory/tasks/v1";

module {
    public type TaskView = {
        id : Nat;
        revision : Nat;
        title : Text;
        status : Text;
        source_kind : Text;
        source_owner : Text;
        source_repo : Text;
        source_issue_number : Nat;
        source_url : Text;
        client_request_id : Text;
        created_at : Int;
        updated_at : Int;
    };
    public type TaskResult = { ok : Bool; error : Text; task : ?TaskView; book_revision : Nat };
    public type TaskPage = { tasks : [TaskView]; book_revision : Nat };
    public type DeleteItem = { id : Nat; expected_revision : Nat };
    public type DeleteResult = { ok : Bool; error : Text; deleted : Nat; book_revision : Nat };
    public type AppBackendEnvironment = { stable_memory : { tasks : Memory.Mem } };

    public class Init(env : AppBackendEnvironment) {
        let mem = env.stable_memory.tasks;
        let MAX_TASKS : Nat = 2_000;

        public func /*query*/tasks_list() : TaskPage {
            let rows = List.empty<TaskView>();
            for (task in Map.values(mem.tasks)) List.add(rows, view(task));
            { tasks = List.toArray(rows); book_revision = mem.book_revision };
        };

        public func /*update*/tasks_create(
            title : Text,
            client_request_id : Text,
            source_kind : Text,
            source_owner : Text,
            source_repo : Text,
            source_issue_number : Nat,
            source_url : Text,
        ) : TaskResult {
            let clean = Text.trim(title, #char ' ');
            if (clean.size() == 0 or clean.size() > 240) return failure("Title must be 1 to 240 characters");
            if (client_request_id.size() == 0 or client_request_id.size() > 128) return failure("client_request_id must be 1 to 128 characters");
            switch (Map.get(mem.request_ids, Text.compare, client_request_id)) {
                case (?id) return success(Map.get(mem.tasks, Nat.compare, id));
                case (null) {};
            };
            if (Map.size(mem.tasks) >= MAX_TASKS) return failure("Task limit reached");
            let source : Memory.Source = if (source_kind == "github_issue") {
                if (source_owner.size() == 0 or source_repo.size() == 0 or source_issue_number == 0) return failure("GitHub source is incomplete");
                #github_issue({ owner = source_owner; repo = source_repo; issue_number = source_issue_number; url = source_url });
            } else { #manual };
            let now = Time.now();
            let task : Memory.Task = {
                id = mem.next_id;
                revision = 1;
                title = clean;
                status = #open;
                source;
                client_request_id;
                created_at = now;
                updated_at = now;
            };
            Map.add(mem.tasks, Nat.compare, task.id, task);
            Map.add(mem.request_ids, Text.compare, client_request_id, task.id);
            mem.next_id += 1;
            mem.book_revision += 1;
            success(?task);
        };

        public func /*update*/tasks_complete(id : Nat, expected_revision : Nat) : TaskResult {
            let ?current = Map.get(mem.tasks, Nat.compare, id) else return failure("Task not found");
            if (current.revision != expected_revision) return failure("Task revision conflict");
            if (current.status == #completed) return success(?current);
            let next : Memory.Task = {
                id = current.id;
                revision = current.revision + 1;
                title = current.title;
                status = #completed;
                source = current.source;
                client_request_id = current.client_request_id;
                created_at = current.created_at;
                updated_at = Time.now();
            };
            Map.add(mem.tasks, Nat.compare, id, next);
            mem.book_revision += 1;
            success(?next);
        };

        public func /*update*/tasks_delete_completed(items : [DeleteItem]) : DeleteResult {
            if (items.size() == 0 or items.size() > 100) return deleteFailure("Select 1 to 100 completed tasks");
            for (item in items.vals()) {
                let ?task = Map.get(mem.tasks, Nat.compare, item.id) else return deleteFailure("Task not found");
                if (task.revision != item.expected_revision) return deleteFailure("Task revision conflict");
                if (task.status != #completed) return deleteFailure("Only completed tasks can be deleted");
            };
            var deleted = 0;
            for (item in items.vals()) switch (Map.get(mem.tasks, Nat.compare, item.id)) {
                case (?task) { Map.remove(mem.tasks, Nat.compare, item.id); Map.remove(mem.request_ids, Text.compare, task.client_request_id); deleted += 1 };
                case (null) {};
            };
            mem.book_revision += 1;
            { ok = true; error = ""; deleted; book_revision = mem.book_revision };
        };

        func success(task : ?Memory.Task) : TaskResult { { ok = true; error = ""; task = switch task { case (?value) ?view(value); case (null) null }; book_revision = mem.book_revision } };
        func failure(error : Text) : TaskResult { { ok = false; error; task = null; book_revision = mem.book_revision } };
        func deleteFailure(error : Text) : DeleteResult { { ok = false; error; deleted = 0; book_revision = mem.book_revision } };
        func view(task : Memory.Task) : TaskView {
            let (kind, owner, repo, number, url) = switch (task.source) {
                case (#manual) ("manual", "", "", 0, "");
                case (#github_issue(value)) ("github_issue", value.owner, value.repo, value.issue_number, value.url);
            };
            {
                id = task.id; revision = task.revision; title = task.title;
                status = switch (task.status) { case (#open) "open"; case (#completed) "completed" };
                source_kind = kind; source_owner = owner; source_repo = repo;
                source_issue_number = number; source_url = url;
                client_request_id = task.client_request_id;
                created_at = task.created_at; updated_at = task.updated_at;
            };
        };
    };

/*---NEUTRON GENERATED BEGIN---*/

public type tasks_list_Input = ();
public type tasks_list_Output = TaskPage;

public type tasks_create_Input = (title : Text,
            client_request_id : Text,
            source_kind : Text,
            source_owner : Text,
            source_repo : Text,
            source_issue_number : Nat,
            source_url : Text,);
public type tasks_create_Output = TaskResult;

public type tasks_complete_Input = (id : Nat, expected_revision : Nat);
public type tasks_complete_Output = TaskResult;

public type tasks_delete_completed_Input = (items : [DeleteItem]);
public type tasks_delete_completed_Output = DeleteResult;

/*---NEUTRON GENERATED END---*/
}
