import { createRoot } from "react-dom/client";
import { TrustConsoleView } from "../../apps/trust_console/src/view.tsx";
import type { Section, TrustConsoleActions, TrustConsoleModel } from "../../apps/trust_console/src/model.ts";
import "../../apps/trust_console/src/style.scss";

const now = "1787900000000000000";
const model: TrustConsoleModel = {
  demo: true,
  connection: { connected: false, label: "", tokenSuffix: "", connectedAt: "0", revision: "0" },
  policies: [{ id:"1",consumerAppId:"judge_demo",owner:"neutron-demo",repo:"capability-sandbox",allowIssueRead:true,allowIssueCreate:true,enabled:true,revision:"3",createdAt:now,updatedAt:now },{ id:"2",consumerAppId:"agent_runner",owner:"acme",repo:"launchpad",allowIssueRead:true,allowIssueCreate:true,enabled:true,revision:"1",createdAt:now,updatedAt:now }],
  jobs: [
    {id:"1",jobUid:"1c4b9708-7e26-4c39-90b4-58f04719950a",consumerAppId:"judge_demo",operation:"issue_create",owner:"neutron-demo",repo:"capability-sandbox",issueNumber:"0",title:"Review a scoped capability request",body:"Simulation only. No GitHub API request is sent.",clientRequestId:"demo-1",status:"succeeded",leaseId:"",leasedAt:"0",attemptCount:"1",externalSendStarted:true,resultSummary:"Simulation reconciled; no GitHub write was sent.",externalUrl:"",externalNumber:"0",errorCode:"",createdAt:now,updatedAt:now},
    {id:"2",jobUid:"8a9d0f91-a566-40ae-ae31-5b8cdd4fb1e2",consumerAppId:"agent_runner",operation:"issue_create",owner:"acme",repo:"launchpad",issueNumber:"0",title:"Verify checkout evidence",body:"",clientRequestId:"demo-2",status:"pending",leaseId:"",leasedAt:"0",attemptCount:"0",externalSendStarted:false,resultSummary:"",externalUrl:"",externalNumber:"0",errorCode:"",createdAt:now,updatedAt:now},
    {id:"3",jobUid:"c459ed16-a3e2-4d80-9bd0-577386882bab",consumerAppId:"research_agent",operation:"issue_create",owner:"acme",repo:"docs",issueNumber:"0",title:"Document uncertain result",body:"",clientRequestId:"demo-3",status:"outcome_unknown",leaseId:"",leasedAt:"0",attemptCount:"1",externalSendStarted:true,resultSummary:"External result requires owner review",externalUrl:"",externalNumber:"0",errorCode:"network_after_send",createdAt:now,updatedAt:now}
  ],
  tasks: [{id:"1",revision:"2",title:"Prepare qualifier release",status:"open",sourceKind:"github_issue",sourceOwner:"acme",sourceRepo:"launchpad",sourceIssueNumber:"42",sourceUrl:"https://github.example/acme/launchpad/issues/42",clientRequestId:"task-1",createdAt:now,updatedAt:now},{id:"2",revision:"4",title:"Verify CycleMint receipt",status:"completed",sourceKind:"manual",sourceOwner:"",sourceRepo:"",sourceIssueNumber:"0",sourceUrl:"",clientRequestId:"task-2",createdAt:now,updatedAt:now}],
  cycles: {configured:true,serviceCanister:"m7sm4-2iaaa-aaaam-adx5a-cai",hostedCheckoutUrl:"https://checkout.example",neutronCanister:"aaaaa-aa",lastOrderId:"cm_01J8",lastOrderStatus:"topped_up",lastCyclesAmount:"500000000000",lastGrossUsdCents:"500",lastError:"",backendReserved:true,revision:"7"},
  menus:[{id:"starter",label:"Starter top-up",grossUsdCents:"500",netUsdCents:"450",enabled:true,priceVersion:"2"},{id:"builder",label:"Builder top-up",grossUsdCents:"1500",netUsdCents:"1400",enabled:true,priceVersion:"2"}],
  order:{orderId:"cm_01J8",clientSecret:"",status:"topped_up",targetCanister:"aaaaa-aa",cyclesAmount:"500000000000",grossUsdCents:"500",lastError:""}
};
function section():Section{const value=location.hash.slice(1) as Section;return ["overview","github","tasks","cyclemint"].includes(value)?value:"overview"}
const noop=async()=>{}; const actions:TrustConsoleActions={navigate(next){location.hash=next;location.reload()},connectGitHub:noop,saveGitHubPolicy:noop,createTask:noop,completeTask:noop,configureCycleMint:noop,refreshMenus:noop,createCycleOrder:noop,runGitHubDemo:noop};
const root=document.getElementById("root");if(!root)throw new Error("root missing");createRoot(root).render(<TrustConsoleView model={model} section={section()} actions={actions}/>);
