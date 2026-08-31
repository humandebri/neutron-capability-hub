// Persistent schema: keep this file immutable after release.
module {
  public type Mem = {
    var owner : ?Principal; var service_canister : Text; var hosted_checkout_url : Text;
    var last_order_id : Text; var last_order_status : Text; var last_cycles_amount : Text;
    var last_gross_usd_cents : Nat64; var last_error : Text; var revision : Nat;
  };
  public func init() : Mem { {
    var owner = null; var service_canister = ""; var hosted_checkout_url = "";
    var last_order_id = ""; var last_order_status = ""; var last_cycles_amount = "0";
    var last_gross_usd_cents = 0; var last_error = ""; var revision = 0;
  } };
};
