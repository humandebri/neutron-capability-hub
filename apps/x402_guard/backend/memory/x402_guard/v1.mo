// Persistent schema: keep this file immutable after release.
module {
  public type Mem = { var owner : ?Principal; var demo_example_enabled : Bool; var max_amount_atomic : Text; var revision : Nat };
  public func init() : Mem { { var owner = null; var demo_example_enabled = false; var max_amount_atomic = "1000000"; var revision = 0 } };
};
