import Memory "./memory/capability_hub/v1";
module {
  public type AppBackendEnvironment = { stable_memory : { capability_hub : Memory.Mem } };
  public class Init(_env : AppBackendEnvironment) {};
/*---NEUTRON GENERATED BEGIN---*/

/*---NEUTRON GENERATED END---*/
}
