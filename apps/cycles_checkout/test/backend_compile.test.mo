import Blob "mo:core/Blob";
import Principal "mo:core/Principal";
import NeutronCapabilities "mo:neutron-capabilities";
import Checkout "../backend/main";
import Memory "../backend/memory/cycles_checkout/v2";
import V1 "../backend/memory/cycles_checkout/v1";
import Migration "../backend/memory/cycles_checkout/v1_to_v2";
let self = Principal.fromBlob(Blob.fromArray([0, 1, 1]));
let user = Principal.fromBlob(Blob.fromArray([7, 8, 9, 2]));
let app = Checkout.Init({
  stable_memory = { cycles_checkout = Memory.init() };
  capabilities = { backend_calls = {
    canister_principal = self;
    can_call = func(_canister : Principal, _method : Text) { false };
    call = func(_request : NeutronCapabilities.BackendCallRequestV1) : async* NeutronCapabilities.BackendCallResultV1 { #err({ code = "unused"; message = "unused" }) };
    call_batch = func(_requests : [NeutronCapabilities.BackendCallRequestV1]) : async* [NeutronCapabilities.BackendCallResultV1] { [] };
  } };
});
assert (app.cycles_checkout_config(user).neutron_canister == Principal.toText(self));
let legacy = V1.init();
legacy.service_canister := "ryjl3-tyaaa-aaaaa-aaaba-cai";
legacy.last_order_id := "order-1";
legacy.revision := 4;
let migrated = Migration.migrate(legacy);
assert (migrated.service_canister == legacy.service_canister);
assert (migrated.last_order_id == "order-1");
assert (migrated.last_order_status == "");
assert (migrated.revision == 4);
