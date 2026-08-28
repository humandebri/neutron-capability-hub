import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Memory "./memory/x402_guard/v1";
module {
  public type Policy = { demo_example_enabled : Bool; max_amount_atomic : Text; revision : Nat };
  public type AppBackendEnvironment = { stable_memory : { x402_guard : Memory.Mem } };
  public class Init(env : AppBackendEnvironment) {
    let mem = env.stable_memory.x402_guard;
    public func /*query*/x402_policy_status(/*caller*/ caller : Principal) : Policy { authenticated(caller); ownerOrUnclaimed(caller); policy() };
    public func /*update*/x402_policy_save(enabled : Bool, max_amount_atomic : Text, /*caller*/ caller : Principal) : Policy {
      authenticated(caller); ownerOrUnclaimed(caller);
      if (not decimal(max_amount_atomic) or max_amount_atomic.size() > 40) return policy();
      mem.owner := ?caller; mem.demo_example_enabled := enabled; mem.max_amount_atomic := max_amount_atomic; mem.revision += 1; policy();
    };
    func policy() : Policy { { demo_example_enabled = mem.demo_example_enabled; max_amount_atomic = mem.max_amount_atomic; revision = mem.revision } };
    func authenticated(caller : Principal) { assert(not Principal.isAnonymous(caller)) };
    func ownerOrUnclaimed(caller : Principal) { switch (mem.owner) { case (?owner) assert(owner == caller); case (null) {} } };
    func decimal(value : Text) : Bool { if (value.size() == 0) return false; for (char in value.chars()) if (char < '0' or char > '9') return false; true };
  };
/*---NEUTRON GENERATED BEGIN---*/

public type x402_policy_status_Input = ();
public type x402_policy_status_Output = Policy;

public type x402_policy_save_Input = (enabled : Bool, max_amount_atomic : Text);
public type x402_policy_save_Output = Policy;

/*---NEUTRON GENERATED END---*/
}
