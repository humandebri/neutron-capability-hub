import Principal "mo:core/Principal";
import Text "mo:core/Text";
import NeutronCapabilities "mo:neutron-capabilities";
import Memory "../memory/cycles_checkout/v2";

module {
  public type RemoteError = { #Unauthorized; #InvalidInput : Text; #NotFound : Text; #RateLimited : Text; #RateUnavailable : Text; #CapacityUnavailable : Text; #StripeUnavailable : Text; #TopupFailed : Text; #DbError : Text; #ExternalError : Text };
  public type PriceMenu = { id : Text; menu_label : Text; gross_usd_cents : Nat64; net_usd_cents : Nat64; price_version : Nat64; enabled : Bool };
  public type Order = { id : Text; payer_principal : Text; client_request_id : Text; target_canister_id : Principal; price_menu_id : Text; price_version : Nat64; gross_usd_cents : Nat64; net_usd_cents : Nat64; xdr_usd_rate_e8 : Nat64; rate_timestamp_sec : Nat64; cycles_amount : Text; stripe_payment_intent_id : Text; status : Text; last_error : ?Text; created_at_ns : Nat64; expires_at_ns : Nat64; updated_at_ns : Nat64 };
  public type CreateOrderResult = { order : Order; stripe_client_secret : Text };
  public type Config = { configured : Bool; service_canister : Text; hosted_checkout_url : Text; neutron_canister : Text; last_order_id : Text; last_order_status : Text; last_cycles_amount : Text; last_gross_usd_cents : Nat64; last_error : Text; backend_reserved : Bool; revision : Nat };
  public type MenuPage = { ok : Bool; error : Text; menus : [PriceMenu] };
  public type OrderView = { ok : Bool; error : Text; order_id : Text; client_secret : Text; status : Text; target_canister : Text; cycles_amount : Text; gross_usd_cents : Nat64; last_error : Text };
  public type AppBackendEnvironment = { stable_memory : { cycles_checkout : Memory.Mem }; capabilities : { backend_calls : NeutronCapabilities.BackendCallsV1 } };

  public class Init(env : AppBackendEnvironment) {
    let mem = env.stable_memory.cycles_checkout; let calls = env.capabilities.backend_calls;
    let METHODS = ["create_neutron_order", "list_neutron_price_menus", "get_neutron_order", "finalize_neutron_payment"];

    public func /*query*/cycles_checkout_config(/*caller*/ caller : Principal) : Config { authenticated(caller); ownerOrUnclaimed(caller); config() };
    public func /*update*/cycles_checkout_config_save(service_canister : Text, hosted_checkout_url : Text, /*caller*/ caller : Principal) : Config {
      authenticated(caller); ownerOrUnclaimed(caller);
      let service = Principal.fromText(service_canister);
      assert(service != Principal.anonymous() and service != calls.canister_principal);
      assert(Text.startsWith(hosted_checkout_url, #text "https://") and hosted_checkout_url.size() <= 500);
      mem.owner := ?caller; mem.service_canister := Principal.toText(service); mem.hosted_checkout_url := hosted_checkout_url; mem.revision += 1; config();
    };
    public func /*update*/cycles_price_menus(/*caller*/ caller : Principal) : async* MenuPage {
      authenticated(caller); owner(caller);
      let ?servicePrincipal = service() else return { ok = false; error = "Cycles service is not configured"; menus = [] };
      switch (await* remote(servicePrincipal, "list_neutron_price_menus", to_candid ())) {
        case (#err(error)) { { ok = false; error = error; menus = [] } };
        case (#ok(reply)) {
          switch (from_candid reply : ?[PriceMenu]) {
            case (?menus) { { ok = true; error = ""; menus = menus } };
            case (null) { { ok = false; error = "Invalid price menu response"; menus = [] } };
          }
        };
      };
    };
    public func /*update*/cycles_create_order(price_menu_id : Text, client_request_id : Text, /*caller*/ caller : Principal) : async* OrderView {
      authenticated(caller); owner(caller); if (price_menu_id.size() == 0 or client_request_id.size() == 0) return failure("Invalid order request");
      let ?servicePrincipal = service() else return failure("Cycles service is not configured");
      let result = await* remote(servicePrincipal, "create_neutron_order", to_candid ({ price_menu_id; client_request_id }));
      switch result { case (#err(error)) failure(error); case (#ok(reply)) switch (from_candid reply : ?{ #Ok : CreateOrderResult; #Err : RemoteError }) {
        case (?#Ok(created)) { remember(created.order); view(created.order, created.stripe_client_secret) };
        case (?#Err(error)) failure(remoteError(error)); case (null) failure("Invalid create order response");
      } };
    };
    public func /*update*/cycles_order_status(order_id : Text, /*caller*/ caller : Principal) : async* OrderView { authenticated(caller); owner(caller); await* orderCall("get_neutron_order", order_id) };
    public func /*update*/cycles_finalize_order(order_id : Text, /*caller*/ caller : Principal) : async* OrderView { authenticated(caller); owner(caller); await* orderCall("finalize_neutron_payment", order_id) };

    func orderCall(method : Text, order_id : Text) : async* OrderView {
      let ?servicePrincipal = service() else return failure("Cycles service is not configured");
      switch (await* remote(servicePrincipal, method, to_candid (order_id))) { case (#err(error)) failure(error); case (#ok(reply)) switch (from_candid reply : ?{ #Ok : Order; #Err : RemoteError }) { case (?#Ok(order)) { remember(order); view(order, "") }; case (?#Err(error)) failure(remoteError(error)); case (null) failure("Invalid order response") } };
    };
    func remote(service : Principal, method : Text, args : Blob) : async* { #ok : Blob; #err : Text } {
      if (not calls.can_call(service, method)) return #err("Reserve exact backend access to " # method # " first");
      switch (await* calls.call({ canister = service; method; args; cycles = 20_000_000 })) { case (#ok(reply)) #ok(reply); case (#err(error)) #err(error.code # ": " # error.message) };
    };
    func config() : Config { let reserved = switch (service()) { case (?servicePrincipal) { var ok = true; for (method in METHODS.vals()) if (not calls.can_call(servicePrincipal, method)) ok := false; ok }; case (null) false }; { configured = mem.service_canister != "" and mem.hosted_checkout_url != ""; service_canister = mem.service_canister; hosted_checkout_url = mem.hosted_checkout_url; neutron_canister = Principal.toText(calls.canister_principal); last_order_id = mem.last_order_id; last_order_status = mem.last_order_status; last_cycles_amount = mem.last_cycles_amount; last_gross_usd_cents = mem.last_gross_usd_cents; last_error = mem.last_error; backend_reserved = reserved; revision = mem.revision } };
    func service() : ?Principal { if (mem.service_canister == "") null else ?Principal.fromText(mem.service_canister) };
    func view(order : Order, client_secret : Text) : OrderView { { ok = true; error = ""; order_id = order.id; client_secret; status = order.status; target_canister = Principal.toText(order.target_canister_id); cycles_amount = order.cycles_amount; gross_usd_cents = order.gross_usd_cents; last_error = switch (order.last_error) { case (?value) value; case (null) "" } } };
    func remember(order : Order) { mem.last_order_id := order.id; mem.last_order_status := order.status; mem.last_cycles_amount := order.cycles_amount; mem.last_gross_usd_cents := order.gross_usd_cents; mem.last_error := switch (order.last_error) { case (?value) value; case (null) "" }; mem.revision += 1 };
    func failure(error : Text) : OrderView { { ok = false; error; order_id = ""; client_secret = ""; status = ""; target_canister = ""; cycles_amount = "0"; gross_usd_cents = 0; last_error = "" } };
    func remoteError(error : RemoteError) : Text { switch error { case (#Unauthorized) "Unauthorized"; case (#InvalidInput(v)) "InvalidInput: "#v; case (#NotFound(v)) "NotFound: "#v; case (#RateLimited(v)) "RateLimited: "#v; case (#RateUnavailable(v)) "RateUnavailable: "#v; case (#CapacityUnavailable(v)) "CapacityUnavailable: "#v; case (#StripeUnavailable(v)) "StripeUnavailable: "#v; case (#TopupFailed(v)) "TopupFailed: "#v; case (#DbError(v)) "DbError: "#v; case (#ExternalError(v)) "ExternalError: "#v } };
    func authenticated(caller : Principal) { assert(not Principal.isAnonymous(caller)) }; func owner(caller : Principal) { assert(mem.owner == ?caller) }; func ownerOrUnclaimed(caller : Principal) { switch (mem.owner) { case (?value) assert(value == caller); case (null) {} } };
  };
/*---NEUTRON GENERATED BEGIN---*/

public type cycles_checkout_config_Input = ();
public type cycles_checkout_config_Output = Config;

public type cycles_checkout_config_save_Input = (service_canister : Text, hosted_checkout_url : Text);
public type cycles_checkout_config_save_Output = Config;

public type cycles_price_menus_Input = ();
public type cycles_price_menus_Output = MenuPage;

public type cycles_create_order_Input = (price_menu_id : Text, client_request_id : Text);
public type cycles_create_order_Output = OrderView;

public type cycles_order_status_Input = (order_id : Text);
public type cycles_order_status_Output = OrderView;

public type cycles_finalize_order_Input = (order_id : Text);
public type cycles_finalize_order_Output = OrderView;

/*---NEUTRON GENERATED END---*/
}
