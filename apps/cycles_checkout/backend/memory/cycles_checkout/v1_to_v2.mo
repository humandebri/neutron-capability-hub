import V1 "./v1";
import V2 "./v2";

module {
  public func migrate(old : V1.Mem) : V2.Mem { {
    var owner = old.owner;
    var service_canister = old.service_canister;
    var hosted_checkout_url = old.hosted_checkout_url;
    var last_order_id = old.last_order_id;
    var last_order_status = "";
    var last_cycles_amount = "0";
    var last_gross_usd_cents = 0;
    var last_error = "";
    var revision = old.revision;
  } };
};
