import Blob "mo:core/Blob";
import Principal "mo:core/Principal";
import Guard "../backend/main";
import Memory "../backend/memory/x402_guard/v1";
let user = Principal.fromBlob(Blob.fromArray([4, 5, 6, 2]));
let app = Guard.Init({ stable_memory = { x402_guard = Memory.init() } });
assert (not app.x402_policy_status(user).demo_example_enabled);
assert (app.x402_policy_save(true, "1000000", user).demo_example_enabled);
