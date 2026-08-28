// Persistent schema: keep this file immutable after release.
module {
  public type Mem = { var owner : ?Principal; var service_canister : Text; var hosted_checkout_url : Text; var last_order_id : Text; var revision : Nat };
  public func init() : Mem { { var owner = null; var service_canister = ""; var hosted_checkout_url = ""; var last_order_id = ""; var revision = 0 } };
};
